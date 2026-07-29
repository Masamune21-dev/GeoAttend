import { describe, it, expect } from 'vitest';
import { deriveScheduledLibur, shiftOnDate, shiftToNumber } from './libur';
import type { ScheduleEntry } from '@/types/api';

const entries: ScheduleEntry[] = [
  { userId: 'u1', date: '2026-07-01', shift: '1' },
  { userId: 'u1', date: '2026-07-05', shift: 'libur' },
  { userId: 'u1', date: '2026-07-12', shift: 'libur' },
  { userId: 'u2', date: '2026-07-05', shift: '2' },
  { userId: 'u2', date: '2026-07-06', shift: 'libur' },
];

const EMPTY: ReadonlySet<string> = new Set();

describe('shiftOnDate', () => {
  it('mengembalikan shift terjadwal', () => {
    expect(shiftOnDate(entries, 'u1', '2026-07-01')).toBe('1');
    expect(shiftOnDate(entries, 'u1', '2026-07-05')).toBe('libur');
  });

  it('null bila tidak dijadwalkan atau user belum diketahui', () => {
    expect(shiftOnDate(entries, 'u1', '2026-07-02')).toBeNull();
    expect(shiftOnDate(entries, undefined, '2026-07-01')).toBeNull();
  });
});

describe('shiftToNumber', () => {
  it('hanya shift kerja yang punya nomor', () => {
    expect(shiftToNumber('1')).toBe(1);
    expect(shiftToNumber('2')).toBe(2);
    expect(shiftToNumber('libur')).toBeNull();
    expect(shiftToNumber(null)).toBeNull();
  });
});

describe('deriveScheduledLibur', () => {
  it('mengambil hari bershift libur sampai tanggal batas saja', () => {
    const result = deriveScheduledLibur(entries, {
      until: '2026-07-06',
      attendedKeys: EMPTY,
      leaveKeys: EMPTY,
    });
    expect(result).toEqual([
      { userId: 'u1', date: '2026-07-05' },
      { userId: 'u2', date: '2026-07-06' },
    ]);
  });

  it('melewati tanggal yang karyawannya tetap absen', () => {
    const result = deriveScheduledLibur(entries, {
      until: '2026-07-31',
      attendedKeys: new Set(['u1|2026-07-05']),
      leaveKeys: EMPTY,
    });
    expect(result).toEqual([
      { userId: 'u1', date: '2026-07-12' },
      { userId: 'u2', date: '2026-07-06' },
    ]);
  });

  it('melewati tanggal yang sudah punya izin/libur tercatat (tidak dobel)', () => {
    const result = deriveScheduledLibur(entries, {
      until: '2026-07-31',
      attendedKeys: EMPTY,
      leaveKeys: new Set(['u1|2026-07-05', 'u1|2026-07-12']),
    });
    expect(result).toEqual([{ userId: 'u2', date: '2026-07-06' }]);
  });

  it('tidak menghasilkan duplikat bila entri jadwal kembar', () => {
    const dupes: ScheduleEntry[] = [
      { userId: 'u1', date: '2026-07-05', shift: 'libur' },
      { userId: 'u1', date: '2026-07-05', shift: 'libur' },
    ];
    expect(
      deriveScheduledLibur(dupes, { until: '2026-07-31', attendedKeys: EMPTY, leaveKeys: EMPTY })
    ).toHaveLength(1);
  });
});
