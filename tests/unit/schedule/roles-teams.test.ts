import { describe, expect, it } from 'vitest';
import {
  isShiftAllowedForRole,
  shiftCycleForRole,
  shiftOptionsForRole,
} from '@/lib/schedule/roles';
import { isTeamOnDuty, teamOnDuty } from '@/lib/schedule/teams';
import { isMoppingDay } from '@/lib/schedule/display';
import { generateOffDaysOnly } from '@/lib/schedule/rotation';

describe('shiftOptionsForRole', () => {
  it('teknisi hanya punya Shift 1 dan Libur', () => {
    expect(shiftOptionsForRole('teknisi')).toEqual(['1', 'libur']);
  });

  it('admin & NOC punya dua shift', () => {
    expect(shiftOptionsForRole('admin')).toEqual(['1', '2', 'libur']);
    expect(shiftOptionsForRole('noc')).toEqual(['1', '2', 'libur']);
  });

  it('siklus klik sel selalu diawali kosong', () => {
    expect(shiftCycleForRole('teknisi')).toEqual([undefined, '1', 'libur']);
    expect(shiftCycleForRole('noc')).toEqual([undefined, '1', '2', 'libur']);
  });

  it('menolak Shift 2 untuk teknisi', () => {
    expect(isShiftAllowedForRole('teknisi', '2')).toBe(false);
    expect(isShiftAllowedForRole('teknisi', '1')).toBe(true);
    expect(isShiftAllowedForRole('teknisi', 'libur')).toBe(true);
    expect(isShiftAllowedForRole('noc', '2')).toBe(true);
  });
});

describe('teamOnDuty', () => {
  it('tanggal ganjil giliran tim ganjil', () => {
    expect(teamOnDuty('2026-07-01')).toBe('ganjil');
    expect(teamOnDuty('2026-07-31')).toBe('ganjil');
  });

  it('tanggal genap giliran tim genap', () => {
    expect(teamOnDuty('2026-07-02')).toBe('genap');
    expect(teamOnDuty('2026-07-30')).toBe('genap');
  });

  it('isTeamOnDuty mencocokkan tim dengan paritas tanggal', () => {
    expect(isTeamOnDuty('ganjil', '2026-07-07')).toBe(true);
    expect(isTeamOnDuty('ganjil', '2026-07-08')).toBe(false);
    expect(isTeamOnDuty('genap', '2026-07-08')).toBe(true);
  });

  it('teknisi tanpa tim tidak pernah siaga', () => {
    expect(isTeamOnDuty(null, '2026-07-07')).toBe(false);
    expect(isTeamOnDuty(undefined, '2026-07-08')).toBe(false);
  });
});

describe('isMoppingDay', () => {
  // Juli 2026: Sabtu jatuh pada 4, 11, 18, 25
  it('true hanya pada hari Sabtu', () => {
    for (const d of ['2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25']) {
      expect(isMoppingDay(d)).toBe(true);
    }
  });

  it('false pada hari selain Sabtu, termasuk Minggu', () => {
    expect(isMoppingDay('2026-07-05')).toBe(false); // Minggu
    expect(isMoppingDay('2026-07-06')).toBe(false); // Senin
  });
});

describe('generateOffDaysOnly', () => {
  it('mengisi hari kerja dengan Shift 1 dan hari libur dengan libur', () => {
    const result = generateOffDaysOnly('2026-07', [0]); // libur tiap Minggu
    expect(result['2026-07-05']).toBe('libur'); // Minggu
    expect(result['2026-07-06']).toBe('1'); // Senin
    expect(Object.keys(result)).toHaveLength(31);
  });

  it('tidak pernah menghasilkan Shift 2', () => {
    const result = generateOffDaysOnly('2026-07', [0, 6]);
    expect(Object.values(result)).not.toContain('2');
  });
});
