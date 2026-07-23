import { describe, it, expect } from 'vitest';
import { monthDates, generateRotation } from './rotation';

// Juli 2026: 31 hari, tanggal 1 = Rabu, Minggu jatuh di 5/12/19/26.
describe('monthDates', () => {
  it('mengembalikan semua tanggal bulan', () => {
    const dates = monthDates('2026-07');
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe('2026-07-01');
    expect(dates[30]).toBe('2026-07-31');
  });

  it('menangani panjang bulan berbeda (Februari non-kabisat)', () => {
    expect(monthDates('2026-02')).toHaveLength(28);
  });
});

describe('generateRotation', () => {
  it('menandai hari Minggu sebagai libur', () => {
    const r = generateRotation('2026-07', 1, [0]);
    for (const d of ['2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26']) {
      expect(r[d]).toBe('libur');
    }
  });

  it('oper shift tiap pekan mulai dari startShift (pekan pertama = shift 1)', () => {
    const r = generateRotation('2026-07', 1, [0]);
    expect(r['2026-07-01']).toBe('1'); // pekan 1
    expect(r['2026-07-06']).toBe('2'); // Senin, pekan 2 -> oper
    expect(r['2026-07-13']).toBe('1'); // pekan 3
    expect(r['2026-07-20']).toBe('2'); // pekan 4
    expect(r['2026-07-27']).toBe('1'); // pekan 5
  });

  it('startShift 2 membalik fase rotasi', () => {
    const r = generateRotation('2026-07', 2, [0]);
    expect(r['2026-07-01']).toBe('2');
    expect(r['2026-07-06']).toBe('1');
  });

  it('mendukung beberapa hari libur (Sabtu + Minggu)', () => {
    const r = generateRotation('2026-07', 1, [0, 6]);
    expect(r['2026-07-04']).toBe('libur'); // Sabtu
    expect(r['2026-07-05']).toBe('libur'); // Minggu
    expect(r['2026-07-06']).toBe('2'); // Senin tetap kerja
  });

  it('setiap hari kerja bernilai shift 1 atau 2', () => {
    const r = generateRotation('2026-07', 1, [0]);
    for (const [date, shift] of Object.entries(r)) {
      const isSunday = new Date(`${date}T00:00:00`).getDay() === 0;
      expect(shift).toBe(isSunday ? 'libur' : shift);
      if (!isSunday) expect(['1', '2']).toContain(shift);
    }
  });
});
