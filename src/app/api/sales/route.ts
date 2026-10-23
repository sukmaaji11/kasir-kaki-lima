import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

type CheckoutItem = {
  productId: string;
  quantity: number;
};

type CheckoutBody = {
  outletId: string;
  idempotencyKey: string;
  paymentMethod: 'CASH' | 'QRIS' | 'TRANSFER';
  items: CheckoutItem[];
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return errorResponse('Silakan login terlebih dahulu.', 401);
  }

  let body: CheckoutBody;

  try {
    body = await request.json();
  } catch {
    return errorResponse('Format request tidak valid.', 400);
  }

  if (
    typeof body.outletId !== 'string' ||
    !body.outletId.trim() ||
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey.trim() ||
    body.idempotencyKey.length > 100 ||
    !['CASH', 'QRIS', 'TRANSFER'].includes(body.paymentMethod) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100
  ) {
    return errorResponse('Data checkout tidak valid.', 400);
  }

  const normalizedItems = new Map<string, number>();

  for (const item of body.items) {
    if (
      !item ||
      typeof item.productId !== 'string' ||
      !item.productId.trim() ||
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(Math.round(item.quantity * 1000)) ||
      Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) >
        0.000001
    ) {
      return errorResponse(
        'Produk atau kuantitas tidak valid. Maksimal tiga angka desimal.',
        400,
      );
    }

    const nextQuantity =
      (normalizedItems.get(item.productId) ?? 0) + item.quantity;

    if (!Number.isFinite(nextQuantity) || nextQuantity > 999999999) {
      return errorResponse('Kuantitas produk terlalu besar.', 400);
    }

    normalizedItems.set(item.productId, nextQuantity);
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const membership = await tx.membership.findFirst({
          where: {
            userId: session.user.id,
            isActive: true,
            business: {
              isActive: true,
            },
            OR: [
              {
                role: 'OWNER',
              },
              {
                outletAssignments: {
                  some: {
                    outletId: body.outletId,
                    isActive: true,
                    outlet: {
                      isActive: true,
                    },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            businessId: true,
            role: true,
          },
        });

        if (!membership) {
          throw new Error('OUTLET_ACCESS_DENIED');
        }

        // Permintaan ulang dengan key yang sama tidak membuat penjualan baru.
        const existing = await tx.sale.findUnique({
          where: {
            outletId_idempotencyKey: {
              outletId: body.outletId,
              idempotencyKey: body.idempotencyKey,
            },
          },
          include: { items: true },
        });

        if (existing) {
          if (
            existing.businessId !== membership.businessId ||
            existing.cashierId !== membership.id
          ) {
            throw new Error('IDEMPOTENCY_CONFLICT');
          }

          return { sale: existing, replayed: true };
        }

        const outlet = await tx.outlet.findFirst({
          where: {
            id: body.outletId,
            businessId: membership.businessId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!outlet) {
          throw new Error('OUTLET_ACCESS_DENIED');
        }

        const now = new Date();
        const operationalDate = new Date(
          Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
        );

        const dailyCash = await tx.dailyCash.findUnique({
          where: {
            outletId_operationalDate: {
              outletId: outlet.id,
              operationalDate,
            },
          },
        });

        if (!dailyCash || dailyCash.status !== 'OPEN') {
          throw new Error('DAILY_CASH_NOT_OPEN');
        }

        const productIds = [...normalizedItems.keys()];

        const products = await tx.product.findMany({
          where: {
            businessId: membership.businessId,
            outletId: outlet.id,
            isActive: true,
            id: { in: productIds },
          },
          select: {
            id: true,
            name: true,
            sellingPrice: true,
            hpp: true,
          },
        });

        if (products.length !== productIds.length) {
          throw new Error('PRODUCT_NOT_AVAILABLE');
        }

        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        const preparedItems = productIds.map((productId) => {
          const product = productMap.get(productId)!;
          const quantity = normalizedItems.get(productId)!;

          const lineTotal = new Prisma.Decimal(
            Math.round(Number(product.sellingPrice.toString()) * 100),
          )
            .mul(new Prisma.Decimal(quantity))
            .div(100)
            .toDecimalPlaces(2);

          return {
            product,
            quantity,
            lineTotal,
          };
        });

        const totalAmount = preparedItems.reduce(
          (total, item) => total.add(item.lineTotal),
          new Prisma.Decimal(0),
        );

        // Membuat nomor transaksi yang unik tanpa bergantung pada jam saja.
        const transactionNumber = `TRX-${now.getTime()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const sale = await tx.sale.create({
          data: {
            businessId: membership.businessId,
            outletId: outlet.id,
            dailyCashId: dailyCash.id,
            cashierId: membership.id,
            transactionNumber,
            idempotencyKey: body.idempotencyKey,
            paymentMethod: body.paymentMethod,
            totalAmount,
            items: {
              create: preparedItems.map((item) => ({
                productId: item.product.id,
                productNameSnapshot: item.product.name,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: item.product.sellingPrice,
                hppSnapshot: item.product.hpp,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: { items: true },
        });

        for (const item of preparedItems) {
          const inventory = await tx.inventory.findUnique({
            where: {
              businessId_outletId_productId: {
                businessId: membership.businessId,
                outletId: outlet.id,
                productId: item.product.id,
              },
            },
            select: { id: true },
          });

          if (!inventory) {
            throw new Error('INVENTORY_NOT_FOUND');
          }

          const updated = await tx.inventory.updateMany({
            where: {
              id: inventory.id,
              quantity: { gte: new Prisma.Decimal(item.quantity) },
            },
            data: {
              quantity: { decrement: new Prisma.Decimal(item.quantity) },
            },
          });

          if (updated.count !== 1) {
            throw new Error('INSUFFICIENT_STOCK');
          }

          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              type: 'SALE',
              quantity: new Prisma.Decimal(-item.quantity),
              note: `Penjualan ${sale.transactionNumber}`,
              referenceId: sale.id,
            },
          });
        }

        return { sale, replayed: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json(
      {
        message: result.replayed
          ? 'Checkout sebelumnya sudah tercatat.'
          : 'Checkout berhasil.',
        replayed: result.replayed,
        sale: {
          id: result.sale.id,
          transactionNumber: result.sale.transactionNumber,
          paymentMethod: result.sale.paymentMethod,
          totalAmount: result.sale.totalAmount.toString(),
          status: result.sale.status,
          soldAt: result.sale.soldAt,
          items: result.sale.items.map((item) => ({
            productId: item.productId,
            name: item.productNameSnapshot,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        },
      },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'OUTLET_ACCESS_DENIED':
          return errorResponse('Akses ke outlet ditolak.', 403);
        case 'IDEMPOTENCY_CONFLICT':
          return errorResponse(
            'Idempotency key sudah digunakan oleh checkout lain.',
            409,
          );
        case 'DAILY_CASH_NOT_OPEN':
          return errorResponse(
            'Kas harian belum dibuka atau sudah ditutup.',
            409,
          );
        case 'PRODUCT_NOT_AVAILABLE':
          return errorResponse(
            'Ada produk yang tidak aktif atau bukan milik outlet ini.',
            400,
          );
        case 'INVENTORY_NOT_FOUND':
          return errorResponse('Data stok produk belum tersedia.', 409);
        case 'INSUFFICIENT_STOCK':
          return errorResponse(
            'Stok tidak mencukupi. Checkout dibatalkan.',
            409,
          );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002')
    ) {
      return errorResponse(
        'Terjadi konflik transaksi. Silakan coba checkout kembali dengan idempotency key baru jika transaksi sebelumnya belum tercatat.',
        409,
      );
    }

    console.error('Checkout error:', error);
    return errorResponse('Terjadi kesalahan saat checkout.', 500);
  }
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

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get('outletId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
  );
  const pageSize = 20;

  if (
    (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
    (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))
  ) {
    return NextResponse.json(
      { error: 'Format tanggal harus YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  if (from && to && from > to) {
    return NextResponse.json(
      { error: 'Tanggal awal tidak boleh melewati tanggal akhir.' },
      { status: 400 },
    );
  }

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

  const isOwner = membership.role === 'OWNER';

  const outletAccess = isOwner
    ? {
        businessId: membership.businessId,
        isActive: true,
      }
    : {
        businessId: membership.businessId,
        isActive: true,
        outletAssignments: {
          some: {
            membershipId: membership.id,
            isActive: true,
          },
        },
      };

  if (outletId) {
    const permittedOutlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        ...outletAccess,
      },
      select: { id: true },
    });

    if (!permittedOutlet) {
      return NextResponse.json(
        { error: 'Akses ke outlet ditolak.' },
        { status: 403 },
      );
    }
  }

  const startDate = from ? new Date(`${from}T00:00:00.000+07:00`) : undefined;

  const endDate = to
    ? new Date(
        new Date(`${to}T00:00:00.000+07:00`).getTime() + 24 * 60 * 60 * 1000,
      )
    : undefined;

  const where = {
    businessId: membership.businessId,
    ...(outletId ? { outletId } : {}),
    ...(isOwner
      ? {}
      : {
          outlet: {
            outletAssignments: {
              some: {
                membershipId: membership.id,
                isActive: true,
              },
            },
          },
        }),
    ...(startDate || endDate
      ? {
          soldAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lt: endDate } : {}),
          },
        }
      : {}),
  };

  const [sales, total] = await prisma.$transaction([
    prisma.sale.findMany({
      where,
      orderBy: { soldAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        transactionNumber: true,
        paymentMethod: true,
        totalAmount: true,
        status: true,
        soldAt: true,
        voidedAt: true,
        outlet: {
          select: { name: true },
        },
        cashier: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.sale.count({ where }),
  ]);

  return NextResponse.json({
    data: sales.map((sale) => ({
      ...sale,
      totalAmount: sale.totalAmount.toString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
