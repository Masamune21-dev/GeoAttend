import type {
  AttendanceRecordResponse,
  LeaveRequestResponse,
  OvertimeStatus,
  ScheduleEntry,
} from '@/types/api';
import { computeRecap, type ShiftTime } from '@/lib/shifts/calc';
import { OPEN_SESSION_WINDOW_HOURS } from '@/lib/constants';
import { expandDateRange } from '@/lib/leaves';
import { deriveScheduledLibur } from '@/lib/schedule/libur';
import { appDateOf, appTimeOf } from '@/lib/time';

/**
 * Penyusun rekap absensi bulanan — SATU sumber kebenaran.
 *
 * Dipakai bersama oleh halaman Rekap Bulanan (web) dan GET /api/reports/recap
 * (yang melayani aplikasi mobile). Sebelumnya perhitungan ini hanya hidup di
 * komponen web, sementara mobile memakai rumus sendiri yang cuma menjumlahkan
 * sesi lembur urgent — hasilnya "Total Lembur" mobile 0 padahal web 2j 3m.
 *
 * Semua penanggalan memakai jam dinding WIB agar hasilnya sama di browser
 * (WIB) maupun di server (host UTC).
 */

export interface RecapRow {
  key: string;
  /** Tanggal sesi menurut WIB, "yyyy-MM-dd". */
  date: string;
  userId: string;
  userName: string;
  role: string;
  /** Waktu absen masuk/pulang, ISO 8601 (null bila tidak ada). */
  clockInAt: string | null;
  clockOutAt: string | null;
  /** Jam tampilan "HH:mm" WIB. */
  clockInTime: string | null;
  clockOutTime: string | null;
  shiftNumber: number | null;
  lateMinutes: number;
  overtimeMinutes: number;
  earlyLeaveMinutes: number;
  /** null = hadir; selain itu 'sakit' | 'izin' | 'cuti' | 'libur' */
  leaveType: string | null;
  /** 'shift' = kehadiran biasa, 'lembur' = sesi lembur urgent di luar shift */
  kind: 'shift' | 'lembur';
  /** Status verifikasi sesi lembur (null utk baris non-lembur) */
  overtimeStatus: OvertimeStatus | null;
  /** id record pembuka sesi lembur — sasaran tombol Setujui/Tolak */
  overtimeRecordId: string | null;
}

export interface RecapSummary {
  userId: string;
  userName: string;
  role: string;
  presentDays: number;
  sakitDays: number;
  izinDays: number;
  cutiDays: number;
  liburDays: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  totalEarlyLeaveMinutes: number;
  /** Menit lembur urgent yang SUDAH disetujui admin */
  overtimeUrgentMinutes: number;
  /** Berapa kali dipanggil lembur (sesi disetujui) */
  overtimeUrgentCount: number;
  /** Sesi lembur yang masih menunggu verifikasi — belum masuk total */
  overtimeUrgentPending: number;
}

export interface RecapInput {
  records: AttendanceRecordResponse[];
  users: { id: string; name: string; role: string }[];
  shifts: ShiftTime[];
  /** Izin/cuti/sakit/libur yang SUDAH disetujui. */
  leaves: LeaveRequestResponse[];
  scheduleEntries: ScheduleEntry[];
  /** Batas bulan, "yyyy-MM-dd". */
  monthStart: string;
  monthEnd: string;
  /** Hari ini menurut WIB — libur terjadwal hanya dihitung sampai tanggal ini. */
  today: string;
}

export interface RecapResult {
  rows: RecapRow[];
  summaries: RecapSummary[];
}

/** Bentuk respons GET /api/reports/recap — rekap sebulan satu karyawan. */
export interface RecapResponse {
  month: string; // "yyyy-MM"
  user: { id: string; name: string; role: string };
  summary: RecapSummary;
  rows: RecapRow[];
}

interface WorkSession {
  userId: string;
  userName: string;
  date: string;
  shiftNumber: number | null;
  clockIn: Date | null;
  clockOut: Date | null;
  kind: 'shift' | 'lembur';
  overtimeStatus: OvertimeStatus | null;
  overtimeRecordId: string | null;
}

/**
 * Bentuk SESI kerja per user secara KRONOLOGIS: clock_in membuka sesi,
 * clock_out menutupnya. clock_out mewarisi TANGGAL & shift dari clock-in
 * sesinya — jadi pulang 02:00 keesokan hari tetap masuk rekap tanggal clock-in
 * (shift lintas tengah malam), bukan baris terpisah di tanggal berikutnya.
 * clock_out tanpa sesi terbuka (masuk hilang / data lama) menjadi baris pulang
 * berdiri sendiri pada tanggalnya.
 */
