'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  unit: string;
  sellingPrice: string | number;
  hpp: string | number | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  outlet: { id: string; name: string };
  inventories: { quantity: string | number }[];
};

function formatRupiah(value: string | number | null) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function toggleProduct(product: Product) {
    const action = product.isActive ? 'menonaktifkan' : 'mengaktifkan';

    if (!window.confirm(`Yakin ingin ${action} produk "${product.name}"?`)) {
      return;
    }

    setError('');

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal mengubah status produk.');
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, isActive: result.data.isActive }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal mengubah status produk.',
      );
    }
  }
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch('/api/products');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Gagal mengambil produk.');
        }

        if (!cancelled) {
          setProducts(result.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.category?.name ?? ''} ${product.outlet.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
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
              <span className="font-medium text-[#17643e]">Produk</span>
            </nav>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Manajemen Produk
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
              Kelola produk, harga jual, dan stok setiap outlet.
            </p>
          </div>

          <Link
            href="/dashboard/products/new"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#17643e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#125332] sm:w-auto"
          >
            <span className="mr-2 text-lg leading-none" aria-hidden="true">
              +
            </span>
            Tambah Produk
          </Link>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Daftar Produk</h2>
              <p className="mt-1 text-sm text-gray-500">
                {products.length} produk terdaftar
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, kategori, atau outlet..."
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-600 sm:max-w-sm"
            />
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Memuat daftar produk...
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center">
              <p className="font-medium text-gray-800">
                {search ? 'Produk tidak ditemukan' : 'Belum ada produk'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {search
                  ? 'Coba gunakan kata kunci lain.'
                  : 'Tambahkan produk pertama untuk mulai mengelola persediaan.'}
              </p>

              {!search && (
                <Link
                  href="/dashboard/products/new"
                  className="mt-4 inline-block rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
                >
                  Tambah Produk
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {product.name}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {product.category?.name ?? 'Tanpa kategori'} ·{' '}
                          {product.outlet.name}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          product.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {product.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Harga jual</p>
                        <p className="mt-1 font-semibold text-gray-900">
                          {formatRupiah(product.sellingPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Stok</p>
                        <p className="mt-1 font-semibold text-gray-900">
                          {Number(product.inventories[0]?.quantity ?? 0)}{' '}
                          {product.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">HPP</p>
                        <p className="mt-1 text-gray-700">
                          {product.hpp == null
                            ? 'Belum diatur'
                            : formatRupiah(product.hpp)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                      <Link
                        href={`/dashboard/products/${product.id}/edit`}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        onClick={() => void toggleProduct(product)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-3 font-medium">Produk</th>
                      <th className="px-3 py-3 font-medium">Kategori</th>
                      <th className="px-3 py-3 font-medium">Outlet</th>
                      <th className="px-3 py-3 text-right font-medium">
                        Harga jual
                      </th>
                      <th className="px-3 py-3 text-right font-medium">Stok</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-4">
                          <p className="font-medium text-gray-900">
                            {product.name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            HPP:{' '}
                            {product.hpp == null
                              ? 'Belum diatur'
                              : formatRupiah(product.hpp)}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-gray-600">
                          {product.category?.name ?? '—'}
                        </td>
                        <td className="px-3 py-4 text-gray-600">
                          {product.outlet.name}
                        </td>
                        <td className="px-3 py-4 text-right font-medium text-gray-900">
                          {formatRupiah(product.sellingPrice)}
                        </td>
                        <td className="px-3 py-4 text-right text-gray-700">
                          {Number(product.inventories[0]?.quantity ?? 0)}{' '}
                          {product.unit}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              product.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {product.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/products/${product.id}/edit`}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </Link>

                            <button
                              type="button"
                              onClick={() => void toggleProduct(product)}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
