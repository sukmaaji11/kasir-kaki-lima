'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth/auth-client';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'Login gagal. Periksa kredensialmu.');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f9f7] px-5 py-10 font-sans text-[#18251d]">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-lime-100/50 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_24px_80px_-30px_rgba(20,60,35,0.18)] md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-[#123c2a] p-12 text-white md:flex lg:p-14">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold">
              K
            </div>
            <p className="mt-5 text-sm font-medium tracking-[0.2em] text-emerald-200">
              KASIR KAKI LIMA
            </p>
          </div>

          <div className="my-14">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-3xl">
              ✳
            </div>
            <h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
              Usaha tertata,
              <br />
              cuan lebih terasa.
            </h1>
            <p className="mt-5 max-w-sm leading-7 text-emerald-100/75">
              Kelola transaksi dan operasional usaha kecilmu dari satu tempat.
              Praktis, rapi, dan mudah digunakan.
            </p>
          </div>

          <p className="text-xs text-emerald-100/50">
            Platform pengelolaan usaha untuk pedagang Indonesia.
          </p>
        </section>

        <section className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <div className="mb-10 md:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#123c2a] text-lg font-bold text-white">
              K
            </div>
            <p className="mt-3 text-xs font-semibold tracking-[0.18em] text-emerald-800">
              KASIR KAKI LIMA
            </p>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-sm font-medium text-emerald-700">
              Selamat datang kembali
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Masuk ke akunmu
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Masukkan username dan password untuk melanjutkan ke ruang kerjamu.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-20 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 text-xs font-medium text-gray-500 hover:text-emerald-700"
                >
                  {showPassword ? 'Sembunyikan' : 'Lihat'}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#17643e] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125332] focus:outline-none focus:ring-4 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sedang masuk...' : 'Masuk ke Dashboard'}
              {!loading && <span className="ml-2">→</span>}
            </button>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-center text-xs leading-5 text-gray-400">
              Akses khusus pengguna terdaftar.
              <br />
              Registrasi akun Owner tidak tersedia secara publik.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
