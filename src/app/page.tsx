import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/utils';
import { getServerBrand } from '@/lib/brand.server';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  redirect(getServerBrand() === 'stok' ? '/stock' : '/checkin');
}
