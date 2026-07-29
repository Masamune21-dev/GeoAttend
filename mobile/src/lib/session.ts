import type { AttendanceKind, AttendanceRecordResponse } from '../api/types';

/**
 * Jendela "sesi kerja terbuka" (jam). Sesi (masuk → pulang) bisa menembus tengah
 * malam (Shift 2 masuk 15:00, pulang 02:00 keesokan hari), jadi status
 * masuk/pulang ditentukan dari record terakhir dalam jendela ini — bukan "sejak
 * tengah malam". Selaras dengan OPEN_SESSION_WINDOW_HOURS di server.
 */
export const OPEN_SESSION_WINDOW_HOURS = 18;

/** ISO batas bawah jendela sesi, untuk query `?from=`. */
export function sessionWindowStart(now: Date = new Date()): string {
  return new Date(now.getTime() - OPEN_SESSION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

export interface OpenSession {
  /** Aksi absensi berikutnya menurut record terakhir. */
  nextType: 'clock_in' | 'clock_out';
  /** Record pembuka sesi yang masih terbuka (null bila tidak ada sesi berjalan). */
  openRecord: AttendanceRecordResponse | null;
  /** Jenis sesi berjalan; 'shift' bila belum ada sesi. */
  kind: AttendanceKind;
}

/**
 * Turunkan status sesi dari daftar record terurut menurun (terbaru dulu).
 * Dipakai bersama oleh Dashboard (label tombol) & layar Absen.
 */
export function deriveOpenSession(records: AttendanceRecordResponse[]): OpenSession {
  const last = records[0];
  const isOpen = last?.type === 'clock_in';
  return {
    nextType: isOpen ? 'clock_out' : 'clock_in',
    openRecord: isOpen ? last : null,
    kind: isOpen ? last.kind ?? 'shift' : 'shift',
  };
}
