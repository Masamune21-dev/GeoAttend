/**
 * Waktu operasional aplikasi.
 *
 * Server produksi berjalan pada TZ UTC, sedangkan seluruh jadwal, absensi, dan
 * penanda "hari ini" mengikuti jam dinding kantor (WIB). Tanpa penyesuaian ini
 * setiap pukul 00:00–07:00 WIB server masih menganggap hari kemarin — roster
 * harian, penanda libur, dan validasi tukar shift ikut salah sehari.
 *
 * WIB tetap UTC+7 sepanjang tahun (tanpa DST), jadi cukup pergeseran konstan;
 * tidak perlu bergantung pada data zona waktu sistem.
 */

/** Selisih WIB terhadap UTC, dalam menit. */
export const APP_UTC_OFFSET_MINUTES = 7 * 60;

/** Date yang komponen UTC-nya sudah setara jam dinding WIB. */
function toAppWallClock(now: Date): Date {
  return new Date(now.getTime() + APP_UTC_OFFSET_MINUTES * 60_000);
}

/** "yyyy-MM-dd" sebuah waktu menurut WIB, bebas dari TZ host. */
export function appDateOf(date: Date): string {
  return toAppWallClock(date).toISOString().slice(0, 10);
}

/** "yyyy-MM-dd" hari ini menurut WIB, bebas dari TZ host. */
export function appToday(now: Date = new Date()): string {
  return appDateOf(now);
}

/** Menit sejak tengah malam WIB (0–1439), bebas dari TZ host. */
export function appMinutesOfDay(date: Date): number {
  const wall = toAppWallClock(date);
  return wall.getUTCHours() * 60 + wall.getUTCMinutes();
}

/** Selisih hari kalender WIB antara dua waktu (0 = hari sama, 1 = besoknya). */
export function appDayOffset(from: Date, to: Date): number {
  const a = Date.parse(`${appDateOf(from)}T00:00:00Z`);
  const b = Date.parse(`${appDateOf(to)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "HH:mm" menurut WIB, bebas dari TZ host. */
export function appTimeOf(date: Date): string {
  return toAppWallClock(date).toISOString().slice(11, 16);
}

/** "yyyy-MM" bulan berjalan menurut WIB, bebas dari TZ host. */
export function appMonth(now: Date = new Date()): string {
  return toAppWallClock(now).toISOString().slice(0, 7);
}

/** Tanggal pertama bulan berjalan menurut WIB, "yyyy-MM-dd". */
export function appMonthStart(now: Date = new Date()): string {
  return `${appMonth(now)}-01`;
}
