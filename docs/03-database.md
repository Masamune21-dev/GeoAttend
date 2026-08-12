# 03 — Database

PostgreSQL 16 (image `postgis/postgis:16-3.4`; ekstensi PostGIS tersedia tapi
perhitungan jarak saat ini memakai Haversine di aplikasi). ORM: Drizzle.
Skema: [src/lib/db/schema.ts](../src/lib/db/schema.ts). Migrasi SQL:
[src/lib/db/migrations/](../src/lib/db/migrations/).

## Diagram Relasi

```
users 1───* sessions
users 1───* accounts          (credential: hash password scrypt)
users 1───* attendance_records *───1 geofences (nullable)
users 1───* leave_requests     (reviewed_by → users, nullable)
users 1───1 live_locations
users 1───* location_trails      (jejak perjalanan, retensi 90 hari)
users 1───1 schedule_participants (peserta grid jadwal shift)
shift_settings                 (berdiri sendiri, key: role+shift_number)
app_settings                   (key-value: app_name, app_logo, registration_code)
verifications                  (token verifikasi Better Auth)
```

## Tabel

### users
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | text PK | ID Better Auth |
| name | varchar(255) | Nama tampilan |
| email | varchar(255) unique | Username login |
| email_verified | boolean | default false |
| image | text null | URL foto profil (`/api/uploads/avatars/...`) |
| role | varchar(20) | `administrator` \| `admin` \| `noc` \| `teknisi` \| `employee` (default) |
| technician_team | varchar(10) null | `ganjil` \| `genap` — tim jaga lembur malam teknisi |
| created_at / updated_at | timestamp | |

### schedule_participants
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| user_id | text PK, FK→users (cascade) | Karyawan yang muncul di grid jadwal & kandidat piket |
| created_at | timestamp | |

Tabel **kosong = perilaku lama**: grid memakai semua karyawan ber-role
`admin`/`noc`/`teknisi`. Mengeluarkan peserta tidak menghapus `schedule_entries`
miliknya (riwayat jadwal tetap utuh).

### sessions / accounts / verifications
Tabel standar Better Auth. `sessions.token` unique + index (validasi tiap request).
`accounts.password` menyimpan hash scrypt untuk provider credential.

### geofences
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | uuid PK | |
| name | varchar(255) | mis. "Kantor Pusat" |
| latitude / longitude | numeric(10,7) | Pusat area |
| radius_meters | numeric(6,2) | 10–5000 |
| is_active | boolean | Satu geofence aktif dipakai validasi |

### attendance_records
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | uuid PK | |
| user_id | text FK→users (cascade) | |
| type | varchar(20) | `clock_in` \| `clock_out` |
| shift_number | integer null | Shift yang dipilih saat absen (null: data lama / role tanpa SOP) |
| timestamp | timestamp | Waktu absen (server) |
| latitude / longitude | numeric(10,7) | Posisi saat absen |
| accuracy_meters | numeric(6,2) null | Akurasi GPS |
| photo_url | text | `/api/uploads/attendance/<uuid>.jpg` |
| geofence_id | uuid FK→geofences null | Geofence saat validasi |
| is_within_geofence | boolean | |
| distance_from_center | numeric(8,2) | meter |
| notes | text null | maks 500 char |
| metadata | jsonb null | `{userAgent}` |

Index: `(user_id, timestamp)` dan `(timestamp)`.

### shift_settings
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | uuid PK | |
| role | varchar(20) | `admin` \| `noc` \| `teknisi` |
| shift_number | integer | 1..n |
| start_time / end_time | varchar(5) | "HH:mm", start < end (tidak lintas tengah malam) |

Unique index `(role, shift_number)`. Default SOP di-seed:
admin & noc: 07:00–15:00 dan 15:00–22:00; teknisi: 08:00–16:00.

### leave_requests
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | uuid PK | |
| user_id | text FK→users (cascade) | Pengaju |
| type | varchar(10) | `sakit` \| `izin` \| `cuti` \| `libur` |
| start_date / end_date | varchar(10) | `"yyyy-MM-dd"` (tanggal lokal, inklusif) |
| reason | text null | maks 500 char |
| status | varchar(10) | `pending` (default) \| `approved` \| `rejected` |
| reviewed_by | text FK→users null | Administrator yang memutuskan |
| reviewed_at | timestamp null | |
| review_note | text null | Catatan penolakan/persetujuan |

