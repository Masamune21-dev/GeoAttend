'use client';

import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { useSwaps, useReviewSwap } from '@/hooks/useSchedule';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function fmtDate(d: string): string {
  return format(new Date(`${d}T00:00:00`), 'EEE, dd MMM yyyy', { locale: localeId });
}

/** Daftar pengajuan tukar shift yang sudah disetujui rekan & menunggu administrator. */
export function SwapApprovals() {
  const { data, isLoading } = useSwaps({ status: 'pending_admin' });
  const reviewSwap = useReviewSwap();
  const swaps = data?.data ?? [];

  const act = (id: string, action: 'approve' | 'reject', label: string) => {
    reviewSwap.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(label),
        onError: (err: Error) => toast.error(err.message || 'Gagal memproses'),
      }
    );
  };

  if (!isLoading && swaps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          Tukar Shift
        </CardTitle>
        <CardDescription>
          Sudah disetujui rekan, menunggu persetujuan administrator. Menyetujui akan menukar jadwal
          kedua karyawan.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
              <th className="py-2 pr-3 font-medium">Pengaju</th>
              <th className="py-2 pr-3 font-medium">Rekan</th>
              <th className="py-2 pr-3 font-medium">Tanggal</th>
              <th className="py-2 pr-3 font-medium">Tukar</th>
              <th className="py-2 pr-3 font-medium">Alasan</th>
              <th className="py-2 text-center font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {swaps.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-background">
                <td className="py-2.5 pr-3 font-medium text-text-primary">{s.requesterName}</td>
                <td className="py-2.5 pr-3 text-text-primary">{s.targetName}</td>
                <td className="py-2.5 pr-3 text-text-primary">{fmtDate(s.date)}</td>
                <td className="py-2.5 pr-3 text-text-secondary">
                  {s.requesterName.split(' ')[0]}: S{s.requesterShift}→S{s.targetShift}
                </td>
                <td className="max-w-40 py-2.5 pr-3">
                  <span className="block truncate text-text-secondary" title={s.reason ?? ''}>
                    {s.reason ?? '-'}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => act(s.id, 'approve', `Tukar ${s.requesterName} disetujui`)}
                      disabled={reviewSwap.isPending}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" /> Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => act(s.id, 'reject', `Tukar ${s.requesterName} ditolak`)}
                      disabled={reviewSwap.isPending}
                    >
                      <X className="h-4 w-4" aria-hidden="true" /> Tolak
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
