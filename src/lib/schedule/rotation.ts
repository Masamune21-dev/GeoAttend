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
 * Isi jadwal sebulan untuk role yang hanya punya SATU shift (teknisi):
 * semua hari kerja = Shift 1, sisanya libur. Jadwal teknisi memang hanya
 * dipakai untuk menentukan hari libur, bukan pergantian shift.
 */
export function generateOffDaysOnly(
  month: string,
  offWeekdays: number[]
): Record<string, ScheduleShift> {
  const off = new Set(offWeekdays);
  const result: Record<string, ScheduleShift> = {};
  for (const dateStr of monthDates(month)) {
    const d = new Date(`${dateStr}T00:00:00`);
    result[dateStr] = off.has(d.getDay()) ? 'libur' : '1';
  }
  return result;
}

/**
 * Tebak hari libur mingguan seseorang dari jadwal yang sudah ada.
 *
 * Dipakai untuk meneruskan jadwal ke bulan berikutnya tanpa admin mengisi ulang
 * hari libur satu per satu. Yang dibaca hanya entri bershift `libur`.
 *
 * Dua hal yang sengaja diperhatikan:
 * - **Yang terbaru menang.** Kalau seseorang pindah hari libur di tengah bulan
 *   (mis. dari Minggu ke Jumat), yang diteruskan adalah kebiasaan barunya —
 *   makanya penghitungan dibatasi `recentWeeks` terakhir, bukan sebulan penuh.
 * - **Tukar libur tidak ikut menular.** Tukar sehari-dua hari kalah suara oleh
 *   pola mayoritas, jadi tidak terbawa jadi jadwal tetap bulan depan.
 *
 * Mengembalikan getDay() (0=Minggu … 6=Sabtu), atau null bila tidak ada libur.
 */
export function detectOffWeekday(
  dates: string[],
  shiftOf: (date: string) => ScheduleShift | undefined,
  recentWeeks = 3
): number | null {
  const liburDates = dates.filter((d) => shiftOf(d) === 'libur').sort();
  if (liburDates.length === 0) return null;

  const recent = liburDates.slice(-recentWeeks);
  const votes: Record<number, number> = {};
  for (const d of recent) {
    const wd = new Date(`${d}T00:00:00`).getDay();
    votes[wd] = (votes[wd] ?? 0) + 1;
  }

  // Suara terbanyak; bila seri, hari libur PALING BARU yang menang
  let best = new Date(`${recent[recent.length - 1]}T00:00:00`).getDay();
  let bestCount = votes[best] ?? 0;
  for (const [wd, count] of Object.entries(votes)) {
    if (count > bestCount) {
      best = Number(wd);
      bestCount = count;
    }
  }
  return best;
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
