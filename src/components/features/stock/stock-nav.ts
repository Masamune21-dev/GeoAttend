import { ArrowLeftRight, ClipboardList, LayoutDashboard, Warehouse, type LucideIcon } from 'lucide-react';

export interface StockNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hanya administrator (kelola master barang). */
  adminOnly?: boolean;
}

/** Navigasi modul stok — dipakai sub-tab (dalam GeoAttend) & sidebar (shell stok). */
export const STOCK_NAV: StockNavItem[] = [
  { href: '/stock', label: 'Overview', icon: LayoutDashboard },
  { href: '/stock/inventory', label: 'Inventory', icon: Warehouse, adminOnly: true },
  { href: '/stock/movements', label: 'Masuk & Keluar', icon: ArrowLeftRight },
  { href: '/stock/history', label: 'Riwayat', icon: ClipboardList },
];
