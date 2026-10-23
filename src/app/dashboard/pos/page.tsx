'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Product = {
  id: string;
  name: string;
  unit: string;
  sellingPrice: string;
  isActive: boolean;
  outlet: {
    id: string;
    name: string;
  };
  inventories: {
    quantity: string;
  }[];
};

type ProductResponse = {
  data: Product[];
};

type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER';

type CartItem = {
  product: Product;
  quantity: number;
};

type CheckoutResult = {
  message?: string;
  error?: string;
  sale?: {
    id: string;
    transactionNumber: string;
    paymentMethod: PaymentMethod;
    totalAmount: string;
    soldAt: string;
    items: {
      productId: string;
      name: string;
      quantity: string;
      unitPrice: string;
      lineTotal: string;
    }[];
  };
};

function formatRupiah(value: number | string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function getStock(product: Product) {
  return Number(product.inventories?.[0]?.quantity ?? 0);
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [outletId, setOutletId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<CheckoutResult['sale'] | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/products', {
        cache: 'no-store',
      });
      const result: ProductResponse & { error?: string } =
        await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Gagal memuat produk.');
      }

      const activeProducts = result.data.filter((product) => product.isActive);

      setProducts(activeProducts);

      setOutletId((current) => {
        if (
          current &&
          activeProducts.some((product) => product.outlet.id === current)
        ) {
          return current;
        }

        return activeProducts[0]?.outlet.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat produk.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const outletOptions = useMemo(() => {
    const unique = new Map<string, string>();

    for (const product of products) {
      unique.set(product.outlet.id, product.outlet.name);
    }

    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesOutlet = product.outlet.id === outletId;
      const matchesSearch = product.name.toLowerCase().includes(keyword);

      return matchesOutlet && matchesSearch;
    });
  }, [products, search, outletId]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total + Number(item.product.sellingPrice) * item.quantity,
        0,
      ),
    [cart],
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addProduct(product: Product) {
    setError('');
    setNotice('');
    setReceipt(null);

    const stock = getStock(product);

    if (stock <= 0) {
      setError(`Stok ${product.name} habis.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);

      if (existing) {
        if (existing.quantity + 1 > stock) {
          setError(`Stok ${product.name} hanya ${stock}.`);
          return current;
        }

        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, change: number) {
    setError('');
    setNotice('');
    setReceipt(null);

    setCart((current) =>
      current.flatMap((item) => {
        if (item.product.id !== productId) {
          return [item];
        }

        const nextQuantity = item.quantity + change;

        if (nextQuantity <= 0) {
          return [];
        }

        if (nextQuantity > getStock(item.product)) {
          setError(`Stok ${item.product.name} tidak mencukupi.`);
          return [item];
        }

        return [{ ...item, quantity: nextQuantity }];
      }),
    );
  }

  function removeProduct(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
    setReceipt(null);
    setNotice('');
  }

  async function checkout() {
    if (checkoutLoading) return;

    setError('');
    setNotice('');
    setReceipt(null);

    if (!outletId || cart.length === 0) {
      setError('Pilih outlet dan tambahkan produk ke keranjang.');
      return;
    }

    const invalidItem = cart.find(
      (item) =>
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > getStock(item.product),
    );

    if (invalidItem) {
      setError(`Periksa kembali stok ${invalidItem.product.name}.`);
      return;
    }

    setCheckoutLoading(true);

    try {
      const idempotencyKey = crypto.randomUUID();

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outletId,
          idempotencyKey,
          paymentMethod,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result: CheckoutResult = await response.json();

      if (!response.ok || !result.sale) {
        throw new Error(result.error ?? 'Checkout gagal.');
      }

      setReceipt(result.sale);
      setCart([]);
      setNotice('Pembayaran berhasil dicatat.');

      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout gagal.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  function startNewTransaction() {
    setReceipt(null);
    setNotice('');
    setError('');
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            KASIR KAKI LIMA
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Kasir POS
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Pilih produk, masukkan keranjang, lalu proses pembayaran.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadProducts()}
          disabled={loading || checkoutLoading}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Muat ulang produk
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

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      {receipt ? (
        <section className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Transaksi berhasil
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Pembayaran berhasil dicatat.
            </p>
            <p className="mt-4 text-3xl font-bold text-emerald-700">
              {formatRupiah(receipt.totalAmount)}
            </p>
          </div>

          <div className="mt-6 space-y-3 border-y border-dashed border-gray-200 py-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Nomor transaksi</span>
              <span className="text-right font-semibold text-gray-900">
                {receipt.transactionNumber}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Pembayaran</span>
              <span className="font-medium text-gray-900">
                {receipt.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Waktu</span>
              <span className="text-right text-gray-900">
                {new Date(receipt.soldAt).toLocaleString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                })}
              </span>
            </div>
          </div>

          <div className="my-4 space-y-3">
            {receipt.items.map((item, index) => (
              <div
                key={`${item.productId}-${index}`}
                className="flex justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="mt-1 text-gray-500">
                    {item.quantity} × {formatRupiah(item.unitPrice)}
                  </p>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatRupiah(item.lineTotal)}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={startNewTransaction}
            className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
          >
            Transaksi baru
          </button>
        </section>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
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
                  setCart([]);
                  setError('');
                }}
                disabled={checkoutLoading}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 outline-none focus:border-emerald-600"
              >
                {outletOptions.length === 0 && (
                  <option value="">Tidak ada outlet</option>
                )}
                {outletOptions.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>

              <label
                htmlFor="search"
                className="mb-2 mt-4 block text-sm font-medium text-gray-700"
              >
                Cari produk
              </label>
              <input
                id="search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ketik nama produk..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">Daftar produk</h2>
                <span className="text-sm text-gray-500">
                  {visibleProducts.length} produk
                </span>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                  Memuat produk...
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                  <p className="font-medium text-gray-900">
                    Produk tidak ditemukan
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Coba kata kunci lain atau periksa outlet yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProducts.map((product) => {
                    const stock = getStock(product);
                    const disabled = stock <= 0 || checkoutLoading;

                    return (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => addProduct(product)}
                        disabled={disabled}
                        className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-emerald-500 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex min-h-24 flex-col justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {product.name}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Stok: {stock} {product.unit}
                            </p>
                          </div>

                          <div className="flex items-end justify-between gap-2">
                            <span className="font-bold text-emerald-700">
                              {formatRupiah(product.sellingPrice)}
                            </span>
                            <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                              {stock > 0 ? '+ Tambah' : 'Habis'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Keranjang</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {cartCount} item
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="my-8 rounded-xl border border-dashed border-gray-300 p-6 text-center">
                <p className="font-medium text-gray-900">
                  Keranjang masih kosong
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Pilih produk untuk mulai transaksi.
                </p>
              </div>
            ) : (
              <div className="my-5 max-h-[380px] space-y-4 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="border-b border-gray-100 pb-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {item.product.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatRupiah(item.product.sellingPrice)} /{' '}
                          {item.product.unit}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeProduct(item.product.id)}
                        disabled={checkoutLoading}
                        aria-label={`Hapus ${item.product.name}`}
                        className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.product.id, -1)}
                          disabled={checkoutLoading}
                          aria-label="Kurangi jumlah"
                          className="h-9 w-9 rounded-lg border border-gray-200 text-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center font-semibold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.product.id, 1)}
                          disabled={
                            checkoutLoading ||
                            item.quantity >= getStock(item.product)
                          }
                          aria-label="Tambah jumlah"
                          className="h-9 w-9 rounded-lg border border-gray-200 text-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-semibold text-gray-900">
                        {formatRupiah(
                          Number(item.product.sellingPrice) * item.quantity,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-gray-200 pt-4">
              <div>
                <label
                  htmlFor="paymentMethod"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Metode pembayaran
                </label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as PaymentMethod)
                  }
                  disabled={checkoutLoading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 outline-none focus:border-emerald-600"
                >
                  <option value="CASH">Tunai (Cash)</option>
                  <option value="QRIS">QRIS</option>
                  <option value="TRANSFER">Transfer bank</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-500">Total pembayaran</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatRupiah(cartTotal)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void checkout()}
                disabled={
                  checkoutLoading || loading || cart.length === 0 || !outletId
                }
                className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkoutLoading
                  ? 'Memproses pembayaran...'
                  : 'Proses Pembayaran'}
              </button>

              <p className="text-xs leading-relaxed text-gray-500">
                Pastikan produk dan jumlahnya benar sebelum menyelesaikan
                transaksi.
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
