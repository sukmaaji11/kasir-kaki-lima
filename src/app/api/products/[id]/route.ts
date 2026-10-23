import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getOwnerBusiness(userId: string) {
  return prisma.membership.findFirst({
    where: {
      userId,
      role: 'OWNER',
      isActive: true,
      business: { isActive: true },
    },
    select: { businessId: true },
  });
}

export async function GET(_request: Request, context: RouteContext) {
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

    const { id } = await context.params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        businessId: membership.businessId,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        sellingPrice: true,
        hpp: true,
        categoryId: true,
        outletId: true,
        isActive: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { message: 'Produk tidak ditemukan.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: product });
  } catch (error) {
    console.error('GET /api/products/[id]:', error);

    return NextResponse.json(
      { message: 'Gagal mengambil detail produk.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const body: unknown = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { message: 'Data produk tidak valid.' },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    const existing = await prisma.product.findFirst({
      where: {
        id,
        businessId: membership.businessId,
      },
      select: {
        id: true,
        outletId: true,
        isActive: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Produk tidak ditemukan.' },
        { status: 404 },
      );
    }

    // Nonaktifkan atau aktifkan produk tanpa menghapus riwayat stok.
    if ('isActive' in data) {
      if (
        typeof data.isActive !== 'boolean' ||
        Object.keys(data).length !== 1
      ) {
        return NextResponse.json(
          { message: 'Permintaan perubahan status tidak valid.' },
          { status: 400 },
        );
      }

      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: { isActive: data.isActive },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      return NextResponse.json({ data: updated });
    }

    const updateData: {
      name?: string;
      unit?: 'PCS';
      sellingPrice?: number;
      hpp?: number | null;
      categoryId?: string | null;
    } = {};

    if ('name' in data) {
      if (typeof data.name !== 'string') {
        return NextResponse.json(
          { message: 'Nama produk tidak valid.' },
          { status: 400 },
        );
      }

      const name = data.name.trim();

      if (!name || name.length > 120) {
        return NextResponse.json(
          { message: 'Nama produk harus 1–120 karakter.' },
          { status: 400 },
        );
      }

      updateData.name = name;
    }

    if ('unit' in data) {
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

      if (typeof data.unit !== 'string' || !allowedUnits.includes(data.unit)) {
        return NextResponse.json(
          { message: 'Satuan produk tidak valid.' },
          { status: 400 },
        );
      }

      updateData.unit = data.unit as 'PCS';
    }

    if ('sellingPrice' in data) {
      if (
        (typeof data.sellingPrice !== 'number' &&
          typeof data.sellingPrice !== 'string') ||
        String(data.sellingPrice).trim() === '' ||
        !Number.isFinite(Number(data.sellingPrice)) ||
        Number(data.sellingPrice) < 0
      ) {
        return NextResponse.json(
          { message: 'Harga jual tidak valid.' },
          { status: 400 },
        );
      }

      updateData.sellingPrice = Number(data.sellingPrice);
    }

    if ('hpp' in data) {
      if (data.hpp === null || data.hpp === '') {
        updateData.hpp = null;
      } else if (
        (typeof data.hpp !== 'number' && typeof data.hpp !== 'string') ||
        !Number.isFinite(Number(data.hpp)) ||
        Number(data.hpp) < 0
      ) {
        return NextResponse.json(
          { message: 'HPP tidak valid.' },
          { status: 400 },
        );
      } else {
        updateData.hpp = Number(data.hpp);
      }
    }

    if ('categoryId' in data) {
      if (data.categoryId !== null && typeof data.categoryId !== 'string') {
        return NextResponse.json(
          { message: 'Kategori tidak valid.' },
          { status: 400 },
        );
      }

      const categoryId =
        typeof data.categoryId === 'string' && data.categoryId.trim()
          ? data.categoryId
          : null;

      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: categoryId,
            businessId: membership.businessId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!category) {
          return NextResponse.json(
            { message: 'Kategori aktif tidak ditemukan.' },
            { status: 400 },
          );
        }
      }

      updateData.categoryId = categoryId;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: 'Tidak ada perubahan produk.' },
        { status: 400 },
      );
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        unit: true,
        sellingPrice: true,
        hpp: true,
        categoryId: true,
        isActive: true,
      },
    });

    return NextResponse.json({ data: product });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { message: 'Nama produk sudah digunakan di outlet ini.' },
        { status: 409 },
      );
    }

    console.error('PATCH /api/products/[id]:', error);

    return NextResponse.json(
      { message: 'Gagal memperbarui produk.' },
      { status: 500 },
    );
  }
}
