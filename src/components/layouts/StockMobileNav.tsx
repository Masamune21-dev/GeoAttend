'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STOCK_NAV } from '@/components/features/stock/stock-nav';

const NAV = [...STOCK_NAV, { href: '/profile', label: 'Profil', icon: User }];

export function StockMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi stok"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {NAV.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full px-3 py-1 transition-colors',
                isActive && 'bg-primary-subtle'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={isActive ? 2.25 : 2} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
