'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/constants';
import { STOCK_NAV } from '@/components/features/stock/stock-nav';

interface StockSidebarProps {
  appName: string;
  logoUrl?: string | null;
  /** Boleh kelola master barang (administrator / admin gudang). */
  canManage: boolean;
}

export function StockSidebar({ appName, logoUrl, canManage }: StockSidebarProps) {
  const pathname = usePathname();
  const nav = [
    ...STOCK_NAV.filter((n) => canManage || !n.adminOnly),
    { href: '/profile', label: 'Profil', icon: User },
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-surface md:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border/70 px-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" aria-hidden="true" className="h-9 w-9 rounded-md object-contain" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
            <Warehouse className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <span className="truncate text-lg font-bold tracking-tight text-text-primary">{appName}</span>
      </div>

      <nav aria-label="Navigasi stok" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary-subtle font-semibold text-primary'
                  : 'font-medium text-text-secondary hover:bg-secondary hover:text-text-primary'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={isActive ? 2.25 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="shrink-0 border-t border-border/70 px-5 py-3 text-[11px] text-text-secondary/70">
        {appName} v{APP_VERSION}
      </p>
    </aside>
  );
}
