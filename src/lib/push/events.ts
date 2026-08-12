import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { dispatchPush, sendPushToAdministrators } from '@/lib/push';
import { getLeaveTypeLabel } from '@/lib/leaves';

/**
 * Susunan kalimat tiap notifikasi, terkumpul di satu berkas.
 *
 * Semua teks dirakit di server supaya kata-katanya bisa diubah lewat deploy web
 * biasa — app mobile tidak punya OTA, jadi apa pun yang ditulis di sisi klien
 * baru berubah setelah karyawan memasang APK baru.
 *
 * Field `data` dipakai app untuk membuka layar yang tepat saat notifikasi
 * disentuh. Nilainya harus string semua (payload FCM tidak menerima nested).
 */

const BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/**
 * "2026-08-12" → "12 Agu 2026". Diurai manual dari string, bukan lewat `Date`:
 * proses server berjalan pada TZ=UTC dan tanggal ini adalah tanggal WIB, jadi
 * membungkusnya jadi `Date` cuma menambah peluang meleset sehari.
 */
function formatTanggal(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const bulan = BULAN[Number(month) - 1];
  if (!bulan) return isoDate;
  return `${Number(day)} ${bulan} ${year}`;
}

/** "12 Agu 2026" atau "12–14 Agu 2026" bila rentangnya lebih dari sehari. */
function formatRentang(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatTanggal(startDate);
  return `${formatTanggal(startDate)} – ${formatTanggal(endDate)}`;
}

/**
 * Pengajuan izin/cuti baru masuk dan menunggu keputusan administrator.
 *
 * Tidak dipanggil untuk `type: 'libur'` — penanda libur langsung berstatus
 * `approved` (self-service), tidak ada yang perlu diputuskan.
 */
export function notifyAdminLeaveSubmitted(input: {
  requesterId: string;
  requesterName: string;
  type: string;
  startDate: string;
  endDate: string;
  leaveId: string;
}): void {
  dispatchPush(
    () =>
      sendPushToAdministrators(
        {
          title: `Pengajuan ${getLeaveTypeLabel(input.type)} baru`,
          body: `${input.requesterName} — ${formatRentang(input.startDate, input.endDate)}. Menunggu persetujuan.`,
          data: { kind: 'leave_request', id: input.leaveId },
        },
        { exceptUserId: input.requesterId }
      ),
    `notifikasi izin baru (${input.leaveId})`
  );
}

/**
 * Pengajuan tukar naik ke meja administrator.
 *
 * Sengaja BUKAN saat pengajuan dibuat: alurnya dua tahap (`pending_peer` →
 * rekan setuju → `pending_admin`). Kalau dikirim sejak awal, administrator
 * dapat notifikasi untuk sesuatu yang bisa saja ditolak rekan dan tidak pernah
 * sampai ke mejanya.
 */
export function notifyAdminSwapAwaitingReview(input: {
  requesterId: string;
  targetId: string;
  kind: string;
  date: string;
  targetDate: string | null;
  swapId: string;
}): void {
  const isLibur = input.kind === 'libur';
  const tanggal =
    isLibur && input.targetDate
      ? `${formatTanggal(input.date)} ↔ ${formatTanggal(input.targetDate)}`
      : formatTanggal(input.date);

  dispatchPush(async () => {
    // Nama diambil di dalam task, bukan di route: pencarian ini tidak boleh
    // menambah waktu tunggu respons rekan yang baru menekan "setuju".
    const rows = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [input.requesterId, input.targetId]));

    const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? 'Pengguna terhapus';

    return sendPushToAdministrators({
      title: isLibur ? 'Tukar hari libur menunggu persetujuan' : 'Tukar shift menunggu persetujuan',
      body: `${nameOf(input.requesterId)} ↔ ${nameOf(input.targetId)} — ${tanggal}. Rekan sudah setuju.`,
      data: { kind: 'shift_swap', id: input.swapId },
    });
  }, `notifikasi tukar shift (${input.swapId})`);
}
