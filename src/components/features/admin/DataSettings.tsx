'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DangerAction =
  | { kind: 'restore'; payload: unknown; fileName: string }
  | { kind: 'reset-attendance' }
  | { kind: 'reset-users' };

const ACTION_INFO: Record<DangerAction['kind'], { title: string; description: string; confirmWord: string }> = {
  restore: {
    title: 'Restore dari Backup',
    description:
      'SEMUA data saat ini akan DIGANTI dengan isi file backup. Seluruh pengguna (termasuk Anda) harus login ulang setelahnya.',
    confirmWord: 'RESTORE',
  },
  'reset-attendance': {
    title: 'Hapus Semua Data Absensi',
    description:
      'Seluruh record absensi, foto absensi, dan posisi live akan dihapus permanen. Akun pengguna tetap ada.',
    confirmWord: 'RESET',
  },
  'reset-users': {
    title: 'Hapus Semua Pengguna Non-Administrator',
    description:
      'Semua akun selain Administrator akan dihapus permanen beserta seluruh riwayat absensinya.',
    confirmWord: 'RESET',
  },
};

/** Tab "Backup & Data": backup JSON, restore, dan reset data. */
export function DataSettings() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<DangerAction | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const closeDialog = () => {
    setPendingAction(null);
    setConfirmText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Backup ---
  const [isDownloading, setIsDownloading] = useState(false);
  const handleBackup = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) throw new Error('Gagal membuat backup');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `geoattend-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Backup berhasil diunduh');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat backup');
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Restore ---
  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      setPendingAction({ kind: 'restore', payload, fileName: file.name });
    } catch {
      toast.error('File bukan JSON backup yang valid');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const dangerMutation = useMutation({
    mutationFn: async (action: DangerAction) => {
      if (action.kind === 'restore') {
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message ?? 'Restore gagal');
        return { kind: action.kind, message: body.message as string };
      }

      const scope = action.kind === 'reset-attendance' ? 'attendance' : 'users';
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, confirm: 'RESET' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Reset gagal');
      return { kind: action.kind, message: body.message as string };
    },
    onSuccess: (result) => {
      toast.success(result.message);
      closeDialog();
      if (result.kind === 'restore') {
        // Session ikut terhapus — arahkan ke login
        setTimeout(() => {
          router.push('/login');
          router.refresh();
        }, 1500);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const info = pendingAction ? ACTION_INFO[pendingAction.kind] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup className="h-5 w-5 text-primary" aria-hidden="true" />
            Backup Data
          </CardTitle>
          <CardDescription>
            Unduh seluruh data (pengguna, absensi, geofence, SOP, pengaturan) sebagai file
            JSON. Foto absensi TIDAK termasuk — backup folder <code>uploads/</code> secara
            terpisah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleBackup} isLoading={isDownloading}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Unduh Backup (JSON)
          </Button>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-warning" aria-hidden="true" />
            Restore Data
          </CardTitle>
          <CardDescription>
            Pulihkan data dari file backup JSON. Semua data saat ini akan diganti, dan
            seluruh pengguna harus login ulang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Pilih File Backup...
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => handleRestoreFile(e.target.files?.[0])}
          />
        </CardContent>
      </Card>

      {/* Zona berbahaya */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Zona Berbahaya
          </CardTitle>
          <CardDescription>
            Aksi di bawah ini permanen dan tidak dapat dibatalkan. Buat backup terlebih
            dahulu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-text-primary">Hapus semua data absensi</p>
              <p className="text-xs text-text-secondary">
                Record, foto, dan posisi live dihapus — akun pengguna tetap ada
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingAction({ kind: 'reset-attendance' })}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Reset Absensi
            </Button>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Hapus semua pengguna non-administrator
              </p>
              <p className="text-xs text-text-secondary">
                Akun karyawan beserta seluruh riwayatnya dihapus permanen
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingAction({ kind: 'reset-users' })}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Reset Pengguna
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog konfirmasi dengan ketik ulang */}
      <Dialog open={pendingAction !== null} onClose={closeDialog} title={info?.title}>
        {pendingAction && info && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-lg bg-destructive-subtle p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{info.description}</p>
            </div>

            {pendingAction.kind === 'restore' && (
              <p className="text-sm text-text-secondary">
                File: <strong className="text-text-primary">{pendingAction.fileName}</strong>
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-word">
                Ketik <strong>{info.confirmWord}</strong> untuk melanjutkan
              </Label>
              <Input
                id="confirm-word"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={info.confirmWord}
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== info.confirmWord}
                isLoading={dangerMutation.isPending}
                onClick={() => dangerMutation.mutate(pendingAction)}
              >
                Lanjutkan
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
