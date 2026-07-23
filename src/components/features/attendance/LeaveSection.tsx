'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarOff, ClipboardList, Palmtree, Trash2 } from 'lucide-react';
import {
  useCreateLeave,
  useDeleteLeave,
  useLeaves,
  useTodayAttendance,
} from '@/hooks/useAttendance';
import { getLeaveStatusLabel, getLeaveTypeLabel, toLocalDateString } from '@/lib/leaves';
import type { LeaveRequestResponse, LeaveType } from '@/types/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STATUS_VARIANT = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
} as const;

function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (d: string) => format(new Date(`${d}T00:00:00`), 'dd MMM yyyy', { locale: localeId });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

/**
 * Bagian izin & libur di halaman absensi:
 * - tombol "Libur Hari Ini" (self-service, langsung tercatat)
 * - form "Ajukan Izin" (sakit/izin/cuti — menunggu persetujuan administrator)
 * - daftar pengajuan terbaru milik user + batalkan
 */
export function LeaveSection() {
  const today = toLocalDateString(new Date());
  const { data: leavesData } = useLeaves({ userId: 'self' });
  const { data: todayData } = useTodayAttendance();
  const createLeave = useCreateLeave();
  const deleteLeave = useDeleteLeave();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState<Exclude<LeaveType, 'libur'>>('izin');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');

  const leaves = useMemo(() => leavesData?.data ?? [], [leavesData]);
  const hasAttendanceToday = (todayData?.data ?? []).length > 0;

  const todayLibur = leaves.find(
    (l) => l.type === 'libur' && l.status === 'approved' && l.startDate <= today && today <= l.endDate
  );
  const todayApprovedLeave = leaves.find(
    (l) => l.type !== 'libur' && l.status === 'approved' && l.startDate <= today && today <= l.endDate
  );

  // Tampilkan pengajuan yang masih relevan (belum lewat, atau baru diputuskan)
  const visibleLeaves = useMemo(
    () => leaves.filter((l) => l.endDate >= today || l.status === 'pending').slice(0, 5),
    [leaves, today]
  );

  const handleMarkLibur = () => {
    createLeave.mutate(
      { type: 'libur', startDate: today, endDate: today },
      {
        onSuccess: () => toast.success('Hari ini tercatat sebagai libur'),
        onError: (err: Error & { code?: string }) =>
          toast.error(
            err.code === 'LEAVE_OVERLAP'
              ? 'Sudah ada izin/libur pada hari ini'
              : err.message || 'Gagal menandai libur'
          ),
      }
    );
  };

  const handleSubmitLeave = () => {
    createLeave.mutate(
      {
        type,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Pengajuan izin terkirim — menunggu persetujuan administrator');
          setDialogOpen(false);
          setReason('');
        },
        onError: (err: Error & { code?: string }) =>
          toast.error(
            err.code === 'LEAVE_OVERLAP'
              ? 'Sudah ada pengajuan pada rentang tanggal tersebut'
              : err.message || 'Gagal mengirim pengajuan'
          ),
      }
    );
  };

  const handleCancel = (leave: LeaveRequestResponse) => {
    deleteLeave.mutate(leave.id, {
      onSuccess: () =>
        toast.success(
          leave.type === 'libur' ? 'Penanda libur dibatalkan' : 'Pengajuan dibatalkan'
        ),
      onError: (err: Error) => toast.error(err.message || 'Gagal membatalkan'),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
          Izin &amp; Libur
        </CardTitle>
        <CardDescription>
          Tidak masuk hari ini? Tandai libur atau ajukan izin di sini.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {todayLibur ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-warning-subtle px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-medium text-amber-700">
              <Palmtree className="h-4 w-4" aria-hidden="true" />
              Hari ini tercatat Libur
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCancel(todayLibur)}
              isLoading={deleteLeave.isPending}
            >
              Batalkan
            </Button>
          </div>
        ) : todayApprovedLeave ? (
          <Alert variant="warning" className="font-medium">
            Hari ini Anda tercatat {getLeaveTypeLabel(todayApprovedLeave.type)}
          </Alert>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleMarkLibur}
              isLoading={createLeave.isPending && !dialogOpen}
              disabled={hasAttendanceToday}
              title={hasAttendanceToday ? 'Anda sudah absen hari ini' : undefined}
            >
              <Palmtree className="h-4 w-4" aria-hidden="true" />
              Libur Hari Ini
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <CalendarOff className="h-4 w-4" aria-hidden="true" />
              Ajukan Izin
            </Button>
          </div>
        )}

        {visibleLeaves.length > 0 && (
          <ul className="flex flex-col gap-2">
            {visibleLeaves.map((leave) => (
              <li
                key={leave.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">
                    {getLeaveTypeLabel(leave.type)}
                    <span className="ml-2 font-normal text-text-secondary">
                      {formatDateRange(leave.startDate, leave.endDate)}
                    </span>
                  </p>
                  {leave.reason && (
                    <p className="truncate text-xs text-text-secondary">{leave.reason}</p>
                  )}
                  {leave.status === 'rejected' && leave.reviewNote && (
                    <p className="truncate text-xs text-red-700">Alasan: {leave.reviewNote}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={STATUS_VARIANT[leave.status]}>
                    {getLeaveStatusLabel(leave.status)}
                  </Badge>
                  {(leave.status === 'pending' ||
                    (leave.type === 'libur' && leave.endDate >= today)) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(leave)}
                      aria-label="Batalkan pengajuan"
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-destructive-subtle hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Ajukan Izin">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Jenis</span>
            <div className="grid grid-cols-3 gap-2">
              {(['sakit', 'izin', 'cuti'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={
                    type === t
                      ? 'rounded-md border border-primary bg-primary-subtle px-3 py-2 text-sm font-semibold text-primary'
                      : 'rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary hover:bg-secondary'
                  }
                >
                  {getLeaveTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-start">Dari tanggal</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-end">Sampai tanggal</Label>
              <Input
                id="leave-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-reason">Alasan</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Contoh: Periksa ke dokter"
            />
          </div>

          <Button
            onClick={handleSubmitLeave}
            isLoading={createLeave.isPending}
            disabled={!reason.trim() || createLeave.isPending}
          >
            Kirim Pengajuan
          </Button>
          {!reason.trim() && (
            <p className="-mt-2 text-center text-xs text-text-secondary">
              Isi alasan terlebih dahulu untuk mengirim
            </p>
          )}
        </div>
      </Dialog>
    </Card>
  );
}
