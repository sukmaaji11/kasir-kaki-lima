import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const { id } = await context.params;
    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== 'object' ||
      !('isActive' in body) ||
      typeof body.isActive !== 'boolean'
    ) {
      return NextResponse.json(
        { message: 'Status kategori tidak valid.' },
        { status: 400 },
      );
    }

    const existing = await prisma.category.findFirst({
      where: {
        id,
        businessId: membership.businessId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Kategori tidak ditemukan.' },
        { status: 404 },
      );
    }

    const category = await prisma.category.update({
      where: { id: existing.id },
      data: { isActive: body.isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: category });
  } catch (error) {
    console.error('PATCH /api/categories/[id]:', error);

    return NextResponse.json(
      { message: 'Gagal memperbarui kategori.' },
      { status: 500 },
    );
  }
}
