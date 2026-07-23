import { describe, expect, it } from 'vitest';
import {
  computeRecap,
  formatMinutes,
  pickShift,
  timeToMinutes,
  type ShiftTime,
} from '@/lib/shifts/calc';

const ADMIN_SHIFTS: ShiftTime[] = [
  { role: 'admin', shiftNumber: 1, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', shiftNumber: 2, startTime: '15:00', endTime: '22:00' },
];

const TEKNISI_SHIFTS: ShiftTime[] = [
  { role: 'teknisi', shiftNumber: 1, startTime: '08:00', endTime: '16:00' },
];

/** Buat Date lokal di jam tertentu hari ini. */
function at(hours: number, minutes: number): Date {
  const d = new Date(2026, 6, 20); // tanggal arbitrer
  d.setHours(hours, minutes, 0, 0);
  return d;
}

describe('timeToMinutes', () => {
  it('konversi HH:mm ke menit', () => {
    expect(timeToMinutes('07:00')).toBe(420);
    expect(timeToMinutes('15:30')).toBe(930);
  });
});

describe('pickShift', () => {
  it('memilih shift dengan jam masuk terdekat dari waktu clock-in', () => {
    expect(pickShift(at(6, 45), ADMIN_SHIFTS)?.shiftNumber).toBe(1);
    expect(pickShift(at(14, 50), ADMIN_SHIFTS)?.shiftNumber).toBe(2);
    expect(pickShift(at(10, 0), ADMIN_SHIFTS)?.shiftNumber).toBe(1);
    expect(pickShift(at(20, 0), ADMIN_SHIFTS)?.shiftNumber).toBe(2);
  });

  it('mengembalikan null bila role tidak punya shift', () => {
    expect(pickShift(at(8, 0), [])).toBeNull();
  });
});

describe('computeRecap — aturan SOP', () => {
  it('datang lebih awal dihitung lembur', () => {
    // Teknisi masuk 07:30 (SOP 08:00) → lembur 30m
    const result = computeRecap({ clockIn: at(7, 30), clockOut: at(16, 0) }, TEKNISI_SHIFTS);
    expect(result.overtimeMinutes).toBe(30);
    expect(result.lateMinutes).toBe(0);
  });

  it('pulang lebih larut dihitung lembur', () => {
    // Teknisi pulang 17:15 (SOP 16:00) → lembur 75m
    const result = computeRecap({ clockIn: at(8, 0), clockOut: at(17, 15) }, TEKNISI_SHIFTS);
    expect(result.overtimeMinutes).toBe(75);
    expect(result.lateMinutes).toBe(0);
  });

  it('datang telat dihitung telat', () => {
    // Teknisi masuk 08:20 → telat 20m
    const result = computeRecap({ clockIn: at(8, 20), clockOut: at(16, 0) }, TEKNISI_SHIFTS);
    expect(result.lateMinutes).toBe(20);
    expect(result.overtimeMinutes).toBe(0);
  });

  it('telat pagi TIDAK membatalkan lembur sore (independen)', () => {
    // Masuk telat 30m, pulang lembur 60m → keduanya tercatat
    const result = computeRecap({ clockIn: at(8, 30), clockOut: at(17, 0) }, TEKNISI_SHIFTS);
    expect(result.lateMinutes).toBe(30);
    expect(result.overtimeMinutes).toBe(60);
  });

  it('lembur pagi + lembur sore dijumlahkan', () => {
    // Masuk 07:30 (lembur 30m), pulang 16:45 (lembur 45m) → total 75m
    const result = computeRecap({ clockIn: at(7, 30), clockOut: at(16, 45) }, TEKNISI_SHIFTS);
    expect(result.overtimeMinutes).toBe(75);
    expect(result.lateMinutes).toBe(0);
  });

  it('shift 2 admin: masuk 14:50 lembur 10m, pulang 22:30 lembur 30m', () => {
    const result = computeRecap({ clockIn: at(14, 50), clockOut: at(22, 30) }, ADMIN_SHIFTS);
    expect(result.shift?.shiftNumber).toBe(2);
    expect(result.overtimeMinutes).toBe(40);
    expect(result.lateMinutes).toBe(0);
  });

  it('belum clock-out: hanya hitung komponen pagi', () => {
    const result = computeRecap({ clockIn: at(8, 15), clockOut: null }, TEKNISI_SHIFTS);
    expect(result.lateMinutes).toBe(15);
    expect(result.overtimeMinutes).toBe(0);
  });

  it('role tanpa SOP: semua nol', () => {
    const result = computeRecap({ clockIn: at(8, 0), clockOut: at(20, 0) }, []);
    expect(result.shift).toBeNull();
    expect(result.lateMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
  });

  it('shift tercatat di record dipakai, bukan tebakan jam terdekat', () => {
    // Masuk 10:00 utk shift 2 (15:00) — pickShift akan menebak shift 1,
    // tapi shift tercatat = 2 → lembur 5 jam (datang lebih awal)
    const result = computeRecap(
      { clockIn: at(10, 0), clockOut: at(22, 0), shiftNumber: 2 },
      ADMIN_SHIFTS
    );
    expect(result.shift?.shiftNumber).toBe(2);
    expect(result.overtimeMinutes).toBe(300);
    expect(result.lateMinutes).toBe(0);
  });

  it('shift tercatat tidak dikenal: fallback ke jam masuk terdekat', () => {
    const result = computeRecap(
      { clockIn: at(7, 10), clockOut: at(15, 0), shiftNumber: 9 },
      ADMIN_SHIFTS
    );
    expect(result.shift?.shiftNumber).toBe(1);
    expect(result.lateMinutes).toBe(10);
  });

  it('pulang lebih awal dihitung pulang cepat, lembur datang awal TIDAK menutupinya', () => {
    // Shift 1 (07:00-15:00): masuk 06:00 → lembur 60m; pulang 14:00 → pulang cepat 60m
    const result = computeRecap(
      { clockIn: at(6, 0), clockOut: at(14, 0), shiftNumber: 1 },
      ADMIN_SHIFTS
    );
    expect(result.overtimeMinutes).toBe(60);
    expect(result.earlyLeaveMinutes).toBe(60);
    expect(result.lateMinutes).toBe(0);
  });

  it('pulang tepat waktu: pulang cepat nol', () => {
    const result = computeRecap(
      { clockIn: at(7, 0), clockOut: at(15, 0), shiftNumber: 1 },
      ADMIN_SHIFTS
    );
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.lateMinutes).toBe(0);
  });

  it('telat pagi + pulang cepat keduanya tercatat', () => {
    // Masuk 08:00 (telat 60m), pulang 14:30 (pulang cepat 30m)
    const result = computeRecap(
      { clockIn: at(8, 0), clockOut: at(14, 30), shiftNumber: 1 },
      ADMIN_SHIFTS
    );
    expect(result.lateMinutes).toBe(60);
    expect(result.earlyLeaveMinutes).toBe(30);
    expect(result.overtimeMinutes).toBe(0);
  });

  it('belum clock-out: pulang cepat belum dihitung', () => {
    const result = computeRecap(
      { clockIn: at(7, 0), clockOut: null, shiftNumber: 1 },
      ADMIN_SHIFTS
    );
    expect(result.earlyLeaveMinutes).toBe(0);
  });
});

describe('formatMinutes', () => {
  it('format menit ke jam+menit', () => {
    expect(formatMinutes(0)).toBe('-');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1j');
    expect(formatMinutes(90)).toBe('1j 30m');
  });
});
