import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';
import { connection } from 'next/server';

export async function GET() {
  await connection();
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { message: 'Silakan login terlebih dahulu.' },
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
      select: { businessId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { message: 'Akses Owner tidak ditemukan.' },
        { status: 403 },
      );
    }

    const [inventories, movements] = await Promise.all([
      prisma.inventory.findMany({
        where: {
          businessId: membership.businessId,
          product: { isActive: true },
          outlet: { isActive: true },
        },
        orderBy: { product: { name: 'asc' } },
        select: {
          id: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
          outlet: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.stockMovement.findMany({
        where: {
          inventory: {
            businessId: membership.businessId,
            product: { isActive: true },
            outlet: { isActive: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          type: true,
          quantity: true,
          note: true,
          createdAt: true,
          inventory: {
            select: {
              product: { select: { name: true, unit: true } },
              outlet: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: { inventories, movements },
    });
  } catch (error) {
    console.error('GET /api/inventory:', error);

    return NextResponse.json(
      { message: 'Gagal mengambil data inventaris.' },
      { status: 500 },
    );
  }
}
