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
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAttendanceList, useShifts, useUsers } from '@/hooks/useAttendance';
import { computeRecap, formatMinutes, type ShiftTime } from '@/lib/shifts/calc';
import { getRoleLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
}

interface UserSummary {
  userId: string;
  userName: string;
  role: string;
  presentDays: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const today = new Date();

  const { data: attendanceData, isLoading: attendanceLoading } = useAttendanceList({
    from: startOfMonth(month).toISOString(),
    to: endOfMonth(month).toISOString(),
    limit: 1000,
  });
  const { data: usersData, isLoading: usersLoading } = useUsers();
  const { data: shiftsData, isLoading: shiftsLoading } = useShifts();

  const isLoading = attendanceLoading || usersLoading || shiftsLoading;

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

    // Kelompokkan record per user per tanggal lokal:
    // jam masuk = clock_in PERTAMA, jam pulang = clock_out TERAKHIR hari itu
    const byUserDay = new Map<
      string,
      { userId: string; userName: string; date: string; clockIn: Date | null; clockOut: Date | null }
    >();

    for (const record of records) {
      const ts = new Date(record.timestamp);
      const date = format(ts, 'yyyy-MM-dd');
      const key = `${record.userId}|${date}`;
      const entry =
        byUserDay.get(key) ??
        {
          userId: record.userId,
          userName: record.userName,
          date,
          clockIn: null as Date | null,
          clockOut: null as Date | null,
        };

      if (record.type === 'clock_in') {
        if (!entry.clockIn || ts < entry.clockIn) entry.clockIn = ts;
      } else {
        if (!entry.clockOut || ts > entry.clockOut) entry.clockOut = ts;
      }
      byUserDay.set(key, entry);
    }

    const rows: DailyRow[] = Array.from(byUserDay.entries())
      .map(([key, entry]) => {
        const role = roleByUser.get(entry.userId) ?? 'employee';
        const recap = computeRecap(
          { clockIn: entry.clockIn, clockOut: entry.clockOut },
          shiftsByRole.get(role) ?? []
        );
        return {
          key,
          date: entry.date,
          userId: entry.userId,
          userName: entry.userName,
          role,
          clockIn: entry.clockIn,
          clockOut: entry.clockOut,
          shiftNumber: recap.shift?.shiftNumber ?? null,
          lateMinutes: recap.lateMinutes,
          overtimeMinutes: recap.overtimeMinutes,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName));

    // Ringkasan per user
    const summaryMap = new Map<string, UserSummary>();
    for (const row of rows) {
      const summary =
        summaryMap.get(row.userId) ??
        {
          userId: row.userId,
          userName: row.userName,
          role: row.role,
          presentDays: 0,
          totalLateMinutes: 0,
          totalOvertimeMinutes: 0,
        };
      summary.presentDays += 1;
      summary.totalLateMinutes += row.lateMinutes;
      summary.totalOvertimeMinutes += row.overtimeMinutes;
      summaryMap.set(row.userId, summary);
    }

    return {
      dailyRows: rows,
      summaries: Array.from(summaryMap.values()).sort((a, b) =>
        a.userName.localeCompare(b.userName)
      ),
    };
  }, [attendanceData, usersData, shiftsData]);

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
    const header = ['Tanggal', 'Nama', 'Role', 'Shift', 'Jam Masuk', 'Jam Pulang', 'Telat (menit)', 'Lembur (menit)'];
    const lines = filteredRows.map((row) =>
      [
        row.date,
        escapeCsv(row.userName),
        getRoleLabel(row.role),
        row.shiftNumber != null ? `Shift ${row.shiftNumber}` : '-',
        row.clockIn ? format(row.clockIn, 'HH:mm') : '-',
        row.clockOut ? format(row.clockOut, 'HH:mm') : '-',
        String(row.lateMinutes),
        String(row.overtimeMinutes),
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
      head: [['Nama', 'Role', 'Hari Hadir', 'Total Telat', 'Total Lembur']],
      body: filteredSummaries.map((s) => [
        s.userName,
        getRoleLabel(s.role),
        String(s.presentDays),
        formatMinutes(s.totalLateMinutes),
        formatMinutes(s.totalOvertimeMinutes),
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
      head: [['Tanggal', 'Nama', 'Role', 'Shift', 'Jam Masuk', 'Jam Pulang', 'Telat', 'Lembur']],
      body: filteredRows.map((row) => [
        format(new Date(`${row.date}T00:00:00`), 'dd MMM yyyy', { locale: localeId }),
        row.userName,
        getRoleLabel(row.role),
        row.shiftNumber != null ? `Shift ${row.shiftNumber}` : '-',
        row.clockIn ? format(row.clockIn, 'HH:mm') : '-',
        row.clockOut ? format(row.clockOut, 'HH:mm') : '-',
        formatMinutes(row.lateMinutes),
        formatMinutes(row.overtimeMinutes),
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
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          aria-label="Filter per karyawan"
          className="h-10 rounded-md border border-border bg-white px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        </select>

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
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="py-2 pr-3 font-medium">Nama</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 text-center font-medium">Hari Hadir</th>
                    <th className="py-2 pr-3 text-center font-medium">Total Telat</th>
                    <th className="py-2 text-center font-medium">Total Lembur</th>
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
                      <td className="py-2.5 pr-3 text-center">
                        {s.totalLateMinutes > 0 ? (
                          <span className="font-medium text-destructive">
                            {formatMinutes(s.totalLateMinutes)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {s.totalOvertimeMinutes > 0 ? (
                          <span className="font-medium text-success">
                            {formatMinutes(s.totalOvertimeMinutes)}
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
                Jam masuk = clock-in pertama, jam pulang = clock-out terakhir tiap hari
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="py-2 pr-3 font-medium">Tanggal</th>
                    <th className="py-2 pr-3 font-medium">Nama</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 text-center font-medium">Shift</th>
                    <th className="py-2 pr-3 text-center font-medium">Jam Masuk</th>
                    <th className="py-2 pr-3 text-center font-medium">Jam Pulang</th>
                    <th className="py-2 pr-3 text-center font-medium">Telat</th>
                    <th className="py-2 text-center font-medium">Lembur</th>
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
                      <td className="py-2.5 text-center">
                        {row.overtimeMinutes > 0 ? (
                          <span className="font-medium text-success">
                            {formatMinutes(row.overtimeMinutes)}
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
        </>
      )}
    </div>
  );
}
