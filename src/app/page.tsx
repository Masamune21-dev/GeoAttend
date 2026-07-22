import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/utils';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  redirect('/checkin');
}
