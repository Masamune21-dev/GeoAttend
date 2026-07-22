import { MapPin } from 'lucide-react';
import { getAppSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { appName, logoUrl } = await getAppSettings();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-primary to-sky-500 p-4">
      {/* Dekorasi lembut */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl"
      />

      <div className="relative mb-8 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            className="h-11 w-11 rounded-lg bg-white/90 object-contain p-1 shadow-elevated"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 text-white shadow-elevated ring-1 ring-white/25 backdrop-blur">
            <MapPin className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        <div>
          <p className="text-2xl font-bold tracking-tight text-white">{appName}</p>
          <p className="text-xs text-blue-100">Absensi dengan verifikasi lokasi &amp; foto</p>
        </div>
      </div>

      <div className="relative w-full max-w-md animate-slide-up">{children}</div>

      <p className="relative mt-8 text-center text-xs text-blue-100/80">
        KusumaVision · {new Date().getFullYear()}
      </p>
    </main>
  );
}
