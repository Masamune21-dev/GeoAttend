import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/utils';
import { getAppSettings } from '@/lib/settings';
import { getServerBrand } from '@/lib/brand.server';
import { brandConfig } from '@/lib/brand';
import { Header } from '@/components/layouts/Header';
import { MobileNav } from '@/components/layouts/MobileNav';
import { DesktopSidebar } from '@/components/layouts/DesktopSidebar';
import { StockSidebar } from '@/components/layouts/StockSidebar';
import { StockMobileNav } from '@/components/layouts/StockMobileNav';
import { LiveTracker } from '@/components/features/attendance/LiveTracker';
import { BrandProvider } from '@/components/providers/BrandProvider';

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
  const brand = getServerBrand();
  const cfg = brandConfig(brand, appSettings.appName);
  const isStock = brand === 'stok';

  return (
    <BrandProvider brand={brand}>
      <div className="flex min-h-dvh">
        {isStock ? (
          <StockSidebar appName={cfg.name} logoUrl={appSettings.logoUrl} isAdmin={isAdmin} />
        ) : (
          <DesktopSidebar isAdmin={isAdmin} appName={appSettings.appName} logoUrl={appSettings.logoUrl} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            userName={session.user.name}
            userRole={session.user.role ?? 'employee'}
            userImage={session.user.image}
            brandName={cfg.name}
          />
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        </div>
        {isStock ? <StockMobileNav /> : <MobileNav isAdmin={isAdmin} />}
        {!isStock && <LiveTracker />}
      </div>
    </BrandProvider>
  );
}
