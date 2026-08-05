import type { ScheduleShift, SwapStatus } from '../api/types';
import type { Tone } from '../components/ui';

/** Helper jadwal shift untuk aplikasi mobile (murni, tanpa dependensi UI). */

export const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Inisial hari untuk kepala kalender (Minggu → Sabtu). */
export const WEEKDAY_INITIAL = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function toLocalMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthDates(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const dates: string[] = [];
  const cursor = new Date(year, mon - 1, 1);
  while (cursor.getMonth() === mon - 1) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function addMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

/** "2026-07-24" → "Kam, 24 Jul". */
export function formatShortDate(dateStr: string): string {
  const day = Number(dateStr.slice(-2));
  const mon = Number(dateStr.slice(5, 7));
  return `${WEEKDAY_SHORT[weekdayOf(dateStr)]}, ${day} ${MONTH_NAMES[mon - 1].slice(0, 3)}`;
}

/**
 * Pengelompokan role pada kartu roster harian. Label & urutannya disamakan
 * dengan grid jadwal di web (ROLE_GROUP_LABEL / ROLE_ORDER) supaya admin
 * membaca istilah yang sama di kedua tempat.
 */
export const ROSTER_ROLE_LABEL: Record<string, string> = {
  admin: 'Admin & CS',
  noc: 'NOC',
  teknisi: 'Teknisi',
};

export const ROSTER_ROLE_ORDER: Record<string, number> = { admin: 0, noc: 1, teknisi: 2 };

export const SHIFT_BADGE: Record<ScheduleShift, { label: string; tone: Tone }> = {
  '1': { label: 'Shift 1', tone: 'primary' },
  '2': { label: 'Shift 2', tone: 'warning' },
  libur: { label: 'Libur', tone: 'neutral' },
};

export const SWAP_META: Record<SwapStatus, { label: string; tone: Tone }> = {
  pending_peer: { label: 'Menunggu rekan', tone: 'warning' },
  pending_admin: { label: 'Menunggu admin', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'success' },
  rejected: { label: 'Ditolak', tone: 'destructive' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
};

/** Warna titik penanda di kalender jadwal. */
export const SHIFT_DOT: Record<ScheduleShift, string> = {
  '1': '#2563EB',
  '2': '#0EA5E9',
  libur: '#CBD5E1',
};

/** Titik kedua pada tanggal saat pengguna kebagian piket. */
export const PIKET_DOT = '#F59E0B';
