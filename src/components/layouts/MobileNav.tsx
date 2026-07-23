'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Camera, LayoutDashboard, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isAdmin: boolean;
}

export function MobileNav({ isAdmin }: MobileNavProps) {
  const pathname = usePathname();

  // Administrator: tab Admin di depan (paling sering dipakai)
  const items = isAdmin
    ? [
        { href: '/admin', label: 'Admin', icon: LayoutDashboard },
        { href: '/checkin', label: 'Absen', icon: Camera },
        { href: '/history', label: 'Riwayat', icon: CalendarDays },
        { href: '/profile', label: 'Profil', icon: User },
      ]
    : [
        { href: '/checkin', label: 'Absen', icon: Camera },
        { href: '/history', label: 'Riwayat', icon: CalendarDays },
        { href: '/profile', label: 'Profil', icon: User },
      ];

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {items.map((item) => {
        const isActive =
          item.href === '/admin' ? pathname.startsWith('/admin') : pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full px-4 py-1 transition-colors',
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
