'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
type Outlet = {
  id: string;
  name: string;
  code: string | null;
  dailyCash: {
    id: string;
    status: 'OPEN' | 'CLOSED';
    openingBalance: string;
    openedAt: string;
    closedAt: string | null;
  } | null;
};

type Movement = {
  id: string;
  type: 'CASH_IN' | 'CASH_OUT';
  category: string;
  amount: number;
  description: string | null;
  createdAt: string;
  recordedBy: string;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function CashMovementsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedOutlet = outlets.find((outlet) => outlet.id === outletId);
  const cashIsOpen = selectedOutlet?.dailyCash?.status === 'OPEN';

  const loadOutlets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/daily-cash', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat outlet.');
      }

      const items: Outlet[] = result.outlets ?? [];
      setOutlets(items);

      setOutletId((current) => {
        if (current && items.some((item) => item.id === current)) {
          return current;
        }

        const openOutlet = items.find(
          (item) => item.dailyCash?.status === 'OPEN',
        );

        return openOutlet?.id ?? items[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovements = useCallback(async (selectedOutletId: string) => {
    if (!selectedOutletId) {
      setMovements([]);
      return;
    }

    setHistoryLoading(true);

    try {
      const response = await fetch(
        `/api/cash-movements?outletId=${encodeURIComponent(selectedOutletId)}`,
        { cache: 'no-store' },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat riwayat kas.');
      }

      setMovements(result.movements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOutlets();
  }, [loadOutlets]);

  useEffect(() => {
    void loadMovements(outletId);
  }, [outletId, loadMovements]);

  const cashInTotal = movements
    .filter((item) => item.type === 'CASH_IN')
    .reduce((sum, item) => sum + item.amount, 0);

  const cashOutTotal = movements
    .filter((item) => item.type === 'CASH_OUT')
    .reduce((sum, item) => sum + item.amount, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const numericAmount = Number(amount);

    if (!outletId) {
      setError('Pilih outlet terlebih dahulu.');
      return;
    }

    if (!cashIsOpen) {
      setError('Outlet harus memiliki sesi kas yang terbuka.');
      return;
    }

    if (!category.trim()) {
      setError('Kategori wajib diisi.');
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      Math.round(numericAmount * 100) !== numericAmount * 100
    ) {
      setError('Nominal harus lebih dari nol dan maksimal dua desimal.');
      return;
    }

    if (description.trim().length > 500) {
      setError('Keterangan maksimal 500 karakter.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/cash-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId,
          type,
          category: category.trim(),
          amount: numericAmount,
          description: description.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal mencatat pergerakan kas.');
      }

      setSuccess(result.message ?? 'Pergerakan kas berhasil dicatat.');
      setCategory('');
      setAmount('');
      setDescription('');

      await loadMovements(outletId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
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
            Kas Masuk &amp; Kas Keluar
          </span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Kas Masuk &amp; Kas Keluar
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Catat pergerakan uang tunai di luar transaksi penjualan dan
          pengeluaran.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
          Memuat data outlet...
        </div>
      ) : outlets.length === 0 ? (
        <div className="rounded-xl border border-gray-200 p-6 text-sm text-gray-600">
          Belum ada outlet aktif. Buat outlet terlebih dahulu.
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Total kas masuk hari ini</p>
              <p className="mt-2 text-xl font-bold text-emerald-700">
                {formatRupiah(cashInTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Total kas keluar hari ini</p>
              <p className="mt-2 text-xl font-bold text-red-700">
                {formatRupiah(cashOutTotal)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Catat pergerakan kas
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  cashIsOpen
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cashIsOpen ? 'Kas terbuka' : 'Kas belum terbuka'}
              </span>
            </div>

            <div className="mt-5">
              <label
                htmlFor="outletId"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Outlet
              </label>
              <select
                id="outletId"
                value={outletId}
                onChange={(event) => {
                  setOutletId(event.target.value);
                  setError('');
                  setSuccess('');
                }}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                    {outlet.dailyCash?.status === 'OPEN'
                      ? ' — Kas terbuka'
                      : outlet.dailyCash?.status === 'CLOSED'
                        ? ' — Kas ditutup'
                        : ' — Belum buka kas'}
                  </option>
                ))}
              </select>
            </div>

            {cashIsOpen ? (
              <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Jenis transaksi
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setType('CASH_IN')}
                      className={`rounded-xl border p-3 text-sm font-semibold ${
                        type === 'CASH_IN'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      + Kas Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('CASH_OUT')}
                      className={`rounded-xl border p-3 text-sm font-semibold ${
                        type === 'CASH_OUT'
                          ? 'border-red-600 bg-red-50 text-red-800'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      − Kas Keluar
                    </button>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="category"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Kategori
                    </label>
                    <input
                      id="category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      maxLength={100}
                      required
                      disabled={submitting}
                      placeholder={
                        type === 'CASH_IN'
                          ? 'Contoh: Tambahan modal'
                          : 'Contoh: Uang kecil operasional'
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="amount"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Nominal (Rp)
                    </label>
                    <input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                      disabled={submitting}
                      placeholder="Contoh: 50000"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Keterangan (opsional)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    rows={3}
                    disabled={submitting}
                    placeholder="Tambahkan keterangan transaksi..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full rounded-xl px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    type === 'CASH_IN'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-red-700 hover:bg-red-800'
                  }`}
                >
                  {submitting
                    ? 'Menyimpan...'
                    : type === 'CASH_IN'
                      ? 'Simpan Kas Masuk'
                      : 'Simpan Kas Keluar'}
                </button>
              </form>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {selectedOutlet?.dailyCash?.status === 'CLOSED'
                  ? 'Kas outlet sudah ditutup. Pergerakan baru tidak dapat dicatat untuk sesi ini.'
                  : 'Buka kas harian outlet ini terlebih dahulu untuk mencatat pergerakan kas.'}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Riwayat pergerakan kas
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedOutlet?.name ?? 'Outlet terpilih'} · sesi kas hari
                  ini
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadMovements(outletId)}
                disabled={historyLoading || !outletId}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Muat ulang
              </button>
            </div>

            {historyLoading ? (
              <p className="mt-5 text-sm text-gray-500">Memuat riwayat...</p>
            ) : movements.length === 0 ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-6 text-center">
                <p className="font-medium text-gray-700">
                  Belum ada pergerakan kas
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Transaksi kas masuk dan kas keluar akan muncul di sini.
                </p>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-gray-100">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            movement.type === 'CASH_IN'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {movement.type === 'CASH_IN'
                            ? 'Kas masuk'
                            : 'Kas keluar'}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {movement.category}
                        </span>
                      </div>

                      {movement.description && (
                        <p className="mt-2 break-words text-sm text-gray-600">
                          {movement.description}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-gray-500">
                        {formatDate(movement.createdAt)} · {movement.recordedBy}
                      </p>
                    </div>

                    <p
                      className={`font-bold ${
                        movement.type === 'CASH_IN'
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {movement.type === 'CASH_IN' ? '+' : '−'}
                      {formatRupiah(movement.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
