'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { signIn } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const expired = searchParams.get('reason') === 'expired';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: authError } = await signIn.email({ email, password });

    setIsLoading(false);
    if (authError) {
      setError('Email atau kata sandi salah');
      return;
    }

    toast.success('Berhasil masuk');
    // Administrator langsung ke dashboard admin; lainnya ke halaman absensi
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.push(role === 'administrator' ? '/admin' : '/checkin');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>
          {expired
            ? 'Sesi berakhir, silakan login kembali'
            : 'Masukkan email dan kata sandi Anda'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Kata Sandi</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p role="alert" className="rounded-sm bg-red-50 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isLoading} className="mt-2">
            {isLoading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Belum punya akun?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Daftar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
