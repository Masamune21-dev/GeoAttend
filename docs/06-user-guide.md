# 06 — Panduan Pengguna

## Untuk Karyawan

### Pertama kali
1. Buka alamat aplikasi di browser HP (Chrome/Safari), login dengan email & kata sandi dari administrator
2. Saat diminta, **izinkan akses Lokasi dan Kamera** — keduanya wajib untuk absen
3. (Disarankan) Install ke home screen: menu browser → *Add to Home Screen* — app terasa seperti aplikasi native

### Absen masuk
1. Buka menu **Absen** (ikon kamera)
2. Tunggu indikator lokasi hijau: *"Anda berada di dalam area absensi"*
   - Merah = masih di luar area (tampil jaraknya) → mendekat ke lokasi kerja
   - Kuning = sinyal GPS lemah → pindah ke area terbuka
3. Tap **Ambil Foto** (bisa ganti kamera depan/belakang), cek pratinjau, **Ambil Ulang** bila perlu
4. (Opsional) isi catatan, lalu tap **Kirim Absen Masuk**
5. Muncul centang hijau = tercatat ✓

### Absen pulang
Sama seperti absen masuk — tombol otomatis berubah menjadi **Kirim Absen Pulang**.

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
| Sesi berakhir | Login ulang (sesi berlaku 7 hari) |

## Untuk Administrator

### Setup awal (sekali)
1. Login akun administrator → **Pengaturan**
2. **Area Absensi**: seret pin ke lokasi kantor (atau klik peta), atur radius (disarankan 100–200 m), **Simpan**
3. **Jam Kerja SOP**: sesuaikan jam masuk/pulang tiap role bila berbeda dari default, **Simpan**
4. **Pengguna** → **Tambah Pengguna**: buat akun karyawan (nama, email, kata sandi awal, role). Sampaikan kredensial ke karyawan dan minta mereka mengganti kata sandi di menu Profil

### Harian
- **Overview**: ringkasan hadir hari ini + absensi terbaru
- **Peta Live**: pantau posisi karyawan — hijau berdenyut = posisi terkini (live), biru = posisi saat absen (app karyawan tertutup), merah = absen di luar area. Klik marker untuk foto & jam. Data diperbarui otomatis (10–30 detik)

### Bulanan (payroll)
1. **Rekap Bulanan** → pilih bulan (dan karyawan tertentu bila perlu)
2. Periksa tabel ringkasan (hari hadir, total telat, total lembur) dan detail harian
3. **PDF** untuk arsip/tanda tangan, **CSV** untuk olah di Excel

### Kelola pengguna
- **Ubah role**: dropdown di daftar pengguna (menentukan SOP shift & akses)
- **Edit** (ikon pensil): ubah nama, email login, atau **reset kata sandi** (isi kata sandi baru; kosongkan bila tidak diubah)
- **Hapus** (ikon tempat sampah): menghapus user beserta seluruh riwayat absensinya — tidak bisa dibatalkan

### Kasus khusus
| Situasi | Penanganan |
| :--- | :--- |
| Karyawan lupa kata sandi | Pengguna → Edit → isi kata sandi baru |
| Karyawan lupa absen pulang | Status "hadir" menggantung; rekap menampilkan jam pulang "-" dan lembur sore 0. Ingatkan karyawan absen pulang keesokan kali |
| Pindah lokasi kantor | Pengaturan → geser pin geofence → Simpan (berlaku seketika) |
| Absen tercatat "luar area" | Cek akurasi GPS di detail record; pertimbangkan menambah radius |
