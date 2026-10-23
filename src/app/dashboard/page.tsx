export const instant = false;

import Link from 'next/link';
import { connection } from 'next/server';
import { getOwnerContext } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getTodayRangeWIB() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const start = new Date(`${today}T00:00:00.000+07:00`);

  return {
    today,
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

const modules = [
  {
    title: 'Kasir / POS',
    description: 'Mulai transaksi penjualan',
    href: '/dashboard/pos',
    icon: '🛒',
  },
  {
    title: 'Produk & Stok',
    description: 'Kelola produk dan persediaan',
    href: '/dashboard/products',
    icon: '📦',
  },
  {
    title: 'Penjualan',
    description: 'Riwayat transaksi',
    href: '/dashboard/sales',
    icon: '🧾',
  },
  {
    title: 'Kas Harian',
    description: 'Modal awal dan saldo kas',
    href: '/dashboard/cash',
    icon: '💵',
  },
  {
    title: 'Kas Masuk/Keluar',
    description: 'Pergerakan uang tunai',
    href: '/dashboard/cash-movements',
    icon: '💰',
  },
  {
    title: 'Pengeluaran',
    description: 'Biaya operasional',
    href: '/dashboard/expenses',
    icon: '📝',
  },
  {
    title: 'Laporan',
    description: 'Ringkasan kinerja usaha',
    href: '/dashboard/reports',
    icon: '📊',
  },
];

export default async function DashboardPage() {
  await connection();

  const { user, business } = await getOwnerContext();
  const { today, start, end } = getTodayRangeWIB();

  const [sales, transactionCount, productCount, userCount, outlets] =
    await Promise.all([
      prisma.sale.aggregate({
        where: {
          businessId: business.id,
          soldAt: { gte: start, lt: end },
          status: 'ACTIVE',
        },
        _sum: { totalAmount: true },
      }),
      prisma.sale.count({
        where: {
          businessId: business.id,
          soldAt: { gte: start, lt: end },
          status: 'ACTIVE',
        },
      }),
      prisma.product.count({
        where: {
          businessId: business.id,
          isActive: true,
        },
      }),
      prisma.membership.count({
        where: {
          businessId: business.id,
          isActive: true,
          user: { isActive: true },
        },
      }),
      prisma.outlet.findMany({
        where: {
          businessId: business.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          dailyCashDays: {
            where: {
              operationalDate: new Date(`${today}T00:00:00.000Z`),
            },
            select: {
              status: true,
              openingBalance: true,
            },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

  const revenue = Number(sales._sum.totalAmount?.toString() ?? '0');

  const openCashCount = outlets.filter(
    (outlet) => outlet.dailyCashDays[0]?.status === 'OPEN',
  ).length;

  const summary = [
    {
      label: 'Omzet hari ini',
      value: formatRupiah(revenue),
      note: 'Penjualan aktif',
      icon: '💵',
    },
    {
      label: 'Transaksi',
      value: transactionCount.toLocaleString('id-ID'),
      note: 'Hari ini',
      icon: '🧾',
    },
    {
      label: 'Produk aktif',
      value: productCount.toLocaleString('id-ID'),
      note: 'Produk terdaftar',
      icon: '📦',
    },
    {
      label: 'Kas terbuka',
      value: `${openCashCount}/${outlets.length}`,
      note: 'Outlet aktif',
      icon: '🏪',
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f9f7] text-[#18251d]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-8 sm:px-8 sm:py-8">
        {/* Sapaan */}
        <section className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-700 sm:text-sm">
              DASHBOARD OWNER
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:mt-2 sm:text-3xl">
              Halo, {user.name}! 👋
            </h1>
            <p className="mt-1 text-xs text-gray-500 sm:mt-2 sm:text-sm">
              Ringkasan usaha hari ini
            </p>
          </div>

          <span className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[10px] font-medium text-gray-600 sm:px-3 sm:text-xs">
            {today}
          </span>
        </section>

        {/* Informasi bisnis */}
        <section className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl sm:h-12 sm:w-12">
            🏪
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500 sm:text-sm">Bisnis aktif</p>
            <h2 className="truncate text-sm font-bold sm:text-lg">
              {business.name}
            </h2>
            <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">
              {outlets.length} outlet · {userCount} pengguna
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 sm:px-3 sm:text-xs">
            Aktif
          </span>
        </section>

        {/* Ringkasan */}
        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="text-base font-bold sm:text-lg">
              Ringkasan hari ini
            </h2>
            <span className="text-[10px] text-gray-400 sm:text-xs">
              Data aktual
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
            {summary.map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3.5 transition hover:border-emerald-200 sm:p-5"
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-medium leading-4 text-gray-500 sm:text-sm">
                    {item.label}
                  </p>
                  <span className="text-lg sm:text-xl" aria-hidden="true">
                    {item.icon}
                  </span>
                </div>

                <p className="mt-3 break-words text-lg font-bold leading-tight tracking-tight sm:text-2xl">
                  {item.value}
                </p>

                <p className="mt-1.5 text-[10px] text-gray-400 sm:text-xs">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Menu usaha */}
        <section>
          <div className="mb-3">
            <h2 className="text-base font-bold sm:text-lg">Menu usaha</h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Pilih fitur yang ingin kamu gunakan.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-5">
            <div className="grid grid-cols-4 gap-x-1 gap-y-5 sm:grid-cols-4 sm:gap-5 lg:grid-cols-7">
              {modules.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-w-0 flex-col items-center rounded-xl px-0.5 py-1 text-center transition hover:bg-emerald-50 sm:px-2 sm:py-3"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f5ed] text-2xl transition group-hover:bg-[#d8ecdf] sm:h-14 sm:w-14 sm:text-3xl">
                    {item.icon}
                  </span>

                  <span className="mt-2 w-full break-words text-[10px] font-semibold leading-4 text-gray-700 group-hover:text-[#17643e] sm:mt-3 sm:text-xs">
                    {item.title}
                  </span>

                  <span className="mt-1 hidden text-xs leading-5 text-gray-400 lg:block">
                    {item.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Status outlet */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold sm:text-lg">Status outlet</h2>
              <p className="mt-1 text-xs text-gray-500">
                Kondisi sesi kas hari ini
              </p>
            </div>

            <Link
              href="/dashboard/cash"
              className="shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-900 sm:text-sm"
            >
              Kelola kas →
            </Link>
          </div>

          <div className="mt-3 divide-y divide-gray-100">
            {outlets.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">
                Belum ada outlet aktif.
              </p>
            ) : (
              outlets.map((outlet) => {
                const cash = outlet.dailyCashDays[0];
                const status = cash?.status ?? 'NOT_OPEN';

                return (
                  <div
                    key={outlet.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {outlet.name}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-500 sm:text-xs">
                        {cash
                          ? `Modal awal ${formatRupiah(Number(cash.openingBalance.toString()))}`
                          : 'Belum ada sesi kas hari ini'}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${
                        status === 'OPEN'
                          ? 'bg-emerald-50 text-emerald-700'
                          : status === 'CLOSED'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {status === 'OPEN'
                        ? 'Kas terbuka'
                        : status === 'CLOSED'
                          ? 'Kas ditutup'
                          : 'Belum buka'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <footer className="pb-2 text-center text-[10px] text-gray-400 sm:text-xs">
          Kasir Kaki Lima · {business.name}
        </footer>
      </div>
    </main>
  );
}
