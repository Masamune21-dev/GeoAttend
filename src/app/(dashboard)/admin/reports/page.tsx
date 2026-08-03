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
import { formatMinutes, type ShiftTime } from '@/lib/shifts/calc';
import { buildRecap, type RecapRow } from '@/lib/reports/recap';
import { getLeaveTypeLabel } from '@/lib/leaves';
import { appToday } from '@/lib/time';
import { getRoleLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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

  const reviewOvertime = (row: RecapRow, action: 'approve' | 'reject') => {
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

  const { rows: dailyRows, summaries } = useMemo(
    () =>
      buildRecap({
        records: attendanceData?.data ?? [],
        users: usersData?.data ?? [],
        shifts: (shiftsData?.data ?? []).map(
          (s): ShiftTime => ({
            role: s.role,
            shiftNumber: s.shiftNumber,
            startTime: s.startTime,
            endTime: s.endTime,
          })
        ),
        leaves: leavesData?.data ?? [],
        scheduleEntries: scheduleData?.entries ?? [],
        monthStart,
        monthEnd,
        today: appToday(),
      }),
    [attendanceData, usersData, shiftsData, leavesData, scheduleData, monthStart, monthEnd]
  );

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
        row.clockInTime ?? '-',
        row.clockOutTime ?? '-',
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
        row.clockInTime ?? '-',
        row.clockOutTime ?? '-',
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
                        {row.clockInTime ?? '-'}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-text-primary">
                        {row.clockOutTime ?? '-'}
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
                        row.leaveType === null && row.clockInAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setTrailTarget({
                                userId: row.userId,
                                userName: row.userName,
                                date: row.date,
                                clockInAt: row.clockInAt!,
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
