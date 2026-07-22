# GeoAttend

Aplikasi absensi ringan dengan **verifikasi geofence GPS**, **bukti foto real-time**, dan **pelacakan posisi live**. Dibangun dengan Next.js 14 (App Router), Drizzle ORM + PostgreSQL, Better Auth, Leaflet, dan TanStack Query.

📚 **Dokumentasi lengkap: [docs/](docs/README.md)** — gambaran umum, referensi API, database, aturan bisnis, deployment (Proxmox VM/LXC), panduan pengguna, dan panduan integrasi mobile.

## Fitur

- ✅ **Check-in/out dengan foto** — kamera wajib, tidak bisa upload dari galeri
- 📍 **Validasi geofence** — absensi hanya sah dalam radius lokasi kantor (formula Haversine + toleransi akurasi GPS maks 50m)
- 🗺️ **Peta live admin** — pantau absensi hari ini secara real-time (polling 30 detik)
- 📅 **Riwayat kalender** — kalender bulanan berkode warna + detail foto tiap absensi
- 👥 **Manajemen pengguna** — ubah role admin/karyawan, hapus akun
- ⚙️ **Editor geofence interaktif** — seret pin di peta, atur radius 10m–5km
- 📤 **Ekspor CSV** — untuk rekap payroll
- 🔐 **Auth aman** — Better Auth, HTTP-only cookie, session sliding 7 hari

## Menjalankan (Development)

### 1. Prasyarat

- Node.js 20+
- Docker Desktop (untuk PostgreSQL)

### 2. Setup

```bash
# Salin env (sudah tersedia .env.local default untuk dev)
cp .env.example .env.local   # bila belum ada

# Install dependencies
npm install

# Nyalakan database (pastikan Docker Desktop berjalan)
docker compose up -d db

# Jalankan migrasi
npm run db:migrate

# Seed admin + geofence default
npm run db:seed
# → Admin: admin@geoattend.local / Admin12345

# Jalankan dev server
npm run dev
```

Buka http://localhost:3000 — login sebagai admin, lalu atur lokasi geofence di **Admin → Pengaturan**.

> **Catatan HTTPS:** API kamera & GPS browser hanya berfungsi di `localhost` atau HTTPS. Untuk mengakses dari HP di jaringan lokal, gunakan tunnel (mis. `npx ngrok http 3000`) atau reverse proxy HTTPS.

### Perintah lain

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build & jalankan production |
| `npm run test` | Unit test (Vitest) |
| `npm run db:generate` | Generate migrasi baru dari perubahan schema |
| `npm run db:migrate` | Terapkan migrasi ke DB |
| `npm run db:seed` | Seed admin + geofence |
| `npm run lint` | ESLint |

## Deployment (Docker)

```bash
# Set env production
export DB_PASSWORD=<password-kuat>
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export APP_URL=https://absensi.perusahaan.com

docker compose --profile production up -d --build
```

Health check: `GET /api/health` → `{"status":"ok","db":"connected"}`

## Struktur Proyek

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Login & register
│   ├── (dashboard)/      # Halaman terproteksi (checkin, history, admin/*)
│   └── api/              # API routes (attendance, geofence, users, uploads, health)
├── components/
│   ├── ui/               # Primitif (Button, Card, Dialog, ...)
│   ├── features/         # Komponen fitur (attendance, map, admin, auth)
│   └── layouts/          # Header, Sidebar, MobileNav
├── lib/
│   ├── db/               # Drizzle schema + koneksi + migrasi
│   ├── auth/             # Better Auth (server, client, helpers)
│   ├── geo/              # Haversine + validasi geofence
│   └── storage/          # Penyimpanan foto (filesystem lokal)
├── hooks/                # useGeolocation, useAttendance
├── stores/               # Zustand (lokasi, UI)
└── types/                # Zod schemas + tipe API
```

## Akun Seed Default

| Email | Password | Role |
| :--- | :--- | :--- |
| `admin@geoattend.local` | `Admin12345` | admin |

⚠️ **Ganti password ini di production** (atau set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` sebelum menjalankan seed).

## Catatan Keamanan

- Foto absensi disimpan di `./uploads` (di luar `public/`) dan hanya bisa diakses lewat `/api/uploads/*` dengan session valid
- Semua input divalidasi dengan Zod di sisi server; geofence direvalidasi server-side (client hanya UX)
- Karyawan hanya bisa membaca record miliknya sendiri; endpoint admin dicek role server-side
- Security headers + CSP aktif di production (lihat `next.config.mjs`)

## Belum Termasuk (Roadmap)

- Service worker / offline queue (PWA manifest sudah ada, SW belum)
- Rate limiting middleware
- Kompresi foto server-side (saat ini kompresi dilakukan client-side, JPEG q80)
- Retensi otomatis foto > 90 hari
- Aplikasi mobile native
