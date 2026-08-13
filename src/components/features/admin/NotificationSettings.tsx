'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, BellRing, RefreshCw, Send, Smartphone } from 'lucide-react';
import { formatDateTime, getRoleLabel } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BroadcastPushResponse, PushDeviceResponse } from '@/types/api';

const MESSAGE_MAX = 500;

/** Perangkat yang tidak menyapa server lebih lama dari ini dianggap mungkin sudah mati. */
const STALE_DEVICE_DAYS = 14;

async function fetchDevices(): Promise<PushDeviceResponse[]> {
  const res = await fetch('/api/push/devices');
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message ?? 'Gagal memuat daftar perangkat');
  return body.data as PushDeviceResponse[];
}

/**
 * Tab "Notifikasi": daftar perangkat yang siap menerima push, sekaligus
 * pengirim pengumuman ke perangkat itu.
 *
 * Keduanya satu layar dengan sengaja. Mengirim siaran tanpa melihat siapa yang
 * akan menerimanya adalah menembak dalam gelap — daftar di bawah form adalah
 * jawaban atas "ini nanti masuk ke HP siapa saja".
 */
export function NotificationSettings() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string> | null>(null); // null = semua
  const [confirmOpen, setConfirmOpen] = useState(false);

  const devicesQuery = useQuery({
    queryKey: ['push-devices'],
    queryFn: fetchDevices,
  });

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);

  /** Penerima adalah ORANG, bukan perangkat — satu karyawan bisa punya dua HP. */
  const recipientIds = useMemo(() => {
    const all = Array.from(new Set(devices.map((d) => d.userId)));
    return selected === null ? all : all.filter((id) => selected.has(id));
  }, [devices, selected]);

  const deviceCount = useMemo(
    () => devices.filter((d) => recipientIds.includes(d.userId)).length,
    [devices, recipientIds]
  );

  const toggleUser = (userId: string) => {
    const allIds = new Set(devices.map((d) => d.userId));
    const current = selected === null ? allIds : new Set(selected);
    if (current.has(userId)) current.delete(userId);
    else current.add(userId);
    setSelected(current.size === allIds.size ? null : current);
  };

  const isChecked = (userId: string) => selected === null || selected.has(userId);

  const sendMutation = useMutation({
    mutationFn: async (): Promise<BroadcastPushResponse> => {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          message: message.trim(),
          // Kirim daftar hanya bila memang disaring; kosong berarti "semua"
          // menurut sisi server, yang selalu memakai data terbarunya sendiri.
          userIds: selected === null ? undefined : recipientIds,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal mengirim notifikasi');
      return body.data as BroadcastPushResponse;
    },
    onSuccess: (result) => {
      toast.success(
        `Terkirim ke ${result.sent} dari ${result.targeted} perangkat` +
          (result.removed > 0 ? ` — ${result.removed} token mati dibersihkan` : '')
      );
      setConfirmOpen(false);
      setTitle('');
      setMessage('');
      setSelected(null);
      void devicesQuery.refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmOpen(false);
    },
  });

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MESSAGE_MAX && recipientIds.length > 0;

  const staleBefore = Date.now() - STALE_DEVICE_DAYS * 86_400_000;

  return (
    <div className="flex flex-col gap-4">
      {/* --- Pengirim pengumuman --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" aria-hidden="true" />
            Kirim Notifikasi
          </CardTitle>
          <CardDescription>
            Pengumuman langsung ke HP karyawan. Notifikasi yang sudah terkirim tidak bisa
            ditarik kembali — periksa isinya sebelum menekan kirim.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="broadcast-title">Judul (opsional)</Label>
            <Input
              id="broadcast-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Kosongkan — nama aplikasi yang akan tampil"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="broadcast-message">Pesan</Label>
            <Textarea
              id="broadcast-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MESSAGE_MAX}
              placeholder="Contoh: Besok apel pagi jam 07.30 di kantor."
            />
            <span className="self-end text-xs text-text-secondary">
              {trimmed.length}/{MESSAGE_MAX}
            </span>
          </div>

          {devices.length === 0 && !devicesQuery.isLoading && (
            <Alert variant="warning">
              Belum ada perangkat terdaftar. Karyawan perlu membuka aplikasi mobile dan
              mengizinkan notifikasi terlebih dahulu.
            </Alert>
          )}

          <Button
            className="self-start"
            disabled={!canSend}
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Kirim ke {recipientIds.length} karyawan
          </Button>
        </CardContent>
      </Card>

      {/* --- Daftar perangkat --- */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
                Perangkat Aktif ({devices.length})
              </CardTitle>
              <CardDescription>
                HP yang sudah punya token notifikasi. Centang untuk memilih penerima —
                bila semua tercentang, pesan dikirim ke seluruh perangkat.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void devicesQuery.refetch()}
              isLoading={devicesQuery.isFetching}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Segarkan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {devicesQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : devicesQuery.isError ? (
            <Alert variant="destructive">
              {(devicesQuery.error as Error).message}
            </Alert>
          ) : devices.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              Belum ada perangkat terdaftar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="w-10 py-2" />
                    <th className="py-2 font-medium">Karyawan</th>
                    <th className="py-2 font-medium">Perangkat</th>
                    <th className="py-2 font-medium">Versi App</th>
                    <th className="py-2 font-medium">Terakhir Aktif</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const stale = new Date(device.lastSeenAt).getTime() < staleBefore;
                    return (
                      <tr
                        key={device.userId + device.tokenSuffix}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${device.userName}`}
                            checked={isChecked(device.userId)}
                            onChange={() => toggleUser(device.userId)}
                            className="h-4 w-4 cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="py-2.5">
                          <p className="font-medium text-text-primary">{device.userName}</p>
                          <p className="text-xs text-text-secondary">
                            {getRoleLabel(device.userRole)}
                          </p>
                        </td>
                        <td className="py-2.5">
                          <span className="text-text-secondary">
                            {device.platform} · …{device.tokenSuffix}
                          </span>
                        </td>
                        <td className="py-2.5 text-text-secondary">
                          {device.appVersion ?? '-'}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-text-secondary">
                              {formatDateTime(device.lastSeenAt)}
                            </span>
                            {stale && <Badge variant="warning">lama tak aktif</Badge>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Konfirmasi: pratinjau isi sebelum benar-benar dikirim --- */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Kirim notifikasi sekarang?"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg bg-warning-subtle p-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Akan masuk ke <strong>{deviceCount} perangkat</strong> milik{' '}
              <strong>{recipientIds.length} karyawan</strong>. Notifikasi tidak bisa ditarik
              kembali setelah terkirim.
            </p>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
              Pratinjau
            </p>
            <p className="font-medium text-text-primary">
              {title.trim() || 'Nama aplikasi'}
            </p>
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{trimmed}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button isLoading={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Kirim
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
