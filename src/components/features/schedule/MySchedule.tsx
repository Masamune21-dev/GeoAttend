'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSession } from '@/lib/auth/client';
import {
  useSchedule,
  useSwaps,
  useSwapCandidates,
  useCreateSwap,
  useReviewSwap,
  useDeleteSwap,
  usePiket,
  useMarkPiketDone,
} from '@/hooks/useSchedule';
import { monthDates, toLocalMonth } from '@/lib/schedule/rotation';
import { toLocalDateString } from '@/lib/leaves';
import {
  SHIFT_LABEL,
  WEEKDAY_SHORT,
  shiftCellClass,
  monthLabel,
  addMonth,
  weekdayOf,
  isWeekend,
  SWAP_STATUS_LABEL,
  SWAP_STATUS_VARIANT,
} from '@/lib/schedule/display';
import type { ScheduleShift } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}

function formatDate(dateStr: string): string {
  const day = Number(dateStr.slice(-2));
  return `${WEEKDAY_SHORT[weekdayOf(dateStr)]}, ${day} ${monthLabel(dateStr.slice(0, 7))}`;
}

export function MySchedule() {
  const { data: session } = useSession();
  const myId = session?.user.id;

  const [month, setMonth] = useState(() => toLocalMonth(new Date()));
  const { data, isLoading } = useSchedule(month, 'self');
  const { data: swapsData } = useSwaps();
  const { data: piketData } = usePiket(month);
  const markPiketDone = useMarkPiketDone();

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapDate, setSwapDate] = useState(tomorrowStr());
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');

  const candidatesQuery = useSwapCandidates(swapOpen ? swapDate : null);
  const createSwap = useCreateSwap();
  const reviewSwap = useReviewSwap();
  const deleteSwap = useDeleteSwap();

  const dates = useMemo(() => monthDates(month), [month]);
  const byDate = useMemo(() => {
    const map: Record<string, ScheduleShift> = {};
    for (const e of data?.entries ?? []) map[e.date] = e.shift;
    return map;
  }, [data]);

  const swaps = swapsData?.data ?? [];
  const incoming = swaps.filter((s) => s.targetId === myId && s.status === 'pending_peer');
  const mine = swaps.filter((s) => s.requesterId === myId);

  const today = toLocalDateString(new Date());
  const hasSchedule = (data?.entries ?? []).length > 0;

  const piketList = piketData?.assignments ?? [];
  const todayPiket = piketList.find((a) => a.date === today);
  const myPiket = piketList
    .filter((a) => a.userId === myId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const togglePiket = (date: string, done: boolean) => {
    markPiketDone.mutate(
      { date, done },
      {
        onSuccess: () => toast.success(done ? 'Ditandai sudah piket' : 'Tanda piket dibatalkan'),
        onError: (err: Error) => toast.error(err.message || 'Gagal memperbarui piket'),
      }
    );
  };

  const submitSwap = () => {
    if (!targetUserId) {
      toast.error('Pilih rekan yang akan ditukar');
      return;
    }
    createSwap.mutate(
      { date: swapDate, targetUserId, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Pengajuan tukar dikirim ke rekan');
          setSwapOpen(false);
          setTargetUserId('');
          setReason('');
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal mengajukan tukar'),
      }
    );
  };

  const respondPeer = (id: string, action: 'peer_accept' | 'peer_reject') => {
    reviewSwap.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(action === 'peer_accept' ? 'Diterima, menunggu admin' : 'Permintaan ditolak'),
        onError: (err: Error) => toast.error(err.message || 'Gagal memproses'),
      }
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Header bulan */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonth(m, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="w-36 text-center text-sm font-semibold text-text-primary">
            {monthLabel(month)}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonth(m, 1))} aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <Button onClick={() => setSwapOpen(true)}>
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          Ajukan Tukar
        </Button>
      </div>

      {/* Permintaan tukar untuk saya */}
      {incoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permintaan tukar untuk kamu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {incoming.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm">
                <div>
                  <span className="font-medium text-text-primary">{s.requesterName}</span> ingin tukar
                  shift {formatDate(s.date)} — kamu ke <strong>Shift {s.requesterShift}</strong>, dia
                  ke <strong>Shift {s.targetShift}</strong>.
                  {s.reason && <span className="block text-text-secondary">“{s.reason}”</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="success" onClick={() => respondPeer(s.id, 'peer_accept')} disabled={reviewSwap.isPending}>
                    <Check className="h-4 w-4" aria-hidden="true" /> Terima
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondPeer(s.id, 'peer_reject')} disabled={reviewSwap.isPending}>
                    <X className="h-4 w-4" aria-hidden="true" /> Tolak
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Jadwal saya */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jadwal Saya</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : !hasSchedule ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Belum ada jadwal untuk bulan ini
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-center text-sm">
                <thead>
                  <tr className="bg-secondary">
                    {dates.map((d) => {
                      const isToday = d === today;
                      return (
                        <th
                          key={d}
                          className={`border-b border-l border-border/50 px-0.5 py-1.5 font-medium first:border-l-0 ${
                            isToday
                              ? 'bg-primary-subtle text-primary'
                              : isWeekend(d)
                                ? 'bg-red-50 text-red-600'
                                : 'text-text-secondary'
                          }`}
                        >
                          <div className="text-sm font-semibold leading-tight">{Number(d.slice(-2))}</div>
                          <div className="text-[11px] font-normal">{WEEKDAY_SHORT[weekdayOf(d)]}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {dates.map((d) => {
                      const shift = byDate[d];
                      const isToday = d === today;
                      return (
                        <td
                          key={d}
                          className={`border-l border-border/40 p-1 first:border-l-0 ${
                            isToday ? 'bg-primary-subtle' : ''
                          }`}
                        >
                          <div
                            className={`flex h-11 items-center justify-center rounded text-sm font-semibold ${shiftCellClass(shift)}`}
                            title={shift ? SHIFT_LABEL[shift] : 'kosong'}
                          >
                            {shift ? SHIFT_LABEL[shift] : '–'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Piket kebersihan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Piket Kebersihan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Petugas piket hari ini:</span>
            {todayPiket ? (
              <span className="font-medium text-text-primary">{todayPiket.userName}</span>
            ) : (
              <span className="text-text-secondary">belum dijadwalkan</span>
            )}
            {todayPiket && todayPiket.userId === myId && (
              <Button
                size="sm"
                variant={todayPiket.done ? 'outline' : 'success'}
                onClick={() => togglePiket(today, !todayPiket.done)}
                disabled={markPiketDone.isPending}
              >
                {todayPiket.done ? 'Batalkan tanda' : 'Tandai sudah piket'}
              </Button>
            )}
          </div>

          {myPiket.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary">
                Jadwal piket kamu bulan ini
              </p>
              <div className="flex flex-wrap gap-1.5">
                {myPiket.map((a) => {
                  const editable = a.date <= today;
                  return (
                    <button
                      key={a.date}
                      type="button"
                      disabled={!editable || markPiketDone.isPending}
                      onClick={() => editable && togglePiket(a.date, !a.done)}
                      title={
                        editable
                          ? a.done
                            ? 'Sudah piket (klik untuk batal)'
                            : 'Klik jika sudah piket'
                          : 'Belum waktunya'
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        a.done ? 'bg-success-subtle text-green-700' : 'bg-secondary text-text-secondary'
                      } ${editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-70'}`}
                    >
                      {formatDate(a.date)}
                      {a.done ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Kamu tidak ada jadwal piket bulan ini.</p>
          )}
        </CardContent>
      </Card>

      {/* Pengajuan tukar saya */}
      {mine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengajuan tukar saya</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {mine.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm">
                <div>
                  Tukar dgn <span className="font-medium text-text-primary">{s.targetName}</span> —{' '}
                  {formatDate(s.date)} (S{s.requesterShift} ↔ S{s.targetShift})
                  {s.reviewNote && <span className="block text-text-secondary">Catatan: {s.reviewNote}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={SWAP_STATUS_VARIANT[s.status]}>{SWAP_STATUS_LABEL[s.status]}</Badge>
                  {(s.status === 'pending_peer' || s.status === 'pending_admin') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        deleteSwap.mutate(s.id, {
                          onSuccess: () => toast.success('Pengajuan dibatalkan'),
                          onError: (err: Error) => toast.error(err.message || 'Gagal membatalkan'),
                        })
                      }
                      disabled={deleteSwap.isPending}
                    >
                      Batal
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog ajukan tukar */}
      <Dialog open={swapOpen} onClose={() => setSwapOpen(false)} title="Ajukan Tukar Shift">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="swap-date" className="text-sm font-medium text-text-primary">
              Tanggal (ke depan)
            </label>
            <input
              id="swap-date"
              type="date"
              value={swapDate}
              min={tomorrowStr()}
              onChange={(e) => {
                setSwapDate(e.target.value);
                setTargetUserId('');
              }}
              className="h-10 rounded-sm border border-border bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {candidatesQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : candidatesQuery.data?.requesterShift == null ? (
            <p className="rounded-sm bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Kamu tidak terjadwal shift (atau libur) pada tanggal itu.
            </p>
          ) : candidatesQuery.data.candidates.length === 0 ? (
            <p className="rounded-sm bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Shift kamu <strong>Shift {candidatesQuery.data.requesterShift}</strong>. Tidak ada rekan
              satu role dengan shift berbeda pada tanggal itu.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                Shift kamu: <strong>Shift {candidatesQuery.data.requesterShift}</strong>. Pilih rekan
                (shift berbeda) untuk ditukar:
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="swap-target" className="text-sm font-medium text-text-primary">
                  Rekan
                </label>
                <select
                  id="swap-target"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="h-10 rounded-sm border border-border bg-white px-2 text-sm"
                >
                  <option value="">— pilih rekan —</option>
                  {candidatesQuery.data.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Shift {c.shift})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="swap-reason" className="text-sm font-medium text-text-primary">
                  Alasan (opsional)
                </label>
                <textarea
                  id="swap-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSwapOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={submitSwap}
              isLoading={createSwap.isPending}
              disabled={!targetUserId || !candidatesQuery.data?.candidates.length}
            >
              Kirim Pengajuan
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
