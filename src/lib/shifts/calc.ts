/**
 * Logika perhitungan telat & lembur berdasarkan SOP jam kerja per role.
 *
 * Aturan:
 * - Datang LEBIH AWAL dari jam masuk shift  → selisihnya dihitung LEMBUR
 * - Datang TELAT dari jam masuk shift        → selisihnya dihitung TELAT
 * - Pulang LEBIH LARUT dari jam pulang shift → selisihnya dihitung LEMBUR
 * - Telat dan lembur dihitung independen: telat pagi tidak membatalkan
 *   lembur sore, dan lembur pagi tidak membatalkan status telat.
 */

export interface ShiftTime {
  role: string;
  shiftNumber: number;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface DailyAttendance {
  clockIn: Date | null;
  clockOut: Date | null;
}

export interface RecapResult {
  shift: ShiftTime | null;
  lateMinutes: number;
  overtimeMinutes: number;
}

/** "07:30" → 450 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Menit sejak tengah malam (waktu lokal). */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Tentukan shift yang berlaku untuk sebuah absensi: shift dengan jam masuk
 * paling dekat dengan waktu clock-in. Contoh (admin, shift 07:00 & 15:00):
 * clock-in 06:45 → shift 1; clock-in 14:50 → shift 2 (lembur 10 menit).
 */
export function pickShift(reference: Date, shifts: ShiftTime[]): ShiftTime | null {
  if (shifts.length === 0) return null;
  const refMinutes = minutesOfDay(reference);
  return shifts.reduce((best, shift) =>
    Math.abs(timeToMinutes(shift.startTime) - refMinutes) <
    Math.abs(timeToMinutes(best.startTime) - refMinutes)
      ? shift
      : best
  );
}

/**
 * Hitung telat & lembur satu hari kerja untuk satu karyawan.
 * Bila role tidak punya konfigurasi shift, semuanya 0.
 */
export function computeRecap(day: DailyAttendance, roleShifts: ShiftTime[]): RecapResult {
  const reference = day.clockIn ?? day.clockOut;
  if (!reference) {
    return { shift: null, lateMinutes: 0, overtimeMinutes: 0 };
  }

  const shift = pickShift(reference, roleShifts);
  if (!shift) {
    return { shift: null, lateMinutes: 0, overtimeMinutes: 0 };
  }

  let lateMinutes = 0;
  let overtimeMinutes = 0;

  if (day.clockIn) {
    const inMinutes = minutesOfDay(day.clockIn);
    const startMinutes = timeToMinutes(shift.startTime);
    if (inMinutes < startMinutes) {
      overtimeMinutes += startMinutes - inMinutes; // berangkat lebih awal = lembur
    } else {
      lateMinutes += inMinutes - startMinutes; // berangkat telat
    }
  }

  if (day.clockOut) {
    const outMinutes = minutesOfDay(day.clockOut);
    const endMinutes = timeToMinutes(shift.endTime);
    if (outMinutes > endMinutes) {
      overtimeMinutes += outMinutes - endMinutes; // pulang lebih larut = lembur
    }
  }

  return { shift, lateMinutes, overtimeMinutes };
}

/** 90 → "1j 30m", 45 → "45m", 0 → "-" */
export function formatMinutes(total: number): string {
  if (total <= 0) return '-';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}j`;
  return `${hours}j ${minutes}m`;
}
