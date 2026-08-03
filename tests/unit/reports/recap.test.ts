import { describe, expect, it } from 'vitest';
import { buildRecap, type RecapInput } from '@/lib/reports/recap';
import type { AttendanceRecordResponse } from '@/types/api';
import type { ShiftTime } from '@/lib/shifts/calc';

const NOC_SHIFTS: ShiftTime[] = [
  { role: 'noc', shiftNumber: 1, startTime: '07:00', endTime: '15:00' },
  { role: 'noc', shiftNumber: 2, startTime: '15:00', endTime: '23:00' },
];

const USER = { id: 'u1', name: 'Misbakhul Munir', role: 'noc' };

/** Record absensi minimal — hanya kolom yang dipakai rekap yang berarti. */
function record(
  partial: Pick<AttendanceRecordResponse, 'id' | 'type' | 'timestamp'> &
    Partial<AttendanceRecordResponse>
): AttendanceRecordResponse {
  return {
    userId: USER.id,
    userName: USER.name,
    kind: 'shift',
    overtimeStatus: null,
    shiftNumber: null,
    latitude: 0,
    longitude: 0,
    accuracyMeters: null,
    photoUrl: '',
    isWithinGeofence: true,
    distanceFromCenter: 0,
    ...partial,
  };
}

function input(overrides: Partial<RecapInput> = {}): RecapInput {
  return {
    records: [],
    users: [USER],
    shifts: NOC_SHIFTS,
    leaves: [],
    scheduleEntries: [],
    monthStart: '2026-08-01',
    monthEnd: '2026-08-31',
    today: '2026-08-03',
    ...overrides,
  };
}

describe('buildRecap', () => {
  it('menghitung lembur dari sesi shift yang pulang lewat jam pulang', () => {
    // Kasus nyata: Shift 2 (15:00–23:00), masuk 15:45, pulang 01:03 hari
    // berikutnya → telat 45m, lembur 2j 3m. Aplikasi mobile dulu melaporkan
    // 0m karena hanya menjumlahkan sesi lembur urgent.
    const { rows, summaries } = buildRecap(
      input({
        records: [
          record({
            id: 'a',
            type: 'clock_in',
            shiftNumber: 2,
            timestamp: '2026-08-01T15:45:00+07:00',
          }),
          record({
            id: 'b',
            type: 'clock_out',
            shiftNumber: 2,
            timestamp: '2026-08-02T01:03:00+07:00',
          }),
        ],
      })
    );

    expect(rows).toHaveLength(1);
    // Pulang lewat tengah malam tetap masuk tanggal clock-in
    expect(rows[0].date).toBe('2026-08-01');
    expect(rows[0].clockInTime).toBe('15:45');
    expect(rows[0].clockOutTime).toBe('01:03');
    expect(rows[0].lateMinutes).toBe(45);
    expect(rows[0].overtimeMinutes).toBe(123);

    expect(summaries[0].presentDays).toBe(1);
    expect(summaries[0].totalLateMinutes).toBe(45);
    expect(summaries[0].totalOvertimeMinutes).toBe(123);
    expect(summaries[0].overtimeUrgentMinutes).toBe(0);
  });

  it('lembur urgent hanya masuk total setelah disetujui', () => {
    const pending = buildRecap(
      input({
        records: [
          record({
            id: 'c',
            type: 'clock_in',
            kind: 'lembur',
            overtimeStatus: 'pending',
            timestamp: '2026-08-02T23:00:00+07:00',
          }),
          record({
            id: 'd',
            type: 'clock_out',
            kind: 'lembur',
            timestamp: '2026-08-03T01:30:00+07:00',
          }),
        ],
      })
    );
    expect(pending.summaries[0].overtimeUrgentMinutes).toBe(0);
    expect(pending.summaries[0].overtimeUrgentPending).toBe(1);
    // Sesi lembur tidak menambah hari hadir
    expect(pending.summaries[0].presentDays).toBe(0);

    const approved = buildRecap(
      input({
        records: [
          record({
            id: 'c',
            type: 'clock_in',
            kind: 'lembur',
            overtimeStatus: 'approved',
            timestamp: '2026-08-02T23:00:00+07:00',
          }),
          record({
            id: 'd',
            type: 'clock_out',
            kind: 'lembur',
            timestamp: '2026-08-03T01:30:00+07:00',
          }),
        ],
      })
    );
    expect(approved.summaries[0].overtimeUrgentMinutes).toBe(150);
    expect(approved.summaries[0].overtimeUrgentCount).toBe(1);
  });

  it('hari bershift libur di jadwal tercatat otomatis, tapi tidak melewati hari ini', () => {
    const { rows, summaries } = buildRecap(
      input({
        scheduleEntries: [
          { userId: USER.id, date: '2026-08-02', shift: 'libur' },
          { userId: USER.id, date: '2026-08-09', shift: 'libur' }, // masih di depan
        ],
      })
    );
    expect(rows.map((r) => r.date)).toEqual(['2026-08-02']);
    expect(summaries[0].liburDays).toBe(1);
  });

  it('hasilnya sama walau TZ host bukan WIB', () => {
    // Waktu dinyatakan dalam UTC; batas tanggal harus tetap mengikuti WIB.
    const { rows } = buildRecap(
      input({
        records: [
          record({
            id: 'e',
            type: 'clock_in',
            shiftNumber: 1,
            timestamp: '2026-08-02T23:55:00Z', // = 3 Agustus 06:55 WIB
          }),
        ],
      })
    );
    expect(rows[0].date).toBe('2026-08-03');
    expect(rows[0].clockInTime).toBe('06:55');
    expect(rows[0].lateMinutes).toBe(0);
  });
});
