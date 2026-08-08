import { describe, it, expect } from 'vitest';
import {
  monthDates,
  detectOffWeekday,
  generateOffDaysOnly,
  generateRotation,
} from './rotation';
import type { ScheduleShift } from '@/types/api';

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

/**
 * Agustus 2026 (31 hari, tanggal 1 = Sabtu). Contoh diambil dari jadwal teknisi
 * yang benar-benar dipakai di produksi, supaya kasus nyatanya ikut terjaga:
 * ada yang liburnya tetap, ada yang pindah hari, ada yang tukar sehari.
 */
const AGUSTUS = monthDates('2026-08');

/** "1,libur,1,…" (31 nilai) → pembaca shift per tanggal. */
function shiftReader(csv: string) {
  const shifts = csv.split(',') as ScheduleShift[];
  const map = new Map(AGUSTUS.map((d, i) => [d, shifts[i]]));
  return (date: string) => map.get(date);
}

describe('detectOffWeekday', () => {
  it('mengenali hari libur tetap (ALIK: tiap Jumat)', () => {
    const read = shiftReader(
      '1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1'
    );
    expect(detectOffWeekday(AGUSTUS, read)).toBe(5); // Jumat
  });

  it('mengikuti kebiasaan TERBARU saat orangnya pindah hari libur (Triyo: Minggu → Jumat)', () => {
    const read = shiftReader(
      '1,1,1,1,1,1,1,1,libur,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1'
    );
    expect(detectOffWeekday(AGUSTUS, read)).toBe(5); // Jumat, bukan Minggu
  });

  it('tidak terpengaruh tukar libur sehari (Dicki: Minggu, sekali libur Jumat)', () => {
    const read = shiftReader(
      '1,libur,1,1,1,1,libur,1,1,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1'
    );
    expect(detectOffWeekday(AGUSTUS, read)).toBe(0); // Minggu
  });

  it('saat suara seri, hari libur paling baru yang menang', () => {
    // Libur 21 (Jum), 22 (Sab), 23 (Min) — masing-masing sekali
    const shifts = AGUSTUS.map((d) =>
      ['2026-08-21', '2026-08-22', '2026-08-23'].includes(d) ? 'libur' : '1'
    );
    expect(detectOffWeekday(AGUSTUS, (d) => shifts[AGUSTUS.indexOf(d)] as ScheduleShift)).toBe(0);
  });

  it('mengembalikan null bila tidak ada libur sama sekali', () => {
    expect(detectOffWeekday(AGUSTUS, () => '1')).toBeNull();
  });

  it('hasilnya bisa langsung dipakai generateOffDaysOnly untuk bulan berikutnya', () => {
    const read = shiftReader(
      '1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1,1,1,1,libur,1,1,1'
    );
    const off = detectOffWeekday(AGUSTUS, read)!;
    const september = generateOffDaysOnly('2026-09', [off]);
    // September 2026: Jumat jatuh di 4, 11, 18, 25
    for (const d of ['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25']) {
      expect(september[d]).toBe('libur');
    }
    expect(september['2026-09-01']).toBe('1');
  });
});
