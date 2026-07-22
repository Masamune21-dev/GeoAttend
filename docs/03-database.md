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
users 1───1 live_locations
shift_settings                 (berdiri sendiri, key: role+shift_number)
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
| created_at / updated_at | timestamp | |

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

### live_locations
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| user_id | text PK, FK→users (cascade) | Satu baris per user (upsert) |
| latitude / longitude | numeric(10,7) | Posisi terkini |
| accuracy_meters | numeric(6,2) null | |
| updated_at | timestamp | Client anggap live bila < 90 detik |

Diisi saat clock-in & tiap kiriman posisi; **dihapus saat clock-out**.

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
