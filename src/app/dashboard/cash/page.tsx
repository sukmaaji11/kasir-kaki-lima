'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
type DailyCash = {
  id: string;
  openingBalance: string;
  expectedClosingBalance: string | null;
  actualClosingBalance: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
};

type Outlet = {
  id: string;
  name: string;
  code: string | null;
  dailyCash: DailyCash | null;
};

type CashResponse = {
  operationalDate: string;
  outlets: Outlet[];
};

type CashPreview = {
  dailyCashId: string;
  openingBalance: number;
  cashSales: number;
  cashExpenses: number;
  cashIn: number;
  cashOut: number;
  expectedClosingBalance: number;
};

function formatRupiah(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function DailyCashPage() {
  const [data, setData] = useState<CashResponse | null>(null);
  const [outletId, setOutletId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [actualClosingBalance, setActualClosingBalance] = useState('');
  const [preview, setPreview] = useState<CashPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCash = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/daily-cash', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat data kas.');
      }

      setData(result);

      setOutletId((current) => {
        if (
          current &&
          result.outlets.some((outlet: Outlet) => outlet.id === current)
        ) {
          return current;
        }

        return result.outlets[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCash();
  }, [loadCash]);

  const selectedOutlet = data?.outlets.find((outlet) => outlet.id === outletId);
  const selectedCash = selectedOutlet?.dailyCash;

  useEffect(() => {
    if (selectedCash?.status !== 'OPEN' || !outletId) {
      setPreview(null);
      setActualClosingBalance('');
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setPreviewLoading(true);
      setPreview(null);

      try {
        const response = await fetch(
          `/api/daily-cash/close?outletId=${encodeURIComponent(outletId)}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? 'Gagal menghitung saldo kas.');
        }

        if (!controller.signal.aborted) {
          setPreview(result.data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : 'Gagal menghitung saldo kas.',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [outletId, selectedCash?.id, selectedCash?.status]);

  const actualAmount = Number(actualClosingBalance);
  const difference =
    preview &&
    actualClosingBalance.trim() !== '' &&
    Number.isFinite(actualAmount)
      ? actualAmount - preview.expectedClosingBalance
      : null;

  async function handleOpenCash() {
    setError('');
    setSuccess('');

    const amount = Number(openingBalance);

    if (!outletId) {
      setError('Pilih outlet terlebih dahulu.');
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      setError('Modal awal harus berupa angka yang valid.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/daily-cash/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId, openingBalance: amount }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal membuka kas.');
      }

      setSuccess('Kas harian berhasil dibuka.');
      await loadCash();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseCash() {
    setError('');
    setSuccess('');

    if (!outletId || !preview) {
      setError('Pratinjau saldo kas belum tersedia.');
      return;
    }

    if (
      actualClosingBalance.trim() === '' ||
      !Number.isFinite(actualAmount) ||
      actualAmount < 0 ||
      Math.round(actualAmount * 100) !== actualAmount * 100
    ) {
      setError('Masukkan saldo aktual yang valid.');
      return;
    }

    const confirmed = window.confirm(
      `Tutup kas outlet ${selectedOutlet?.name}?\n\n` +
        `Saldo seharusnya: ${formatRupiah(preview.expectedClosingBalance)}\n` +
        `Saldo aktual: ${formatRupiah(actualAmount)}\n` +
        `Selisih: ${formatRupiah(actualAmount - preview.expectedClosingBalance)}\n\n` +
        'Kas yang sudah ditutup tidak dapat dibuka kembali melalui halaman ini.',
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/daily-cash/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId,
          actualClosingBalance: actualAmount,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal menutup kas.');
      }

      setSuccess('Kas berhasil ditutup. Selisih kas telah dicatat.');
      setActualClosingBalance('');
      setPreview(null);
      await loadCash();
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
          <span className="font-medium text-[#17643e]">Kas Harian</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Kas Harian
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Kelola modal awal, pantau saldo, dan tutup kas setiap outlet.
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
        <div className="rounded-2xl border border-gray-200 p-6 text-sm text-gray-500">
          Memuat data kas...
        </div>
      ) : !data || data.outlets.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900">
            Belum ada outlet aktif
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Buat atau aktifkan outlet terlebih dahulu sebelum membuka kas.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Status kas hari ini
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Tanggal operasional: {data.operationalDate}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadCash()}
                disabled={loading || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover hover hover:text-[#17643e] disabled disabled sm sm.5"
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
                Muat ulang
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.outlets.map((outlet) => (
                <button
                  type="button"
                  key={outlet.id}
                  onClick={() => {
                    setOutletId(outlet.id);
                    setError('');
                    setSuccess('');
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    outletId === outlet.id
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {outlet.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {outlet.code || 'Tanpa kode outlet'}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        outlet.dailyCash?.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-700'
                          : outlet.dailyCash?.status === 'CLOSED'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {outlet.dailyCash?.status === 'OPEN'
                        ? 'Kas terbuka'
                        : outlet.dailyCash?.status === 'CLOSED'
                          ? 'Kas ditutup'
                          : 'Belum dibuka'}
                    </span>
                  </div>

                  {outlet.dailyCash && (
                    <p className="mt-3 text-sm text-gray-600">
                      Modal awal:{' '}
                      <span className="font-semibold text-gray-900">
                        {formatRupiah(outlet.dailyCash.openingBalance)}
                      </span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedCash?.status === 'OPEN'
                ? 'Tutup kas harian'
                : selectedCash?.status === 'CLOSED'
                  ? 'Hasil penutupan kas'
                  : 'Buka kas baru'}
            </h2>

            {selectedCash?.status === 'OPEN' ? (
              <div className="mt-4 space-y-5">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-800">
                    Kas outlet {selectedOutlet?.name} sedang terbuka.
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900">
                    {formatRupiah(selectedCash.openingBalance)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Dibuka pada {formatDate(selectedCash.openedAt)}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Pratinjau saldo kas
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Periksa uang fisik sebelum menutup kas.
                  </p>
                </div>

                {previewLoading ? (
                  <p className="text-sm text-gray-500">
                    Menghitung saldo kas...
                  </p>
                ) : preview ? (
                  <>
                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                      {[
                        ['Modal awal', preview.openingBalance],
                        ['Penjualan tunai', preview.cashSales],
                        ['Pengeluaran tunai', -preview.cashExpenses],
                        ['Kas masuk', preview.cashIn],
                        ['Kas keluar', -preview.cashOut],
                      ].map(([label, amount]) => (
                        <div
                          key={String(label)}
                          className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                        >
                          <span className="text-gray-600">{label}</span>
                          <span className="font-medium text-gray-900">
                            {formatRupiah(Number(amount))}
                          </span>
                        </div>
                      ))}

                      <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-4">
                        <span className="font-semibold text-gray-900">
                          Saldo seharusnya
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {formatRupiah(preview.expectedClosingBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="max-w-lg space-y-3">
                      <label
                        htmlFor="actualClosingBalance"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Saldo aktual (uang fisik, Rp)
                      </label>

                      <input
                        id="actualClosingBalance"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={actualClosingBalance}
                        onChange={(event) =>
                          setActualClosingBalance(event.target.value)
                        }
                        disabled={submitting}
                        placeholder="Hitung uang fisik lalu masukkan nominal"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
                      />

                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">
                          Selisih kas (aktual − seharusnya)
                        </p>
                        <p
                          className={`mt-1 text-xl font-bold ${
                            difference === null
                              ? 'text-gray-400'
                              : difference < 0
                                ? 'text-red-700'
                                : difference > 0
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                          }`}
                        >
                          {difference === null
                            ? 'Masukkan saldo aktual'
                            : formatRupiah(difference)}
                        </p>
                        {difference !== null && (
                          <p className="mt-1 text-xs text-gray-500">
                            {difference === 0
                              ? 'Saldo sesuai.'
                              : difference < 0
                                ? 'Kas fisik kurang dari saldo seharusnya.'
                                : 'Kas fisik lebih dari saldo seharusnya.'}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleCloseCash()}
                        disabled={
                          submitting ||
                          previewLoading ||
                          !preview ||
                          actualClosingBalance.trim() === ''
                        }
                        className="w-full rounded-xl bg-red-700 px-4 py-3 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting
                          ? 'Memproses penutupan...'
                          : 'Konfirmasi Tutup Kas'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Pratinjau saldo belum tersedia. Muat ulang halaman atau coba
                    lagi sebelum menutup kas.
                  </div>
                )}
              </div>
            ) : selectedCash?.status === 'CLOSED' ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="font-semibold text-gray-900">
                    Kas outlet {selectedOutlet?.name} sudah ditutup.
                  </p>
                  {selectedCash.closedAt && (
                    <p className="mt-1 text-sm text-gray-500">
                      Ditutup pada {formatDate(selectedCash.closedAt)}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Saldo seharusnya</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      {selectedCash.expectedClosingBalance === null
                        ? 'Belum tersedia'
                        : formatRupiah(selectedCash.expectedClosingBalance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Saldo aktual</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      {selectedCash.actualClosingBalance === null
                        ? 'Belum tersedia'
                        : formatRupiah(selectedCash.actualClosingBalance)}
                    </p>
                  </div>
                </div>

                {selectedCash.expectedClosingBalance !== null &&
                  selectedCash.actualClosingBalance !== null && (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-sm text-gray-500">Selisih kas</p>
                      <p
                        className={`mt-1 text-xl font-bold ${
                          Number(selectedCash.actualClosingBalance) -
                            Number(selectedCash.expectedClosingBalance) <
                          0
                            ? 'text-red-700'
                            : Number(selectedCash.actualClosingBalance) -
                                  Number(selectedCash.expectedClosingBalance) >
                                0
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {formatRupiah(
                          Number(selectedCash.actualClosingBalance) -
                            Number(selectedCash.expectedClosingBalance),
                        )}
                      </p>
                    </div>
                  )}

                <p className="text-sm text-gray-500">
                  Kas yang sudah ditutup tidak dapat dibuka kembali melalui
                  halaman ini.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-500">
                  Masukkan modal uang tunai yang tersedia di awal operasional.
                </p>

                <div className="mt-5 max-w-md">
                  <label
                    htmlFor="openingBalance"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Modal awal kas (Rp)
                  </label>

                  <input
                    id="openingBalance"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={openingBalance}
                    onChange={(event) => setOpeningBalance(event.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
                    placeholder="Contoh: 100000"
                  />

                  <button
                    type="button"
                    onClick={() => void handleOpenCash()}
                    disabled={submitting || !outletId}
                    className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Membuka kas...' : 'Buka Kas'}
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