Index: `(user_id, start_date)` dan `(status)`.
Jenis `libur` dibuat langsung `approved` (self-service, hanya hari ini);
jenis lain menunggu keputusan administrator.

### app_settings
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| key | varchar(64) PK | `app_name`, `app_logo`, `registration_code` |
| value | text | |

`registration_code`: kode wajib saat pendaftaran akun. Baris dihapus = pendaftaran ditutup.

### live_locations
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| user_id | text PK, FK→users (cascade) | Satu baris per user (upsert) |
| latitude / longitude | numeric(10,7) | Posisi terkini |
| accuracy_meters | numeric(6,2) null | |
| updated_at | timestamp | Client anggap live bila < 6 menit |

Diisi saat clock-in & tiap kiriman posisi; **dihapus saat clock-out**.

### location_trails
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | uuid PK | |
| user_id | text FK→users (cascade) | |
| recorded_at | timestamp | Waktu fix GPS **di perangkat** |
| latitude / longitude | numeric(10,7) | |
| accuracy_meters | numeric(6,2) null | Fix > 150 m tidak pernah disimpan |
| is_mocked | boolean | Android: terdeteksi aplikasi fake GPS |
| created_at | timestamp | Waktu terima server (pembanding audit) |

Index: `location_trails_user_recorded_idx` (UNIQUE `user_id, recorded_at` — sekaligus kunci idempotensi saat batch dikirim ulang) dan `location_trails_recorded_idx` (dipakai pembersih retensi).

Append-only, diisi POST `/api/locations` selama sesi kerja. Berbeda dari
`live_locations`, tabel ini **tidak dihapus saat clock-out** — justru itulah
sumber data riwayat perjalanan.

Data **operasional**, bukan absensi resmi: sengaja **tidak ikut backup**, ikut
terhapus pada reset scope `attendance`, dan dibersihkan otomatis setelah
`TRAIL_RETENTION_DAYS` (default 90) hari:

```bash
npm run db:cleanup-trails                          # retensi default
TRAIL_RETENTION_DAYS=30 npm run db:cleanup-trails  # override
```

Perkiraan volume: ~240 titik/karyawan/shift → 20 karyawan × 26 hari ≈ 125 rb
baris/bulan; pada retensi 90 hari ≈ 375 rb baris (~95 MB termasuk index).

Untuk pengembangan, jejak sintetis bisa dibangkitkan tanpa berkendara:

```bash
npm run db:seed-trail -- --email budi@contoh.com --date 2026-07-29
```

### push_tokens
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| token | text **PK** | Expo push token (`ExponentPushToken[...]`) |
| user_id | text FK→users (cascade) | Pemilik perangkat saat ini |
| platform | varchar(10) | `android` \| `ios` |
| app_version | varchar(20) null | Versi app pendaftar — pelacak HP yang belum di-update |
| created_at | timestamp | |
| last_seen_at | timestamp | Disegarkan tiap app mendaftarkan ulang token |

Index: `push_tokens_user_idx` (`user_id`) — dipakai saat mengumpulkan perangkat penerima.

**Token yang jadi primary key, bukan pasangan `(user_id, token)`.** Token Expo
melekat ke instalasi aplikasi, bukan akun: satu HP yang berganti pemilik
(karyawan logout, rekannya login) tetap memakai token yang sama. Dengan token
sebagai PK, registrasi ulang cukup meng-upsert `user_id` sehingga notifikasi
ikut pindah pemilik. Kalau PK-nya gabungan, HP itu akan menerima notifikasi
milik dua orang sekaligus.

Baris dihapus saat logout, dan otomatis saat Expo menjawab `DeviceNotRegistered`
(aplikasi di-uninstall / token dicabut).

## Alur Migrasi

```bash
# 1. Ubah src/lib/db/schema.ts
# 2. Generate file SQL
npm run db:generate -- --name nama-perubahan
# 3. Terapkan
npm run db:migrate
# 4. (opsional) Seed data awal
npm run db:seed
```

Aturan: migrasi **additive-only** (tambah tabel/kolom) agar rollback aplikasi
tidak merusak data. Riwayat migrasi tercatat di schema `drizzle.__drizzle_migrations`.

## Backup

```bash
docker exec geoattend-db pg_dump -U geoattend geoattend > backup_$(date +%Y%m%d).sql
# Restore:
cat backup.sql | docker exec -i geoattend-db psql -U geoattend -d geoattend
```

Jangan lupa backup folder `uploads/` (foto absensi & avatar) bersamaan.
