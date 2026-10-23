import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

function getOperationalDateWIB() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return new Date(`${date}T00:00:00.000Z`);
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Silakan login terlebih dahulu.' },
        { status: 401 },
      );
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        role: 'OWNER',
        isActive: true,
        business: { isActive: true },
      },
      select: { id: true, businessId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Akses khusus Owner aktif.' },
        { status: 403 },
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
        openingBalance: true,
        status: true,
        openedAt: true,
      },
    });

    if (!dailyCash || dailyCash.businessId !== membership.businessId) {
      return NextResponse.json(
        { error: 'Sesi kas hari ini tidak ditemukan.' },
        { status: 404 },
      );
    }

    if (dailyCash.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Kas sudah ditutup.' },
        { status: 409 },
      );
    }

    const [sales, expenses, movements] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          dailyCashId: dailyCash.id,
          businessId: membership.businessId,
          outletId,
          status: 'ACTIVE',
          paymentMethod: 'CASH',
        },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: {
          dailyCashId: dailyCash.id,
          businessId: membership.businessId,
          outletId,
          paymentMethod: 'CASH',
        },
        _sum: { amount: true },
      }),
      prisma.cashMovement.findMany({
        where: {
          dailyCashId: dailyCash.id,
          businessId: membership.businessId,
          outletId,
        },
        select: {
          type: true,
          amount: true,
        },
      }),
    ]);

    const openingBalance = Number(dailyCash.openingBalance.toString());
    const cashSales = Number(sales._sum.totalAmount?.toString() ?? '0');
    const cashExpenses = Number(expenses._sum.amount?.toString() ?? '0');

    let cashIn = 0;
    let cashOut = 0;

    for (const movement of movements) {
      const amount = Number(movement.amount.toString());

      if (movement.type === 'CASH_IN') cashIn += amount;
      if (movement.type === 'CASH_OUT') cashOut += amount;
    }

    const expectedClosingBalance = Number(
      (openingBalance + cashSales - cashExpenses + cashIn - cashOut).toFixed(2),
    );

    return NextResponse.json({
      data: {
        dailyCashId: dailyCash.id,
        openingBalance,
        cashSales,
        cashExpenses,
        cashIn,
        cashOut,
        expectedClosingBalance,
      },
    });
  } catch (error) {
    console.error('GET /api/daily-cash/close:', error);

    return NextResponse.json(
      { error: 'Gagal menghitung pratinjau saldo kas.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Silakan login terlebih dahulu.' },
        { status: 401 },
      );
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
      return NextResponse.json(
        { error: 'Akses khusus Owner aktif.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const outletId = typeof body.outletId === 'string' ? body.outletId : '';
    const actualClosingBalance = Number(body.actualClosingBalance);

    if (!outletId) {
      return NextResponse.json(
        { error: 'Outlet wajib dipilih.' },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(actualClosingBalance) ||
      actualClosingBalance < 0 ||
      Math.round(actualClosingBalance * 100) !== actualClosingBalance * 100
    ) {
      return NextResponse.json(
        {
          error:
            'Saldo aktual harus berupa angka nol atau lebih, maksimal dua desimal.',
        },
        { status: 400 },
      );
    }

    const operationalDate = getOperationalDateWIB();

    const result = await prisma.$transaction(
      async (tx) => {
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
            openingBalance: true,
            status: true,
          },
        });

        if (!dailyCash || dailyCash.businessId !== membership.businessId) {
          throw new Error('DAILY_CASH_NOT_FOUND');
        }

        if (dailyCash.status !== 'OPEN') {
          throw new Error('DAILY_CASH_ALREADY_CLOSED');
        }

        const [sales, expenses, movements] = await Promise.all([
          tx.sale.aggregate({
            where: {
              dailyCashId: dailyCash.id,
              businessId: membership.businessId,
              outletId,
              status: 'ACTIVE',
              paymentMethod: 'CASH',
            },
            _sum: { totalAmount: true },
          }),
          tx.expense.aggregate({
            where: {
              dailyCashId: dailyCash.id,
              businessId: membership.businessId,
              outletId,
              paymentMethod: 'CASH',
            },
            _sum: { amount: true },
          }),
          tx.cashMovement.findMany({
            where: {
              dailyCashId: dailyCash.id,
              businessId: membership.businessId,
              outletId,
            },
            select: {
              type: true,
              amount: true,
            },
          }),
        ]);

        const openingBalance = Number(dailyCash.openingBalance.toString());
        const cashSales = Number(sales._sum.totalAmount?.toString() ?? '0');
        const cashExpenses = Number(expenses._sum.amount?.toString() ?? '0');

        let cashIn = 0;
        let cashOut = 0;

        for (const movement of movements) {
          const amount = Number(movement.amount.toString());

          if (movement.type === 'CASH_IN') {
            cashIn += amount;
          } else if (movement.type === 'CASH_OUT') {
            cashOut += amount;
          }
        }

        const expectedClosingBalance = Number(
          (
            openingBalance +
            cashSales -
            cashExpenses +
            cashIn -
            cashOut
          ).toFixed(2),
        );

        const difference = Number(
          (actualClosingBalance - expectedClosingBalance).toFixed(2),
        );

        const closedAt = new Date();

        const updated = await tx.dailyCash.updateMany({
          where: {
            id: dailyCash.id,
            businessId: membership.businessId,
            status: 'OPEN',
          },
          data: {
            expectedClosingBalance: new Prisma.Decimal(
              expectedClosingBalance.toFixed(2),
            ),
            actualClosingBalance: new Prisma.Decimal(
              actualClosingBalance.toFixed(2),
            ),
            status: 'CLOSED',
            closedById: membership.id,
            closedAt,
          },
        });

        if (updated.count !== 1) {
          throw new Error('DAILY_CASH_ALREADY_CLOSED');
        }

        return {
          dailyCashId: dailyCash.id,
          operationalDate: operationalDate.toISOString().slice(0, 10),
          openingBalance,
          cashSales,
          cashExpenses,
          cashIn,
          cashOut,
          expectedClosingBalance,
          actualClosingBalance,
          difference,
          status: 'CLOSED',
          closedAt,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json({
      message: 'Kas harian berhasil ditutup.',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DAILY_CASH_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Sesi kas hari ini tidak ditemukan untuk outlet tersebut.' },
          { status: 404 },
        );
      }

      if (error.message === 'DAILY_CASH_ALREADY_CLOSED') {
        return NextResponse.json(
          { error: 'Kas sudah ditutup atau sedang diproses.' },
          { status: 409 },
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        {
          error:
            'Terjadi transaksi bersamaan. Silakan muat ulang dan periksa status kas.',
        },
        { status: 409 },
      );
    }

    console.error('POST /api/daily-cash/close:', error);

    return NextResponse.json(
      { error: 'Gagal menutup kas harian.' },
      { status: 500 },
    );
  }
}
