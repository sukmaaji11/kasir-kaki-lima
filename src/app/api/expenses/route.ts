import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

const EXPENSE_CATEGORIES = [
  'MATERIAL_PURCHASE',
  'OPERATING',
  'OWNER_WITHDRAWAL',
  'OTHER',
] as const;

const PAYMENT_METHODS = ['CASH', 'QRIS', 'TRANSFER'] as const;

function getDateWIB(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return new Date(`${value}T00:00:00.000+07:00`);
}

async function getOwnerMembership() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { error: 'Silakan login terlebih dahulu.', status: 401 as const };
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
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const outletId = searchParams.get('outletId');
    const category = searchParams.get('category');

    const where: {
      businessId: string;
      outletId?: string;
      category?: (typeof EXPENSE_CATEGORIES)[number];
      expenseAt?: { gte: Date; lt: Date };
    } = {
      businessId: owner.membership.businessId,
    };

    if (outletId) where.outletId = outletId;

    if (category) {
      if (
        !EXPENSE_CATEGORIES.includes(
          category as (typeof EXPENSE_CATEGORIES)[number],
        )
      ) {
        return NextResponse.json(
          { error: 'Kategori pengeluaran tidak valid.' },
          { status: 400 },
        );
      }

      where.category = category as (typeof EXPENSE_CATEGORIES)[number];
    }

    if (from || to) {
      const fromDate = from ? getDateWIB(from) : null;
      const toDate = to ? getDateWIB(to) : null;

      if (
        (from && !fromDate) ||
        (to && !toDate) ||
        (fromDate && toDate && fromDate > toDate)
      ) {
        return NextResponse.json(
          { error: 'Rentang tanggal tidak valid.' },
          { status: 400 },
        );
      }

      const expenseAt: { gte?: Date; lt?: Date } = {};

      if (fromDate) expenseAt.gte = fromDate;
      if (toDate) {
        expenseAt.lt = new Date(toDate.getTime() + 86400000);
      }

      where.expenseAt = expenseAt as { gte: Date; lt: Date };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true } },
        recordedBy: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { expenseAt: 'desc' },
      take: 200,
    });

    const totalAmount = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount.toString()),
      0,
    );

    return NextResponse.json({
      expenses: expenses.map((expense) => ({
        id: expense.id,
        outletId: expense.outletId,
        outletName: expense.outlet.name,
        category: expense.category,
        amount: Number(expense.amount.toString()),
        paymentMethod: expense.paymentMethod,
        description: expense.description,
        expenseAt: expense.expenseAt,
        recordedBy: expense.recordedBy.user.name,
        createdAt: expense.createdAt,
      })),
      totalAmount,
    });
  } catch (error) {
    console.error('GET /api/expenses:', error);

    return NextResponse.json(
      { error: 'Gagal mengambil data pengeluaran.' },
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
    const category = typeof body.category === 'string' ? body.category : '';
    const paymentMethod =
      typeof body.paymentMethod === 'string' ? body.paymentMethod : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const amount = Number(body.amount);

    if (!outletId) {
      return NextResponse.json(
        { error: 'Outlet wajib dipilih.' },
        { status: 400 },
      );
    }

    if (
      !EXPENSE_CATEGORIES.includes(
        category as (typeof EXPENSE_CATEGORIES)[number],
      )
    ) {
      return NextResponse.json(
        { error: 'Kategori pengeluaran tidak valid.' },
        { status: 400 },
      );
    }

    if (
      !PAYMENT_METHODS.includes(
        paymentMethod as (typeof PAYMENT_METHODS)[number],
      )
    ) {
      return NextResponse.json(
        { error: 'Metode pembayaran tidak valid.' },
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

    const expenseDate =
      typeof body.expenseDate === 'string' && body.expenseDate
        ? getDateWIB(body.expenseDate)
        : new Date();

    if (!expenseDate) {
      return NextResponse.json(
        { error: 'Tanggal pengeluaran tidak valid.' },
        { status: 400 },
      );
    }

    const outlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        businessId: owner.membership.businessId,
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

    const expense = await prisma.$transaction(async (tx) => {
      const now = new Date();

      const jakartaDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      const operationalDate = new Date(`${jakartaDate}T00:00:00.000Z`);

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
          outletId: true,
          status: true,
          openedAt: true,
        },
      });

      if (!dailyCash || dailyCash.businessId !== owner.membership.businessId) {
        throw new Error('DAILY_CASH_NOT_FOUND');
      }

      if (dailyCash.status !== 'OPEN') {
        throw new Error('DAILY_CASH_CLOSED');
      }

      const created = await tx.expense.create({
        data: {
          businessId: owner.membership.businessId,
          outletId,
          dailyCashId: dailyCash.id,
          recordedById: owner.membership.id,
          category: category as (typeof EXPENSE_CATEGORIES)[number],
          amount,
          paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number],
          description: description || null,
          expenseAt: expenseDate,
        },
        select: {
          id: true,
          category: true,
          amount: true,
          paymentMethod: true,
          description: true,
          expenseAt: true,
          outlet: { select: { name: true } },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        message: 'Pengeluaran berhasil dicatat.',
        expense: {
          ...expense,
          amount: Number(expense.amount.toString()),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'DAILY_CASH_NOT_FOUND') {
      return NextResponse.json(
        {
          error:
            'Buka kas harian terlebih dahulu sebelum mencatat pengeluaran.',
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === 'DAILY_CASH_CLOSED') {
      return NextResponse.json(
        {
          error:
            'Kas harian sudah ditutup. Pengeluaran tidak dapat ditambahkan.',
        },
        { status: 409 },
      );
    }

    console.error('POST /api/expenses:', error);

    return NextResponse.json(
      { error: 'Gagal menyimpan pengeluaran.' },
      { status: 500 },
    );
  }
}
