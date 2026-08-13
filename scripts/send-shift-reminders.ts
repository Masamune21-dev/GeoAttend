/**
 * Pengingat shift: kirim push "shift mulai sebentar lagi" ke karyawan yang
 * jam masuknya tinggal <= SHIFT_REMINDER_LEAD_MINUTES menit lagi.
 *
 * Jalankan: npm run push:shift-reminders
 * Uji tanpa mengirim: DRY_RUN=1 npm run push:shift-reminders
 * Lihat penerima sepanjang sisa hari (tanpa mengirim):
 *   DRY_RUN=1 SHIFT_REMINDER_LEAD_MINUTES=600 npm run push:shift-reminders
 *
 * Di produksi dijalankan systemd timer tiap beberapa menit sepanjang hari
 * (lihat docs/05-deployment.md). Idempotent: tabel `shift_reminders` menahan
 * pengiriman kedua untuk (karyawan, tanggal, shift) yang sama, jadi putaran
 * yang bertumpuk maupun percobaan ulang manual tidak menghasilkan notifikasi
 * ganda.
 */
import { config } from 'dotenv';
// Import TIPE saja — dihapus saat kompilasi, jadi tidak menyentuh modul db
// sebelum env dimuat. Nilai runtime tetap lewat import dinamis di bawah.
import type { ReminderSubject } from '../src/lib/push/reminders';

config({ path: '.env.local' });

