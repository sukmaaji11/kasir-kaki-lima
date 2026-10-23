'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type ReportData = {
  period: { from: string; to: string };
  summary: {
    revenue: number;
    transactionCount: number;
    grossProfit: number;
    totalOperatingExpenses: number;
    estimatedNetProfit: number;
    ownerWithdrawals: number;
    missingHppItems: number;
  };
  expenseBreakdown: {
    category: string;
    amount: number;
    count: number;
  }[];
  dailySales: { date: string; revenue: number }[];
  bestSellingProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
  outlets: { id: string; name: string }[];
};

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getTodayWIB() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export default function SalesReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outletId, setOutletId] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    if (!from || !to) {
      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to
    ) {
      setError('Rentang tanggal tidak valid.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ from, to });
      if (outletId) params.set('outletId', outletId);

      const response = await fetch(`/api/reports/sales?${params.toString()}`, {
        cache: 'no-store',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat laporan.');
      }

      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [from, to, outletId]);

  useEffect(() => {
    const today = getTodayWIB();

    setTo(today);
    setFrom(`${today.slice(0, 7)}-01`);
  }, []);

  useEffect(() => {
    if (!from || !to) return;

    void loadReport();
  }, [from, to, outletId, loadReport]);

  const maxRevenue = Math.max(
    1,
    ...(report?.dailySales.map((day) => day.revenue) ?? []),
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="mb-3 flex flex-wrap items-center gap-2 text-xs"
          >
            <Link
              href="/dashboard"
              className="font-medium text-gray-500 transition hover:text-[#17643e]"
            >
              Dashboard
            </Link>
            <span className="text-gray-300" aria-hidden="true">
              /
            </span>
            <span className="font-medium text-[#17643e]">
              Laporan Penjualan
            </span>
          </nav>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Laporan Penjualan
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Pantau omzet dan performa penjualan tokomu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReport()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#17643e] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
        >
          {' '}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          >
            <path d="M20 7v5h-5" />
            <path d="M4 17v-5h5" />
            <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12" />
            <path d="M18.4 15a7 7 0 0 1-11.6 2L4 12" />
          </svg>
          {loading ? 'Memuat...' : 'Muat ulang'}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="from"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Dari tanggal
          </label>
          <input
            id="from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="to"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Sampai tanggal
          </label>
          <input
            id="to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="outlet"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Outlet
          </label>
          <select
            id="outlet"
            value={outletId}
            onChange={(event) => setOutletId(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900"
          >
            <option value="">Semua outlet</option>
            {report?.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading && !report ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Memuat laporan penjualan...
        </div>
      ) : report ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">Total omzet</p>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {rupiah(report.summary.revenue)}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Berdasarkan transaksi aktif
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Jumlah transaksi
              </p>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {report.summary.transactionCount}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Penjualan berstatus ACTIVE
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Estimasi laba kotor
              </p>
              <p className="mt-3 text-2xl font-bold text-emerald-700">
                {rupiah(report.summary.grossProfit)}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Omzet dikurangi HPP item yang tersedia
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Total pengeluaran operasional
              </p>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {rupiah(report.summary.totalOperatingExpenses)}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Tidak termasuk pengambilan pemilik
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Estimasi laba setelah pengeluaran
              </p>
              <p
                className={`mt-3 text-2xl font-bold ${
                  report.summary.estimatedNetProfit >= 0
                    ? 'text-emerald-700'
                    : 'text-red-600'
                }`}
              >
                {rupiah(report.summary.estimatedNetProfit)}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Laba kotor dikurangi pengeluaran operasional
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Pengambilan pemilik
              </p>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {rupiah(report.summary.ownerWithdrawals)}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Dicatat terpisah dari biaya usaha
              </p>
            </article>
          </section>

          {report.summary.missingHppItems > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Ada {report.summary.missingHppItems} item penjualan tanpa snapshot
              HPP. Estimasi laba kotor belum mencakup HPP item tersebut.
            </div>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Grafik omzet harian
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Omzet per tanggal berdasarkan zona waktu WIB.
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {report.dailySales.length} hari
              </span>
            </div>

            {report.dailySales.every((day) => day.revenue === 0) ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">
                Belum ada penjualan pada periode ini.
              </div>
            ) : (
              <div className="mt-6 flex h-64 items-end gap-1 overflow-x-auto border-b border-gray-200 pb-2">
                {report.dailySales.map((day) => {
                  const height = Math.max(
                    day.revenue > 0 ? 4 : 0,
                    (day.revenue / maxRevenue) * 100,
                  );

                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${rupiah(day.revenue)}`}
                      className="group flex h-full min-w-7 flex-1 flex-col items-center justify-end"
                    >
                      <div className="mb-1 hidden text-center text-[10px] text-gray-500 group-hover:block">
                        {day.revenue > 0 ? rupiah(day.revenue) : ''}
                      </div>
                      <div
                        className="w-full max-w-10 rounded-t-md bg-emerald-600 transition-colors hover:bg-emerald-700"
                        style={{ height: `${height}%` }}
                      />
                      <span className="mt-2 text-[10px] text-gray-500">
                        {day.date.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="font-semibold text-gray-900">
                Rincian pengeluaran
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Pengeluaran berdasarkan kategori pada periode yang dipilih.
              </p>
            </div>

            {report.expenseBreakdown.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Belum ada pengeluaran pada periode ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Kategori</th>
                      <th className="px-5 py-3 text-right font-medium">
                        Jumlah catatan
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        Total nominal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.expenseBreakdown.map((item) => {
                      const labels: Record<string, string> = {
                        MATERIAL_PURCHASE: 'Belanja bahan baku',
                        OPERATING: 'Operasional',
                        OWNER_WITHDRAWAL: 'Pengambilan pemilik',
                        OTHER: 'Lain-lain',
                      };

                      return (
                        <tr key={item.category}>
                          <td className="px-5 py-4 font-medium text-gray-900">
                            {labels[item.category] ?? item.category}
                          </td>
                          <td className="px-5 py-4 text-right text-gray-600">
                            {item.count}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-gray-900">
                            {rupiah(item.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="font-semibold text-gray-900">Produk terlaris</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sepuluh produk dengan kuantitas penjualan tertinggi.
              </p>
            </div>

            {report.bestSellingProducts.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Belum ada data produk terjual.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">#</th>
                      <th className="px-5 py-3 font-medium">Nama produk</th>
                      <th className="px-5 py-3 text-right font-medium">
                        Terjual
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        Omzet
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.bestSellingProducts.map((product, index) => (
                      <tr key={`${product.name}-${index}`}>
                        <td className="px-5 py-4 text-gray-500">{index + 1}</td>
                        <td className="px-5 py-4 font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-5 py-4 text-right text-gray-700">
                          {product.quantity}
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-gray-900">
                          {rupiah(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
