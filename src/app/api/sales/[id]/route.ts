import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu.' },
      { status: 401 },
    );
  }

  const { id } = await params;

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      business: { isActive: true },
    },
    select: {
      id: true,
      businessId: true,
      role: true,
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: 'Membership aktif tidak ditemukan.' },
      { status: 403 },
    );
  }

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      businessId: membership.businessId,
      ...(membership.role === 'OWNER'
        ? {}
        : {
            outlet: {
              assignments: {
                some: {
                  membershipId: membership.id,
                  isActive: true,
                },
              },
            },
          }),
    },
    select: {
      id: true,
      transactionNumber: true,
      paymentMethod: true,
      totalAmount: true,
      status: true,
      soldAt: true,
      voidedAt: true,
      outlet: {
        select: {
          name: true,
        },
      },
      cashier: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          quantity: true,
          unitPrice: true,
          hppSnapshot: true,
          lineTotal: true,
        },
      },
    },
  });

  if (!sale) {
    return NextResponse.json(
      { error: 'Transaksi tidak ditemukan.' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...sale,
      totalAmount: sale.totalAmount.toString(),
      items: sale.items.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        hppSnapshot: item.hppSnapshot?.toString() ?? null,
        lineTotal: item.lineTotal.toString(),
      })),
    },
  });
}
