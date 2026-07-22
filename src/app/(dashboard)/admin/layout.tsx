import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/utils';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session || session.user.role !== 'administrator') {
    redirect('/checkin');
  }

  return <>{children}</>;
}
