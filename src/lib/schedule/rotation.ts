import type { ScheduleShift } from '@/types/api';
import { toLocalDateString } from '@/lib/leaves';

/**
 * Helper jadwal shift: daftar tanggal bulan + generator pola rotasi mingguan.
 * Pola: karyawan "oper shift" tiap pekan (berbasis Senin), dengan hari libur
 * tetap per pekan. Semua fungsi murni agar mudah diuji.
 */

/** "yyyy-MM" lokal dari sebuah Date. */
export function toLocalMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Semua tanggal "yyyy-MM-dd" dalam sebuah bulan "yyyy-MM" (waktu lokal). */
export function monthDates(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const dates: string[] = [];
  const cursor = new Date(year, mon - 1, 1);
  while (cursor.getMonth() === mon - 1) {
    dates.push(toLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Nomor pekan berbasis Senin sejak epoch (5 Jan 1970 = Senin). */
function mondayWeekNumber(date: Date): number {
  const dayMs = 86_400_000;
  const epochMonday = Date.UTC(1970, 0, 5);
  const days = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - epochMonday) / dayMs
  );
  return Math.floor(days / 7);
}

/**
 * Isi jadwal sebulan dengan pola rotasi mingguan.
 * - `offWeekdays`: hari libur, memakai getDay() (0=Minggu … 6=Sabtu).
 * - `startShift` dipakai pada pekan PERTAMA bulan itu, lalu berselang-seling
 *   tiap pekan (oper shift tiap Senin).
 */
export function generateRotation(
  month: string,
  startShift: 1 | 2,
  offWeekdays: number[]
): Record<string, ScheduleShift> {
  const dates = monthDates(month);
  if (dates.length === 0) return {};

  const off = new Set(offWeekdays);
  const start: ScheduleShift = startShift === 1 ? '1' : '2';
  const other: ScheduleShift = startShift === 1 ? '2' : '1';
  const baseWeek = mondayWeekNumber(new Date(`${dates[0]}T00:00:00`));

  const result: Record<string, ScheduleShift> = {};
  for (const dateStr of dates) {
    const d = new Date(`${dateStr}T00:00:00`);
    if (off.has(d.getDay())) {
      result[dateStr] = 'libur';
      continue;
    }
    const parity = Math.abs(mondayWeekNumber(d) - baseWeek) % 2;
    result[dateStr] = parity === 0 ? start : other;
  }
  return result;
}

/**
 * Isi piket kebersihan sebulan secara round-robin: satu orang per hari,
 * bergiliran mengikuti urutan `userIds` (mulai dari `startIndex`).
 */
export function generatePiket(
  month: string,
  userIds: string[],
  startIndex = 0
): Record<string, string> {
  const dates = monthDates(month);
  const result: Record<string, string> = {};
  if (userIds.length === 0) return result;
  dates.forEach((dateStr, i) => {
    result[dateStr] = userIds[(i + startIndex) % userIds.length];
  });
  return result;
}
