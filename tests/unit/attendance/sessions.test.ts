import { describe, expect, it } from 'vitest';
import { buildWorkSessions } from '@/lib/attendance/sessions';

/**
 * Waktu ditulis TANPA sufiks Z supaya diinterpretasikan sebagai waktu lokal —
 * sama seperti tanggal yang dilihat karyawan, dan sama seperti pengelompokan
 * tanggal di rekap bulanan.
 */
function record(type: 'clock_in' | 'clock_out', local: string, shiftNumber: number | null = 1) {
  return { type, timestamp: new Date(local), shiftNumber };
}

describe('buildWorkSessions', () => {
  it('memasangkan clock_in dengan clock_out pada hari yang sama', () => {
    const sessions = buildWorkSessions([
      record('clock_in', '2026-07-29T07:00:00'),
      record('clock_out', '2026-07-29T15:10:00'),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-07-29');
    expect(sessions[0].clockIn).not.toBeNull();
    expect(sessions[0].clockOut).not.toBeNull();
  });

  it('shift lintas tengah malam tetap satu sesi milik TANGGAL MASUK', () => {
    const sessions = buildWorkSessions([
      record('clock_in', '2026-07-29T22:00:00', 2),
      record('clock_out', '2026-07-30T02:30:00', 2),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-07-29');
    expect(sessions[0].shiftNumber).toBe(2);
    expect(sessions[0].clockOut?.timestamp).toEqual(new Date('2026-07-30T02:30:00'));
  });

  it('clock_out di luar jendela 18 jam tidak menutup sesi basi', () => {
    const sessions = buildWorkSessions([
      record('clock_in', '2026-07-29T07:00:00'),
      record('clock_out', '2026-07-30T09:00:00'), // 26 jam kemudian
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBeNull(); // lupa absen pulang
    expect(sessions[1].clockIn).toBeNull(); // pulang yatim
    expect(sessions[1].date).toBe('2026-07-30');
  });

  it('clock_in baru menutup paksa sesi sebelumnya yang lupa clock_out', () => {
    const sessions = buildWorkSessions([
      record('clock_in', '2026-07-29T07:00:00'),
      record('clock_in', '2026-07-30T07:05:00'),
      record('clock_out', '2026-07-30T15:00:00'),
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBeNull();
    expect(sessions[1].clockOut).not.toBeNull();
  });

  it('mendukung dua shift dalam satu hari', () => {
    const sessions = buildWorkSessions([
      record('clock_in', '2026-07-29T07:00:00', 1),
      record('clock_out', '2026-07-29T15:00:00', 1),
      record('clock_in', '2026-07-29T16:00:00', 2),
      record('clock_out', '2026-07-29T22:00:00', 2),
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.date)).toEqual(['2026-07-29', '2026-07-29']);
    expect(sessions.map((s) => s.shiftNumber)).toEqual([1, 2]);
  });

  it('mengurutkan record yang datang acak', () => {
    const sessions = buildWorkSessions([
      record('clock_out', '2026-07-29T15:00:00'),
      record('clock_in', '2026-07-29T07:00:00'),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockIn).not.toBeNull();
    expect(sessions[0].clockOut).not.toBeNull();
  });

  it('menerima timestamp berupa string ISO', () => {
    const sessions = buildWorkSessions([
      { type: 'clock_in', timestamp: '2026-07-29T07:00:00.000Z', shiftNumber: 1 },
      { type: 'clock_out', timestamp: '2026-07-29T15:00:00.000Z', shiftNumber: 1 },
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockOut).not.toBeNull();
  });

  it('mengembalikan array kosong untuk masukan kosong', () => {
    expect(buildWorkSessions([])).toEqual([]);
  });
});
