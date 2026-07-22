import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/utils';
import { getAppSettings } from '@/lib/settings';
import { Header } from '@/components/layouts/Header';
import { MobileNav } from '@/components/layouts/MobileNav';
import { DesktopSidebar } from '@/components/layouts/DesktopSidebar';
import { LiveTracker } from '@/components/features/attendance/LiveTracker';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login?reason=expired');
  }

  const isAdmin = session.user.role === 'administrator';
  const appSettings = await getAppSettings();

  return (
    <div className="flex min-h-dvh">
      <DesktopSidebar
        isAdmin={isAdmin}
        appName={appSettings.appName}
        logoUrl={appSettings.logoUrl}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          userName={session.user.name}
          userRole={session.user.role ?? 'employee'}
          userImage={session.user.image}
        />
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav isAdmin={isAdmin} />
      <LiveTracker />
    </div>
  );
}
