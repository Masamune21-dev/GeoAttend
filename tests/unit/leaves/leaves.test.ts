import { describe, expect, it } from 'vitest';
import {
  expandDateRange,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  rangesOverlap,
  toLocalDateString,
} from '@/lib/leaves';

describe('toLocalDateString', () => {
  it('format Date ke yyyy-MM-dd lokal', () => {
    expect(toLocalDateString(new Date(2026, 6, 23))).toBe('2026-07-23');
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('expandDateRange', () => {
  it('mengembangkan rentang inklusif', () => {
    expect(expandDateRange('2026-07-20', '2026-07-22')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
    ]);
  });

  it('satu hari = satu tanggal', () => {
    expect(expandDateRange('2026-07-23', '2026-07-23')).toEqual(['2026-07-23']);
  });

  it('lintas akhir bulan', () => {
    expect(expandDateRange('2026-07-31', '2026-08-02')).toEqual([
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('dibatasi maxDays', () => {
    expect(expandDateRange('2026-01-01', '2026-12-31', 5)).toHaveLength(5);
  });
});

describe('rangesOverlap', () => {
  it('deteksi tumpang-tindih', () => {
    expect(rangesOverlap('2026-07-20', '2026-07-25', '2026-07-24', '2026-07-30')).toBe(true);
    expect(rangesOverlap('2026-07-20', '2026-07-25', '2026-07-25', '2026-07-25')).toBe(true);
    expect(rangesOverlap('2026-07-20', '2026-07-22', '2026-07-23', '2026-07-24')).toBe(false);
  });
});

describe('label helpers', () => {
  it('label jenis', () => {
    expect(getLeaveTypeLabel('sakit')).toBe('Sakit');
    expect(getLeaveTypeLabel('libur')).toBe('Libur');
  });
  it('label status', () => {
    expect(getLeaveStatusLabel('pending')).toBe('Menunggu');
    expect(getLeaveStatusLabel('approved')).toBe('Disetujui');
    expect(getLeaveStatusLabel('rejected')).toBe('Ditolak');
  });
});
