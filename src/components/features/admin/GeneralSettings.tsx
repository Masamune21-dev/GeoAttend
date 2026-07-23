'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, ImagePlus, KeyRound, MapPin, Palette, RefreshCw, Save, Server } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface AppSettingsResponse {
  appName: string;
  logoUrl: string | null;
  registrationCode?: string | null; // hanya dikirim utk administrator
}

/** Kode acak 8 karakter tanpa huruf/angka yang mudah tertukar (0,O,1,I,L). */
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

interface SystemInfoResponse {
  appVersion: string;
  nextVersion: string;
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  db: { connected: boolean; version: string };
  counts: { users: number; attendanceRecords: number; uploadsSizeBytes: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}h ${hours}j ${minutes}m`;
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

/** Tab "General": identitas aplikasi + informasi sistem. */
export function GeneralSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [appName, setAppName] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null); // data URI baru
  const [regCode, setRegCode] = useState<string | null>(null); // null = belum diubah

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async (): Promise<AppSettingsResponse> => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Gagal memuat pengaturan');
      return res.json();
    },
  });

  const { data: sysInfo, isLoading: sysLoading } = useQuery({
    queryKey: ['system-info'],
    queryFn: async (): Promise<SystemInfoResponse> => {
      const res = await fetch('/api/admin/system-info');
      if (!res.ok) throw new Error('Gagal memuat informasi sistem');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const displayName = appName ?? settings?.appName ?? '';

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Logo harus PNG atau JPEG');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Ukuran logo maksimal 1MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logoUrl: string | undefined;

      if (logoPreview) {
        const logoRes = await fetch('/api/settings/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoBase64: logoPreview }),
        });
        const logoBody = await logoRes.json();
        if (!logoRes.ok) throw new Error(logoBody?.message ?? 'Gagal mengunggah logo');
        logoUrl = logoBody.url;
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: displayName.trim(), logoUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal menyimpan pengaturan');
      return body;
    },
    onSuccess: () => {
      toast.success('Pengaturan aplikasi tersimpan');
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      router.refresh(); // perbarui branding di sidebar
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const displayRegCode = regCode ?? settings?.registrationCode ?? '';

  const saveRegCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationCode: displayRegCode.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal menyimpan kode');
      return body;
    },
    onSuccess: () => {
      toast.success(
        displayRegCode.trim()
          ? 'Kode pendaftaran tersimpan'
          : 'Pendaftaran ditutup (kode dikosongkan)'
      );
      setRegCode(null);
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayRegCode.trim());
      toast.success('Kode disalin ke clipboard');
    } catch {
      toast.error('Gagal menyalin kode');
    }
  };

  if (settingsLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full xl:col-span-2" />
      </div>
    );
  }

  const currentLogo = logoPreview ?? settings?.logoUrl ?? null;
  const registrationOpen = Boolean((regCode ?? settings?.registrationCode ?? '').trim());

  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-2">
      {/* Identitas aplikasi */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
            Identitas Aplikasi
          </CardTitle>
          <CardDescription>
            Nama dan logo tampil di sidebar, halaman login, dan tab browser
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-4 rounded-lg border border-border/70 bg-background p-3">
            {currentLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentLogo}
                alt="Logo aplikasi"
                className="h-16 w-16 shrink-0 rounded-lg border border-border bg-surface object-contain p-1"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
                <MapPin className="h-8 w-8" aria-hidden="true" />
              </span>
            )}
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {currentLogo ? 'Ganti Logo' : 'Upload Logo'}
              </Button>
              <p className="text-xs text-text-secondary">PNG/JPEG, maksimal 1MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => handleLogoSelect(e.target.files?.[0])}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-name">Nama Aplikasi</Label>
            <Input
              id="app-name"
              value={displayName}
              onChange={(e) => setAppName(e.target.value)}
              maxLength={64}
            />
            <p className="text-xs text-text-secondary">Maksimal 64 karakter</p>
          </div>

          <Button
            className="mt-auto self-start"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
            disabled={displayName.trim().length === 0}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Simpan
          </Button>
        </CardContent>
      </Card>

      {/* Kode pendaftaran */}
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
              Kode Pendaftaran
            </CardTitle>
            <Badge variant={registrationOpen ? 'success' : 'warning'}>
              {registrationOpen ? 'Pendaftaran terbuka' : 'Pendaftaran ditutup'}
            </Badge>
          </div>
          <CardDescription>
            Karyawan baru wajib memasukkan kode ini saat mendaftar. Kosongkan lalu simpan untuk
            menutup pendaftaran.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {!settings?.registrationCode && !regCode && (
            <Alert variant="warning">
              Belum ada kode — pendaftaran akun saat ini <strong>ditutup</strong>. Buat kode agar
              karyawan bisa mendaftar.
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registration-code">Kode aktif</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="registration-code"
                value={displayRegCode}
                onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                maxLength={64}
                placeholder="Belum ada kode"
                className="w-40 font-mono text-base tracking-widest md:text-base"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegCode(generateCode())}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                disabled={!displayRegCode.trim()}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Salin
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              Bagikan kode ini ke karyawan baru. Ganti kapan saja bila bocor.
            </p>
          </div>
          <Button
            className="mt-auto self-start"
            onClick={() => saveRegCodeMutation.mutate()}
            isLoading={saveRegCodeMutation.isPending}
            disabled={regCode === null}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Simpan Kode
          </Button>
        </CardContent>
      </Card>

      {/* Informasi sistem */}
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" aria-hidden="true" />
            Informasi Sistem
          </CardTitle>
          <CardDescription>Versi aplikasi dan kondisi server saat ini</CardDescription>
        </CardHeader>
        <CardContent>
          {sysLoading || !sysInfo ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['Versi Aplikasi', `v${sysInfo.appVersion}`],
                ['Framework', `Next.js ${sysInfo.nextVersion}`],
                ['Runtime', `Node.js ${sysInfo.nodeVersion}`],
                ['Platform', sysInfo.platform],
                ['Uptime Server', formatUptime(sysInfo.uptimeSeconds)],
                ['Jumlah Pengguna', String(sysInfo.counts.users)],
                ['Record Absensi', String(sysInfo.counts.attendanceRecords)],
                ['Penyimpanan Foto', formatBytes(sysInfo.counts.uploadsSizeBytes)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-border/50 pb-2">
                  <dt className="text-text-secondary">{label}</dt>
                  <dd className="font-medium tabular-nums text-text-primary">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-text-secondary">Database</dt>
                <dd className="flex items-center gap-2">
                  <Badge variant={sysInfo.db.connected ? 'success' : 'destructive'}>
                    {sysInfo.db.connected ? 'Terhubung' : 'Terputus'}
                  </Badge>
                  <span className="font-medium text-text-primary">{sysInfo.db.version}</span>
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
