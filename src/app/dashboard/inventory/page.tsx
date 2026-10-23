'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

type InventoryItem = {
  id: string;
  quantity: string | number;
  product: { id: string; name: string; unit: string };
  outlet: { id: string; name: string };
};

type Movement = {
  id: string;
  type: string;
  quantity: string | number;
  note: string | null;
  createdAt: string;
  inventory: {
    product: { name: string; unit: string };
    outlet: { name: string };
  };
};

type InventoryResponse = {
  inventories: InventoryItem[];
  movements: Movement[];
};

const movementLabels: Record<string, string> = {
  OPENING: 'Stok awal',
  IN: 'Stok masuk',
  OUT: 'Stok keluar',
  ADJUSTMENT: 'Penyesuaian',
  SALE: 'Penjualan',
  VOID: 'Pembatalan',
};

function numberFormat(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryResponse>({
    inventories: [],
    movements: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [productId, setProductId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [type, setType] = useState('IN');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal mengambil inventaris.');
      }

      setData(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal mengambil inventaris.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const selectedInventory = data.inventories.find(
    (item) => item.product.id === productId && item.outlet.id === outletId,
  );

  const availableOutlets = data.inventories
    .filter((item) => item.product.id === productId)
    .map((item) => item.outlet);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!productId || !outletId) {
      setError('Pilih produk dan outlet.');
      return;
    }

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount < 0) {
      setError('Jumlah stok tidak valid.');
      return;
    }

    if (type !== 'ADJUSTMENT' && amount <= 0) {
      setError('Jumlah stok harus lebih besar dari nol.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          outletId,
          type,
          ...(type === 'ADJUSTMENT'
            ? { targetQuantity: amount }
            : { quantity: amount }),
          note,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal memperbarui stok.');
      }

      setSuccess(
        `Stok berhasil diperbarui. Saldo sekarang: ${numberFormat(
          result.data.stockAfter,
        )} ${result.data.product.unit}.`,
      );
      setQuantity('');
      setNote('');
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui stok.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            ← Kembali ke Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Manajemen Stok
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Pantau persediaan dan catat setiap perubahan stok.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="rounded-xl bg-green-50 p-4 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold text-gray-900">Catat Pergerakan Stok</h2>

          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Memuat inventaris...</p>
          ) : data.inventories.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm text-gray-600">
                Belum ada inventaris produk aktif.
              </p>
              <Link
                href="/dashboard/products/new"
                className="mt-3 inline-block text-sm font-semibold text-green-700 hover:underline"
              >
                Tambah produk terlebih dahulu
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="product"
                    className="text-sm font-medium text-gray-700"
                  >
                    Produk *
                  </label>
                  <select
                    id="product"
                    required
                    value={productId}
                    onChange={(event) => {
                      const nextProductId = event.target.value;
                      setProductId(nextProductId);
                      const first = data.inventories.find(
                        (item) => item.product.id === nextProductId,
                      );
                      setOutletId(first?.outlet.id ?? '');
                    }}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  >
                    <option value="">Pilih produk</option>
                    {Array.from(
                      new Map(
                        data.inventories.map((item) => [
                          item.product.id,
                          item.product,
                        ]),
                      ).values(),
                    ).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="outlet"
                    className="text-sm font-medium text-gray-700"
                  >
                    Outlet *
                  </label>
                  <select
                    id="outlet"
                    required
                    value={outletId}
                    onChange={(event) => setOutletId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  >
                    {availableOutlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="type"
                    className="text-sm font-medium text-gray-700"
                  >
                    Jenis pergerakan *
                  </label>
                  <select
                    id="type"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  >
                    <option value="IN">Stok masuk</option>
                    <option value="OUT">Stok keluar</option>
                    <option value="ADJUSTMENT">Penyesuaian stok fisik</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="quantity"
                    className="text-sm font-medium text-gray-700"
                  >
                    {type === 'ADJUSTMENT'
                      ? 'Stok fisik saat ini *'
                      : 'Jumlah *'}
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder={
                      type === 'ADJUSTMENT' ? 'Contoh: 95' : 'Contoh: 10'
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  />
                </div>
              </div>

              {selectedInventory && (
                <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  Stok saat ini:{' '}
                  <strong>
                    {numberFormat(selectedInventory.quantity)}{' '}
                    {selectedInventory.product.unit}
                  </strong>
                </p>
              )}

              <div>
                <label
                  htmlFor="note"
                  className="text-sm font-medium text-gray-700"
                >
                  Catatan
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Contoh: Pembelian barang dari pemasok"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Menyimpan...' : 'Simpan Pergerakan Stok'}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold text-gray-900">Saldo Stok</h2>

          {loading ? (
            <p className="py-6 text-sm text-gray-500">Memuat stok...</p>
          ) : data.inventories.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">Belum ada data stok.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-3 pr-4 font-medium">Produk</th>
                    <th className="py-3 pr-4 font-medium">Outlet</th>
                    <th className="py-3 text-right font-medium">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventories.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {item.outlet.name}
                      </td>
                      <td className="py-3 text-right text-gray-900">
                        {numberFormat(item.quantity)} {item.product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold text-gray-900">
            Riwayat Pergerakan Stok
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Menampilkan maksimal 100 pergerakan terbaru.
          </p>

          {loading ? (
            <p className="py-6 text-sm text-gray-500">Memuat riwayat...</p>
          ) : data.movements.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">
              Belum ada riwayat pergerakan stok.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-3 pr-4 font-medium">Waktu</th>
                    <th className="py-3 pr-4 font-medium">Produk</th>
                    <th className="py-3 pr-4 font-medium">Jenis</th>
                    <th className="py-3 pr-4 text-right font-medium">
                      Perubahan
                    </th>
                    <th className="py-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                        {new Date(movement.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">
                          {movement.inventory.product.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {movement.inventory.outlet.name}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-gray-700">
                        {movementLabels[movement.type] ?? movement.type}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-gray-900">
                        {numberFormat(movement.quantity)}{' '}
                        {movement.inventory.product.unit}
                      </td>
                      <td className="py-3 text-gray-600">
                        {movement.note ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
