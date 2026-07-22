# 01 — Gambaran Umum GeoAttend

## Apa itu GeoAttend?

GeoAttend adalah sistem absensi berbasis web dengan tiga lapis verifikasi:

1. **Geofence GPS** — absensi hanya sah di dalam radius lokasi kantor yang dikonfigurasi
2. **Bukti foto real-time** — foto wajib diambil langsung dari kamera (bukan galeri)
3. **Pelacakan live** — posisi karyawan yang sedang hadir terpantau di peta admin

Aplikasi berjalan **local-first** di infrastruktur sendiri (Proxmox/Docker/VPS) tanpa biaya langganan.

## Fitur Lengkap

### Untuk Karyawan
- Absen masuk/pulang dengan kamera + validasi lokasi otomatis
- Indikator jarak real-time ke area absensi + peringatan sinyal GPS lemah
- Riwayat absensi dengan kalender bulanan berkode warna + detail foto
- Profil: ubah nama, foto profil, dan kata sandi sendiri
- Pengiriman posisi live otomatis selama status hadir (untuk pemantauan lapangan)

### Untuk Administrator
- Dashboard overview: statistik hadir/dalam/luar area + absensi terbaru
- **Peta Live**: marker bergerak mengikuti posisi karyawan (hijau berdenyut = live, biru = posisi terakhir), popup foto & jam
- **Rekap Bulanan**: tabel per user per hari (jam masuk, jam pulang, shift, telat, lembur), filter per karyawan, ekspor CSV & PDF
- **Kelola Pengguna**: tambah akun langsung, edit nama/email/reset password, ubah role, hapus
- **Pengaturan**: editor geofence interaktif (drag pin + radius) dan jam kerja SOP per role

## Arsitektur

```
┌──────────────────────────────────────────────────────┐
│  Browser (Karyawan / Administrator)                  │
│  Next.js App Router (React 18, Tailwind, Leaflet)    │
│  - TanStack Query (server state, polling)            │
│  - Zustand (GPS/UI state)                            │
│  - LiveTracker (kirim posisi tiap 20 detik)          │
└──────────────────┬───────────────────────────────────┘
                   │ HTTPS (cookie session HTTP-only)
┌──────────────────▼───────────────────────────────────┐
│  Next.js Server (API Routes, port 3000)              │
│  - Better Auth (session, password hash scrypt)       │
│  - Zod validation di semua endpoint                  │
│  - Validasi geofence server-side (Haversine)         │
│  - Foto → filesystem ./uploads (di luar public/)     │
└──────┬───────────────────────────────┬───────────────┘
       │ Drizzle ORM                   │ fs/promises
┌──────▼──────────────┐        ┌───────▼──────────────┐
│  PostgreSQL 16      │        │  ./uploads/          │
│  (Docker/native)    │        │  ├── attendance/     │
│                     │        │  └── avatars/        │
└─────────────────────┘        └──────────────────────┘
```

## Tech Stack

| Kategori | Teknologi | Versi |
| :--- | :--- | :--- |
| Framework | Next.js (App Router) | 14.2.x |
| Bahasa | TypeScript (strict) | 5.4.x |
| UI | Tailwind CSS + komponen kustom ala shadcn | 3.4.x |
| Peta | Leaflet + React-Leaflet (OpenStreetMap) | 1.9 / 4.2 |
| ORM | Drizzle ORM | 0.45.x |
| Database | PostgreSQL (image PostGIS) | 16 |
| Auth | Better Auth | 1.6.x |
| Validasi | Zod | 3.23.x |
| State server | TanStack Query | 5.x |
| State client | Zustand | 4.5.x |
| Kamera | react-webcam | 7.x |
| Tanggal | date-fns (locale id) | 3.x |
| PDF | jsPDF + jspdf-autotable (dynamic import) | 2.5 / 3.8 |
| Notifikasi | sonner | 1.5.x |

## Struktur Proyek

```
KusumaVisionAbsensi/
├── docs/                       # Dokumentasi (folder ini)
├── docker-compose.yml          # db (default) + app (profile: production)
├── Dockerfile                  # Multi-stage build Next.js standalone
├── drizzle.config.ts
├── scripts/seed.ts             # Seed administrator + geofence + SOP shift
├── tests/unit/                 # Vitest: geo & perhitungan shift
├── uploads/                    # Foto absensi & avatar (gitignored)
└── src/
    ├── middleware.ts           # Guard cookie session (optimistik)
    ├── app/
    │   ├── (auth)/             # login, register
    │   ├── (dashboard)/        # checkin, history, profile, admin/*
    │   │   └── admin/          # layout guard role administrator
    │   │       ├── page.tsx        # Overview
    │   │       ├── live-map/       # Peta live + tracking
    │   │       ├── reports/        # Rekap bulanan (CSV/PDF)
    │   │       ├── users/          # Kelola pengguna
    │   │       └── settings/       # Geofence + jam kerja SOP
    │   └── api/                # Lihat docs/02-api.md
    ├── components/
    │   ├── ui/                 # Button, Card, Dialog, Input, ...
    │   ├── layouts/            # Header, DesktopSidebar, MobileNav
    │   └── features/           # attendance/, map/, admin/, auth/, profile/
    ├── lib/
    │   ├── db/                 # schema.ts, koneksi, migrations/
    │   ├── auth/               # Better Auth server + client + helpers
    │   ├── geo/                # Haversine + validasi geofence
    │   ├── shifts/calc.ts      # Logika telat/lembur (pure, teruji)
    │   ├── storage/local-fs.ts # Simpan/baca foto dengan proteksi path
    │   └── constants.ts        # WORK_ROLES, DEFAULT_SHIFTS, dll.
    ├── hooks/                  # useGeolocation, useAttendance (query hooks)
    ├── stores/                 # Zustand
    └── types/api.ts            # Zod schema + tipe request/response
```

## Prinsip Desain

- **Server tidak mempercayai client**: geofence, duplikasi absen, dan role dicek ulang server-side
- **Foto tidak publik**: disimpan di luar `public/`, disajikan via endpoint terautentikasi
- **Mobile-first**: bottom nav di HP, sidebar di desktop; target Lighthouse > 90
- **Bahasa Indonesia** untuk seluruh teks pengguna
- **Satu sumber kebenaran perhitungan**: `lib/shifts/calc.ts` dipakai web (dan nanti mobile via API rekap bila diperlukan)