async function main() {
  // Import dinamis setelah env dimuat — DATABASE_URL dibaca saat modul db dimuat.
  const { db } = await import('../src/lib/db');
  const {
    attendanceRecords,
    leaveRequests,
    pushTokens,
    scheduleEntries,
    shiftReminders,
    shiftSettings,
    user,
  } = await import('../src/lib/db/schema');
  const {
    SHIFT_REMINDER_LEAD_MINUTES,
    SHIFT_REMINDER_RETENTION_DAYS,
    SHIFT_REMINDER_TICK_MINUTES,
  } = await import('../src/lib/constants');
  const { appDayRangeUtc, appMinutesOfDay, appToday } = await import('../src/lib/time');
  const { selectDueReminders } = await import('../src/lib/push/reminders');
  const { notifyShiftStartingSoon } = await import('../src/lib/push/events');
  const { and, eq, gte, inArray, lt, lte } = await import('drizzle-orm');

  const dryRun = process.env.DRY_RUN === '1';
  const now = new Date();
  const today = appToday(now);
  const nowMinutes = appMinutesOfDay(now);

  /**
   * Lead boleh dilebarkan lewat env — gunanya memeriksa hasil penyaringan
   * dengan data nyata di luar jendela sempit 15 menit, mis.
   * `DRY_RUN=1 SHIFT_REMINDER_LEAD_MINUTES=600 npm run push:shift-reminders`
   * untuk melihat siapa saja yang bakal diingatkan sepanjang sisa hari.
   */
  const leadMinutes = Number(
    process.env.SHIFT_REMINDER_LEAD_MINUTES ?? SHIFT_REMINDER_LEAD_MINUTES
  );
  if (!Number.isFinite(leadMinutes) || leadMinutes <= 0) {
    throw new Error(
      `SHIFT_REMINDER_LEAD_MINUTES tidak valid: ${process.env.SHIFT_REMINDER_LEAD_MINUTES}`
    );
  }

  // --- 1. Jam kerja SOP per role -------------------------------------------
  const shiftRows = await db
    .select({
      role: shiftSettings.role,
      shiftNumber: shiftSettings.shiftNumber,
      startTime: shiftSettings.startTime,
      endTime: shiftSettings.endTime,
    })
    .from(shiftSettings);

  const shiftsByRole = new Map<string, typeof shiftRows>();
  for (const row of shiftRows) {
    const list = shiftsByRole.get(row.role) ?? [];
    list.push(row);
    shiftsByRole.set(row.role, list);
  }

  const rolesWithShift = Array.from(shiftsByRole.keys());
  if (rolesWithShift.length === 0) {
    console.log('Tidak ada SOP jam kerja tersimpan — tidak ada yang bisa diingatkan.');
    process.exit(0);
  }

  // --- 2. Kandidat: karyawan bershift YANG PUNYA perangkat terdaftar --------
  // Tanpa token, membuat baris klaim di shift_reminders cuma menumpuk sampah
  // untuk notifikasi yang tak pernah bisa dikirim.
  const candidates = await db
    .selectDistinct({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .innerJoin(pushTokens, eq(pushTokens.userId, user.id))
    .where(inArray(user.role, rolesWithShift));

  if (candidates.length === 0) {
    console.log('Belum ada perangkat terdaftar milik karyawan bershift.');
    process.exit(0);
  }

  const ids = candidates.map((c) => c.id);
  const { start: dayStart, end: dayEnd } = appDayRangeUtc(today);

  // --- 3. Konteks hari ini: jadwal, izin, absen masuk, pengingat terkirim ---
  const [schedules, leaves, clockIns, alreadySent] = await Promise.all([
    db
      .select({ userId: scheduleEntries.userId, shift: scheduleEntries.shift })
      .from(scheduleEntries)
      .where(and(inArray(scheduleEntries.userId, ids), eq(scheduleEntries.date, today))),

    // Rentang izin inklusif di kedua ujung: start <= hari ini <= end.
    db
      .select({ userId: leaveRequests.userId, type: leaveRequests.type })
      .from(leaveRequests)
      .where(
        and(
          inArray(leaveRequests.userId, ids),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startDate, today),
          gte(leaveRequests.endDate, today)
        )
      ),

    // Sesi lembur tidak dihitung: teknisi yang semalam dipanggil lembur tetap
    // punya shift pagi hari ini dan tetap perlu diingatkan.
    db
      .select({ userId: attendanceRecords.userId })
      .from(attendanceRecords)
      .where(
        and(
          inArray(attendanceRecords.userId, ids),
          eq(attendanceRecords.type, 'clock_in'),
          eq(attendanceRecords.kind, 'shift'),
          gte(attendanceRecords.timestamp, dayStart),
          lt(attendanceRecords.timestamp, dayEnd)
        )
      ),

    db
      .select({ userId: shiftReminders.userId, shiftNumber: shiftReminders.shiftNumber })
      .from(shiftReminders)
      .where(and(inArray(shiftReminders.userId, ids), eq(shiftReminders.date, today))),
  ]);

  const scheduleOf = new Map(schedules.map((s) => [s.userId, s.shift]));
  const clockedIn = new Set(clockIns.map((r) => r.userId));

  const leavesOf = new Map<string, string[]>();
  for (const row of leaves) {
    leavesOf.set(row.userId, [...(leavesOf.get(row.userId) ?? []), row.type]);
  }

  const remindedOf = new Map<string, number[]>();
  for (const row of alreadySent) {
    remindedOf.set(row.userId, [...(remindedOf.get(row.userId) ?? []), row.shiftNumber]);
  }

  const subjects: ReminderSubject[] = candidates.map((c) => ({
    userId: c.id,
    role: c.role ?? '',
    shifts: shiftsByRole.get(c.role ?? '') ?? [],
    scheduled: (scheduleOf.get(c.id) as ReminderSubject['scheduled']) ?? null,
    approvedLeaveTypes: leavesOf.get(c.id) ?? [],
    alreadyClockedIn: clockedIn.has(c.id),
    remindedShiftNumbers: remindedOf.get(c.id) ?? [],
  }));

  const due = selectDueReminders({ nowMinutes, leadMinutes, subjects });

  if (due.length === 0) {
    console.log(`Tidak ada pengingat jatuh tempo (${today} ${jam(nowMinutes)} WIB).`);
    await bersihkanCatatanLama();
    process.exit(0);
  }

  // --- 4. Klaim dulu, baru kirim -------------------------------------------
  // Urutannya sengaja begini. Kalau pengiriman didahulukan lalu proses mati
  // sebelum sempat mencatat, putaran berikutnya (beberapa menit lagi) mengirim
  // ulang — dan begitu seterusnya sampai shift mulai. Satu pengingat yang
  // hilang karena Expo sedang bermasalah jauh lebih ringan daripada empat
  // notifikasi kembar di HP setiap karyawan.
  const namaOf = new Map(candidates.map((c) => [c.id, c.name]));

  let sent = 0;
  for (const reminder of due) {
    if (dryRun) {
      console.log(
        `[dry-run] ${namaOf.get(reminder.userId) ?? reminder.userId} — shift ${reminder.shiftNumber} mulai ${reminder.startTime} (${reminder.minutesUntilStart} menit lagi)`
      );
      continue;
    }

    const claimed = await db
      .insert(shiftReminders)
      .values({ userId: reminder.userId, date: today, shiftNumber: reminder.shiftNumber })
      .onConflictDoNothing()
      .returning({ userId: shiftReminders.userId });

    // Kosong = putaran lain sudah menangani orang ini lebih dulu.
    if (claimed.length === 0) continue;

    try {
      const result = await notifyShiftStartingSoon(reminder);
      sent += result.sent;
    } catch (error) {
      console.error(`[push] pengingat gagal untuk ${reminder.userId}:`, error);
    }
  }

  console.log(
    `✔ ${jam(nowMinutes)} WIB — ${due.length} pengingat jatuh tempo, ${sent} notifikasi terkirim${dryRun ? ' (dry-run)' : ''}`
  );

  await bersihkanCatatanLama();
  process.exit(0);

  /**
   * Buang penanda anti-kirim-ganda yang harinya sudah lewat.
   *
   * Hanya pada putaran pertama setelah tengah malam WIB. Skrip ini berjalan
   * ratusan kali sehari; menyapu tabel di tiap putaran tidak menghasilkan apa
   * pun selain beban DELETE berulang.
   */
  async function bersihkanCatatanLama() {
    if (dryRun || nowMinutes >= SHIFT_REMINDER_TICK_MINUTES) return;
    const cutoff = new Date(Date.now() - SHIFT_REMINDER_RETENTION_DAYS * 86_400_000);
    await db.delete(shiftReminders).where(lt(shiftReminders.date, appToday(cutoff)));
  }

  /** 435 → "07:15" */
  function jam(minutes: number): string {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
}

main().catch((err) => {
  console.error('Pengiriman pengingat shift gagal:', err);
  process.exit(1);
});
