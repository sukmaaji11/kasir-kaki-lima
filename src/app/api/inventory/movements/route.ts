import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { message: 'Data pergerakan stok tidak valid.' },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const productId = typeof data.productId === 'string' ? data.productId : '';
    const outletId = typeof data.outletId === 'string' ? data.outletId : '';
    const type = data.type;
    const note = typeof data.note === 'string' ? data.note.trim() : '';

    if (!productId || !outletId) {
      return NextResponse.json(
        { message: 'Produk dan outlet wajib dipilih.' },
        { status: 400 },
      );
    }

    if (type !== 'IN' && type !== 'OUT' && type !== 'ADJUSTMENT') {
      return NextResponse.json(
        { message: 'Jenis pergerakan stok tidak valid.' },
        { status: 400 },
      );
    }

    if (note.length > 500) {
      return NextResponse.json(
        { message: 'Catatan maksimal 500 karakter.' },
        { status: 400 },
      );
    }

    const amount = type === 'ADJUSTMENT' ? data.targetQuantity : data.quantity;

    if (
      (typeof amount !== 'number' && typeof amount !== 'string') ||
      String(amount).trim() === '' ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) < 0 ||
      Number(amount) > 99999999999.999
    ) {
      return NextResponse.json(
        {
          message:
            type === 'ADJUSTMENT'
              ? 'Stok fisik harus berupa angka non-negatif.'
              : 'Jumlah stok harus berupa angka positif.',
        },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);

    if (type !== 'ADJUSTMENT' && numericAmount <= 0) {
      return NextResponse.json(
        { message: 'Jumlah stok harus lebih besar dari nol.' },
        { status: 400 },
      );
    }

    if (Math.round(numericAmount * 1000) !== numericAmount * 1000) {
      return NextResponse.json(
        { message: 'Stok maksimal menggunakan 3 angka desimal.' },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const inventory = await tx.inventory.findFirst({
          where: {
            businessId: membership.businessId,
            outletId,
            productId,
            product: { isActive: true },
            outlet: { isActive: true },
          },
          select: {
            id: true,
            quantity: true,
            product: {
              select: { id: true, name: true, unit: true },
            },
          },
        });

        if (!inventory) {
          throw new Error('INVENTORY_NOT_FOUND');
        }

        let delta: number;

        if (type === 'IN') {
          delta = numericAmount;

          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: { increment: delta },
            },
          });
        } else if (type === 'OUT') {
          delta = -numericAmount;

          // Update atomik: stok tidak boleh menjadi negatif,
          // termasuk jika ada dua permintaan bersamaan.
          const updated = await tx.inventory.updateMany({
            where: {
              id: inventory.id,
              quantity: { gte: numericAmount },
            },
            data: {
              quantity: { decrement: numericAmount },
            },
          });

          if (updated.count === 0) {
            throw new Error('INSUFFICIENT_STOCK');
          }
        } else {
          const current = Number(inventory.quantity);
          delta = numericAmount - current;

          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: numericAmount },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            type: type as MovementType,
            quantity: new Prisma.Decimal(delta.toFixed(3)),
            note: note || null,
          },
          select: {
            id: true,
            type: true,
            quantity: true,
            note: true,
            createdAt: true,
          },
        });

        const updatedInventory = await tx.inventory.findUniqueOrThrow({
          where: { id: inventory.id },
          select: { quantity: true },
        });

        return {
          movement,
          product: inventory.product,
          outletId,
          stockBefore: inventory.quantity,
          stockAfter: updatedInventory.quantity,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      { message: 'Stok berhasil diperbarui.', data: result },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVENTORY_NOT_FOUND') {
        return NextResponse.json(
          { message: 'Inventaris produk aktif tidak ditemukan.' },
          { status: 404 },
        );
      }

      if (error.message === 'INSUFFICIENT_STOCK') {
        return NextResponse.json(
          { message: 'Stok tidak mencukupi untuk pengeluaran ini.' },
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
          message:
            'Stok sedang diperbarui oleh transaksi lain. Silakan coba kembali.',
        },
        { status: 409 },
      );
    }

    console.error('POST /api/inventory/movements:', error);

    return NextResponse.json(
      { message: 'Gagal memperbarui stok.' },
      { status: 500 },
    );
  }
}
