import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwnerContext } from '@/lib/auth/session';
import LogoutButton from './logout-button';

export const instant = false;

const navigation = [
  {
    label: 'MENU UTAMA',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '⌂' },
      { label: 'Kasir / POS', href: '/dashboard/pos', icon: '▣' },
      { label: 'Riwayat Penjualan', href: '/dashboard/sales', icon: '▤' },
    ],
  },
  {
    label: 'INVENTARIS',
    items: [{ label: 'Produk & Stok', href: '/dashboard/products', icon: '▦' }],
  },
  {
    label: 'KEUANGAN',
    items: [
      { label: 'Kas Harian', href: '/dashboard/cash', icon: '◉' },
      {
        label: 'Kas Masuk & Keluar',
        href: '/dashboard/cash-movements',
        icon: '↕',
      },
      { label: 'Pengeluaran', href: '/dashboard/expenses', icon: '−' },
      { label: 'Laporan Usaha', href: '/dashboard/reports', icon: '▥' },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let businessName = '';

  try {
    const { business } = await getOwnerContext();
    businessName = business.name;
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#f7f9f7] text-[#18251d]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <Link
          href="/dashboard"
          className="flex h-[76px] items-center gap-3 border-b border-gray-100 px-5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17643e] text-lg font-bold text-white">
            K
          </span>
          <span>
            <span className="block font-semibold">Kasir Kaki Lima</span>
            <span className="block text-xs text-gray-500">
              Panel Pengelolaan Usaha
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-6 overflow-y-auto p-4">
          {navigation.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.15em] text-gray-400">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-emerald-50 hover:text-[#17643e]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-lg">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-4">
          <p className="mb-3 px-3 text-xs text-gray-500">
            Kasir Kaki Lima · Owner
          </p>
          <LogoutButton />
        </div>
      </aside>

      {/* Topbar mobile: identitas usaha */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white lg:hidden">
        <div className="flex min-h-[76px] items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            aria-label="Kembali ke dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e9f5ed]"
          >
            <span className="text-xl" aria-hidden="true">
              🏪
            </span>
          </Link>

          <Link href="/dashboard" className="min-w-0 flex-1">
            <span className="block truncate text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">
              Kasir Kaki Lima
            </span>
            <span className="mt-0.5 block truncate text-base font-bold text-[#18251d]">
              {businessName}
            </span>
            <span className="mt-0.5 block text-[11px] text-gray-500">
              Panel pengelolaan usaha
            </span>
          </Link>

          <div className="shrink-0">
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Konten halaman */}
      <div className="min-h-screen lg:pl-64">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
