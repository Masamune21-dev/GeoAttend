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
2. **Geofence**: jarak dihitung Haversine dari pusat geofence aktif. Sah bila `jarak ≤ radius + buffer akurasi GPS` (buffer maks 50 m). Aturan **hanya berlaku untuk absen MASUK** — di luar area, clock-in ditolak server (`GEOFENCE_VIOLATION`) dan tombol kirim dinonaktifkan di client. **Absen PULANG boleh di luar area** (mis. selesai kerja lapangan / langsung pulang); lokasi tetap dicatat (`isWithinGeofence` + jarak) untuk pelaporan.
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

Jenis: **Sakit**, **Izin**, **Cuti** (perlu persetujuan), dan **Libur** — libur datang dari
**jadwal shift** (otomatis) atau ditandai sendiri (self-service, untuk libur di luar jadwal).

| Aturan | Sakit / Izin / Cuti | Libur (jadwal) | Libur (penanda manual) |
| :--- | :--- | :--- | :--- |
| Siapa yang mencatat | Karyawan mengajukan (rentang tanggal + alasan) | Administrator, lewat grid jadwal shift | Karyawan menandai sendiri (1 klik) |
| Persetujuan | Administrator (setujui/tolak + catatan) | Tidak perlu — ikut jadwal | Tidak perlu — langsung tercatat |
| Tanggal | Mulai hari ini atau ke depan, boleh rentang | Semua sel bershift `libur` di jadwal | **Hanya hari ini** |
| Batal | Oleh pengaju selama masih `pending`; administrator kapan saja | Ubah jadwalnya | Oleh pemilik (hari berjalan) atau administrator |

- Rentang yang **tumpang-tindih** dengan pengajuan aktif (pending/approved) milik user yang sama ditolak
- Hanya pengajuan **approved** yang masuk rekap bulanan (kolom Keterangan + hitungan hari Sakit/Izin/Cuti/Libur per karyawan)
- Bila karyawan **tetap absen** di tanggal izin/libur → baris kehadiran yang dipakai di rekap (izin/libur hari itu diabaikan)
- Karyawan tidak bisa menandai libur bila sudah absen hari itu

### Libur otomatis dari jadwal

Hari yang dijadwalkan `libur` **langsung terhitung Libur di rekap** — karyawan tidak
perlu menekan "Libur Hari Ini". Turunannya dihitung saat rekap dirender
([src\lib\schedule\libur.ts](..\src\lib\schedule\libur.ts)), bukan disimpan sebagai
`leave_requests`, sehingga selalu ikut jadwal terbaru bila admin mengubahnya.

Baris Libur otomatis **dilewati** bila:

| Kondisi | Alasan |
| :--- | :--- |
| Tanggalnya belum tiba (setelah hari ini) | Libur yang belum terjadi tidak dihitung |
| Karyawan tetap absen di tanggal itu | Baris kehadiran yang menang (mis. dipanggil masuk) |
| Sudah ada izin/libur tercatat di tanggal itu | Supaya tidak terhitung dua kali |

Tombol **"Libur Hari Ini"** tetap ada untuk libur dadakan yang **tidak** ada di
jadwal; tombol itu disembunyikan ketika jadwal hari itu sudah `libur`.

## Lembur Urgent

Panggilan mendadak di **luar jam shift** (mis. teknisi dipanggil gangguan malam)
dicatat sebagai **sesi lembur** — jenis sesi kedua di samping sesi shift, dibedakan
oleh kolom `attendance_records.kind` (`'shift'` \| `'lembur'`).

Kenapa harus terpisah: sesi lembur diukur terhadap durasinya sendiri, bukan
terhadap shift. Bila dipaksa lewat absen biasa, teknisi yang dipanggil 23:00 dan
selesai 01:30 (nyata 2j 30m) tercatat **telat 15 jam & lembur 9j 30m** karena
diukur ke jam masuk shiftnya (08:00–16:00).

| Aturan | Sesi Shift | Sesi Lembur |
| :--- | :--- | :--- |
| Nomor shift | Wajib/otomatis | **Selalu `null`** — di luar jadwal |
| Telat & pulang cepat | Dihitung | **Selalu 0** |
| Lembur | Datang awal / pulang telat | **100% durasi masuk→pulang** |
| Alasan (`notes`) | Wajib hanya bila masuk di luar area | **Selalu wajib** saat membuka sesi |
| Di luar geofence | Perlu alasan | Wajar — tidak diperlakukan sebagai pelanggaran |
| Foto | Selfie masuk & pulang | Sama; foto penutup = **bukti hasil perbaikan** |
| Masuk rekap | Langsung | Setelah **diverifikasi administrator** |

