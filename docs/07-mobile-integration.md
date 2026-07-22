# 07 — Panduan Integrasi Aplikasi Mobile

Dokumen ini untuk pengembangan aplikasi mobile (fase berikutnya). Backend web
**sudah siap dipakai** — mobile cukup mengonsumsi API yang sama
([02 — Referensi API](02-api.md)).

## Alasan utama butuh mobile native

**Pelacakan lokasi background.** Browser menghentikan GPS saat layar mati/app
di-background. Aplikasi native (dengan izin background location) bisa terus
mengirim `POST /api/locations` sehingga marker teknisi tetap LIVE walau HP di saku.

## Rekomendasi Stack

**React Native + Expo** — alasan:
- Tim sudah menguasai React/TypeScript (kode web ini); banyak tipe di `src/types/api.ts` bisa dipakai ulang
- `expo-location` mendukung background location (iOS & Android), `expo-camera` untuk foto absensi
- `expo-task-manager` untuk task pengiriman posisi berkala

Alternatif: Flutter (performa bagus, tapi bahasa berbeda) atau Kotlin/Swift native (dua codebase).

## Autentikasi dari Mobile

Better Auth mendukung dua pola:

### Opsi A — Cookie (paling sederhana)
Gunakan HTTP client dengan cookie jar (mis. fetch + `expo-cookies` / axios dengan
persist). Login `POST /api/auth/sign-in/email` → simpan cookie → semua request
berikutnya otomatis terautentikasi. Kekurangan: pengelolaan cookie di RN kadang merepotkan.

### Opsi B — Bearer token (disarankan untuk mobile)
Aktifkan plugin `bearer` di Better Auth server (`src/lib/auth/index.ts`):

```ts
import { bearer } from 'better-auth/plugins';
export const auth = betterAuth({ ..., plugins: [bearer()] });
```

Alur: login → baca header `set-auth-token` dari respons → simpan di SecureStore →
kirim `Authorization: Bearer <token>` di setiap request. Tidak ada perubahan lain
di endpoint aplikasi (semua memakai `auth.api.getSession({ headers })` yang
otomatis mengerti bearer).

## Pemetaan Layar → Endpoint

| Layar Mobile | Endpoint |
| :--- | :--- |
| Login | `POST /api/auth/sign-in/email` |
| Beranda/Absen | `GET /api/geofence`, `GET /api/attendance?today=true&userId=self`, `POST /api/attendance` |
| Riwayat | `GET /api/attendance?userId=self&from=&to=&limit=100` |
| Profil | `GET /api/auth/get-session`, `POST /api/auth/update-user`, `POST /api/auth/change-password`, `POST /api/profile/avatar` |
| Service background tracking | `POST /api/locations` tiap 20–60 detik selama hadir |
| (Admin) Peta live | `GET /api/locations` + `GET /api/attendance?today=true` polling |

## Kontrak Penting untuk Mobile

1. **Foto absensi**: kirim sebagai data URI `data:image/jpeg;base64,...` di field `photoBase64` (bukan multipart). Kompres dulu: maks sisi 1200 px, kualitas 0.8, < 5 MB
2. **Avatar**: crop persegi 400 px, JPEG, < 2 MB → `POST /api/profile/avatar` → lalu `POST /api/auth/update-user` `{image: url}`
3. **Waktu**: server yang mencatat timestamp — jangan kirim waktu perangkat
4. **Geofence**: boleh divalidasi lokal untuk UX (rumus Haversine, buffer akurasi maks 50 m — lihat [04](04-business-rules.md)), tapi keputusan final tetap dari server (`GEOFENCE_VIOLATION` 422)
5. **Tracking**: hormati respons `409 NOT_CLOCKED_IN` → hentikan task background. Selalu hentikan task setelah clock-out (hemat baterai & privasi)
6. **Error**: semua error berformat `{code, message, details?, timestamp}` — tampilkan `message` (sudah bahasa Indonesia)

## Background Location — Catatan Platform

| | Android | iOS |
| :--- | :--- | :--- |
| Izin | `ACCESS_BACKGROUND_LOCATION` (minta bertahap: foreground dulu) | "Always" authorization |
| Kebijakan store | Wajib deklarasi & video demo kebijakan lokasi di Play Console | Review ketat; jelaskan use case absensi karyawan |
| Praktik | Foreground service + notifikasi persisten "Pelacakan aktif selama jam kerja" | Significant-change / region monitoring untuk hemat baterai |

Wajib: tampilkan indikator jelas di app bahwa pelacakan aktif, dan hanya selama
status hadir (sesuai aturan server).

## Push Notification (opsional, fase lanjut)

Ide: pengingat absen masuk/pulang sesuai jam shift role user. Perlu penambahan
server: simpan FCM/APNs token per user + cron pengirim — belum tersedia di backend saat ini.

## Checklist Kesiapan Backend (sudah ✅)

- [x] Seluruh fitur tersedia via REST API dengan validasi server-side
- [x] Format error konsisten & berbahasa Indonesia
- [x] Endpoint tracking dengan guard status hadir
- [x] Foto via base64 (tanpa kebutuhan multipart)
- [ ] Plugin `bearer` diaktifkan (1 baris, saat mulai develop mobile)
- [ ] (Opsional) Push notification infrastructure
