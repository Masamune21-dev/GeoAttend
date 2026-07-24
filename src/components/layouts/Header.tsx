'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from '@/lib/auth/client';
import { getRoleLabel } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

const PAGE_TITLES: Record<string, string> = {
  '/checkin': 'Absensi',
  '/history': 'Riwayat',
  '/profile': 'Profil',
  '/stock': 'Overview',
  '/stock/inventory': 'Inventory',
  '/stock/movements': 'Masuk & Keluar',
  '/stock/history': 'Riwayat',
  '/admin': 'Dashboard Admin',
  '/admin/live-map': 'Peta Live',
  '/admin/reports': 'Rekap Bulanan',
  '/admin/leaves': 'Persetujuan Izin',
  '/admin/users': 'Kelola Pengguna',
  '/admin/settings': 'Pengaturan',
};

interface HeaderProps {
  userName: string;
  userRole: string;
  userImage?: string | null;
  brandName?: string;
}

export function Header({ userName, userRole, userImage, brandName = 'GeoAttend' }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = PAGE_TITLES[pathname] ?? brandName;

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
        <Avatar
          src={userImage}
          name={userName}
          className="h-9 w-9"
          textClassName="text-sm"
          ring
          preview
        />
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