function buildSessions(records: AttendanceRecordResponse[]): WorkSession[] {
  const OPEN_SESSION_WINDOW_MS = OPEN_SESSION_WINDOW_HOURS * 60 * 60 * 1000;
  const sessions: WorkSession[] = [];

  const recordsByUser = new Map<string, AttendanceRecordResponse[]>();
  for (const record of records) {
    const list = recordsByUser.get(record.userId) ?? [];
    list.push(record);
    recordsByUser.set(record.userId, list);
  }

  for (const list of Array.from(recordsByUser.values())) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let open: WorkSession | null = null;
    for (const record of sorted) {
      const ts = new Date(record.timestamp);
      const shiftNumber = record.shiftNumber ?? null;
      const kind = record.kind ?? 'shift';
      if (record.type === 'clock_in') {
        // clock_in baru membuka sesi baru; sesi sebelumnya yang belum ditutup
        // dianggap lupa clock-out (jam pulang tetap kosong).
        open = {
          userId: record.userId,
          userName: record.userName,
          date: appDateOf(ts),
          shiftNumber,
          clockIn: ts,
          clockOut: null,
          kind,
          // Status & id verifikasi menempel di record PEMBUKA sesi lembur
          overtimeStatus: kind === 'lembur' ? record.overtimeStatus ?? 'pending' : null,
          overtimeRecordId: kind === 'lembur' ? record.id : null,
        };
        sessions.push(open);
      } else if (
        open &&
        open.clockIn &&
        ts.getTime() - open.clockIn.getTime() <= OPEN_SESSION_WINDOW_MS
      ) {
        open.clockOut = ts;
        open = null;
      } else {
        sessions.push({
          userId: record.userId,
          userName: record.userName,
          date: appDateOf(ts),
          shiftNumber,
          clockIn: null,
          clockOut: ts,
          kind,
          overtimeStatus: null,
          overtimeRecordId: null,
        });
        open = null;
      }
    }
  }

  return sessions;
}

