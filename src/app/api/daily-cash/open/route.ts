import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

function getOperationalDateWIB() {
  const jakartaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return new Date(`${jakartaDate}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu.' },
      { status: 401 },
    );
  }

  let body: { outletId?: string; openingBalance?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Format request tidak valid.' },
      { status: 400 },
    );
  }

  const { outletId, openingBalance } = body;

  if (
    typeof outletId !== 'string' ||
    !outletId.trim() ||
    typeof openingBalance !== 'number' ||
    !Number.isFinite(openingBalance) ||
    openingBalance < 0 ||
    openingBalance > 999999999999 ||
    Math.round(openingBalance * 100) !== openingBalance * 100
  ) {
    return NextResponse.json(
      { error: 'Outlet atau modal awal kas tidak valid.' },
      { status: 400 },
    );
  }

  try {
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
      return NextResponse.json(
        { error: 'Akses khusus Owner aktif.' },
        { status: 403 },
      );
    }

    const outlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        businessId: membership.businessId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!outlet) {
      return NextResponse.json(
        { error: 'Outlet tidak ditemukan atau tidak aktif.' },
        { status: 404 },
      );
    }

    const operationalDate = getOperationalDateWIB();

    const dailyCash = await prisma.dailyCash.create({
      data: {
        businessId: membership.businessId,
        outletId: outlet.id,
        operationalDate,
        openingBalance: new Prisma.Decimal(openingBalance),
        status: 'OPEN',
        openedById: membership.id,
      },
    });

    return NextResponse.json(
      {
        message: 'Kas harian berhasil dibuka.',
        dailyCash: {
          id: dailyCash.id,
          outletId: dailyCash.outletId,
          operationalDate: operationalDate.toISOString().slice(0, 10),
          openingBalance: dailyCash.openingBalance.toString(),
          status: dailyCash.status,
          openedAt: dailyCash.openedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          error:
            'Kas untuk outlet ini sudah dibuka pada tanggal operasional hari ini.',
        },
        { status: 409 },
      );
    }

    console.error('Open daily cash error:', error);

    return NextResponse.json(
      { error: 'Gagal membuka kas harian.' },
      { status: 500 },
    );
  }
}
