import { describe, expect, it } from 'vitest';
import { selectDueReminders, type ReminderSubject } from './reminders';

const SHIFT_ADMIN = [
  { role: 'admin', shiftNumber: 1, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', shiftNumber: 2, startTime: '15:00', endTime: '23:00' },
];
const SHIFT_TEKNISI = [{ role: 'teknisi', shiftNumber: 1, startTime: '08:00', endTime: '16:00' }];

function subject(over: Partial<ReminderSubject> = {}): ReminderSubject {
  return {
    userId: 'u1',
    role: 'teknisi',
    shifts: SHIFT_TEKNISI,
    scheduled: null,
    approvedLeaveTypes: [],
    alreadyClockedIn: false,
    remindedShiftNumbers: [],
    ...over,
  };
}

/** Jam WIB → menit sejak tengah malam. */
function at(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const LEAD = 15;

function run(nowWib: string, subjects: ReminderSubject[]) {
  return selectDueReminders({ nowMinutes: at(nowWib), leadMinutes: LEAD, subjects });
}

describe('selectDueReminders — jendela waktu', () => {
  it('mengirim saat sisa waktu tepat di batas lead', () => {
    const due = run('07:45', [subject()]);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ shiftNumber: 1, startTime: '08:00', minutesUntilStart: 15 });
  });

  it('belum mengirim saat masih di luar jendela', () => {
    expect(run('07:44', [subject()])).toHaveLength(0);
  });

  it('masih mengirim saat putaran sebelumnya terlewat', () => {
    // Timer mati beberapa menit; pengingat telat tapi shift belum mulai.
    expect(run('07:56', [subject()])[0].minutesUntilStart).toBe(4);
  });

  it('tidak mengirim tepat saat shift mulai — itu bukan lagi pengingat', () => {
    expect(run('08:00', [subject()])).toHaveLength(0);
  });

  it('tidak mengirim setelah shift berjalan', () => {
    expect(run('08:30', [subject()])).toHaveLength(0);
  });
});

describe('selectDueReminders — jadwal', () => {
  it('melewati hari libur terjadwal', () => {
    expect(run('07:50', [subject({ scheduled: 'libur' })])).toHaveLength(0);
  });

  it('memakai shift 2 bila itu yang dijadwalkan', () => {
    const s = subject({ role: 'admin', shifts: SHIFT_ADMIN, scheduled: '2' });
    expect(run('14:50', [s])[0]).toMatchObject({ shiftNumber: 2, startTime: '15:00' });
    expect(run('06:50', [s])).toHaveLength(0);
  });

  it('tidak menebak shift untuk role beroper dua shift saat jadwal kosong', () => {
    const s = subject({ role: 'admin', shifts: SHIFT_ADMIN, scheduled: null });
    expect(run('06:50', [s])).toHaveLength(0);
    expect(run('14:50', [s])).toHaveLength(0);
  });

  it('menganggap jadwal kosong sebagai masuk untuk role bershift tunggal', () => {
    // Grid teknisi hanya dipakai menandai libur — sel kosong berarti masuk.
    expect(run('07:50', [subject({ scheduled: null })])).toHaveLength(1);
  });

  it('menandai soleShift agar nomor shift tidak disebut untuk teknisi', () => {
    expect(run('07:50', [subject()])[0].soleShift).toBe(true);
    const admin = subject({ role: 'admin', shifts: SHIFT_ADMIN, scheduled: '1' });
    expect(run('06:50', [admin])[0].soleShift).toBe(false);
  });

  it('melewati karyawan yang rolenya tak punya SOP jam kerja', () => {
    expect(run('07:50', [subject({ shifts: [] })])).toHaveLength(0);
  });
});

describe('selectDueReminders — izin & absensi', () => {
  it.each(['sakit', 'izin', 'cuti', 'libur', 'telat', 'siang'])(
    'melewati karyawan dengan izin %s yang disetujui',
    (type) => {
      expect(run('07:50', [subject({ approvedLeaveTypes: [type] })])).toHaveLength(0);
    }
  );

  it('tetap mengingatkan karyawan berizin remote — jamnya sama, absennya wajib', () => {
    expect(run('07:50', [subject({ approvedLeaveTypes: ['remote'] })])).toHaveLength(1);
  });

  it('melewati karyawan yang sudah absen masuk', () => {
    expect(run('07:50', [subject({ alreadyClockedIn: true })])).toHaveLength(0);
  });

  it('tidak mengirim dua kali untuk shift yang sama', () => {
    expect(run('07:50', [subject({ remindedShiftNumbers: [1] })])).toHaveLength(0);
  });

  it('pengingat shift 1 yang sudah terkirim tidak memblokir shift 2', () => {
    const s = subject({
      role: 'admin',
      shifts: SHIFT_ADMIN,
      scheduled: '2',
      remindedShiftNumbers: [1],
    });
    expect(run('14:50', [s])).toHaveLength(1);
  });
});

describe('selectDueReminders — banyak karyawan', () => {
  it('hanya mengembalikan yang jatuh tempo', () => {
    const due = run('07:50', [
      subject({ userId: 'teknisi-masuk' }),
      subject({ userId: 'teknisi-libur', scheduled: 'libur' }),
      subject({ userId: 'teknisi-sudah-absen', alreadyClockedIn: true }),
      subject({ userId: 'admin-pagi', role: 'admin', shifts: SHIFT_ADMIN, scheduled: '1' }),
    ]);
    expect(due.map((d) => d.userId)).toEqual(['teknisi-masuk']);
  });
});
