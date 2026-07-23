/** Port ringkas dari src/lib/shifts/calc.ts proyek web (pemilihan shift saja). */
import type { ShiftSettingResponse } from '../api/types';

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Shift dengan jam masuk terdekat dari waktu referensi. */
export function pickShift(
  reference: Date,
  shifts: ShiftSettingResponse[]
): ShiftSettingResponse | null {
  if (shifts.length === 0) return null;
  const refMinutes = minutesOfDay(reference);
  return shifts.reduce((best, shift) =>
    Math.abs(timeToMinutes(shift.startTime) - refMinutes) <
    Math.abs(timeToMinutes(best.startTime) - refMinutes)
      ? shift
      : best
  );
}
