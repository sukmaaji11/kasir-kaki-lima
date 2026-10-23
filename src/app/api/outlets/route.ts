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

    const outlets = await prisma.outlet.findMany({
      where: {
        businessId: membership.businessId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json({ data: outlets });
  } catch (error) {
    console.error('GET /api/outlets:', error);

    return NextResponse.json(
      { message: 'Gagal mengambil daftar outlet.' },
      { status: 500 },
    );
  }
}
