# 06 — Panduan Pengguna

## Untuk Karyawan

### Pertama kali
1. Buka alamat aplikasi di browser HP (Chrome/Safari). Login dengan akun dari administrator, **atau** daftar sendiri di halaman **Daftar** — siapkan **kode pendaftaran** dari administrator (tanpa kode, pendaftaran ditolak)
2. Saat diminta, **izinkan akses Lokasi dan Kamera** — keduanya wajib untuk absen
3. (Disarankan) Install ke home screen: menu browser → *Add to Home Screen* — app terasa seperti aplikasi native

### Absen masuk
1. Buka menu **Absen** (ikon kamera)
2. Bila role Anda punya 2 shift (Admin/NOC): pilih **Shift** yang dijalani — otomatis terpilih shift terdekat dengan jam sekarang, ubah bila perlu
3. Tunggu indikator lokasi hijau: *"Anda berada di dalam area absensi"*
   - Merah = masih di luar area (tampil jaraknya) → mendekat ke lokasi kerja
   - Kuning = sinyal GPS lemah → pindah ke area terbuka
4. Tap **Ambil Foto** (bisa ganti kamera depan/belakang), cek pratinjau, **Ambil Ulang** bila perlu
5. (Opsional) isi catatan, lalu tap **Kirim Absen Masuk**
6. Muncul centang hijau = tercatat ✓

### Absen pulang
Sama seperti absen masuk — tombol otomatis berubah menjadi **Kirim Absen Pulang**.
Pilihan shift otomatis mengikuti shift absen masuk Anda hari itu.

### Izin & Libur (kartu di halaman Absen)
- **Libur Hari Ini** — 1 klik, hari ini langsung tercatat libur (bisa dibatalkan; tidak bisa bila sudah absen)
- **Ajukan Izin** — pilih jenis (**Sakit / Izin / Cuti**), rentang tanggal, dan alasan → status **Menunggu** sampai administrator memutuskan; pantau statusnya di daftar bawah tombol (pengajuan Menunggu bisa dibatalkan)
- Jika ditolak, alasan penolakan tampil di daftar pengajuan

> **Penting untuk teknisi lapangan:** selama status hadir, posisi Anda terkirim ke
> kantor **hanya saat aplikasi terbuka di layar**. Biarkan tab GeoAttend terbuka
> saat bertugas. Pelacakan berhenti otomatis setelah absen pulang.

### Riwayat
Menu **Riwayat**: kalender bulanan (hijau = hadir dalam area, merah = ada absen di
luar area). Tap tanggal untuk memfilter, tap item untuk melihat foto & detail.

### Profil
Menu **Profil**: ganti foto profil (tap ikon kamera di pojok avatar), ubah nama,
dan ganti kata sandi (perlu kata sandi lama; sesi perangkat lain otomatis keluar).
Email login hanya bisa diubah oleh administrator.

### Masalah umum
| Gejala | Solusi |
| :--- | :--- |
| "Izin lokasi ditolak" | Pengaturan browser → Site settings → Lokasi → Izinkan, lalu muat ulang |
| "Kamera diperlukan" | Sama seperti di atas untuk Kamera |
| GPS tidak akurat | Aktifkan GPS presisi tinggi, keluar ruangan, tunggu 10–30 detik |
| "Anda sudah absen masuk hari ini" | Anda belum absen pulang dari sesi sebelumnya |
| "Kode pendaftaran salah" saat daftar | Minta kode terbaru ke administrator (kode bisa diganti sewaktu-waktu) |
| "Pendaftaran ditutup" | Administrator belum membuat kode — hubungi administrator |
| Sesi berakhir | Login ulang (sesi berlaku 7 hari) |

## Untuk Administrator

### Setup awal (sekali)
1. Login akun administrator → **Pengaturan**
2. **Area Absensi**: seret pin ke lokasi kantor (atau klik peta), atur radius (disarankan 100–200 m), **Simpan**
3. **Jam Kerja SOP**: sesuaikan jam masuk/pulang tiap role bila berbeda dari default, **Simpan**
4. **General → Kode Pendaftaran**: klik **Generate** → **Simpan Kode** → **Salin** dan bagikan ke karyawan baru agar bisa daftar sendiri. Kosongkan + simpan untuk menutup pendaftaran
5. Alternatif tanpa kode: **Pengguna** → **Tambah Pengguna** — buat akun karyawan langsung (nama, email, kata sandi awal, role). Sampaikan kredensial ke karyawan dan minta mereka mengganti kata sandi di menu Profil

### Harian
- **Overview**: ringkasan hadir hari ini + absensi terbaru
- **Peta Live**: pantau posisi karyawan — hijau berdenyut = posisi terkini (live), biru = posisi saat absen (app karyawan tertutup), merah = absen di luar area. Klik marker untuk foto & jam. Data diperbarui otomatis (10–30 detik)
- **Persetujuan Izin**: cek tab **Menunggu** — **Setujui** atau **Tolak** (bisa beri catatan alasan) pengajuan sakit/izin/cuti. Penanda libur karyawan tercatat otomatis tanpa persetujuan

### Bulanan (payroll)
1. **Rekap Bulanan** → pilih bulan (dan karyawan tertentu bila perlu)
2. Periksa tabel ringkasan (hari hadir, sakit/izin/cuti/libur, total telat, total lembur, total pulang cepat) dan detail harian — satu baris per shift; kolom **Keterangan** membedakan Hadir/Sakit/Izin/Cuti/Libur
3. **PDF** untuk arsip/tanda tangan, **CSV** untuk olah di Excel

> **Catatan pulang cepat:** lembur karena datang lebih awal TIDAK menutupi
> kekurangan jam karena pulang lebih cepat — keduanya tampil terpisah agar
> kebijakan kompensasi bisa diputuskan sesuai aturan perusahaan.

### Kelola pengguna
- **Ubah role**: dropdown di daftar pengguna (menentukan SOP shift & akses)
- **Edit** (ikon pensil): ubah nama, email login, atau **reset kata sandi** (isi kata sandi baru; kosongkan bila tidak diubah)
- **Hapus** (ikon tempat sampah): menghapus user beserta seluruh riwayat absensinya — tidak bisa dibatalkan

### Kasus khusus
| Situasi | Penanganan |
| :--- | :--- |
| Karyawan lupa kata sandi | Pengguna → Edit → isi kata sandi baru |
| Karyawan lupa absen pulang | Status "hadir" menggantung; rekap menampilkan jam pulang "-" dan lembur sore 0. Ingatkan karyawan absen pulang keesokan kali |
| Karyawan salah pilih shift | Shift tercatat di record; saat ini koreksi hanya via database — ingatkan karyawan memilih shift dengan benar |
| Karyawan sakit mendadak | Minta karyawan ajukan **Sakit** dari aplikasi (pengajuan mundur/backdate tidak didukung — ajukan di hari yang sama), lalu setujui di **Persetujuan Izin** |
| Kode pendaftaran tersebar | Pengaturan → General → Generate kode baru → Simpan (kode lama langsung tidak berlaku) |
| Pindah lokasi kantor | Pengaturan → geser pin geofence → Simpan (berlaku seketika) |
| Absen tercatat "luar area" | Cek akurasi GPS di detail record; pertimbangkan menambah radius |
