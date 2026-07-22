# 04 — Aturan Bisnis

## Role & Hak Akses

| Role | Label | Akses Panel Admin | SOP Shift | Keterangan |
| :--- | :--- | :---: | :---: | :--- |
| `administrator` | Administrator | ✅ | — | Pengelola sistem. Tidak dihitung telat/lembur |
| `admin` | Admin (staf) | ❌ | 2 shift | Role kerja staf administrasi |
| `noc` | NOC | ❌ | 2 shift | |
| `teknisi` | Teknisi | ❌ | 1 shift | |
| `employee` | Karyawan | ❌ | — | Default pendaftar baru; belum ditetapkan administrator |

### Matriks Izin

| Aksi | Karyawan/Admin/NOC/Teknisi | Administrator |
| :--- | :---: | :---: |
| Absen masuk/pulang | ✅ | ✅ |
| Lihat riwayat sendiri | ✅ | ✅ |
| Lihat riwayat semua orang | ❌ | ✅ |
| Peta live & posisi karyawan | ❌ | ✅ |
| Rekap bulanan + ekspor | ❌ | ✅ |
| Kelola pengguna (tambah/edit/reset password/hapus) | ❌ | ✅ |
| Ubah geofence & jam kerja SOP | ❌ | ✅ |
| Ubah nama/foto/password sendiri | ✅ | ✅ |
| Ubah email sendiri | ❌ (via administrator) | ✅ (via halaman Pengguna) |

Proteksi anti-lockout: administrator **tidak bisa** menurunkan role atau menghapus akunnya sendiri.

## Aturan Absensi

1. **Urutan wajib**: clock-in dulu, baru clock-out. Dobel clock-in ditolak (`DUPLICATE_CHECKIN`); clock-out tanpa clock-in ditolak (`INVALID_SEQUENCE`). Setelah clock-out boleh clock-in lagi (multi-sesi dalam sehari didukung).
2. **Geofence**: jarak dihitung Haversine dari pusat geofence aktif. Sah bila `jarak ≤ radius + buffer akurasi GPS` (buffer maks 50 m). Di luar itu → ditolak server (`GEOFENCE_VIOLATION`) dan tombol kirim dinonaktifkan di client.
3. **Foto wajib**: diambil langsung dari kamera (galeri tidak bisa), JPEG kualitas 0.8, maks 5 MB, disimpan dengan nama UUID di luar folder publik.
4. **Sinyal GPS lemah** (akurasi > 50 m): tampil peringatan tapi absensi tetap boleh (accuracy tercatat di record untuk audit).
5. Waktu absen memakai **jam server**, bukan jam perangkat.

## Jam Kerja SOP & Perhitungan Telat/Lembur

Implementasi: [src/lib/shifts/calc.ts](../src/lib/shifts/calc.ts) (12 unit test).

### Default SOP (bisa diubah di Pengaturan)

| Role | Shift 1 | Shift 2 |
| :--- | :--- | :--- |
| Admin | 07:00–15:00 | 15:00–22:00 |
| NOC | 07:00–15:00 | 15:00–22:00 |
| Teknisi | 08:00–16:00 | — |

### Penentuan shift
Shift dipilih otomatis: yang **jam masuknya paling dekat** dengan waktu clock-in.
Contoh (role admin): clock-in 06:45 → Shift 1; clock-in 14:50 → Shift 2.

### Rumus harian (per user per tanggal)
- **Jam masuk** = clock-in **pertama** hari itu; **jam pulang** = clock-out **terakhir**
- Datang **lebih awal** dari jam masuk shift → selisih = **lembur**
- Datang **setelah** jam masuk shift → selisih = **telat**
- Pulang **setelah** jam pulang shift → selisih = **lembur**
- **Independen**: telat pagi TIDAK membatalkan lembur sore, dan sebaliknya

Contoh (teknisi, SOP 08:00–16:00):
| Masuk | Pulang | Telat | Lembur |
| :--- | :--- | :--- | :--- |
| 07:30 | 16:00 | - | 30m (pagi) |
| 08:20 | 16:00 | 20m | - |
| 08:30 | 17:00 | 30m | 1j (sore) |
| 07:30 | 16:45 | - | 1j 15m (30m + 45m) |

Role tanpa SOP (`administrator`, `employee`): telat/lembur tidak dihitung (tampil "-").

## Pelacakan Posisi Live

- Aktif **hanya** selama status hadir (clock-in tanpa clock-out) — server menolak kiriman di luar itu (`NOT_CLOCKED_IN`)
- Client mengirim posisi tiap **20 detik**; peta admin polling tiap **10 detik**
- Posisi dianggap **LIVE** bila update terakhir < **90 detik** (marker hijau berdenyut); lebih dari itu marker kembali biru di posisi terakhir yang diketahui
- Saat clock-out, baris posisi **dihapus** — karyawan tidak terlacak di luar jam kerja
- **Batasan web**: browser hanya mengirim GPS saat tab/app terbuka dan layar aktif. Pelacakan background penuh memerlukan aplikasi mobile native (lihat [07 — Integrasi Mobile](07-mobile-integration.md))

## Privasi & Keamanan Data

- Foto absensi/avatar hanya bisa diakses pengguna login (endpoint terautentikasi)
- Posisi live hanya bisa dilihat administrator dan terhapus setelah pulang
- Password di-hash scrypt (Better Auth); tidak pernah tercatat di log
- Karyawan hanya bisa membaca record miliknya sendiri (dipaksa server-side)
- Saran kebijakan: informasikan karyawan bahwa posisi dilacak selama jam kerja (persetujuan tertulis), dan terapkan retensi foto (mis. hapus > 90 hari) sesuai kebutuhan payroll
