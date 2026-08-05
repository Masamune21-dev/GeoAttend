# Dokumentasi GeoAttend

Dokumentasi lengkap aplikasi absensi GeoAttend (KusumaVision).

| Dokumen | Isi | Untuk Siapa |
| :--- | :--- | :--- |
| [01 — Gambaran Umum](01-overview.md) | Visi, fitur, arsitektur, tech stack, struktur proyek | Semua |
| [02 — Referensi API](02-api.md) | Seluruh endpoint, request/response, kode error | Developer (web & mobile) |
| [03 — Database](03-database.md) | Skema tabel, relasi, alur migrasi | Developer |
| [04 — Aturan Bisnis](04-business-rules.md) | Role & izin, aturan absensi, telat/lembur, live tracking | Semua |
| [05 — Deployment](05-deployment.md) | Setup dev, produksi, Proxmox VM vs LXC, HTTPS, backup | DevOps/Admin sistem |
| [06 — Panduan Pengguna](06-user-guide.md) | Cara pakai untuk karyawan & administrator | Pengguna akhir |
| [07 — Integrasi Mobile](07-mobile-integration.md) | Kontrak API & rencana awal integrasi mobile | Developer mobile |
| [08 — Aplikasi Mobile](08-mobile-app.md) | Dokumentasi teknis aplikasi mobile Android yang sudah dibangun | Developer mobile |

## Panduan siap cetak (PDF)

| Dokumen | Isi | Untuk Siapa |
| :--- | :--- | :--- |
| **[Panduan Lengkap GeoAttend v1.6](Panduan-Lengkap-GeoAttend.pdf)** ⭐ | Panduan menyeluruh: karyawan (pemasangan, absen, jadwal, piket, tim jaga malam, izin) **dan** administrator (setup, peta live, kelola jadwal, rekap, riwayat lokasi, stok, pemeliharaan) | Karyawan & Administrator |
| [Panduan Mobile](Panduan-Mobile-GeoAttend.pdf) | Panduan aplikasi mobile versi lama (v1.4) | Karyawan |
| [Panduan Update](Panduan-Update-GeoAttend.pdf) | Instruksi pembaruan aplikasi ke v1.5 | Karyawan |

Sumber HTML-nya ada di folder yang sama ([panduan-lengkap.html](panduan-lengkap.html)) dan bisa dicetak ulang ke PDF lewat browser (Ctrl+P → Simpan sebagai PDF, ukuran A4, margin default). **PDF di repo ini belum ikut diperbarui** — cetak ulang dari HTML bila perubahan terakhir perlu ikut tercetak.

### Yang belum masuk panduan cetak

Isi bab `panduan-lengkap.html` masih menjelaskan aplikasi Android **v1.6**,
sementara aplikasi sudah v1.8.x. Sudah ditambahkan sebagai catatan/bagian:
ekspor Excel, konfirmasi arah stok, dan roster per role. **Belum ada babnya:**

- **Lembur Urgent** (panggilan di luar shift + verifikasi admin di rekap) — sudah
  terdokumentasi di [06 — Panduan Pengguna](06-user-guide.md)
- **Dashboard aplikasi mobile** (ringkasan, aksi cepat, roster hari ini)
- **Pratinjau foto profil & sampul** dan dialog bertema baru di mobile — lihat
  [08 — Aplikasi Mobile §10](08-mobile-app.md)

**Mulai cepat (development):** lihat [README utama](../README.md).
