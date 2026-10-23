import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

const MOVEMENT_TYPES = ['CASH_IN', 'CASH_OUT'] as const;

function getOperationalDateWIB() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return new Date(`${date}T00:00:00.000Z`);
}

async function getOwnerMembership() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      error: 'Silakan login terlebih dahulu.',
      status: 401 as const,
    };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      role: 'OWNER',
      isActive: true,
      business: { isActive: true },
    },
    select: {
      id: true,
      businessId: true,
    },
  });

  if (!membership) {
    return {
      error: 'Fitur ini hanya tersedia untuk Owner aktif.',
      status: 403 as const,
    };
  }

  return { membership };
}

export async function GET(request: Request) {
  try {
    const owner = await getOwnerMembership();

    if ('error' in owner) {
      return NextResponse.json(
        { error: owner.error },
        { status: owner.status },
      );
    }

    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outletId');

    if (!outletId) {
      return NextResponse.json(
        { error: 'Outlet wajib dipilih.' },
        { status: 400 },
      );
    }

    const operationalDate = getOperationalDateWIB();

    const dailyCash = await prisma.dailyCash.findUnique({
      where: {
        outletId_operationalDate: {
          outletId,
          operationalDate,
        },
      },
      select: {
        id: true,
        businessId: true,
      },
    });

    if (!dailyCash || dailyCash.businessId !== owner.membership.businessId) {
      return NextResponse.json(
        { error: 'Sesi kas hari ini tidak ditemukan.' },
        { status: 404 },
      );
    }

    const movements = await prisma.cashMovement.findMany({
      where: {
        dailyCashId: dailyCash.id,
        businessId: owner.membership.businessId,
        outletId,
      },
      include: {
        recordedBy: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      movements: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        category: movement.category,
        amount: Number(movement.amount.toString()),
        description: movement.description,
        createdAt: movement.createdAt,
        recordedBy: movement.recordedBy.user.name,
      })),
    });
  } catch (error) {
    console.error('GET /api/cash-movements:', error);

    return NextResponse.json(
      { error: 'Gagal mengambil riwayat pergerakan kas.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner = await getOwnerMembership();

    if ('error' in owner) {
      return NextResponse.json(
        { error: owner.error },
        { status: owner.status },
      );
    }

    const body = await request.json();

    const outletId = typeof body.outletId === 'string' ? body.outletId : '';
    const type = typeof body.type === 'string' ? body.type : '';
    const category =
      typeof body.category === 'string' ? body.category.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const amount = Number(body.amount);

    if (!outletId) {
      return NextResponse.json(
        { error: 'Outlet wajib dipilih.' },
        { status: 400 },
      );
    }

    if (!MOVEMENT_TYPES.includes(type as (typeof MOVEMENT_TYPES)[number])) {
      return NextResponse.json(
        { error: 'Jenis pergerakan kas tidak valid.' },
        { status: 400 },
      );
    }

    if (!category || category.length > 100) {
      return NextResponse.json(
        { error: 'Kategori wajib diisi, maksimal 100 karakter.' },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return NextResponse.json(
        { error: 'Nominal harus lebih dari nol dan maksimal dua desimal.' },
        { status: 400 },
      );
    }

    if (description.length > 500) {
      return NextResponse.json(
        { error: 'Keterangan maksimal 500 karakter.' },
        { status: 400 },
      );
    }

    const operationalDate = getOperationalDateWIB();

    const movement = await prisma.$transaction(async (tx) => {
      const dailyCash = await tx.dailyCash.findUnique({
        where: {
          outletId_operationalDate: {
            outletId,
            operationalDate,
          },
        },
        select: {
          id: true,
          businessId: true,
          status: true,
        },
      });

      if (!dailyCash || dailyCash.businessId !== owner.membership.businessId) {
        throw new Error('DAILY_CASH_NOT_FOUND');
      }

      if (dailyCash.status !== 'OPEN') {
        throw new Error('DAILY_CASH_CLOSED');
      }

      return tx.cashMovement.create({
        data: {
          businessId: owner.membership.businessId,
          outletId,
          dailyCashId: dailyCash.id,
          recordedById: owner.membership.id,
          type: type as (typeof MOVEMENT_TYPES)[number],
          category,
          amount,
          description: description || null,
        },
        select: {
          id: true,
          type: true,
          category: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      });
    });

    return NextResponse.json(
      {
        message: 'Pergerakan kas berhasil dicatat.',
        movement: {
          ...movement,
          amount: Number(movement.amount.toString()),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DAILY_CASH_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Buka kas harian terlebih dahulu.' },
          { status: 409 },
        );
      }

      if (error.message === 'DAILY_CASH_CLOSED') {
        return NextResponse.json(
          { error: 'Kas sudah ditutup. Pergerakan baru tidak dapat dicatat.' },
          { status: 409 },
        );
      }
    }

    console.error('POST /api/cash-movements:', error);

    return NextResponse.json(
      { error: 'Gagal mencatat pergerakan kas.' },
      { status: 500 },
    );
  }
}
