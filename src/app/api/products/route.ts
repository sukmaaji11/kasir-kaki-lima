import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

async function getOwnerBusiness(userId: string) {
  return prisma.membership.findFirst({
    where: {
      userId,
      role: 'OWNER',
      isActive: true,
      business: { isActive: true },
    },
    select: { id: true, businessId: true },
  });
}

export async function GET(request: Request) {
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

    const membership = await getOwnerBusiness(session.user.id);

    if (!membership) {
      return NextResponse.json(
        { message: 'Akses Owner tidak ditemukan.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outletId');

    const products = await prisma.product.findMany({
      where: {
        businessId: membership.businessId,
        ...(outletId ? { outletId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        unit: true,
        sellingPrice: true,
        hpp: true,
        isActive: true,
        category: {
          select: { id: true, name: true },
        },
        outlet: {
          select: { id: true, name: true },
        },
        inventories: {
          select: { quantity: true },
        },
        createdAt: true,
      },
    });

    return NextResponse.json({ data: products });
  } catch (error) {
    console.error('GET /api/products:', error);

    return NextResponse.json(
      { message: 'Gagal mengambil produk.' },
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
        { message: 'Silakan login terlebih dahulu.' },
        { status: 401 },
      );
    }

    const membership = await getOwnerBusiness(session.user.id);

    if (!membership) {
      return NextResponse.json(
        { message: 'Akses Owner tidak ditemukan.' },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { message: 'Data produk tidak valid.' },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const outletId = typeof data.outletId === 'string' ? data.outletId : '';
    const categoryId =
      typeof data.categoryId === 'string' && data.categoryId.trim()
        ? data.categoryId
        : null;
    const unit = typeof data.unit === 'string' ? data.unit : 'PCS';

    if (!name || name.length > 120 || !outletId) {
      return NextResponse.json(
        { message: 'Nama produk dan outlet wajib diisi.' },
        { status: 400 },
      );
    }

    const allowedUnits = [
      'PCS',
      'KG',
      'GRAM',
      'LITER',
      'ML',
      'PACK',
      'BOX',
      'IKAT',
      'PORSI',
    ];

    if (!allowedUnits.includes(unit)) {
      return NextResponse.json(
        { message: 'Satuan produk tidak valid.' },
        { status: 400 },
      );
    }

    const sellingPrice = data.sellingPrice;
    const hpp = data.hpp;
    const initialStock = data.initialStock ?? 0;

    if (
      (typeof sellingPrice !== 'number' && typeof sellingPrice !== 'string') ||
      !Number.isFinite(Number(sellingPrice)) ||
      Number(sellingPrice) < 0
    ) {
      return NextResponse.json(
        { message: 'Harga jual harus berupa angka non-negatif.' },
        { status: 400 },
      );
    }

    if (
      hpp !== undefined &&
      hpp !== null &&
      ((typeof hpp !== 'number' && typeof hpp !== 'string') ||
        !Number.isFinite(Number(hpp)) ||
        Number(hpp) < 0)
    ) {
      return NextResponse.json(
        { message: 'HPP harus berupa angka non-negatif.' },
        { status: 400 },
      );
    }

    if (
      (typeof initialStock !== 'number' && typeof initialStock !== 'string') ||
      !Number.isFinite(Number(initialStock)) ||
      Number(initialStock) < 0 ||
      Number(initialStock) > 99999999999
    ) {
      return NextResponse.json(
        { message: 'Stok awal harus berupa angka non-negatif.' },
        { status: 400 },
      );
    }

    const stock = Number(initialStock);

    if (stock > 0 && !Number.isFinite(stock * 1000)) {
      return NextResponse.json(
        { message: 'Jumlah stok tidak valid.' },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.findFirst({
        where: {
          id: outletId,
          businessId: membership.businessId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!outlet) {
        throw new Error('OUTLET_NOT_FOUND');
      }

      if (categoryId) {
        const category = await tx.category.findFirst({
          where: {
            id: categoryId,
            businessId: membership.businessId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!category) {
          throw new Error('CATEGORY_NOT_FOUND');
        }
      }

      const product = await tx.product.create({
        data: {
          businessId: membership.businessId,
          outletId,
          createdById: membership.id,
          name,
          unit: unit as 'PCS',
          sellingPrice: Number(sellingPrice),
          hpp:
            hpp === undefined || hpp === null || hpp === ''
              ? null
              : Number(hpp),
          categoryId,
          inventories: {
            create: {
              quantity: stock,
              ...(stock > 0
                ? {
                    movements: {
                      create: {
                        type: 'OPENING',
                        quantity: stock,
                        note: 'Stok awal saat produk dibuat',
                      },
                    },
                  }
                : {}),
            },
          },
        },
        select: {
          id: true,
          name: true,
          unit: true,
          sellingPrice: true,
          hpp: true,
          category: { select: { id: true, name: true } },
          outlet: { select: { id: true, name: true } },
          inventories: { select: { quantity: true } },
          createdAt: true,
        },
      });

      return product;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'OUTLET_NOT_FOUND') {
      return NextResponse.json(
        { message: 'Outlet aktif tidak ditemukan.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json(
        { message: 'Kategori aktif tidak ditemukan.' },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { message: 'Nama produk tersebut sudah digunakan di outlet ini.' },
        { status: 409 },
      );
    }

    console.error('POST /api/products:', error);

    return NextResponse.json(
      { message: 'Gagal membuat produk.' },
      { status: 500 },
    );
  }
}
