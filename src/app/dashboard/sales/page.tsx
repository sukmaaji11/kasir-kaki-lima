'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Sale = {
  id: string;
  transactionNumber: string;
  paymentMethod: 'CASH' | 'QRIS' | 'TRANSFER';
  totalAmount: string;
  status: 'ACTIVE' | 'VOID';
  soldAt: string;
  voidedAt: string | null;
  outlet: { name: string };
  cashier: { user: { name: string } };
  _count: { items: number };
};

type SaleDetail = Omit<Sale, '_count'> & {
  items: {
    id: string;
    productNameSnapshot: string;
    quantity: string;
    unitPrice: string;
    hppSnapshot: string | null;
    lineTotal: string;
  }[];
};

type Outlet = {
  id: string;
  name: string;
};

type SalesResponse = {
  data: Sale[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function rupiah(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOutlets = useCallback(async () => {
    try {
      const response = await fetch('/api/outlets', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (response.ok) {
        setOutlets(result.data ?? result.outlets ?? []);
      }
    } catch {
      // Daftar transaksi tetap dapat ditampilkan tanpa filter outlet.
    }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ page: String(page) });

      if (outletId) params.set('outletId', outletId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const response = await fetch(`/api/sales?${params.toString()}`, {
        cache: 'no-store',
      });
      const result: SalesResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat transaksi.');
      }

      setSales(result.data);
      setTotal(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat transaksi.');
    } finally {
      setLoading(false);
    }
  }, [page, outletId, from, to]);

  useEffect(() => {
    void loadOutlets();
  }, [loadOutlets]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  async function showDetail(id: string) {
    setDetailLoading(true);
    setError('');
    setSelectedSale(null);

    try {
      const response = await fetch(`/api/sales/${id}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat detail transaksi.');
      }

      setSelectedSale(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memuat detail transaksi.',
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function resetFilters() {
    setOutletId('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="mb-3 flex items-center gap-2 text-xs"
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
              Riwayat Transaksi
            </span>
          </nav>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Riwayat Transaksi
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Periksa penjualan dan rincian struk transaksi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSales()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#17643e] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
        >
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

      <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
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
            onChange={(event) => {
              setOutletId(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900"
          >
            <option value="">Semua outlet</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </div>

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
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetFilters}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset filter
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-gray-900">Daftar penjualan</h2>
          <p className="text-sm text-gray-500">{total} transaksi</p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Memuat transaksi...
          </div>
        ) : sales.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-900">Belum ada transaksi</p>
            <p className="mt-1 text-sm text-gray-500">
              Coba ubah filter tanggal atau outlet.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Transaksi</th>
                    <th className="px-5 py-3 font-medium">Waktu</th>
                    <th className="px-5 py-3 font-medium">Outlet / Kasir</th>
                    <th className="px-5 py-3 font-medium">Pembayaran</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {sale.transactionNumber}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {dateTime(sale.soldAt)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {sale.outlet.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {sale.cashier.user.name}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {sale.paymentMethod}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                        {rupiah(sale.totalAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            sale.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {sale.status === 'ACTIVE' ? 'Aktif' : 'Void'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void showDetail(sale.id)}
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          Lihat struk
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-4">
              <p className="text-sm text-gray-500">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {(detailLoading || selectedSale) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => {
            if (!detailLoading) setSelectedSale(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {detailLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Memuat struk...
              </p>
            ) : selectedSale ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2
                      id="receipt-title"
                      className="text-xl font-bold text-gray-900"
                    >
                      Detail transaksi
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {selectedSale.transactionNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSale(null)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
                  >
                    Tutup
                  </button>
                </div>

                <div className="mt-5 space-y-3 border-y border-dashed border-gray-200 py-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Waktu</span>
                    <span className="text-right text-gray-900">
                      {dateTime(selectedSale.soldAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Outlet</span>
                    <span className="text-gray-900">
                      {selectedSale.outlet.name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Kasir</span>
                    <span className="text-gray-900">
                      {selectedSale.cashier.user.name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Pembayaran</span>
                    <span className="text-gray-900">
                      {selectedSale.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium text-gray-900">
                      {selectedSale.status === 'ACTIVE' ? 'Aktif' : 'Void'}
                    </span>
                  </div>
                </div>

                <div className="my-4 space-y-4">
                  {selectedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.productNameSnapshot}
                        </p>
                        <p className="mt-1 text-gray-500">
                          {item.quantity} × {rupiah(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {rupiah(item.lineTotal)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between gap-3 border-t border-gray-200 pt-4">
                  <span className="font-semibold text-gray-700">
                    Total transaksi
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    {rupiah(selectedSale.totalAmount)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
                >
                  Cetak / Simpan PDF
                </button>
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
