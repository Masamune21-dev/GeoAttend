'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { useLeaves, useReviewLeave, useDeleteLeave } from '@/hooks/useAttendance';
import { getLeaveStatusLabel, getLeaveTypeLabel } from '@/lib/leaves';
import { getRoleLabel } from '@/lib/utils';
import type { LeaveRequestResponse, LeaveStatus } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { SwapApprovals } from '@/components/features/admin/SwapApprovals';

const STATUS_VARIANT = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
} as const;

const FILTERS: { value: LeaveStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'all', label: 'Semua' },
];

function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (d: string) => format(new Date(`${d}T00:00:00`), 'dd MMM yyyy', { locale: localeId });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export default function AdminLeavesPage() {
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('pending');
  const { data, isLoading } = useLeaves(filter === 'all' ? {} : { status: filter });
  const reviewLeave = useReviewLeave();
  const deleteLeave = useDeleteLeave();

  const [rejectTarget, setRejectTarget] = useState<LeaveRequestResponse | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const leaves = useMemo(() => {
    const list = data?.data ?? [];
    // Pending selalu di atas, lalu terbaru dulu
    return [...list].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [data]);

  const handleApprove = (leave: LeaveRequestResponse) => {
    reviewLeave.mutate(
      { id: leave.id, status: 'approved' },
      {
        onSuccess: () =>
          toast.success(`${getLeaveTypeLabel(leave.type)} ${leave.userName} disetujui`),
        onError: (err: Error) => toast.error(err.message || 'Gagal menyetujui'),
      }
    );
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    reviewLeave.mutate(
      { id: rejectTarget.id, status: 'rejected', reviewNote: rejectNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Pengajuan ${rejectTarget.userName} ditolak`);
          setRejectTarget(null);
          setRejectNote('');
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal menolak'),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <SwapApprovals />

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-white p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={
              filter === f.value
                ? 'rounded-sm bg-primary-subtle px-3 py-1.5 text-sm font-semibold text-primary'
                : 'rounded-sm px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-secondary hover:text-text-primary'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : leaves.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ClipboardCheck className="h-10 w-10 text-text-secondary" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              {filter === 'pending'
                ? 'Tidak ada pengajuan yang menunggu persetujuan'
                : 'Belum ada data pengajuan'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pengajuan Izin &amp; Libur</CardTitle>
            <CardDescription>
              Setujui atau tolak pengajuan sakit/izin/cuti. Penanda libur dicatat langsung oleh
              karyawan.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="py-2 pr-3 font-medium">Nama</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Jenis</th>
                  <th className="py-2 pr-3 font-medium">Tanggal</th>
                  <th className="py-2 pr-3 font-medium">Alasan</th>
                  <th className="py-2 pr-3 text-center font-medium">Status</th>
                  <th className="py-2 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr
                    key={leave.id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-background"
                  >
                    <td className="py-2.5 pr-3 font-medium text-text-primary">{leave.userName}</td>
                    <td className="py-2.5 pr-3 text-text-secondary">
                      {getRoleLabel(leave.userRole)}
                    </td>
                    <td className="py-2.5 pr-3 text-text-primary">
                      {getLeaveTypeLabel(leave.type)}
                    </td>
                    <td className="py-2.5 pr-3 text-text-primary">
                      {formatDateRange(leave.startDate, leave.endDate)}
                    </td>
                    <td className="max-w-48 py-2.5 pr-3">
                      <span className="block truncate text-text-secondary" title={leave.reason ?? ''}>
                        {leave.reason ?? '-'}
                      </span>
                      {leave.status !== 'pending' && leave.reviewedByName && (
                        <span className="block truncate text-xs text-text-secondary/80">
                          oleh {leave.reviewedByName}
                          {leave.reviewNote ? ` — ${leave.reviewNote}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      <Badge variant={STATUS_VARIANT[leave.status]}>
                        {getLeaveStatusLabel(leave.status)}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      {leave.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleApprove(leave)}
                            disabled={reviewLeave.isPending}
                            aria-label={`Setujui pengajuan ${leave.userName}`}
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget(leave);
                              setRejectNote('');
                            }}
                            disabled={reviewLeave.isPending}
                            aria-label={`Tolak pengajuan ${leave.userName}`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Tolak
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            deleteLeave.mutate(leave.id, {
                              onSuccess: () => toast.success('Data pengajuan dihapus'),
                              onError: (err: Error) =>
                                toast.error(err.message || 'Gagal menghapus'),
                            })
                          }
                          disabled={deleteLeave.isPending}
                        >
                          Hapus
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="Tolak Pengajuan"
      >
        {rejectTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Menolak {getLeaveTypeLabel(rejectTarget.type).toLowerCase()}{' '}
              <span className="font-medium text-text-primary">{rejectTarget.userName}</span> (
              {formatDateRange(rejectTarget.startDate, rejectTarget.endDate)}).
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reject-note">Catatan (opsional)</Label>
              <Textarea
                id="reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Contoh: Jadwal shift tidak memungkinkan"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                isLoading={reviewLeave.isPending}
              >
                Tolak Pengajuan
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
