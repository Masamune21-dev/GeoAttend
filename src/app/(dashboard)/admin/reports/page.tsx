'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isSameMonth,
  startOfMonth,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Route,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAttendanceList,
  useLeaves,
  useReviewOvertime,
  useShifts,
  useUsers,
  type TrailTarget,
} from '@/hooks/useAttendance';
import type { OvertimeStatus } from '@/types/api';
import { useSchedule } from '@/hooks/useSchedule';
import { LocationTrailDialog } from '@/components/features/attendance/LocationTrailDialog';
import { computeRecap, formatMinutes, type ShiftTime } from '@/lib/shifts/calc';
import { OPEN_SESSION_WINDOW_HOURS } from '@/lib/constants';
import { expandDateRange, getLeaveTypeLabel, toLocalDateString } from '@/lib/leaves';
import { deriveScheduledLibur } from '@/lib/schedule/libur';
import { getRoleLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface DailyRow {
  key: string;
  date: string; // yyyy-MM-dd
  userId: string;
  userName: string;
  role: string;
  clockIn: Date | null;
  clockOut: Date | null;
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

interface UserSummary {
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

const OVERTIME_STATUS_LABEL: Record<OvertimeStatus, string> = {
  pending: 'Belum diverifikasi',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

const OVERTIME_STATUS_VARIANT: Record<OvertimeStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

export default function ReportsPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [trailTarget, setTrailTarget] = useState<TrailTarget | null>(null);
  const today = new Date();

  const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');

  const { data: attendanceData, isLoading: attendanceLoading } = useAttendanceList({
    from: startOfMonth(month).toISOString(),
    to: endOfMonth(month).toISOString(),
    limit: 1000,
  });
  const { data: usersData, isLoading: usersLoading } = useUsers();
  const { data: shiftsData, isLoading: shiftsLoading } = useShifts();
  const { data: leavesData, isLoading: leavesLoading } = useLeaves({
    from: monthStart,
    to: monthEnd,
    status: 'approved',
  });
  // Jadwal shift sebulan — hari bershift "libur" masuk rekap otomatis
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule(
    format(month, 'yyyy-MM')
  );

  const reviewOvertimeMutation = useReviewOvertime();

  const isLoading =
    attendanceLoading || usersLoading || shiftsLoading || leavesLoading || scheduleLoading;

  const reviewOvertime = (row: DailyRow, action: 'approve' | 'reject') => {
    if (!row.overtimeRecordId) return;
    reviewOvertimeMutation.mutate(
      { id: row.overtimeRecordId, action },
      {
        onSuccess: () =>
          toast.success(
            action === 'approve'
              ? `Lembur ${row.userName} disetujui`
              : `Lembur ${row.userName} ditolak`
          ),
        onError: (err: Error) => toast.error(err.message || 'Gagal memperbarui status lembur'),
      }
    );
  };

  const { dailyRows, summaries } = useMemo(() => {
    const records = attendanceData?.data ?? [];
    const users = usersData?.data ?? [];
    const shifts: ShiftTime[] = (shiftsData?.data ?? []).map((s) => ({
      role: s.role,
      shiftNumber: s.shiftNumber,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    const roleByUser = new Map(users.map((u) => [u.id, u.role as string]));
    const shiftsByRole = new Map<string, ShiftTime[]>();
    for (const shift of shifts) {
      const list = shiftsByRole.get(shift.role) ?? [];
      list.push(shift);
      shiftsByRole.set(shift.role, list);
    }

    // Bentuk SESI kerja per user secara KRONOLOGIS: clock_in membuka sesi,
    // clock_out menutupnya. clock_out mewarisi TANGGAL & shift dari clock-in
    // sesinya — jadi pulang 02:00 keesokan hari tetap masuk rekap tanggal
    // clock-in (shift lintas tengah malam), bukan baris terpisah di tanggal
    // berikutnya. clock_out tanpa sesi terbuka (masuk hilang / data lama)
    // menjadi baris pulang berdiri sendiri pada tanggalnya.
    const OPEN_SESSION_WINDOW_MS = OPEN_SESSION_WINDOW_HOURS * 60 * 60 * 1000;

    const sessions: {
      userId: string;
      userName: string;
      date: string;
      shiftNumber: number | null;
      clockIn: Date | null;
      clockOut: Date | null;
      kind: 'shift' | 'lembur';
      overtimeStatus: OvertimeStatus | null;
      overtimeRecordId: string | null;
    }[] = [];

    const recordsByUser = new Map<string, typeof records>();
    for (const record of records) {
      const list = recordsByUser.get(record.userId) ?? [];
      list.push(record);
      recordsByUser.set(record.userId, list);
    }

    for (const list of Array.from(recordsByUser.values())) {
      const sorted = [...list].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      let open: (typeof sessions)[number] | null = null;
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
            date: format(ts, 'yyyy-MM-dd'),
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
            date: format(ts, 'yyyy-MM-dd'),
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

    const rows: DailyRow[] = sessions.map((entry, index) => {
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
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
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
    for (const leave of leavesData?.data ?? []) {
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
          clockIn: null,
          clockOut: null,
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
    const nameByUser = new Map(users.map((u) => [u.id, u.name]));
    const todayStr = toLocalDateString(new Date());
    const scheduledLibur = deriveScheduledLibur(scheduleData?.entries ?? [], {
      until: monthEnd < todayStr ? monthEnd : todayStr,
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
        clockIn: null,
        clockOut: null,
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
    const summaryMap = new Map<string, UserSummary>();
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
      dailyRows: rows,
      summaries: Array.from(summaryMap.values()).sort((a, b) =>
        a.userName.localeCompare(b.userName)
      ),
    };
  }, [attendanceData, usersData, shiftsData, leavesData, scheduleData, monthStart, monthEnd]);

  // Filter per karyawan
  const filteredRows = useMemo(
    () =>
      selectedUserId === 'all'
        ? dailyRows
        : dailyRows.filter((row) => row.userId === selectedUserId),
    [dailyRows, selectedUserId]
  );
  const filteredSummaries = useMemo(
    () =>
      selectedUserId === 'all'
        ? summaries
        : summaries.filter((s) => s.userId === selectedUserId),
    [summaries, selectedUserId]
  );

  const monthLabel = format(month, 'MMMM yyyy', { locale: localeId });

  const handleExport = () => {
    if (filteredRows.length === 0) {
      toast.warning('Tidak ada data untuk diekspor');
      return;
    }
    const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Tanggal', 'Nama', 'Role', 'Keterangan', 'Status Lembur', 'Shift', 'Jam Masuk', 'Jam Pulang', 'Telat (menit)', 'Lembur (menit)', 'Pulang Cepat (menit)'];
    const lines = filteredRows.map((row) =>
      [
        row.date,
        escapeCsv(row.userName),
        getRoleLabel(row.role),
        row.kind === 'lembur'
          ? 'Lembur Urgent'
          : row.leaveType
            ? getLeaveTypeLabel(row.leaveType)
            : 'Hadir',
        row.overtimeStatus ? OVERTIME_STATUS_LABEL[row.overtimeStatus] : '-',
        row.shiftNumber != null ? `Shift ${row.shiftNumber}` : '-',
        row.clockIn ? format(row.clockIn, 'HH:mm') : '-',
        row.clockOut ? format(row.clockOut, 'HH:mm') : '-',
        String(row.lateMinutes),
        String(row.overtimeMinutes),
        String(row.earlyLeaveMinutes),
      ].join(';')
    );
    const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap_${format(month, 'yyyy-MM')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV berhasil diunduh');
  };

  const handleExportPdf = async () => {
    if (filteredRows.length === 0) {
      toast.warning('Tidak ada data untuk diekspor');
      return;
    }

    // Import dinamis agar jsPDF tidak masuk bundle awal
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    type DocWithTable = typeof doc & { lastAutoTable: { finalY: number } };

    const selectedName =
      selectedUserId === 'all'
        ? 'Semua Karyawan'
        : filteredSummaries[0]?.userName ?? '';

    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rekap Absensi — ${monthLabel}`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${selectedName} · Dicetak ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })}`,
      14,
      21
    );

    const headStyles = { fillColor: [37, 99, 235] as [number, number, number] };

    // Tabel ringkasan per karyawan
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Ringkasan per Karyawan', 14, 30);
    autoTable(doc, {
      startY: 33,
      head: [['Nama', 'Role', 'Hadir', 'Sakit', 'Izin', 'Cuti', 'Libur', 'Total Telat', 'Total Lembur', 'Lembur Urgent', 'Total Pulang Cepat']],
      body: filteredSummaries.map((s) => [
        s.userName,
        getRoleLabel(s.role),
        String(s.presentDays),
        String(s.sakitDays),
        String(s.izinDays),
        String(s.cutiDays),
        String(s.liburDays),
        formatMinutes(s.totalLateMinutes),
        formatMinutes(s.totalOvertimeMinutes),
        s.overtimeUrgentMinutes > 0
          ? `${formatMinutes(s.overtimeUrgentMinutes)} (${s.overtimeUrgentCount}x)`
          : '-',
        formatMinutes(s.totalEarlyLeaveMinutes),
      ]),
      theme: 'grid',
      headStyles,
      styles: { fontSize: 9, cellPadding: 2 },
    });

    // Tabel detail harian
    const detailStartY = (doc as DocWithTable).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text('Detail Harian', 14, detailStartY - 3);
    autoTable(doc, {
      startY: detailStartY,
      head: [['Tanggal', 'Nama', 'Role', 'Keterangan', 'Status Lembur', 'Shift', 'Jam Masuk', 'Jam Pulang', 'Telat', 'Lembur', 'Pulang Cepat']],
      body: filteredRows.map((row) => [
        format(new Date(`${row.date}T00:00:00`), 'dd MMM yyyy', { locale: localeId }),
        row.userName,
        getRoleLabel(row.role),
        row.kind === 'lembur'
          ? 'Lembur Urgent'
          : row.leaveType
            ? getLeaveTypeLabel(row.leaveType)
            : 'Hadir',
        row.overtimeStatus ? OVERTIME_STATUS_LABEL[row.overtimeStatus] : '-',
        row.shiftNumber != null ? `Shift ${row.shiftNumber}` : '-',
        row.clockIn ? format(row.clockIn, 'HH:mm') : '-',
        row.clockOut ? format(row.clockOut, 'HH:mm') : '-',
        formatMinutes(row.lateMinutes),
        formatMinutes(row.overtimeMinutes),
        formatMinutes(row.earlyLeaveMinutes),
      ]),
      theme: 'grid',
      headStyles,
      styles: { fontSize: 9, cellPadding: 2 },
    });

    const suffix =
      selectedUserId === 'all'
        ? ''
        : `_${selectedName.toLowerCase().replace(/\s+/g, '-')}`;
    doc.save(`rekap_${format(month, 'yyyy-MM')}${suffix}.pdf`);
    toast.success('PDF berhasil diunduh');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Navigasi bulan + ekspor */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-white px-1 py-1">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Bulan sebelumnya"
            className="rounded-md p-1.5 text-text-secondary hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-36 text-center font-semibold capitalize text-text-primary">
            {format(month, 'MMMM yyyy', { locale: localeId })}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Bulan berikutnya"
            disabled={isSameMonth(month, today) || isAfter(month, today)}
            className="rounded-md p-1.5 text-text-secondary hover:bg-secondary disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <Select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          aria-label="Filter per karyawan"
          className="w-auto min-w-[12rem]"
        >
          <option value="all">Semua Karyawan</option>
          {(usersData?.data ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-72 w-full" />
        </>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileSpreadsheet className="h-10 w-10 text-text-secondary" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              Belum ada absensi pada bulan {monthLabel}
              {selectedUserId !== 'all' && ' untuk karyawan ini'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Ringkasan per user */}
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan per Karyawan</CardTitle>
              <CardDescription>
                Total kehadiran, telat, dan lembur selama satu bulan
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="py-2 pr-3 font-medium">Nama</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 text-center font-medium">Hadir</th>
                    <th className="py-2 pr-3 text-center font-medium">Sakit</th>
                    <th className="py-2 pr-3 text-center font-medium">Izin</th>
                    <th className="py-2 pr-3 text-center font-medium">Cuti</th>
                    <th className="py-2 pr-3 text-center font-medium">Libur</th>
                    <th className="py-2 pr-3 text-center font-medium">Total Telat</th>
                    <th className="py-2 pr-3 text-center font-medium">Total Lembur</th>
                    <th className="py-2 pr-3 text-center font-medium">Lembur Urgent</th>
                    <th className="py-2 text-center font-medium">Total Pulang Cepat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((s) => (
                    <tr
                      key={s.userId}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-background"
                    >
                      <td className="py-2.5 pr-3 font-medium text-text-primary">{s.userName}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={s.role === 'administrator' ? 'default' : 'secondary'}>
                          {getRoleLabel(s.role)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">{s.presentDays}</td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {s.sakitDays > 0 ? s.sakitDays : <span className="text-text-secondary">-</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {s.izinDays > 0 ? s.izinDays : <span className="text-text-secondary">-</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {s.cutiDays > 0 ? s.cutiDays : <span className="text-text-secondary">-</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {s.liburDays > 0 ? s.liburDays : <span className="text-text-secondary">-</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {s.totalLateMinutes > 0 ? (
                          <span className="font-medium text-destructive">
                            {formatMinutes(s.totalLateMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {s.totalOvertimeMinutes > 0 ? (
                          <span className="font-medium text-success">
                            {formatMinutes(s.totalOvertimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {s.overtimeUrgentMinutes > 0 || s.overtimeUrgentPending > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {s.overtimeUrgentMinutes > 0 && (
                              <span className="font-medium text-success">
                                {formatMinutes(s.overtimeUrgentMinutes)}
                                <span className="ml-1 font-normal text-text-secondary">
                                  ({s.overtimeUrgentCount}×)
                                </span>
                              </span>
                            )}
                            {s.overtimeUrgentPending > 0 && (
                              <Badge variant="warning">
                                {s.overtimeUrgentPending} belum diverifikasi
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {s.totalEarlyLeaveMinutes > 0 ? (
                          <span className="font-medium text-warning">
                            {formatMinutes(s.totalEarlyLeaveMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Detail harian */}
          <Card>
            <CardHeader>
              <CardTitle>Detail Harian</CardTitle>
              <CardDescription>
                Satu baris per shift per hari. Hari bershift “libur” di jadwal tercatat Libur
                otomatis. Baris <strong>Lembur</strong> = panggilan lembur urgent di luar shift —
                seluruh durasinya dihitung lembur, dan baru masuk total setelah Anda menyetujuinya.
                Pulang cepat = pulang sebelum jam pulang shift (lembur datang awal tidak menutupi
                kekurangan jam)
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="py-2 pr-3 font-medium">Tanggal</th>
                    <th className="py-2 pr-3 font-medium">Nama</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 text-center font-medium">Keterangan</th>
                    <th className="py-2 pr-3 text-center font-medium">Shift</th>
                    <th className="py-2 pr-3 text-center font-medium">Jam Masuk</th>
                    <th className="py-2 pr-3 text-center font-medium">Jam Pulang</th>
                    <th className="py-2 pr-3 text-center font-medium">Telat</th>
                    <th className="py-2 pr-3 text-center font-medium">Lembur</th>
                    <th className="py-2 pr-3 text-center font-medium">Pulang Cepat</th>
                    <th className="py-2 text-center font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-background"
                    >
                      <td className="py-2.5 pr-3 text-text-primary">
                        {format(new Date(`${row.date}T00:00:00`), 'dd MMM', { locale: localeId })}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-text-primary">{row.userName}</td>
                      <td className="py-2.5 pr-3 text-text-secondary">{getRoleLabel(row.role)}</td>
                      <td className="py-2.5 pr-3 text-center">
                        {row.kind === 'lembur' ? (
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="default">Lembur</Badge>
                            {row.overtimeStatus && (
                              <Badge variant={OVERTIME_STATUS_VARIANT[row.overtimeStatus]}>
                                {OVERTIME_STATUS_LABEL[row.overtimeStatus]}
                              </Badge>
                            )}
                          </div>
                        ) : row.leaveType ? (
                          <Badge variant={row.leaveType === 'libur' ? 'secondary' : 'warning'}>
                            {getLeaveTypeLabel(row.leaveType)}
                          </Badge>
                        ) : (
                          <Badge variant="success">Hadir</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-secondary">
                        {row.shiftNumber != null ? row.shiftNumber : '-'}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {row.clockIn ? format(row.clockIn, 'HH:mm') : '-'}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {row.clockOut ? format(row.clockOut, 'HH:mm') : '-'}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {row.lateMinutes > 0 ? (
                          <span className="font-medium text-destructive">
                            {formatMinutes(row.lateMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {row.overtimeMinutes > 0 ? (
                          <span className="font-medium text-success">
                            {formatMinutes(row.overtimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {row.earlyLeaveMinutes > 0 ? (
                          <span className="font-medium text-warning">
                            {formatMinutes(row.earlyLeaveMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {/* Sesi lembur menunggu keputusan admin — verifikasi dulu */}
                        {row.kind === 'lembur' && row.overtimeRecordId ? (
                          <div className="flex items-center justify-center gap-1">
                            {row.overtimeStatus === 'pending' ? (
                              <>
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => reviewOvertime(row, 'approve')}
                                  disabled={reviewOvertimeMutation.isPending}
                                >
                                  <Check className="h-4 w-4" aria-hidden="true" /> Setujui
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => reviewOvertime(row, 'reject')}
                                  disabled={reviewOvertimeMutation.isPending}
                                >
                                  <X className="h-4 w-4" aria-hidden="true" /> Tolak
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  reviewOvertime(
                                    row,
                                    row.overtimeStatus === 'approved' ? 'reject' : 'approve'
                                  )
                                }
                                disabled={reviewOvertimeMutation.isPending}
                              >
                                {row.overtimeStatus === 'approved' ? 'Batalkan' : 'Setujui'}
                              </Button>
                            )}
                          </div>
                        ) : /* Baris izin/libur tidak punya sesi kerja → tak ada jejak */
                        row.leaveType === null && row.clockIn ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setTrailTarget({
                                userId: row.userId,
                                userName: row.userName,
                                date: row.date,
                                clockInAt: row.clockIn!.toISOString(),
                              })
                            }
                          >
                            <Route className="h-4 w-4" aria-hidden="true" /> Riwayat
                          </Button>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <LocationTrailDialog target={trailTarget} onClose={() => setTrailTarget(null)} />
    </div>
  );
}
