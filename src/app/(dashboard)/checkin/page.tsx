import type { Metadata } from 'next';
import { CheckInForm } from '@/components/features/attendance/CheckInForm';

export const metadata: Metadata = {
  title: 'Absensi',
};

export default function CheckInPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <CheckInForm />
    </div>
  );
}
