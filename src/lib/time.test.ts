import { describe, expect, it } from 'vitest';
import { appMonth, appMonthStart, appToday } from './time';

describe('waktu operasional (WIB)', () => {
  it('06:40 WIB di awal bulan tetap terbaca sebagai hari itu, bukan hari sebelumnya', () => {
    // Senin 3 Agustus 2026 pukul 06:40 WIB = Minggu 2 Agustus 23:40 UTC.
    const now = new Date('2026-08-02T23:40:00Z');
    expect(appToday(now)).toBe('2026-08-03');
  });

  it('sebelum tengah malam WIB masih hari sebelumnya', () => {
    // Minggu 2 Agustus 2026 pukul 23:59 WIB = 16:59 UTC.
    expect(appToday(new Date('2026-08-02T16:59:00Z'))).toBe('2026-08-02');
    // Tepat 00:00 WIB → hari berganti.
    expect(appToday(new Date('2026-08-02T17:00:00Z'))).toBe('2026-08-03');
  });

  it('pergantian bulan mengikuti WIB', () => {
    // 1 September 2026 pukul 02:00 WIB = 31 Agustus 19:00 UTC.
    const now = new Date('2026-08-31T19:00:00Z');
    expect(appToday(now)).toBe('2026-09-01');
    expect(appMonth(now)).toBe('2026-09');
    expect(appMonthStart(now)).toBe('2026-09-01');
  });
});
