import type { AttendanceKind, AttendanceRecordResponse } from '../api/types';

/**
 * Jendela "sesi kerja terbuka" (jam). Sesi (masuk → pulang) bisa menembus tengah
 * malam (Shift 2 masuk 15:00, pulang 02:00 keesokan hari), jadi status
 * masuk/pulang ditentukan dari record terakhir dalam jendela ini — bukan "sejak
 * tengah malam".
 *
 * WAJIB sama dengan OPEN_SESSION_WINDOW_HOURS di server: kalau app memakai
 * jendela lebih pendek, absen masuk yang sudah lewat batas tidak ikut terambil,
 * tombol balik jadi "Presensi Masuk", dan absen pulang tercatat sebagai sesi
 * masuk baru.
 */
export const OPEN_SESSION_WINDOW_HOURS = 22;

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

/** Satu sesi lembur: record pembuka + penutupnya (bila sudah ditutup). */
export interface OvertimeSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  notes: string | null;
}

/**
 * Rakit sesi lembur dari daftar record absensi (terurut menurun).
 *
 * Server belum punya endpoint khusus lembur, jadi record `kind='lembur'`
 * dipasangkan di sisi klien: pembuka (`clock_in`) dengan penutup terdekat
 * SETELAHNYA — yang pada daftar menurun berada di indeks sebelumnya.
 * Status verifikasi hanya ada di record pembuka.
 */
export function buildOvertimeSessions(records: AttendanceRecordResponse[]): OvertimeSession[] {
  const lembur = records.filter((r) => r.kind === 'lembur');
  const sessions: OvertimeSession[] = [];
  for (let i = 0; i < lembur.length; i += 1) {
    const record = lembur[i];
    if (record.type !== 'clock_in') continue;
    const closer = lembur[i - 1];
    sessions.push({
      id: record.id,
      startedAt: record.timestamp,
      endedAt: closer?.type === 'clock_out' ? closer.timestamp : null,
      status: record.overtimeStatus ?? 'pending',
      notes: record.notes ?? null,
    });
  }
  return sessions;
}
