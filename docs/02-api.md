# 02 — Referensi API

Base URL: `http://localhost:3000` (dev) atau domain produksi Anda.

## Autentikasi

Semua endpoint (kecuali auth & health) memerlukan **session cookie** Better Auth
(`better-auth.session_token`, HTTP-only, SameSite=Lax). Cookie otomatis terkirim
dari browser; untuk aplikasi mobile lihat [07 — Integrasi Mobile](07-mobile-integration.md).

### Endpoint Auth (Better Auth bawaan, prefix `/api/auth`)

| Method | Path | Body | Keterangan |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/sign-up/email` | `{name, email, password}` | Daftar (role default: `employee`) |
| POST | `/api/auth/sign-in/email` | `{email, password}` | Login → set cookie session |
| POST | `/api/auth/sign-out` | - | Logout, hapus session |
| GET | `/api/auth/get-session` | - | Session + user aktif (termasuk `role`, `image`) |
| POST | `/api/auth/update-user` | `{name?, image?}` | Ubah nama/foto profil sendiri |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword, revokeOtherSessions?}` | Ganti kata sandi sendiri |

Password: minimal 8 karakter, hash scrypt (di-handle Better Auth). Session: 7 hari sliding window.

## Format Error Seragam

```json
{
  "code": "GEOFENCE_VIOLATION",
  "message": "Anda berada di luar area absensi (jarak: 500m)",
  "details": { "distance": "500m" },
  "timestamp": "2026-07-22T21:00:00.000Z"
}
```

| Kode | HTTP | Arti |
| :--- | :--- | :--- |
| `UNAUTHORIZED` | 401 | Belum login / session kedaluwarsa |
| `FORBIDDEN` | 403 | Bukan administrator / bukan pemilik resource |
| `VALIDATION_ERROR` | 400 | Body/query gagal validasi Zod (lihat `details`) |
| `GEOFENCE_VIOLATION` | 422 | Di luar area absensi |
| `DUPLICATE_CHECKIN` | 409 | Sudah clock-in, belum clock-out |
| `INVALID_SEQUENCE` | 409 | Clock-out tanpa clock-in hari itu |
| `NOT_CLOCKED_IN` | 409 | Kirim posisi live saat tidak berstatus hadir |
| `EMAIL_TAKEN` / `USER_ALREADY_EXISTS` | 409 | Email sudah terdaftar |
| `SELF_DEMOTION` / `SELF_DELETION` | 400 | Administrator mengubah/menghapus akunnya sendiri |
| `NOT_FOUND` | 404 | Resource tidak ada |
| `PHOTO_INVALID_FORMAT` / `PHOTO_TOO_LARGE` | 400 | Foto bukan JPEG valid / > batas ukuran |
| `INTERNAL_ERROR` | 500 | Kesalahan tak terduga (cek log server) |

## Absensi

### POST `/api/attendance` — buat record absensi

**Auth:** login. **Body:**

```json
{
  "type": "clock_in",              // "clock_in" | "clock_out"
  "latitude": -6.6001234,
  "longitude": 111.0501234,
  "accuracyMeters": 12.5,          // opsional
  "photoBase64": "data:image/jpeg;base64,...",  // wajib, JPEG, maks 5MB
  "notes": "Datang tepat waktu"    // opsional, maks 500 char
}
```

**Alur server:** validasi Zod → cek urutan (tidak boleh dobel clock-in / clock-out tanpa clock-in) → hitung jarak Haversine ke geofence aktif (toleransi = akurasi GPS, maks 50m) → tolak bila di luar → simpan foto ke `uploads/attendance/<uuid>.jpg` → insert record → **clock-in**: upsert posisi live; **clock-out**: hapus posisi live.

**Respons 201:**

```json
{
  "id": "uuid", "userId": "...", "userName": "Budi",
  "type": "clock_in", "timestamp": "2026-07-22T01:00:00.000Z",
  "latitude": -6.6, "longitude": 111.05, "accuracyMeters": 12.5,
  "photoUrl": "/api/uploads/attendance/xxx.jpg",
  "isWithinGeofence": true, "distanceFromCenter": 45.2,
  "geofenceName": "Kantor Pusat", "notes": null
}
```

