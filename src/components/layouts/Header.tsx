'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from '@/lib/auth/client';
import { getInitials, getRoleLabel } from '@/lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/checkin': 'Absensi',
  '/history': 'Riwayat',
  '/profile': 'Profil',
  '/admin': 'Dashboard Admin',
  '/admin/live-map': 'Peta Live',
  '/admin/reports': 'Rekap Bulanan',
  '/admin/users': 'Kelola Pengguna',
  '/admin/settings': 'Pengaturan',
};

interface HeaderProps {
  userName: string;
  userRole: string;
  userImage?: string | null;
}

export function Header({ userName, userRole, userImage }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = PAGE_TITLES[pathname] ?? 'GeoAttend';

  const handleSignOut = async () => {
    await signOut();
    toast.success('Berhasil keluar');
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-surface/80 px-4 backdrop-blur-md md:px-6">
      <h1 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium leading-tight text-text-primary">{userName}</p>
          <p className="text-xs text-text-secondary">{getRoleLabel(userRole)}</p>
        </div>
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={userImage}
            alt=""
            aria-hidden="true"
            className="h-9 w-9 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white ring-2 ring-primary/20"
          >
            {getInitials(userName)}
          </span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Keluar dari aplikasi"
          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-destructive-subtle hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
