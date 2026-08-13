# 02 — Referensi API

Base URL: `http://localhost:3000` (dev) atau domain produksi Anda.

## Autentikasi

Semua endpoint (kecuali auth & health) memerlukan **session cookie** Better Auth
(`better-auth.session_token`, HTTP-only, SameSite=Lax). Cookie otomatis terkirim
dari browser; untuk aplikasi mobile lihat [07 — Integrasi Mobile](07-mobile-integration.md).

### Endpoint Auth (Better Auth bawaan, prefix `/api/auth`)

| Method | Path | Body | Keterangan |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/sign-up/email` | `{name, email, password, registrationCode}` | Daftar (role default: `employee`). **Wajib `registrationCode`** yang dibuat administrator di Pengaturan → General; tanpa kode valid → 403 |
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
| `INVALID_SHIFT` | 422 | `shiftNumber` tidak tersedia untuk role user |
| `INVALID_LEAVE_DATE` | 422 | Tanggal izin di masa lalu / penanda libur bukan hari ini |
| `LEAVE_OVERLAP` | 409 | Sudah ada pengajuan izin/libur pada rentang tanggal itu |
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
  "kind": "shift",                 // opsional, default "shift" | "lembur"
  "shiftNumber": 1,                // opsional (1–3); shift yang dipilih user
  "latitude": -6.6001234,
  "longitude": 111.0501234,
  "accuracyMeters": 12.5,          // opsional
  "photoBase64": "data:image/jpeg;base64,...",  // wajib, JPEG, maks 5MB
  "notes": "Datang tepat waktu"    // opsional, maks 500 char
}
```

**Alur server:** validasi Zod → cek urutan (tidak boleh dobel clock-in / clock-out tanpa clock-in) → **tentukan jenis sesi** (lihat di bawah) → **tentukan shift**: `shiftNumber` divalidasi terhadap SOP role user (`INVALID_SHIFT` bila tidak ada); bila tidak dikirim, clock-out mewarisi shift dari clock-in hari itu, sisanya fallback ke shift dengan jam masuk terdekat → hitung jarak Haversine ke geofence aktif (toleransi = akurasi GPS, maks 50m) → simpan foto ke `uploads/attendance/<uuid>.jpg` → insert record → **clock-in**: upsert posisi live; **clock-out**: hapus posisi live.