/** Susun baris harian + ringkasan per karyawan untuk satu bulan. */
export function buildRecap({
  records,
  users,
  shifts,
  leaves,
  scheduleEntries,
  monthStart,
  monthEnd,
  today,
}: RecapInput): RecapResult {
  const roleByUser = new Map(users.map((u) => [u.id, u.role]));
  const nameByUser = new Map(users.map((u) => [u.id, u.name]));
  const shiftsByRole = new Map<string, ShiftTime[]>();
  for (const shift of shifts) {
    const list = shiftsByRole.get(shift.role) ?? [];
    list.push(shift);
    shiftsByRole.set(shift.role, list);
  }

  const sessions = buildSessions(records);

  const rows: RecapRow[] = sessions.map((entry, index) => {
    const role = roleByUser.get(entry.userId) ?? 'employee';
    const recap = computeRecap(
      {
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        shiftNumber: entry.shiftNumber,
        kind: entry.kind,
      },
      shiftsByRole.get(role) ?? []
    );
    return {
      key: `${entry.userId}|${entry.date}|${entry.shiftNumber ?? 'x'}|${index}`,
      date: entry.date,
      userId: entry.userId,
      userName: entry.userName,
      role,
      clockInAt: entry.clockIn?.toISOString() ?? null,
      clockOutAt: entry.clockOut?.toISOString() ?? null,
      clockInTime: entry.clockIn ? appTimeOf(entry.clockIn) : null,
      clockOutTime: entry.clockOut ? appTimeOf(entry.clockOut) : null,
      shiftNumber: entry.shiftNumber ?? recap.shift?.shiftNumber ?? null,
      lateMinutes: recap.lateMinutes,
      overtimeMinutes: recap.overtimeMinutes,
      earlyLeaveMinutes: recap.earlyLeaveMinutes,
      leaveType: null,
      kind: entry.kind,
      overtimeStatus: entry.overtimeStatus,
      overtimeRecordId: entry.overtimeRecordId,
    };
  });

  // Sisipkan baris izin/libur (yang disetujui) untuk tanggal tanpa absensi.
  // Bila karyawan tetap absen di tanggal tersebut, baris kehadiran yang dipakai.
  // Hanya sesi SHIFT yang dianggap "masuk kerja": dipanggil lembur urgent di
  // hari libur/izin tidak menghapus hari libur itu — keduanya tampil.
  const attendedDates = new Set(
    sessions.filter((s) => s.kind === 'shift').map((s) => `${s.userId}|${s.date}`)
  );
  const leaveDates = new Set<string>();
  for (const leave of leaves) {
    const from = leave.startDate < monthStart ? monthStart : leave.startDate;
    const to = leave.endDate > monthEnd ? monthEnd : leave.endDate;
    if (from > to) continue;
    for (const date of expandDateRange(from, to)) {
      leaveDates.add(`${leave.userId}|${date}`);
      if (attendedDates.has(`${leave.userId}|${date}`)) continue;
      rows.push({
        key: `${leave.userId}|${date}|${leave.type}`,
        date,
        userId: leave.userId,
        userName: leave.userName,
        role: roleByUser.get(leave.userId) ?? leave.userRole,
        clockInAt: null,
        clockOutAt: null,
        clockInTime: null,
        clockOutTime: null,
        shiftNumber: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        earlyLeaveMinutes: 0,
        leaveType: leave.type,
        kind: 'shift',
        overtimeStatus: null,
        overtimeRecordId: null,
      });
    }
  }

  // Libur menurut JADWAL SHIFT — tercatat otomatis, karyawan tidak perlu
  // menekan "Libur Hari Ini". Hanya sampai hari ini, dan kalah dari baris
  // kehadiran maupun izin/libur yang sudah tercatat.
  const scheduledLibur = deriveScheduledLibur(scheduleEntries, {
    until: monthEnd < today ? monthEnd : today,
    attendedKeys: attendedDates,
    leaveKeys: leaveDates,
  });
  for (const { userId, date } of scheduledLibur) {
    const userName = nameByUser.get(userId);
    if (!userName) continue; // karyawan sudah dihapus — abaikan
    rows.push({
      key: `${userId}|${date}|jadwal-libur`,
      date,
      userId,
      userName,
      role: roleByUser.get(userId) ?? 'employee',
      clockInAt: null,
      clockOutAt: null,
      clockInTime: null,
      clockOutTime: null,
      shiftNumber: null,
      lateMinutes: 0,
      overtimeMinutes: 0,
      earlyLeaveMinutes: 0,
      leaveType: 'libur',
      kind: 'shift',
      overtimeStatus: null,
      overtimeRecordId: null,
    });
  }

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.userName.localeCompare(b.userName) ||
      (a.shiftNumber ?? 0) - (b.shiftNumber ?? 0)
  );

  // Ringkasan per user (hari hadir = tanggal unik, bukan jumlah shift)
  const summaryMap = new Map<string, RecapSummary>();
  const daysByUser = new Map<string, Set<string>>();
  for (const row of rows) {
    const summary =
      summaryMap.get(row.userId) ??
      {
        userId: row.userId,
        userName: row.userName,
        role: row.role,
        presentDays: 0,
        sakitDays: 0,
        izinDays: 0,
        cutiDays: 0,
        liburDays: 0,
        totalLateMinutes: 0,
        totalOvertimeMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        overtimeUrgentMinutes: 0,
        overtimeUrgentCount: 0,
        overtimeUrgentPending: 0,
      };
    if (row.kind === 'lembur') {
      // Lembur urgent dihitung TERPISAH dari lembur biasa (datang awal /
      // pulang telat) karena basis pembayarannya beda. Hanya sesi yang sudah
      // disetujui admin yang masuk total; yang ditolak tidak dihitung sama
      // sekali, dan sesi lembur tidak menambah "hari hadir".
      if (row.overtimeStatus === 'approved') {
        summary.overtimeUrgentMinutes += row.overtimeMinutes;
        summary.overtimeUrgentCount += 1;
      } else if (row.overtimeStatus === 'pending') {
        summary.overtimeUrgentPending += 1;
      }
    } else if (row.leaveType === null) {
      const days = daysByUser.get(row.userId) ?? new Set<string>();
      days.add(row.date);
      daysByUser.set(row.userId, days);
      summary.presentDays = days.size;
      summary.totalLateMinutes += row.lateMinutes;
      summary.totalOvertimeMinutes += row.overtimeMinutes;
      summary.totalEarlyLeaveMinutes += row.earlyLeaveMinutes;
    } else if (row.leaveType === 'sakit') summary.sakitDays += 1;
    else if (row.leaveType === 'izin') summary.izinDays += 1;
    else if (row.leaveType === 'cuti') summary.cutiDays += 1;
    else if (row.leaveType === 'libur') summary.liburDays += 1;
    summaryMap.set(row.userId, summary);
  }

  return {
    rows,
    summaries: Array.from(summaryMap.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName)
    ),
  };
}

/** Ringkasan kosong — dipakai saat karyawan belum punya catatan sama sekali. */
export function emptySummary(
  userId: string,
  userName: string,
  role: string
): RecapSummary {
  return {
    userId,
    userName,
    role,
    presentDays: 0,
    sakitDays: 0,
    izinDays: 0,
    cutiDays: 0,
    liburDays: 0,
    totalLateMinutes: 0,
    totalOvertimeMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    overtimeUrgentMinutes: 0,
    overtimeUrgentCount: 0,
    overtimeUrgentPending: 0,
  };
}
