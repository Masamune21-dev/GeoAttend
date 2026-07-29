import type { ScheduleEntry, ScheduleShift } from '@/types/api';

/**
 * Libur otomatis dari jadwal shift.
 *
 * Hari yang dijadwalkan `libur` LANGSUNG terhitung libur di rekap — karyawan
 * tidak perlu menekan tombol "Libur Hari Ini". Penanda libur manual tetap ada
 * untuk libur dadakan yang tidak ada di jadwal.
 */

/** Shift terjadwal seseorang pada sebuah tanggal (null bila tidak dijadwalkan). */
export function shiftOnDate(
  entries: ScheduleEntry[],
  userId: string | undefined,
  date: string
): ScheduleShift | null {
  if (!userId) return null;
  return entries.find((e) => e.userId === userId && e.date === date)?.shift ?? null;
}

/** Nomor shift untuk absensi ('1'/'2' → 1/2; libur & kosong → null). */
export function shiftToNumber(shift: ScheduleShift | null): number | null {
  return shift === '1' || shift === '2' ? Number(shift) : null;
}

export interface ScheduledLiburOptions {
  /** Tanggal terakhir yang dihitung ("yyyy-MM-dd") — biasanya hari ini. */
  until: string;
  /** Kunci `userId|date` yang sudah punya sesi absensi. */
  attendedKeys: ReadonlySet<string>;
  /** Kunci `userId|date` yang sudah punya izin/libur tercatat. */
  leaveKeys: ReadonlySet<string>;
}

/**
 * Saring entri jadwal bershift `libur` menjadi daftar (userId, tanggal) yang
 * layak menjadi baris "Libur" di rekap:
 *
 * - hanya sampai `until` — libur yang belum tiba tidak dihitung;
 * - dilewati bila karyawan TETAP absen pada tanggal itu (mis. dipanggil masuk)
 *   → baris kehadiran yang menang;
 * - dilewati bila sudah ada izin/libur tercatat pada tanggal itu → tidak
 *   terhitung dua kali.
 */
export function deriveScheduledLibur(
  entries: ScheduleEntry[],
  { until, attendedKeys, leaveKeys }: ScheduledLiburOptions
): { userId: string; date: string }[] {
  const result: { userId: string; date: string }[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.shift !== 'libur' || entry.date > until) continue;
    const key = `${entry.userId}|${entry.date}`;
    if (seen.has(key) || attendedKeys.has(key) || leaveKeys.has(key)) continue;
    seen.add(key);
    result.push({ userId: entry.userId, date: entry.date });
  }

  return result;
}
