import type { ScheduleShift } from '@/types/api';

/**
 * Aturan siapa yang dijadwalkan dan shift apa yang boleh dipakai.
 * Dipakai bersama oleh route API (validasi) dan UI (pilihan sel grid) supaya
 * keduanya tidak pernah berbeda pendapat.
 */

/** Role yang punya jadwal shift. Teknisi ikut sejak fitur jadwal libur teknisi. */
export const SCHEDULABLE_ROLES = ['admin', 'noc', 'teknisi'] as const;
export type SchedulableRole = (typeof SCHEDULABLE_ROLES)[number];

/** Urutan tampil grup pada grid jadwal. */
export const ROLE_ORDER: Record<string, number> = { admin: 0, noc: 1, teknisi: 2 };

export const ROLE_GROUP_LABEL: Record<string, string> = {
  admin: 'Admin & CS',
  noc: 'NOC',
  teknisi: 'Teknisi',
};

/**
 * Shift yang boleh dipakai sebuah role.
 *
 * Teknisi hanya masuk pagi, jadi jadwalnya cuma menentukan HARI LIBUR —
 * pilihannya Shift 1 atau Libur, tidak ada Shift 2.
 */
export function shiftOptionsForRole(role: string): ScheduleShift[] {
  return role === 'teknisi' ? ['1', 'libur'] : ['1', '2', 'libur'];
}

/** Siklus klik sel grid: kosong → …opsi role… → kosong. */
export function shiftCycleForRole(role: string): (ScheduleShift | undefined)[] {
  return [undefined, ...shiftOptionsForRole(role)];
}

export function isShiftAllowedForRole(role: string, shift: ScheduleShift): boolean {
  return shiftOptionsForRole(role).includes(shift);
}

/**
 * Shift kerja satu-satunya milik sebuah role, bila memang cuma punya satu
 * (teknisi → '1'). Role yang beroper shift mengembalikan null.
 *
 * Dipakai tukar HARI LIBUR: saat seseorang melepas liburnya, sistem harus tahu
 * shift apa yang menggantikannya. Itu hanya bisa dipastikan kalau role-nya cuma
 * punya satu shift kerja — makanya tukar libur dibatasi ke role seperti itu.
 */
export function soleWorkShiftForRole(role: string): ScheduleShift | null {
  const work = shiftOptionsForRole(role).filter((s) => s !== 'libur');
  return work.length === 1 ? work[0] : null;
}
