'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import { authClient, useSession } from '@/lib/auth/client';
import { getInitials, getRoleLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const AVATAR_SIZE = 400;

/** Baca file gambar, crop persegi di tengah, resize 400px, konversi ke JPEG. */
async function fileToJpegDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File bukan gambar yang valid'));
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak didukung browser');

  const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  ctx.drawImage(img, (AVATAR_SIZE - width) / 2, (AVATAR_SIZE - height) / 2, width, height);

  return canvas.toDataURL('image/jpeg', 0.85);
}

export function ProfileForm() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  if (isPending || !session) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { user } = session;
  const displayName = name ?? user.name;

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const photoBase64 = await fileToJpegDataUrl(file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoBase64 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal mengunggah foto');

      // Update user + session Better Auth agar foto langsung berlaku
      const { error } = await authClient.updateUser({ image: body.url });
      if (error) throw new Error(error.message ?? 'Gagal menyimpan foto profil');

      toast.success('Foto profil diperbarui');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah foto');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length === 0) {
      toast.error('Nama tidak boleh kosong');
      return;
    }
    setIsSavingName(true);
    const { error } = await authClient.updateUser({ name: displayName.trim() });
    setIsSavingName(false);
    if (error) {
      toast.error(error.message ?? 'Gagal menyimpan nama');
      return;
    }
    toast.success('Nama berhasil diubah');
    router.refresh();
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok');
      return;
    }
    setIsChangingPassword(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setIsChangingPassword(false);
    if (error) {
      toast.error(
        error.code === 'INVALID_PASSWORD'
          ? 'Kata sandi saat ini salah'
          : (error.message ?? 'Gagal mengubah kata sandi')
      );
      return;
    }
    toast.success('Kata sandi berhasil diubah');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Kartu identitas + foto profil */}
      <Card>
        <CardContent className="flex flex-col items-center gap-5 p-6 pt-6 md:flex-row md:p-6 md:pt-6">
          <div className="relative">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={`Foto profil ${user.name}`}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white"
              >
                {getInitials(user.name)}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              aria-label="Ganti foto profil"
              className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleAvatarChange(e.target.files?.[0])}
            />
          </div>

          <div className="text-center md:text-left">
            <p className="text-xl font-semibold text-text-primary">{user.name}</p>
            <p className="text-sm text-text-secondary">{user.email}</p>
            <Badge
              variant={user.role === 'administrator' ? 'default' : 'secondary'}
              className="mt-2"
            >
              {getRoleLabel(user.role)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Ubah nama */}
      <Card>
        <CardHeader>
          <CardTitle>Data Diri</CardTitle>
          <CardDescription>
            Email (username login) hanya bisa diubah oleh Administrator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-name">Nama Lengkap</Label>
              <Input
                id="pf-name"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="self-start"
              isLoading={isSavingName}
              disabled={displayName.trim() === user.name}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Simpan Nama
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Ganti kata sandi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
            Ganti Kata Sandi
          </CardTitle>
          <CardDescription>
            Setelah berhasil, sesi login di perangkat lain akan dikeluarkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-current">Kata Sandi Saat Ini</Label>
              <Input
                id="pf-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pf-new">Kata Sandi Baru</Label>
                <Input
                  id="pf-new"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pf-confirm">Konfirmasi Kata Sandi Baru</Label>
                <Input
                  id="pf-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="self-start"
              isLoading={isChangingPassword}
              disabled={
                currentPassword.length === 0 ||
                newPassword.length === 0 ||
                confirmPassword.length === 0
              }
            >
              Ubah Kata Sandi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
