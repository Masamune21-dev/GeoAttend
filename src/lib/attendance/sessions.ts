import { format } from 'date-fns';
import { OPEN_SESSION_WINDOW_HOURS } from '@/lib/constants';

/** Bentuk minimal record absensi yang dibutuhkan untuk membentuk sesi. */
export interface AttendanceLike {
  type: string; // 'clock_in' | 'clock_out'
  timestamp: string | Date;
  shiftNumber?: number | null;
}

export interface WorkSession<T extends AttendanceLike> {
  /**
   * Tanggal lokal "yyyy-MM-dd" milik sesi = tanggal CLOCK-IN. Sesi yang masuk
   * 22:00 lalu pulang 02:00 keesokan hari tetap menjadi milik tanggal masuk,
   * bukan dua baris di dua tanggal berbeda.
   */
  date: string;
  shiftNumber: number | null;
  clockIn: T | null;
  clockOut: T | null;
}

/**
 * Bentuk sesi kerja (clock_in → clock_out) dari daftar record absensi
 * SATU pengguna. Pemanggil bertanggung jawab mengelompokkan per pengguna.
 *
 * Aturannya sama persis dengan yang dipakai rekap bulanan:
 * - clock_in membuka sesi baru; sesi sebelumnya yang belum ditutup dianggap
 *   lupa absen pulang (jam pulang tetap kosong).
 * - clock_out hanya menutup sesi bila masih dalam jendela bergulir
 *   {@link OPEN_SESSION_WINDOW_HOURS} jam — inilah yang membuat shift lintas
 *   tengah malam tetap utuh sekaligus mencegah clock-out esok lusa
 *   "menempel" ke sesi basi.
 * - clock_out tanpa sesi terbuka menjadi sesi berdiri sendiri tanpa jam masuk.
 *
 * @param records boleh tidak terurut; hasil selalu kronologis
 */
export function buildWorkSessions<T extends AttendanceLike>(
  records: T[],
  windowHours = OPEN_SESSION_WINDOW_HOURS
): WorkSession<T>[] {
  const windowMs = windowHours * 60 * 60 * 1000;
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const sessions: WorkSession<T>[] = [];
  let open: WorkSession<T> | null = null;

  for (const record of sorted) {
    const at = new Date(record.timestamp);
    const shiftNumber = record.shiftNumber ?? null;

    if (record.type === 'clock_in') {
      open = {
        date: format(at, 'yyyy-MM-dd'),
        shiftNumber,
        clockIn: record,
        clockOut: null,
      };
      sessions.push(open);
      continue;
    }

    const openedAt = open?.clockIn ? new Date(open.clockIn.timestamp).getTime() : null;
    if (openedAt !== null && at.getTime() - openedAt <= windowMs) {
      open!.clockOut = record;
      open = null;
    } else {
      sessions.push({
        date: format(at, 'yyyy-MM-dd'),
        shiftNumber,
        clockIn: null,
        clockOut: record,
      });
      open = null;
    }
  }

  return sessions;
}