**Aturan penting:**

- Sesi lembur & sesi shift **tidak pernah terbuka bersamaan** — tombol lembur hanya
  muncul saat tidak ada sesi berjalan. Lembur saat masih di dalam shift sudah
  otomatis terhitung sebagai pulang telat, jadi tidak perlu sesi terpisah.
- Jenis sesi saat menutup ditentukan **server**, mewarisi sesi yang terbuka. Klien
  (mis. versi app lama) tidak bisa membuka lembur lalu menutupnya sebagai shift.
- Dipanggil lembur di hari libur **tidak menghapus hari liburnya** — hanya sesi
  `kind='shift'` yang dianggap "masuk kerja". Rekap menampilkan dua baris:
  **Libur** dan **Lembur**.

### Verifikasi (post-approval)

Lembur urgent tidak bisa menunggu persetujuan — gangguan jam 2 pagi tidak boleh
tertahan. Karyawan mulai sendiri, administrator memverifikasi belakangan di rekap.

Status disimpan di record **PEMBUKA** sesi (`overtime_status`), mewakili satu sesi utuh:

| Status | Arti | Masuk total jam? |
| :--- | :--- | :---: |
| `pending` | Baru dibuat, menunggu administrator | ❌ (dihitung sebagai "belum diverifikasi") |
| `approved` | Disetujui administrator | ✅ |
| `rejected` | Ditolak | ❌ |

Di ringkasan rekap, **Lembur Urgent** adalah kolom terpisah dari **Total Lembur**
(datang awal / pulang telat) karena basis pembayarannya berbeda; kolomnya juga
menampilkan berapa kali dipanggil.

## Jadwal Shift

- **Peserta jadwal** ditentukan administrator lewat tombol **Kelola Peserta** (tersimpan permanen di `schedule_participants`). Hanya peserta yang muncul di grid dan menjadi kandidat piket.
  - Bila daftar peserta belum pernah diatur, sistem memakai perilaku lama: semua karyawan ber-role `admin`, `noc`, dan `teknisi`.
  - Mengeluarkan karyawan hanya menghilangkannya dari grid — entri jadwal yang sudah tersimpan **tidak dihapus**, sehingga riwayat di halaman Jadwal Saya tetap utuh.
  - Simpan jadwal (replace-bulan) hanya berlaku untuk peserta saat itu.
- **Opsi shift mengikuti role** ([src/lib/schedule/roles.ts](../src/lib/schedule/roles.ts)) — satu sumber kebenaran yang dipakai UI maupun validasi server:

  | Role | Pilihan sel grid |
  | :--- | :--- |
  | `admin`, `noc` | Shift 1 · Shift 2 · Libur |
  | `teknisi` | **Shift 1 · Libur saja** — teknisi selalu masuk pagi, jadwalnya hanya menentukan hari libur |

  Entri yang melanggar (mis. Shift 2 untuk teknisi) **diabaikan diam-diam** oleh `PUT /api/schedules`, bukan menggagalkan seluruh penyimpanan.
- **Generate Rotasi**: admin/NOC beroper shift tiap pekan; teknisi hanya diisi hari liburnya (`generateOffDaysOnly`).

## Piket Kebersihan

- Satu petugas per hari, bergiliran (round-robin), ditandai selesai oleh petugas sendiri.
- **Setiap Sabtu adalah hari ngepel**: sel Sabtu ditandai **hijau** dengan keterangan **"Harus ngepel"** di grid admin maupun halaman Jadwal Saya. Petugasnya tetap petugas piket hari itu — tidak ada petugas tambahan.

## Tim Jaga Malam Teknisi

- Teknisi dibagi menjadi **Tim Ganjil** dan **Tim Genap** (`users.technician_team`), ditetapkan administrator dari halaman Jadwal.
- Tim yang siaga lembur saat ada gangguan malam ditentukan **paritas tanggal**: Tim Ganjil pada tanggal 1, 3, 5, … dan Tim Genap pada tanggal 2, 4, 6, …
- Teknisi melihat statusnya di halaman Jadwal Saya ("Kamu siaga lembur malam ini" / giliran tim lain).
- Mengubah role karyawan ke selain `teknisi` otomatis mengosongkan timnya.

## Pelacakan Posisi Live

