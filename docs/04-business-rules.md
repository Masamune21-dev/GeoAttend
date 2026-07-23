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
| Ajukan izin (sakit/izin/cuti) & tandai libur | ✅ | ✅ |
| Setujui/tolak pengajuan izin | ❌ | ✅ |
| Lihat riwayat sendiri | ✅ | ✅ |
| Lihat riwayat semua orang | ❌ | ✅ |
| Peta live & posisi karyawan | ❌ | ✅ |
| Rekap bulanan + ekspor | ❌ | ✅ |
| Kelola pengguna (tambah/edit/reset password/hapus) | ❌ | ✅ |
| Ubah geofence, jam kerja SOP & kode pendaftaran | ❌ | ✅ |
| Ubah nama/foto/password sendiri | ✅ | ✅ |
| Ubah email sendiri | ❌ (via administrator) | ✅ (via halaman Pengguna) |

Proteksi anti-lockout: administrator **tidak bisa** menurunkan role atau menghapus akunnya sendiri.

## Pendaftaran Akun

- Pendaftaran mandiri **wajib memakai kode pendaftaran** yang dibuat administrator
  (Pengaturan → General → Kode Pendaftaran). Validasi dilakukan **server-side**
  (hook Better Auth) sehingga tidak bisa di-bypass lewat API langsung.
- Kode kosong / belum dibuat = pendaftaran **ditutup**.
- Alternatif: administrator membuat akun langsung dari halaman Pengguna (tanpa kode).
- Pendaftar baru mendapat role `employee` — administrator menetapkan role kerja setelahnya.

## Aturan Absensi

1. **Urutan wajib**: clock-in dulu, baru clock-out. Dobel clock-in ditolak (`DUPLICATE_CHECKIN`); clock-out tanpa clock-in ditolak (`INVALID_SEQUENCE`). Setelah clock-out boleh clock-in lagi (multi-sesi dalam sehari didukung).
2. **Geofence**: jarak dihitung Haversine dari pusat geofence aktif. Sah bila `jarak ≤ radius + buffer akurasi GPS` (buffer maks 50 m). Di luar itu → ditolak server (`GEOFENCE_VIOLATION`) dan tombol kirim dinonaktifkan di client.
3. **Foto wajib**: diambil langsung dari kamera (galeri tidak bisa), JPEG kualitas 0.8, maks 5 MB, disimpan dengan nama UUID di luar folder publik.
4. **Sinyal GPS lemah** (akurasi > 50 m): tampil peringatan tapi absensi tetap boleh (accuracy tercatat di record untuk audit).
5. Waktu absen memakai **jam server**, bukan jam perangkat.
6. **Pilihan shift**: role dengan >1 shift memilih shift saat absen (tersimpan di record). `shiftNumber` divalidasi terhadap SOP role; absen pulang tanpa pilihan mewarisi shift absen masuk hari itu.

## Jam Kerja SOP & Perhitungan Telat/Lembur/Pulang Cepat

Implementasi: [src/lib/shifts/calc.ts](../src/lib/shifts/calc.ts) (18 unit test).

### Default SOP (bisa diubah di Pengaturan)

| Role | Shift 1 | Shift 2 |
| :--- | :--- | :--- |
| Admin | 07:00–15:00 | 15:00–22:00 |
| NOC | 07:00–15:00 | 15:00–22:00 |
| Teknisi | 08:00–16:00 | — |

### Penentuan shift
Rekap memakai **shift yang tercatat di record** (dipilih karyawan saat absen).
Untuk data lama tanpa shift tercatat, fallback: shift yang **jam masuknya paling
dekat** dengan waktu clock-in (mis. role admin: clock-in 06:45 → Shift 1;
clock-in 14:50 → Shift 2).

### Rumus harian (per user per tanggal **per shift**)
- Record dikelompokkan per shift tercatat — karyawan yang kerja 2 shift dalam
  sehari muncul sebagai **2 baris rekap** terpisah
- **Jam masuk** = clock-in **pertama** grup itu; **jam pulang** = clock-out **terakhir**
- Datang **lebih awal** dari jam masuk shift → selisih = **lembur**
- Datang **setelah** jam masuk shift → selisih = **telat**
- Pulang **setelah** jam pulang shift → selisih = **lembur**
- Pulang **sebelum** jam pulang shift → selisih = **pulang cepat** (kekurangan jam)
- **Independen**: semua komponen dihitung terpisah — lembur datang awal TIDAK
  menutupi pulang cepat, telat pagi TIDAK membatalkan lembur sore
- **Hari Hadir** di ringkasan = jumlah **tanggal unik** (2 shift sehari tetap 1 hari)

Contoh (teknisi, SOP 08:00–16:00):
| Masuk | Pulang | Telat | Lembur | Pulang Cepat |
| :--- | :--- | :--- | :--- | :--- |
| 07:30 | 16:00 | - | 30m (pagi) | - |
| 08:20 | 16:00 | 20m | - | - |
| 08:30 | 17:00 | 30m | 1j (sore) | - |
| 07:30 | 16:45 | - | 1j 15m (30m + 45m) | - |
| 07:00 | 15:00 | - | 1j (pagi) | 1j |
| 08:30 | 15:30 | 30m | - | 30m |

Baris ke-5: datang 1 jam lebih awal (lembur 1j) **dan** pulang 1 jam lebih cepat
(pulang cepat 1j) — keduanya tampil; kebijakan kompensasinya diputuskan admin.

Role tanpa SOP (`administrator`, `employee`): telat/lembur/pulang cepat tidak dihitung (tampil "-").

## Izin & Libur

Jenis: **Sakit**, **Izin**, **Cuti** (perlu persetujuan), dan **Libur** (self-service).

| Aturan | Sakit / Izin / Cuti | Libur |
| :--- | :--- | :--- |
| Siapa yang mencatat | Karyawan mengajukan (rentang tanggal + alasan) | Karyawan menandai sendiri (1 klik) |
| Persetujuan | Administrator (setujui/tolak + catatan) | Tidak perlu — langsung tercatat |
| Tanggal | Mulai hari ini atau ke depan, boleh rentang | **Hanya hari ini** |
| Batal | Oleh pengaju selama masih `pending`; administrator kapan saja | Oleh pemilik (hari berjalan) atau administrator |

- Rentang yang **tumpang-tindih** dengan pengajuan aktif (pending/approved) milik user yang sama ditolak
- Hanya pengajuan **approved** yang masuk rekap bulanan (kolom Keterangan + hitungan hari Sakit/Izin/Cuti/Libur per karyawan)
- Bila karyawan **tetap absen** di tanggal izin/libur → baris kehadiran yang dipakai di rekap (izin/libur hari itu diabaikan)
- Karyawan tidak bisa menandai libur bila sudah absen hari itu

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
