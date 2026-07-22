import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Masuk',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LoginForm />
    </Suspense>
  );
}
