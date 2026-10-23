import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

function getDateWIB(value: string): Date | null {
  // Validasi format tanggal YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  // Validasi tanggal kalender menggunakan UTC agar tidak
  // tercampur dengan perbedaan zona waktu WIB.
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  // Kembalikan awal hari dalam zona waktu WIB (UTC+7).
  return new Date(`${value}T00:00:00.000+07:00`);
}

export async function GET(request: Request) {
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
      { error: 'Laporan ini hanya tersedia untuk Owner aktif.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const outletId = searchParams.get('outletId');

  if (fromParam === null || toParam === null) {
    return NextResponse.json(
      { error: 'Tanggal awal dan tanggal akhir wajib diisi.' },
      { status: 400 },
    );
  }

  const fromDate = getDateWIB(fromParam);
  const toDate = getDateWIB(toParam);

  if (!fromDate || !toDate || fromDate.getTime() > toDate.getTime()) {
    return NextResponse.json(
      { error: 'Rentang tanggal tidak valid.' },
      { status: 400 },
    );
  }

  const endExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);

  if (outletId) {
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
  }

  const saleWhere = {
    businessId: membership.businessId,
    status: 'ACTIVE' as const,
    soldAt: {
      gte: fromDate,
      lt: endExclusive,
    },
    ...(outletId ? { outletId } : {}),
  };

  const [sales, items, outlets, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      select: {
        id: true,
        totalAmount: true,
        soldAt: true,
      },
      orderBy: { soldAt: 'asc' },
    }),

    prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      select: {
        productNameSnapshot: true,
        quantity: true,
        lineTotal: true,
        hppSnapshot: true,
        sale: {
          select: {
            soldAt: true,
          },
        },
      },
    }),

    prisma.outlet.findMany({
      where: {
        businessId: membership.businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    }),

    prisma.expense.findMany({
      where: {
        businessId: membership.businessId,
        expenseAt: {
          gte: fromDate,
          lt: endExclusive,
        },
        ...(outletId ? { outletId } : {}),
      },
      select: {
        category: true,
        amount: true,
      },
    }),
  ]);

  let totalOperatingExpenses = 0;
  let ownerWithdrawals = 0;

  const expensesByCategory = new Map<
    string,
    { amount: number; count: number }
  >();

  for (const expense of expenses) {
    const amount = Number(expense.amount.toString());

    const category = expensesByCategory.get(expense.category) ?? {
      amount: 0,
      count: 0,
    };

    category.amount += amount;
    category.count += 1;
    expensesByCategory.set(expense.category, category);

    if (expense.category === 'OWNER_WITHDRAWAL') {
      ownerWithdrawals += amount;
    } else {
      totalOperatingExpenses += amount;
    }
  }

  let revenue = 0;
  const dailyMap = new Map<string, number>();

  for (const sale of sales) {
    const amount = Number(sale.totalAmount.toString());
    revenue += amount;

    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(sale.soldAt);

    dailyMap.set(day, (dailyMap.get(day) ?? 0) + amount);
  }

  let grossProfit = 0;
  let missingHppItems = 0;
  const productMap = new Map<string, { quantity: number; revenue: number }>();

  for (const item of items) {
    const quantity = Number(item.quantity.toString());
    const lineRevenue = Number(item.lineTotal.toString());

    const product = productMap.get(item.productNameSnapshot) ?? {
      quantity: 0,
      revenue: 0,
    };

    product.quantity += quantity;
    product.revenue += lineRevenue;
    productMap.set(item.productNameSnapshot, product);

    if (item.hppSnapshot === null) {
      missingHppItems++;
    } else {
      grossProfit +=
        lineRevenue - Number(item.hppSnapshot.toString()) * quantity;
    }
  }

  const dailySales: { date: string; revenue: number }[] = [];

  for (
    let dayOffset = 0;
    dayOffset <=
    Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    dayOffset++
  ) {
    const cursor = new Date(
      fromDate.getTime() + dayOffset * 24 * 60 * 60 * 1000,
    );

    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(cursor);

    dailySales.push({
      date,
      revenue: dailyMap.get(date) ?? 0,
    });
  }

  const bestSellingProducts = [...productMap.entries()]
    .map(([name, value]) => ({
      name,
      quantity: value.quantity,
      revenue: value.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return NextResponse.json({
    period: {
      from: fromParam,
      to: toParam,
    },
    summary: {
      revenue,
      transactionCount: sales.length,
      grossProfit,
      totalOperatingExpenses,
      estimatedNetProfit: grossProfit - totalOperatingExpenses,
      ownerWithdrawals,
      missingHppItems,
    },
    expenseBreakdown: [...expensesByCategory.entries()].map(
      ([category, value]) => ({
        category,
        amount: value.amount,
        count: value.count,
      }),
    ),
    dailySales,
    bestSellingProducts,
    outlets,
  });
}