### GET `/api/attendance` — daftar record

**Auth:** login. Non-administrator **dipaksa** hanya melihat miliknya sendiri.

Query: `?page=1&limit=20&userId=<id|self>&from=<ISO>&to=<ISO>&today=true`
(`limit` maks 1000; `today=true` menimpa from/to)

**Respons 200:** `{ "data": [record...], "pagination": { "page", "limit", "total", "totalPages" } }`

### GET `/api/attendance/[id]` — detail satu record

**Auth:** login; pemilik record atau administrator.

## Geofence

| Method | Path | Auth | Keterangan |
| :--- | :--- | :--- | :--- |
| GET | `/api/geofence` | Login | Geofence aktif; **404** bila belum dikonfigurasi |
| PUT | `/api/geofence` | Administrator | Update/buat: `{name, latitude, longitude, radiusMeters(10–5000), isActive}` |

## Jam Kerja SOP (Shift)

| Method | Path | Auth | Keterangan |
| :--- | :--- | :--- | :--- |
| GET | `/api/shifts` | Login | `{data: [{id, role, shiftNumber, startTime:"HH:mm", endTime}]}` |
| PUT | `/api/shifts` | Administrator | Ganti seluruh konfigurasi: `{shifts:[{role, shiftNumber, startTime, endTime}]}` — role: `admin\|noc\|teknisi`, start < end, kombinasi role+nomor unik |

## Pengguna (Administrator, kecuali dicatat)

### GET `/api/users`
Query: `?search=<nama/email>&role=<administrator|admin|noc|teknisi|employee>`
Urutan: administrator → admin → noc → teknisi → employee, lalu nama A-Z.

### POST `/api/users` — buat akun langsung
Body: `{name, email, password(min 8), role}`. Respons 201: profil user. 409 bila email terdaftar.

### PATCH `/api/users/[id]` — edit user
Body (semua opsional): `{name, email, password, role}`.
- `password` → di-hash Better Auth (reset oleh administrator, tanpa perlu password lama)
- Menurunkan role akun sendiri ditolak (`SELF_DEMOTION`)
- Email duplikat → 409 `EMAIL_TAKEN`

### DELETE `/api/users/[id]`
Hapus user + seluruh riwayatnya (cascade). Akun sendiri ditolak (`SELF_DELETION`).

## Pelacakan Posisi Live

### POST `/api/locations` — kirim posisi (dipanggil otomatis oleh client tiap 20 detik)
**Auth:** login. Body: `{latitude, longitude, accuracyMeters?}`.
Ditolak **409 `NOT_CLOCKED_IN`** bila record terakhir hari ini bukan clock-in.
Data di-upsert (satu baris per user).

### GET `/api/locations` — posisi semua karyawan
**Auth:** administrator. Respons:

```json
{ "data": [{ "userId", "userName", "role", "latitude", "longitude",
             "accuracyMeters", "updatedAt": "ISO" }] }
```

Client menganggap posisi "live" bila `updatedAt` < 90 detik lalu.

## Profil & File

| Method | Path | Auth | Keterangan |
| :--- | :--- | :--- | :--- |
| POST | `/api/profile/avatar` | Login | Body `{photoBase64}` (JPEG, maks 2MB, sudah di-resize client 400px). Respons `{url}` — lalu panggil `update-user` dengan `image: url` |
| GET | `/api/uploads/attendance/<file>` | Login | Foto absensi (Content-Type image/jpeg, cache private 1 hari) |
| GET | `/api/uploads/avatars/<file>` | Login | Foto profil |
| GET | `/api/health` | Publik | `{status:"ok", db:"connected"}` — untuk uptime monitor |

Proteksi path traversal aktif di endpoint uploads (path di-resolve dan wajib berada di dalam `UPLOAD_DIR`).
