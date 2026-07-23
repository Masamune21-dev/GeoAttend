/** Helper tampilan jadwal shift (dipakai halaman admin & karyawan). */

import type { SwapStatus } from '@/types/api';

export const SWAP_STATUS_LABEL: Record<SwapStatus, string> = {
  pending_peer: 'Menunggu rekan',
  pending_admin: 'Menunggu admin',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

export const SWAP_STATUS_VARIANT: Record<
  SwapStatus,
  'default' | 'success' | 'destructive' | 'warning' | 'secondary'
> = {
  pending_peer: 'warning',
  pending_admin: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'secondary',
};

/** Label singkat hari, di-index dengan getDay() (0=Minggu). */
export const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Urutan checkbox hari libur: Senin … Minggu (nilai = getDay()). */
export const WEEKDAY_ORDER: { value: number; label: string }[] = [
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Min' },
];

export const SHIFT_LABEL: Record<string, string> = { '1': 'S1', '2': 'S2', libur: 'L' };
export const SHIFT_FULL: Record<string, string> = { '1': 'Shift 1', '2': 'Shift 2', libur: 'Libur' };

/** Warna sel jadwal per shift. */
export function shiftCellClass(shift?: string | null): string {
  switch (shift) {
    case '1':
      return 'bg-yellow-200 text-yellow-900';
    case '2':
      return 'bg-sky-200 text-sky-900';
    case 'libur':
      return 'bg-red-200 text-red-800';
    default:
      return 'bg-white text-text-secondary';
  }
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** "2026-07" → "Juli 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Geser bulan "yyyy-MM" sebanyak delta bulan. */
export function addMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** getDay() dari sebuah "yyyy-MM-dd" (lokal). */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

export function isWeekend(dateStr: string): boolean {
  const d = weekdayOf(dateStr);
  return d === 0 || d === 6;
}
