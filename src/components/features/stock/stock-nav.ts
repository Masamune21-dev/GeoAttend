import { ArrowLeftRight, ClipboardList, LayoutDashboard, Warehouse } from 'lucide-react';

/** Navigasi modul stok — dipakai sub-tab (dalam GeoAttend) & sidebar (shell stok). */
export const STOCK_NAV = [
  { href: '/stock', label: 'Overview', icon: LayoutDashboard },
  { href: '/stock/inventory', label: 'Inventory', icon: Warehouse },
  { href: '/stock/movements', label: 'Masuk & Keluar', icon: ArrowLeftRight },
  { href: '/stock/history', label: 'Riwayat', icon: ClipboardList },
] as const;
