'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Outlet = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  outletId: string;
  outletName: string;
  category: string;
  amount: number;
  paymentMethod: string;
  description: string | null;
  expenseAt: string;
  recordedBy: string;
};

const categories = [
  { value: 'MATERIAL_PURCHASE', label: 'Belanja bahan baku' },
  { value: 'OPERATING', label: 'Operasional' },
  { value: 'OWNER_WITHDRAWAL', label: 'Pengambilan pemilik' },
  { value: 'OTHER', label: 'Lain-lain' },
];

const paymentMethods = [
  { value: 'CASH', label: 'Tunai' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const formatDateWIB = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

const categoryLabel = (value: string) =>
  categories.find((item) => item.value === value)?.label ?? value;

const paymentLabel = (value: string) =>
  paymentMethods.find((item) => item.value === value)?.label ?? value;

export default function ExpensesPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const [outletId, setOutletId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [today, setToday] = useState('');

  const [formOutletId, setFormOutletId] = useState('');
  const [category, setCategory] = useState('MATERIAL_PURCHASE');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [expenseDate, setExpenseDate] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (outletId) params.set('outletId', outletId);
      if (filterCategory) params.set('category', filterCategory);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const response = await fetch(`/api/expenses?${params.toString()}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Gagal mengambil pengeluaran.');
      }

      setExpenses(data.expenses ?? []);
      setTotalAmount(data.totalAmount ?? 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengambil data.',
      );
    } finally {
      setLoading(false);
    }
  }, [outletId, filterCategory, from, to]);

  useEffect(() => {
    async function initializePage() {
      const date = formatDateWIB(new Date());

      setToday(date);
      setFrom(date);
      setTo(date);
      setExpenseDate(date);

      try {
        const response = await fetch('/api/outlets', {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? 'Gagal mengambil outlet.');
        }

        const list: Outlet[] = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.outlets)
              ? data.outlets
              : [];

        setOutlets(list);

        if (list.length > 0) {
          setFormOutletId(list[0].id);
          setOutletId((current) => current || '');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Gagal mengambil outlet.',
        );
      }
    }

    void initializePage();
  }, []);

  useEffect(() => {
    if (from && to && from <= to) {
      void loadExpenses();
    }
  }, [from, to, loadExpenses]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const numericAmount = Number(amount);

    if (!formOutletId) {
      setError('Pilih outlet terlebih dahulu.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Nominal pengeluaran harus lebih dari nol.');
      return;
    }

    if (from && to && (expenseDate < from || expenseDate > to)) {
      setError(
        'Tanggal pengeluaran berada di luar periode filter. Sesuaikan filter atau tanggal pengeluaran.',
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: formOutletId,
          category,
          amount: numericAmount,
          paymentMethod,
          expenseDate: expenseDate || today,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Gagal menyimpan pengeluaran.');
      }

      setNotice('Pengeluaran berhasil dicatat.');
      setAmount('');
      setDescription('');
      setExpenseDate(today);

      await loadExpenses();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menyimpan.',
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
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
          <span className="font-medium text-[#17643e]">Pengeluaran Usaha</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Pengeluaran Usaha
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Catat dan pantau biaya operasional usahamu.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="font-semibold text-gray-900">Catat Pengeluaran</h2>
            <p className="mt-1 text-xs text-gray-500">
              Masukkan detail pengeluaran usaha.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Outlet
            </label>
            <select
              required
              value={formOutletId}
              onChange={(e) => setFormOutletId(e.target.value)}
              className={inputClass}
            >
              <option value="">Pilih outlet</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Metode pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputClass}
              >
                {paymentMethods.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nominal (Rp)
            </label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 25000"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tanggal pengeluaran
            </label>
            <input
              required
              type="date"
              value={expenseDate}
              max={today || undefined}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Keterangan (opsional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Contoh: beli gas LPG dan minyak goreng"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={saving || outlets.length === 0}
            className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
          </button>
        </form>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-green-800 p-5 text-white shadow-sm">
            <p className="text-sm text-green-100">
              {from === today && to === today
                ? 'Total Pengeluaran Hari Ini'
                : 'Total Pengeluaran Sesuai Filter'}
            </p>
            <p className="mt-3 text-3xl font-bold">
              {formatRupiah(totalAmount)}
            </p>

            <p className="mt-2 text-xs text-green-100">
              {from === today && to === today
                ? 'Total pengeluaran hari ini sesuai filter outlet dan kategori.'
                : 'Total pengeluaran berdasarkan periode dan filter yang dipilih.'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">Tips pencatatan</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Catat pengeluaran segera setelah transaksi.</li>
              <li>• Pilih outlet tempat biaya terjadi.</li>
              <li>• Simpan keterangan agar mudah ditelusuri.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold text-gray-900">Riwayat Pengeluaran</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gunakan filter untuk menemukan catatan pengeluaran.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Dari tanggal
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Sampai tanggal
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Outlet
            </label>
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className={inputClass}
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
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Kategori
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">Semua kategori</option>
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {from && to && from > to && (
          <p className="text-sm text-red-600">
            Tanggal awal tidak boleh melewati tanggal akhir.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3 font-medium">Tanggal</th>
                <th className="px-3 py-3 font-medium">Outlet</th>
                <th className="px-3 py-3 font-medium">Kategori</th>
                <th className="px-3 py-3 font-medium">Keterangan</th>
                <th className="px-3 py-3 font-medium">Pembayaran</th>
                <th className="px-3 py-3 text-right font-medium">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    Memuat pengeluaran...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    Belum ada pengeluaran pada periode ini.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                      {new Intl.DateTimeFormat('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(expense.expenseAt))}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {expense.outletName}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {categoryLabel(expense.category)}
                    </td>
                    <td className="max-w-56 truncate px-3 py-3 text-gray-600">
                      {expense.description || '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {paymentLabel(expense.paymentMethod)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-900">
                      {formatRupiah(expense.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Total pada kartu ringkasan menjumlahkan catatan yang dikembalikan API.
          Jika pengeluaran lebih dari 200 catatan, total tersebut belum mencakup
          seluruh data.
        </p>
      </section>
    </main>
  );
}
