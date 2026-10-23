'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Category = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal memuat kategori.');
      }

      setCategories(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kategori.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length > 60) {
      setError('Nama kategori harus terdiri dari 1–60 karakter.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal membuat kategori.');
      }

      setName('');
      setSuccess(`Kategori "${result.data.name}" berhasil dibuat.`);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat kategori.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: Category) {
    setError('');
    setSuccess('');
    setUpdatingId(category.id);

    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal mengubah status kategori.');
      }

      setSuccess(
        `Kategori "${category.name}" berhasil ${
          result.data.isActive ? 'diaktifkan' : 'dinonaktifkan'
        }.`,
      );

      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal mengubah status kategori.',
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredCategories = categories.filter((category) => {
    const matchesSearch = category.name
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesSearch && (showInactive || category.isActive);
  });

  const activeCount = categories.filter((category) => category.isActive).length;

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            ← Kembali ke Dashboard
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Manajemen Kategori
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Kelompokkan produk agar katalog lebih rapi.
              </p>
            </div>

            <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
              <p className="text-xs text-green-700">Kategori aktif</p>
              <p className="mt-1 text-xl font-bold text-green-800">
                {activeCount}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold text-gray-900">Tambah Kategori</h2>
          <p className="mt-1 text-sm text-gray-500">
            Contoh: Makanan, Minuman, Sembako, atau Camilan.
          </p>

          <form
            onSubmit={handleCreate}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
              placeholder="Masukkan nama kategori"
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : '+ Tambah Kategori'}
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {success && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700"
            >
              {success}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Daftar Kategori</h2>
              <p className="mt-1 text-sm text-gray-500">
                {categories.length} kategori tersimpan
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari kategori..."
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-600 sm:max-w-xs"
            />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="accent-green-700"
            />
            Tampilkan kategori nonaktif
          </label>

          {loading ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Memuat kategori...
            </p>
          ) : filteredCategories.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium text-gray-800">
                Belum ada kategori yang cocok
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Tambahkan kategori baru menggunakan formulir di atas.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">{category.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Dibuat{' '}
                      {new Date(category.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        category.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {category.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>

                    <button
                      type="button"
                      disabled={updatingId === category.id}
                      onClick={() => void toggleCategory(category)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {updatingId === category.id
                        ? 'Memproses...'
                        : category.isActive
                          ? 'Nonaktifkan'
                          : 'Aktifkan'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
