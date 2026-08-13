import type { ScheduleShift } from '@/types/api';
import type { ShiftTime } from '@/lib/shifts/calc';
import { timeToMinutes } from '@/lib/shifts/calc';

/**
 * Penentuan SIAPA yang layak menerima pengingat "shift mulai sebentar lagi".
 *
 * Seluruhnya fungsi murni: pemanggil (scripts/send-shift-reminders.ts) yang
 * mengambil data dari basis data, modul ini cuma memutuskan. Pemisahan itu yang
 * membuat aturannya bisa diuji tanpa database — dan aturan inilah bagian yang
 * paling mudah salah, karena satu kekeliruan berarti belasan orang dibangunkan
 * notifikasi di hari liburnya.
 */

/**
 * Jenis izin yang membatalkan pengingat.
 *
 * `remote` sengaja TIDAK ikut: kerja jarak jauh tetap mulai pada jam yang sama
 * dan tetap harus absen, jadi justru dia yang paling butuh diingatkan. `telat`
 * dan `siang` ikut dibatalkan karena artinya karyawan sudah punya izin datang
 * lebih lambat — memberitahunya "15 menit lagi" malah menyalahi izin yang baru
 * saja disetujui administrator.
 */
export const REMINDER_SKIPPED_LEAVE_TYPES = ['sakit', 'izin', 'cuti', 'libur', 'telat', 'siang'];

/** Satu karyawan beserta seluruh konteks hari ini, sudah dirangkum dari basis data. */
export interface ReminderSubject {
  userId: string;
  role: string;
  /** Jam kerja SOP milik role-nya (bisa lebih dari satu untuk admin & NOC). */
  shifts: ShiftTime[];
  /** Shift terjadwal hari ini; null bila tidak ada entri di grid jadwal. */
  scheduled: ScheduleShift | null;
  /** Jenis izin yang SUDAH disetujui dan mencakup hari ini. */
  approvedLeaveTypes: string[];
  /** Sudah absen masuk hari ini (sesi shift, bukan lembur)? */
  alreadyClockedIn: boolean;
  /** Nomor shift yang pengingatnya sudah pernah dikirim hari ini. */
  remindedShiftNumbers: number[];
}

export interface DueReminder {
  userId: string;
  shiftNumber: number;
  /** Jam masuk shift, "HH:mm". */
  startTime: string;
  /** Sisa menit menuju jam masuk saat pengingat diputuskan. */
  minutesUntilStart: number;
  /** Role-nya cuma punya satu shift kerja (teknisi) — nomornya tak perlu disebut. */
  soleShift: boolean;
}

/**
 * Nomor shift yang harus dijalani seseorang hari ini, atau null bila tidak ada
 * / tidak bisa dipastikan.
 *
 * Jadwal kosong bukan berarti libur. Untuk role bershift tunggal (teknisi:
 * hanya S1) tidak ada yang perlu ditebak — grid jadwal mereka memang cuma
 * dipakai menandai LIBUR, sehingga sel kosong berarti masuk seperti biasa.
 * Untuk admin & NOC yang beroper dua shift, sel kosong benar-benar tidak
 * menentukan: menebak S1 berisiko membangunkan orang yang sebetulnya masuk
 * sore. Karena itu mereka dilewati — pengingat yang salah jam lebih merugikan
 * daripada tidak ada pengingat.
 */
export function scheduledShiftNumber(subject: ReminderSubject): number | null {
  if (subject.scheduled === 'libur') return null;
  if (subject.scheduled === '1' || subject.scheduled === '2') return Number(subject.scheduled);
  return subject.shifts.length === 1 ? subject.shifts[0].shiftNumber : null;
}

/**
 * Saring karyawan yang pengingatnya jatuh tempo pada detik ini.
 *
 * `nowMinutes` adalah menit sejak tengah malam **WIB** (lihat `@/lib/time`),
 * bukan jam host — proses server berjalan pada TZ UTC sedangkan `startTime`
 * shift adalah jam dinding kantor.
 *
 * Hanya shift yang mulai pada hari WIB yang sama yang dihitung. Shift yang jam
 * masuknya kurang dari `leadMinutes` setelah tengah malam (mis. 00:10) tidak
 * akan pernah kebagian pengingat karena jendelanya jatuh di tanggal kemarin —
 * tidak jadi masalah selama SOP mulai pagi/sore, dan lebih baik absen daripada
 * salah tanggal.
 */
export function selectDueReminders(input: {
  nowMinutes: number;
  leadMinutes: number;
  subjects: ReminderSubject[];
}): DueReminder[] {
  const due: DueReminder[] = [];

  for (const subject of input.subjects) {
    // Sudah absen masuk → tidak ada yang perlu diingatkan lagi.
    if (subject.alreadyClockedIn) continue;
    if (subject.approvedLeaveTypes.some((t) => REMINDER_SKIPPED_LEAVE_TYPES.includes(t))) continue;

    const shiftNumber = scheduledShiftNumber(subject);
    if (shiftNumber == null) continue;
    if (subject.remindedShiftNumbers.includes(shiftNumber)) continue;

    const shift = subject.shifts.find((s) => s.shiftNumber === shiftNumber);
    if (!shift) continue;

    // Ketat lebih besar dari 0: begitu shift dimulai ini bukan lagi pengingat.
    const minutesUntilStart = timeToMinutes(shift.startTime) - input.nowMinutes;
    if (minutesUntilStart <= 0 || minutesUntilStart > input.leadMinutes) continue;

    due.push({
      userId: subject.userId,
      shiftNumber,
      startTime: shift.startTime,
      minutesUntilStart,
      soleShift: subject.shifts.length === 1,
    });
  }

  return due;
}