**Jenis sesi (`kind`)** — lihat [04-business-rules.md](04-business-rules.md#lembur-urgent):

- `kind` pada **clock_out DIABAIKAN**; server memakai jenis sesi yang sedang terbuka. Klien tidak bisa membuka lembur lalu menutupnya sebagai shift.
- `kind: "lembur"` + `clock_in` **wajib** `notes` → `422 OVERTIME_REASON_REQUIRED` bila kosong.
- Sesi lembur: `shiftNumber` dipaksa `null`, `overtimeStatus` diisi `"pending"`, dan berada di luar geofence **tidak** memicu `GEOFENCE_REASON_REQUIRED`.

**Respons 201:**

```json
{
  "id": "uuid", "userId": "...", "userName": "Budi",
  "type": "clock_in", "kind": "shift", "overtimeStatus": null,
  "shiftNumber": 1,
  "timestamp": "2026-07-22T01:00:00.000Z",
  "latitude": -6.6, "longitude": 111.05, "accuracyMeters": 12.5,
  "photoUrl": "/api/uploads/attendance/xxx.jpg",
  "isWithinGeofence": true, "distanceFromCenter": 45.2,
  "geofenceName": "Kantor Pusat", "notes": null,
  "reviewedByName": null, "reviewNote": null
}
```

`shiftNumber` bernilai `null` untuk record lama (sebelum fitur shift), role tanpa SOP, atau sesi lembur.
`kind` bernilai `"shift"` untuk seluruh record lama (default kolom saat migrasi).

### GET `/api/attendance` — daftar record

**Auth:** login. Non-administrator **dipaksa** hanya melihat miliknya sendiri.

Query: `?page=1&limit=20&userId=<id|self>&from=<ISO>&to=<ISO>&today=true`
(`limit` maks 1000; `today=true` menimpa from/to)

**Respons 200:** `{ "data": [record...], "pagination": { "page", "limit", "total", "totalPages" } }`

### GET `/api/attendance/[id]` — detail satu record

**Auth:** login; pemilik record atau administrator.

### PATCH `/api/attendance/[id]` — verifikasi sesi lembur

**Auth:** administrator. `id` harus record **PEMBUKA** sesi lembur
(`type=clock_in`, `kind=lembur`) — di situlah status satu sesi disimpan.

**Body:** `{ "action": "approve" | "reject", "reviewNote": "opsional, maks 500 char" }`

**Respons 200:** `{ "data": { "id", "overtimeStatus" } }`

| Kode | Status | Sebab |
| :--- | :---: | :--- |
| `FORBIDDEN` | 403 | Bukan administrator |
| `NOT_FOUND` | 404 | Record tidak ada |
| `NOT_OVERTIME_SESSION` | 422 | Record bukan awal sesi lembur (mis. record penutup) |

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

## Izin & Libur

### POST `/api/leaves` — ajukan izin / tandai libur

**Auth:** login. **Body:**

```json
{
  "type": "izin",                  // "sakit" | "izin" | "cuti" | "libur"
  "startDate": "2026-07-24",       // yyyy-MM-dd
  "endDate": "2026-07-25",         // >= startDate
  "reason": "Periksa ke dokter"    // opsional, maks 500 char
}
```

**Aturan server:**
- `sakit`/`izin`/`cuti` → status `pending` (menunggu keputusan administrator); tanggal mulai tidak boleh di masa lalu
- `libur` → status `approved` **langsung** (self-service), tapi **hanya untuk hari ini** (`startDate` = `endDate` = hari ini) — selain itu `INVALID_LEAVE_DATE`
- Rentang yang tumpang-tindih dengan pengajuan `pending`/`approved` milik user yang sama ditolak (`LEAVE_OVERLAP`)

**Respons 201:**

```json
{
  "id": "uuid", "userId": "...", "userName": "Budi", "userRole": "noc",
  "type": "izin", "startDate": "2026-07-24", "endDate": "2026-07-25",
  "reason": "Periksa ke dokter", "status": "pending",
  "reviewedByName": null, "reviewNote": null,
  "createdAt": "2026-07-23T01:00:00.000Z"
}
```

### GET `/api/leaves` — daftar pengajuan

**Auth:** login. Non-administrator **dipaksa** hanya melihat miliknya sendiri.

Query: `?userId=<id|self>&from=yyyy-MM-dd&to=yyyy-MM-dd&status=pending|approved|rejected`
(from/to memfilter pengajuan yang **tumpang-tindih** dengan rentang itu)

**Respons 200:** `{ "data": [leave...] }` (maks 500, terbaru dulu)

### PATCH `/api/leaves/[id]` — setujui / tolak (administrator)

Body: `{ "status": "approved" | "rejected", "reviewNote": "..."? }`
Respons: `{ "data": { "id", "status" } }`

### DELETE `/api/leaves/[id]` — batalkan

- Karyawan: hanya miliknya sendiri, dan hanya yang `pending` **atau** penanda `libur`
- Administrator: bebas menghapus

## Pengaturan Aplikasi

| Method | Path | Auth | Keterangan |
| :--- | :--- | :--- | :--- |
| GET | `/api/settings` | Publik | `{appName, logoUrl}` (dipakai halaman login). **Administrator** juga menerima `registrationCode` |
| PUT | `/api/settings` | Administrator | `{appName?, logoUrl?, registrationCode?}` — `registrationCode` kosong/null = **tutup pendaftaran** |
| POST | `/api/settings/logo` | Administrator | Upload logo `{photoBase64}` (PNG/JPEG) → `{url}` |

Kode pendaftaran divalidasi server-side pada `POST /api/auth/sign-up/email` (hook Better Auth) — tidak bisa di-bypass dari client.

## Pengguna (Administrator, kecuali dicatat)

### GET `/api/users`
Query: `?search=<nama/email>&role=<administrator|admin|noc|teknisi|employee>`
Urutan: administrator → admin → noc → teknisi → employee, lalu nama A-Z.

### POST `/api/users` — buat akun langsung
Body: `{name, email, password(min 8), role}`. Respons 201: profil user. 409 bila email terdaftar.

### PATCH `/api/users/[id]` — edit user
Body (semua opsional): `{name, email, password, role, technicianTeam}`.
- `password` → di-hash Better Auth (reset oleh administrator, tanpa perlu password lama)
- `technicianTeam`: `"ganjil" | "genap" | null` — tim jaga lembur malam teknisi. Mengubah `role` ke selain `teknisi` otomatis mengosongkannya
- Menurunkan role akun sendiri ditolak (`SELF_DEMOTION`)
- Email duplikat → 409 `EMAIL_TAKEN`

### DELETE `/api/users/[id]`
Hapus user + seluruh riwayatnya (cascade). Akun sendiri ditolak (`SELF_DELETION`).

## Jadwal Shift & Piket

### GET `/api/schedules?month=YYYY-MM&userId=self|<id>`
**Auth:** login. Administrator tanpa `userId` → grid penuh; karyawan selalu dipaksa ke dirinya sendiri.

```json
{ "users": [{ "id", "name", "role", "image", "technicianTeam" }],
  "entries": [{ "userId", "date", "shift": "1|2|libur" }],
  "participantsConfigured": true }
```

`users` berisi **peserta jadwal**; bila daftar peserta belum pernah diatur (`participantsConfigured: false`) dipakai semua karyawan ber-role `admin`/`noc`/`teknisi`.

### PUT `/api/schedules` — simpan jadwal sebulan
**Auth:** administrator. Body `{month, entries[]}`. Semantik **replace-bulan**, hanya untuk peserta jadwal saat ini.
Entri diabaikan bila: tanggal di luar bulan, user bukan peserta, atau **shift tidak berlaku bagi role** (teknisi hanya `1`/`libur`). Respons `{data:{month, saved}}` — `saved` = jumlah yang benar-benar tersimpan.

### GET `/api/schedules/participants` — kandidat & peserta jadwal
**Auth:** administrator. `candidates` = seluruh karyawan non-administrator (dikelompokkan role), `participantIds` = peserta aktif.

### PUT `/api/schedules/participants` — tetapkan peserta
**Auth:** administrator. Body `{userIds: string[]}` (replace seluruhnya). Id yang tidak ada diabaikan.
Mengeluarkan karyawan **tidak menghapus** entri jadwalnya yang sudah tersimpan.

### GET/PUT/PATCH `/api/piket`
Jadwal piket kebersihan sebulan. Kandidat petugas = peserta jadwal. `PATCH` menandai piket selesai (petugas hari itu atau administrator).
Setiap **Sabtu** adalah hari ngepel — ditandai hijau di UI; tidak ada perbedaan struktur data.

## Pelacakan Posisi Live

### POST `/api/locations` — kirim posisi
**Auth:** login. Dipanggil otomatis: web tiap 20 detik, app mobile per batch ~5 menit.

Menerima **dua bentuk body**:
- Lama (app ≤ 1.5.0 & web): `{latitude, longitude, accuracyMeters?}` — satu titik.
- Baru (app ≥ 1.6.0): `{points: [{latitude, longitude, accuracyMeters?, isMocked?, recordedAt}]}` — maks 60 titik per request.

Kompatibilitas mundur dipertahankan permanen: app mobile tidak punya OTA, jadi HP yang belum di-update tetap harus diterima.

Ditolak **409 `NOT_CLOCKED_IN`** bila record absensi terakhir dalam jendela bergulir 22 jam bukan clock-in (bukan "sejak tengah malam" — shift lintas tengah malam harus tetap terlacak).

Efek: posisi live di-upsert (satu baris per user) **dan** titik yang lolos saringan anti-jitter disimpan ke `location_trails`. Respons `{success, received, stored}`.

Saringan sebelum disimpan sebagai jejak:
- akurasi > 150 m dibuang;
- `recordedAt` > 2 menit di masa depan atau mendahului clock-in dibuang;
- titik disimpan bila bergerak ≥ 25 m (atau ≥ setengah radius akurasi) **atau** sudah ≥ 60 detik sejak titik terakhir.

### GET `/api/locations` — posisi semua karyawan
**Auth:** administrator. Respons:

```json
{ "data": [{ "userId", "userName", "role", "latitude", "longitude",
             "accuracyMeters", "updatedAt": "ISO" }] }
```

Client menganggap posisi "live" bila `updatedAt` < 6 menit lalu (heartbeat 5 menit + toleransi). Di atas itu marker **tidak** kembali ke titik absen — tetap di posisi terakhir dengan label "terakhir terlihat".

### GET `/api/locations/trail` — riwayat jejak satu sesi kerja
**Auth:** administrator saja (jejak perjalanan = data pribadi).
Query: `?userId=<id|self>&date=yyyy-MM-dd[&clockInAt=<ISO>]`.

`clockInAt` memilih sesi yang tepat bila ada dua shift pada tanggal yang sama, sekaligus membuat pemilihan sesi tidak bergantung pada zona waktu server.

Rentang jejak mengikuti **sesi kerja** (clock-in → clock-out), bukan 00:00–23:59. Bila belum absen pulang, dibatasi sampai sekarang atau 22 jam sejak masuk.

```json
{ "data": { "userId", "userName", "date", "shiftNumber",
            "sessionStart", "sessionEnd",
            "clockIn": { ...AttendanceRecordResponse }, "clockOut": { ... },
            "points": [{ "latitude", "longitude", "accuracyMeters", "isMocked", "recordedAt" }],
            "stops":  [{ "latitude", "longitude", "startedAt", "endedAt", "durationMinutes", "pointCount" }],
            "totalDistanceMeters", "truncated", "thinned" } }
```

404 `SESSION_NOT_FOUND` bila tidak ada sesi kerja pada tanggal tersebut.
Perhentian dideteksi dari data penuh (radius 100 m, minimal 10 menit); penipisan titik untuk peta baru dilakukan setelahnya (`thinned: true` bila terjadi).

## Profil & File

| Method | Path | Auth | Keterangan |
| :--- | :--- | :--- | :--- |
| POST | `/api/profile/avatar` | Login | Body `{photoBase64}` (JPEG, maks 2MB, sudah di-resize client 400px). Respons `{url}` — lalu panggil `update-user` dengan `image: url` |
| GET | `/api/uploads/attendance/<file>` | Login | Foto absensi (Content-Type image/jpeg, cache private 1 hari) |
| GET | `/api/uploads/avatars/<file>` | Login | Foto profil |
| GET | `/api/health` | Publik | `{status:"ok", db:"connected"}` — untuk uptime monitor |

Proteksi path traversal aktif di endpoint uploads (path di-resolve dan wajib berada di dalam `UPLOAD_DIR`).

## Push Notification

| Method | Path | Auth | Keterangan |
| :--- | :--- | :--- | :--- |
| POST | `/api/push/register` | Login | Body `{token, platform:'android'\|'ios', appVersion?}`. Upsert — aman dipanggil tiap app dibuka |
| DELETE | `/api/push/register` | Login | Token dari query `?token=` **atau** body. Hanya menghapus token milik pemanggil |
| GET | `/api/push/devices` | Administrator | Daftar perangkat terdaftar + pemiliknya, urut aktivitas terakhir |
| POST | `/api/push/broadcast` | Administrator | Body `{title?, message, userIds?}` → `{sent, removed, targeted}` |

`token` wajib berbentuk Expo push token (`ExponentPushToken[...]`); selain itu ditolak `400 VALIDATION_ERROR`.

Konflik di-resolve pada kolom `token`, bukan pasangan `(user, token)`. Satu HP yang berganti pemilik akan menimpa `user_id` lama sehingga notifikasi ikut pindah — kalau tidak, HP itu terus menerima notifikasi karyawan sebelumnya.

Pengiriman memakai **Expo Push Service** ([`src/lib/push`](../src/lib/push/index.ts)), bukan FCM langsung: service account key tersimpan di EAS dan Expo yang bicara ke FCM atas nama aplikasi, jadi server tidak menyimpan kredensial Google sama sekali. Token yang dijawab `DeviceNotRegistered` dihapus otomatis.

Semua pemanggilan dari route lain bersifat **fire-and-forget** (`dispatchPush`) dan tidak pernah melempar — Expo yang lambat atau mati tidak boleh membatalkan pengajuan yang sedang disimpan.

`/api/push/broadcast` justru **kebalikannya**: hasilnya ditunggu dan dilaporkan apa adanya. Di endpoint lain push cuma efek samping, di sini pengiriman itu sendiri adalah hasil yang diminta — administrator harus tahu berapa yang benar-benar terkirim sebelum menutup layar. Tidak ada percobaan ulang otomatis, karena kiriman ulang yang diam-diam muncul dua kali di HP karyawan. Setiap siaran dicatat ke log server berikut nama pengirimnya.

Daftar penerima selalu diambil ulang dari basis data, tidak dipercayakan pada `userIds` yang dikirim layar administrator — perangkat bisa terdaftar atau tercabut di antara saat daftar dimuat dan tombol kirim ditekan. `userIds` kosong/absen berarti semua perangkat.

`/api/push/devices` **tidak pernah** mengirim token utuh, hanya enam karakter terakhirnya. Token Expo adalah kapabilitas: siapa pun yang memegangnya bisa mengirim notifikasi ke HP itu tanpa melewati aplikasi ini. Enam karakter cukup untuk membedakan dua perangkat milik satu orang, dan itu satu-satunya kegunaannya di layar.