- Aktif **hanya** selama status hadir (clock-in tanpa clock-out) — server menolak kiriman di luar itu (`NOT_CLOCKED_IN`). Pengecekannya memakai jendela bergulir **18 jam**, bukan "sejak tengah malam", sehingga shift lintas tengah malam tetap terlacak setelah pukul 00:00
- Web mengirim posisi tiap **20 detik**; app mobile mengirim per batch ~**5 menit** (termasuk saat karyawan diam — heartbeat); peta admin polling tiap **10 detik**
- Posisi dianggap **LIVE** bila update terakhir < **6 menit** (marker hijau berdenyut)
- Bila kedaluwarsa, marker **tetap di posisi terakhir yang diketahui** (abu-abu, "terakhir terlihat HH:mm") — **tidak** kembali ke titik absen. Titik absen hanya dipakai bila karyawan belum pernah mengirim posisi sama sekali (app belum terpasang / izin ditolak)
- Status "dalam/luar area" dihitung dari posisi yang sedang ditampilkan, bukan dari titik absen — karyawan yang absen di kantor lalu pergi ke lapangan terhitung "luar area"
- Saat clock-out, baris posisi live **dihapus** — karyawan tidak terlacak di luar jam kerja
- **Batasan web**: browser hanya mengirim GPS saat tab/app terbuka dan layar aktif. Pelacakan background penuh memerlukan aplikasi mobile native (lihat [07 — Integrasi Mobile](07-mobile-integration.md))

## Riwayat Lokasi (Jejak Perjalanan)

- Setiap titik yang dikirim selama sesi kerja disimpan sebagai **jejak** (`location_trails`), berbeda dari posisi live yang hanya menyimpan satu titik terakhir
- Titik disimpan bila bergerak ≥ **25 m** (atau ≥ setengah radius akurasi GPS) **atau** sudah ≥ **60 detik** sejak titik sebelumnya; fix dengan akurasi > 150 m dibuang
- Dilihat administrator dari **Rekap Bulanan → Detail Harian → tombol Riwayat**: rute perjalanan, titik berhenti, jarak tempuh, serta foto absen masuk & pulang dalam satu dialog
- Rentang jejak mengikuti **sesi kerja** (clock-in → clock-out), sehingga shift lintas tengah malam tampil utuh sebagai satu perjalanan
- **Titik berhenti** dideteksi otomatis: rentetan titik dalam radius **100 m** yang berlangsung ≥ **10 menit**
- Titik yang ditandai `is_mocked` (aplikasi fake GPS terdeteksi di Android) diberi peringatan di dialog
- **Retensi 90 hari**, lalu dihapus otomatis. Jejak tidak ikut backup dan tidak pernah muncul di ekspor CSV/PDF rekap

## Notifikasi Push

- Ditujukan ke **administrator** (pengelola sistem), untuk hal yang menunggu keputusannya. Bukan ke role kerja `admin`
- Dua pemicu saat ini:
  - **Pengajuan izin/cuti baru** — kecuali penanda `libur` yang langsung `approved` (self-service), karena tidak ada yang perlu diputuskan
  - **Tukar shift/libur yang naik ke `pending_admin`** — yaitu setelah rekan tujuan menyetujui, **bukan** saat pengajuan dibuat. Selama masih `pending_peer`, rekan bisa menolak duluan dan pengajuan itu tidak pernah sampai ke meja administrator
- Administrator yang mengajukan sesuatu untuk dirinya sendiri tidak menerima notifikasi atas aksinya sendiri
- Notifikasi bersifat **pelengkap, bukan bagian dari transaksi**: kegagalan pengiriman dicatat di log dan diabaikan, pengajuannya tetap tersimpan
- Isi kalimat dirakit di **server** ([`src/lib/push/events.ts`](../src/lib/push/events.ts)), bukan di aplikasi — app mobile tidak punya OTA, jadi teks yang ditentukan di sisi klien baru berubah setelah karyawan memasang APK baru
- Notifikasi yang disentuh membuka layar **Persetujuan** di aplikasi, langsung pada tab yang sesuai (`data.kind`)

## Privasi & Keamanan Data

- Foto absensi/avatar hanya bisa diakses pengguna login (endpoint terautentikasi)
- Posisi live hanya bisa dilihat administrator dan terhapus setelah pulang
- Riwayat jejak lokasi juga **administrator saja** (endpoint menolak karyawan dengan 403), terhapus otomatis setelah 90 hari, dan tidak ikut file backup
- Password di-hash scrypt (Better Auth); tidak pernah tercatat di log
- Karyawan hanya bisa membaca record miliknya sendiri (dipaksa server-side)
- Saran kebijakan: informasikan karyawan bahwa posisi dilacak selama jam kerja (persetujuan tertulis), dan terapkan retensi foto (mis. hapus > 90 hari) sesuai kebutuhan payroll
