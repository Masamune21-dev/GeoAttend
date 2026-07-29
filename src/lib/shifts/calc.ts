/**
 * Logika perhitungan telat, lembur, & pulang cepat berdasarkan SOP jam kerja per role.
 *
 * Aturan:
 * - Datang LEBIH AWAL dari jam masuk shift  → selisihnya dihitung LEMBUR
 * - Datang TELAT dari jam masuk shift        → selisihnya dihitung TELAT
 * - Pulang LEBIH LARUT dari jam pulang shift → selisihnya dihitung LEMBUR
 * - Pulang LEBIH AWAL dari jam pulang shift  → selisihnya dihitung PULANG CEPAT
 * - Semua komponen dihitung independen: lembur pagi (datang awal) TIDAK
 *   menutupi pulang cepat, dan telat pagi tidak membatalkan lembur sore.
 *   Contoh (shift 07:00–15:00): masuk 06:00 & pulang 14:00
 *   → lembur 60m DAN pulang cepat 60m (jam kerja dalam shift kurang 1 jam).
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
  /** Shift yang dipilih saat absen (dari record); null/undefined utk data lama. */
  shiftNumber?: number | null;
  /**
   * Jenis sesi. 'lembur' = lembur urgent di luar shift — seluruh durasinya
   * dihitung lembur, tanpa telat & pulang cepat (lihat {@link computeRecap}).
   */
  kind?: 'shift' | 'lembur';
}

export interface RecapResult {
  shift: ShiftTime | null;
  lateMinutes: number;
  overtimeMinutes: number;
  /** Menit pulang lebih awal dari jam pulang shift (kekurangan jam kerja). */
  earlyLeaveMinutes: number;
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

/** Selisih hari kalender lokal antara dua waktu (0 = hari sama, 1 = besoknya). */
export function dayOffset(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
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
 * Shift yang dipakai: shift yang tercatat di record (dipilih saat absen);
 * bila tidak ada (data lama), fallback ke shift dengan jam masuk terdekat.
 * Bila role tidak punya konfigurasi shift, semuanya 0.
 */
export function computeRecap(day: DailyAttendance, roleShifts: ShiftTime[]): RecapResult {
  const reference = day.clockIn ?? day.clockOut;
  if (!reference) {
    return { shift: null, lateMinutes: 0, overtimeMinutes: 0, earlyLeaveMinutes: 0 };
  }

  // Sesi LEMBUR URGENT tidak diukur terhadap shift mana pun — memang di luar
  // jam kerja. Seluruh durasi masuk-pulang dihitung lembur; telat & pulang
  // cepat selalu 0. Tanpa cabang ini, teknisi yang dipanggil 23:00 dan selesai
  // 01:30 akan tercatat "telat 15 jam" karena diukur ke jam masuk shiftnya.
  if (day.kind === 'lembur') {
    const minutes =
      day.clockIn && day.clockOut
        ? Math.max(0, Math.round((day.clockOut.getTime() - day.clockIn.getTime()) / 60_000))
        : 0;
    return { shift: null, lateMinutes: 0, overtimeMinutes: minutes, earlyLeaveMinutes: 0 };
  }

  const recorded =
    day.shiftNumber != null
      ? roleShifts.find((s) => s.shiftNumber === day.shiftNumber) ?? null
      : null;
  const shift = recorded ?? pickShift(reference, roleShifts);
  if (!shift) {
    return { shift: null, lateMinutes: 0, overtimeMinutes: 0, earlyLeaveMinutes: 0 };
  }

  let lateMinutes = 0;
  let overtimeMinutes = 0;
  let earlyLeaveMinutes = 0;

  const startMinutes = timeToMinutes(shift.startTime);
  // Shift yang jam pulangnya lebih kecil/sama dari jam masuk (mis. 22:00–06:00)
  // berarti berakhir keesokan hari → geser +24 jam agar durasinya positif.
  let endMinutes = timeToMinutes(shift.endTime);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;

  if (day.clockIn) {
    const inMinutes = minutesOfDay(day.clockIn);
    if (inMinutes < startMinutes) {
      overtimeMinutes += startMinutes - inMinutes; // berangkat lebih awal = lembur
    } else {
      lateMinutes += inMinutes - startMinutes; // berangkat telat
    }
  }

  if (day.clockOut) {
    // Jam pulang diukur relatif terhadap HARI clock-in agar sesi yang menembus
    // tengah malam (mis. pulang 02:00 keesokan hari) terhitung lembur, bukan
    // "pulang cepat" 20+ jam. Tanpa clock-in (data lama) pakai harinya sendiri.
    const anchor = day.clockIn ?? day.clockOut;
    const outMinutes = minutesOfDay(day.clockOut) + dayOffset(anchor, day.clockOut) * 24 * 60;
    if (outMinutes > endMinutes) {
      overtimeMinutes += outMinutes - endMinutes; // pulang lebih larut = lembur
    } else {
      earlyLeaveMinutes = endMinutes - outMinutes; // pulang lebih awal = kurang jam
    }
  }

  return { shift, lateMinutes, overtimeMinutes, earlyLeaveMinutes };
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
