'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { signUp } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordChecks = useMemo(
    () => [
      { label: 'Minimal 8 karakter', valid: password.length >= 8 },
      { label: 'Mengandung huruf besar', valid: /[A-Z]/.test(password) },
      { label: 'Mengandung angka', valid: /\d/.test(password) },
    ],
    [password]
  );

  const isPasswordValid = passwordChecks.every((c) => c.valid);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmailValid) {
      setError('Format email tidak valid');
      return;
    }
    if (!isPasswordValid) {
      setError('Kata sandi belum memenuhi persyaratan');
      return;
    }
    if (!registrationCode.trim()) {
      setError('Masukkan kode pendaftaran dari administrator');
      return;
    }

    setIsLoading(true);
    // registrationCode dikirim ekstra & divalidasi di server (hook Better Auth)
    const { error: authError } = await signUp.email({
      name,
      email,
      password,
      registrationCode: registrationCode.trim(),
    } as Parameters<typeof signUp.email>[0]);
    setIsLoading(false);

    if (authError) {
      if (authError.code === 'USER_ALREADY_EXISTS') {
        setError('Email sudah terdaftar');
      } else {
        setError(authError.message ?? 'Gagal mendaftar. Coba lagi.');
      }
      return;
    }

    toast.success('Akun berhasil dibuat');
    router.push('/checkin');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar</CardTitle>
        <CardDescription>Buat akun baru untuk mulai absensi</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Budi Santoso"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {email.length > 0 && !isEmailValid && (
              <p className="text-xs text-destructive">Format email tidak valid</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Kata Sandi</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {password.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5" aria-live="polite">
                {passwordChecks.map((check) => (
                  <li
                    key={check.label}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      check.valid ? 'text-success' : 'text-text-secondary'
                    )}
                  >
                    {check.valid ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <X className="h-3 w-3" aria-hidden="true" />
                    )}
                    {check.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registration-code">Kode Pendaftaran</Label>
            <Input
              id="registration-code"
              autoComplete="off"
              placeholder="Kode dari administrator"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest"
              required
            />
            <p className="text-xs text-text-secondary">
              Minta kode pendaftaran kepada administrator perusahaan Anda
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-sm bg-red-50 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isLoading} className="mt-2">
            {isLoading ? 'Memproses...' : 'Daftar'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
