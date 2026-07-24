import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { Skeleton } from '@/components/ui/skeleton';
import { getServerBrand } from '@/lib/brand.server';
import { brandConfig } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Masuk',
};

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const cfg = brandConfig(getServerBrand());
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LoginForm brand={cfg.brand} title={cfg.loginTitle} subtitle={cfg.loginSubtitle} />
    </Suspense>
  );
}
