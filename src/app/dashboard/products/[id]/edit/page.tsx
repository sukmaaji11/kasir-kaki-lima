'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  unit: string;
  sellingPrice: string | number;
  hpp: string | number | null;
  categoryId: string | null;
  outletId: string;
  isActive: boolean;
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

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [sellingPrice, setSellingPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [productResponse, categoryResponse] = await Promise.all([
          fetch(`/api/products/${productId}`),
          fetch('/api/categories'),
        ]);

        const productResult = await productResponse.json();
        const categoryResult = await categoryResponse.json();

        if (!productResponse.ok) {
          throw new Error(
            productResult.message || 'Gagal mengambil detail produk.',
          );
        }

        if (!categoryResponse.ok) {
          throw new Error(
            categoryResult.message || 'Gagal mengambil kategori.',
          );
        }

        if (cancelled) return;

        const currentProduct: Product = productResult.data;

        setProduct(currentProduct);
        setName(currentProduct.name);
        setCategoryId(currentProduct.categoryId ?? '');
        setUnit(currentProduct.unit);
        setSellingPrice(String(currentProduct.sellingPrice));
        setHpp(currentProduct.hpp == null ? '' : String(currentProduct.hpp));

        const availableCategories: Category[] = (categoryResult.data ?? [])
          .filter(
            (category: Category & { isActive?: boolean }) =>
              category.isActive !== false,
          )
          .map((category: Category) => ({
            id: category.id,
            name: category.name,
          }));

        // Pertahankan kategori produk saat ini meskipun sudah nonaktif.
        if (
          currentProduct.categoryId &&
          !availableCategories.some(
            (category) => category.id === currentProduct.categoryId,
          )
        ) {
          const existingCategory = (categoryResult.data ?? []).find(
            (category: Category) => category.id === currentProduct.categoryId,
          );

          if (existingCategory) {
            availableCategories.push(existingCategory);
          }
        }

        setCategories(availableCategories);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Gagal memuat data produk.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }

    if (
      sellingPrice.trim() === '' ||
      !Number.isFinite(Number(sellingPrice)) ||
      Number(sellingPrice) < 0
    ) {
      setError('Harga jual tidak valid.');
      return;
    }

    if (
      hpp.trim() !== '' &&
      (!Number.isFinite(Number(hpp)) || Number(hpp) < 0)
    ) {
      setError('HPP tidak valid.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          categoryId: categoryId || null,
          unit,
          sellingPrice: Number(sellingPrice),
          hpp: hpp.trim() === '' ? null : Number(hpp),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal memperbarui produk.');
      }

      router.push('/dashboard/products');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memperbarui produk.',
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100';

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
          <span className="font-medium text-[#17643e]">Edit Produk</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Edit Produk
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Perbarui informasi produk tanpa mengubah stok.
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
            <p className="py-8 text-center text-sm text-gray-500">
              Memuat data produk...
            </p>
          ) : product ? (
            <>
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
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
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
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Outlet:</span>{' '}
                  {product.outletId}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Status:</span>{' '}
                  {product.isActive ? 'Aktif' : 'Nonaktif'}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Outlet dan stok tidak diubah melalui formulir ini.
                </p>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              Produk tidak ditemukan.
            </p>
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
              disabled={loading || saving || !product}
              className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
