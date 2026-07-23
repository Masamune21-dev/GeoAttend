import { CalendarClock, Camera, MapPin, ShieldCheck } from 'lucide-react';
import { getAppSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const HIGHLIGHTS = [
  {
    icon: MapPin,
    title: 'Absen terverifikasi lokasi',
    body: 'Geofence memastikan absensi hanya sah bila dilakukan di dalam area kantor.',
  },
  {
    icon: Camera,
    title: 'Swafoto sebagai bukti',
    body: 'Setiap absen menyimpan foto, waktu, dan koordinat — tidak bisa dititipkan.',
  },
  {
    icon: CalendarClock,
    title: 'Shift, tukar jadwal & izin',
    body: 'Rotasi shift, pengajuan tukar jadwal, dan izin dikelola dalam satu tempat.',
  },
];

/** Logo aplikasi: gambar unggahan bila ada, selain itu pin lokasi bawaan. */
function BrandMark({ logoUrl, className }: { logoUrl: string | null; className: string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className={`${className} rounded-xl bg-white/90 object-contain p-1.5 shadow-elevated`}
      />
    );
  }
  return (
    <span
      className={`${className} flex items-center justify-center rounded-xl bg-white/15 text-white shadow-elevated ring-1 ring-white/25 backdrop-blur`}
    >
      <MapPin className="h-[55%] w-[55%]" aria-hidden="true" />
    </span>
  );
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { appName, logoUrl } = await getAppSettings();
  const year = new Date().getFullYear();

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ---- Panel brand (desktop saja) ---- */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-primary to-sky-500 px-12 py-14 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-28 h-[28rem] w-[28rem] rounded-full bg-sky-300/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <BrandMark logoUrl={logoUrl} className="h-11 w-11" />
          <p className="text-xl font-bold tracking-tight text-white">{appName}</p>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-[2.75rem]">
            Absensi yang benar-benar bisa dipercaya.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-blue-100">
            Lokasi, foto, dan waktu tercatat otomatis di setiap absen — tanpa mesin fingerprint,
            tanpa antre.
          </p>

          <ul className="mt-10 flex flex-col gap-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20 backdrop-blur">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-blue-100">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-sm text-blue-100/80">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          KusumaVision · {year}
        </p>
      </aside>

      {/* ---- Panel form ---- */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-primary to-sky-500 p-4 lg:min-h-0 lg:bg-background lg:bg-none lg:p-8">
        {/* Dekorasi hanya untuk tampilan mobile (desktop pakai panel brand) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl lg:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl lg:hidden"
        />

        {/* Header brand — hanya di mobile/tablet */}
        <div className="relative mb-7 flex items-center gap-3 lg:hidden">
          <BrandMark logoUrl={logoUrl} className="h-12 w-12" />
          <div>
            <p className="text-2xl font-bold tracking-tight text-white">{appName}</p>
            <p className="text-xs text-blue-100">Absensi dengan verifikasi lokasi &amp; foto</p>
          </div>
        </div>

        <div className="relative w-full max-w-md animate-slide-up">{children}</div>

        <p className="relative mt-8 text-center text-xs text-blue-100/80 lg:hidden">
          KusumaVision · {year}
        </p>
      </div>
    </main>
  );
}
