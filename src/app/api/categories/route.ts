import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

    const categories = await prisma.category.findMany({
      where: { businessId: membership.businessId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('GET /api/categories:', error);

    return NextResponse.json(
      { message: 'Gagal mengambil kategori.' },
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

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== 'object' ||
      !('name' in body) ||
      typeof body.name !== 'string'
    ) {
      return NextResponse.json(
        { message: 'Nama kategori wajib diisi.' },
        { status: 400 },
      );
    }

    const name = body.name.trim();

    if (!name || name.length > 60) {
      return NextResponse.json(
        { message: 'Nama kategori harus 1–60 karakter.' },
        { status: 400 },
      );
    }

    const category = await prisma.category.create({
      data: {
        businessId: membership.businessId,
        name,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { message: 'Kategori dengan nama tersebut sudah ada.' },
        { status: 409 },
      );
    }

    console.error('POST /api/categories:', error);

    return NextResponse.json(
      { message: 'Gagal membuat kategori.' },
      { status: 500 },
    );
  }
}
