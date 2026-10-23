import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
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

export async function GET() {
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

  const outlets = await prisma.outlet.findMany({
    where: {
      businessId: membership.businessId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: 'asc' },
  });

  const operationalDate = getOperationalDateWIB();

  const dailyCashRecords = await prisma.dailyCash.findMany({
    where: {
      businessId: membership.businessId,
      operationalDate,
    },
    select: {
      id: true,
      outletId: true,
      operationalDate: true,
      openingBalance: true,
      expectedClosingBalance: true,
      actualClosingBalance: true,
      status: true,
      openedAt: true,
      closedAt: true,
    },
  });

  const cashByOutlet = new Map(
    dailyCashRecords.map((cash) => [cash.outletId, cash]),
  );

  return NextResponse.json({
    operationalDate: operationalDate.toISOString().slice(0, 10),
    outlets: outlets.map((outlet) => {
      const cash = cashByOutlet.get(outlet.id);

      return {
        ...outlet,
        dailyCash: cash
          ? {
              id: cash.id,
              openingBalance: cash.openingBalance.toString(),
              expectedClosingBalance:
                cash.expectedClosingBalance?.toString() ?? null,
              actualClosingBalance:
                cash.actualClosingBalance?.toString() ?? null,
              status: cash.status,
              openedAt: cash.openedAt,
              closedAt: cash.closedAt,
            }
          : null,
      };
    }),
  });
}
