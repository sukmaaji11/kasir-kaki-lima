'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Outlet = {
  id: string;
  name: string;
  code: string | null;
};

type Category = {
  id: string;
  name: string;
};

const units = [
  { value: 'PCS', label: 'Pcs' },
  { value: 'KG', label: 'Kilogram' },
  { value: 'GRAM', label: 'Gram' },
  { value: 'LITER', label: 'Liter' },
  { value: 'ML', label: 'Mililiter' },
  { value: 'PACK', label: 'Pack' },
  { value: 'BOX', label: 'Box' },
  { value: 'IKAT', label: 'Ikat' },
  { value: 'PORSI', label: 'Porsi' },
];

export default function NewProductPage() {
  const router = useRouter();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [outletId, setOutletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [sellingPrice, setSellingPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [outletResponse, categoryResponse] = await Promise.all([
          fetch('/api/outlets'),
          fetch('/api/categories'),
        ]);

        const outletResult = await outletResponse.json();
        const categoryResult = await categoryResponse.json();

        if (!outletResponse.ok) {
          throw new Error(outletResult.message || 'Gagal memuat outlet.');
        }

        if (!categoryResponse.ok) {
          throw new Error(categoryResult.message || 'Gagal memuat kategori.');
        }

        if (cancelled) return;

        const outletData: Outlet[] = outletResult.data ?? [];
        const categoryData: Category[] = (categoryResult.data ?? []).filter(
          (category: Category & { isActive?: boolean }) =>
            category.isActive !== false,
        );

        setOutlets(outletData);
        setCategories(categoryData);

        if (outletData.length > 0) {
          setOutletId(outletData[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Gagal memuat data form.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!outletId) {
      setError('Buat outlet terlebih dahulu sebelum menambahkan produk.');
      return;
    }

    if (!name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }

    if (
      sellingPrice.trim() === '' ||
      !Number.isFinite(Number(sellingPrice)) ||
      Number(sellingPrice) < 0
    ) {
      setError('Masukkan harga jual yang valid.');
      return;
    }

    if (
      hpp.trim() !== '' &&
      (!Number.isFinite(Number(hpp)) || Number(hpp) < 0)
    ) {
      setError('Masukkan HPP yang valid.');
      return;
    }

    if (
      initialStock.trim() === '' ||
      !Number.isFinite(Number(initialStock)) ||
      Number(initialStock) < 0
    ) {
      setError('Masukkan stok awal yang valid.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          outletId,
          categoryId: categoryId || null,
          unit,
          sellingPrice: Number(sellingPrice),
          hpp: hpp.trim() === '' ? null : Number(hpp),
          initialStock: Number(initialStock),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal menyimpan produk.');
      }

      router.push('/dashboard/products');
      router.refresh();
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

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100';

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
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
          <Link
            href="/dashboard/products"
            className="font-medium text-gray-500 transition hover:text-[#17643e]"
          >
            Produk
          </Link>
          <span className="text-gray-300" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-[#17643e]">Tambah Produk</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Tambah Produk
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Masukkan informasi produk dan persediaan awal.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7"
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">
              Memuat data outlet dan kategori...
            </p>
          ) : (
            <>
              {outlets.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Bisnis ini belum memiliki outlet aktif. Buat outlet terlebih
                  dahulu sebelum menambahkan produk.
                </div>
              )}

              <div>
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-gray-700"
                >
                  Nama produk *
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  required
                  placeholder="Contoh: Es Teh Jumbo"
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="outlet"
                    className="text-sm font-medium text-gray-700"
                  >
                    Outlet *
                  </label>
                  <select
                    id="outlet"
                    value={outletId}
                    onChange={(event) => setOutletId(event.target.value)}
                    required
                    disabled={outlets.length === 0}
                    className={fieldClass}
                  >
                    <option value="">Pilih outlet</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                        {outlet.code ? ` (${outlet.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="category"
                    className="text-sm font-medium text-gray-700"
                  >
                    Kategori
                  </label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="unit"
                    className="text-sm font-medium text-gray-700"
                  >
                    Satuan *
                  </label>
                  <select
                    id="unit"
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    className={fieldClass}
                  >
                    {units.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sellingPrice"
                    className="text-sm font-medium text-gray-700"
                  >
                    Harga jual (Rp) *
                  </label>
                  <input
                    id="sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(event) => setSellingPrice(event.target.value)}
                    required
                    placeholder="5000"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="hpp"
                    className="text-sm font-medium text-gray-700"
                  >
                    HPP per satuan (Rp)
                  </label>
                  <input
                    id="hpp"
                    type="number"
                    min="0"
                    step="0.01"
                    value={hpp}
                    onChange={(event) => setHpp(event.target.value)}
                    placeholder="Opsional"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="initialStock"
                    className="text-sm font-medium text-gray-700"
                  >
                    Stok awal *
                  </label>
                  <input
                    id="initialStock"
                    type="number"
                    min="0"
                    step="0.001"
                    value={initialStock}
                    onChange={(event) => setInitialStock(event.target.value)}
                    required
                    className={fieldClass}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard/products"
              className="rounded-xl border border-gray-300 px-5 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Link>

            <button
              type="submit"
              disabled={loading || saving || outlets.length === 0}
              className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
