# GeoAttend — Design System (Web & Mobile)

**Versi:** 1.0 · Berlaku untuk aplikasi web (Next.js) dan aplikasi mobile mendatang (React Native/Expo).
Tujuan: satu bahasa visual yang **tenang, tepercaya, dan cepat dipindai** — aplikasi absensi dipakai orang yang sedang buru-buru.

---

## 1. Prinsip Desain

1. **Satu aksi utama per layar.** Halaman check-in punya satu tombol besar; jangan bersaing dengan elemen lain.
2. **Status selalu terlihat.** Warna semantik (hijau/merah/amber) mengomunikasikan keadaan lebih cepat daripada teks.
3. **Tenang, bukan ramai.** Permukaan putih, aksen biru secukupnya, warna semantik hanya untuk makna — bukan hiasan.
4. **Konsisten lintas platform.** Token warna/radius/spacing yang sama di web & mobile; yang berbeda hanya pola navigasi (mengikuti platform).
5. **Jempol dulu.** Target sentuh ≥ 44px, aksi utama di jangkauan jempol (bawah layar di mobile).

---

## 2. Design Tokens

### 2.1 Warna

| Token | Nilai | Pemakaian |
| :--- | :--- | :--- |
| `primary` | `#2563EB` | Aksi utama, link, item nav aktif, marker peta |
| `primary-hover` | `#1D4ED8` | Hover/pressed aksi utama |
| `primary-subtle` | `#EFF6FF` | Latar tint: item nav aktif, ikon tile, badge biru |
| `accent` | `#0EA5E9` | Highlight sekunder, statistik |
| `success` | `#16A34A` | Dalam area, lembur, status live, konfirmasi |
| `success-subtle` | `#ECFDF5` | Latar tint sukses |
| `warning` | `#F59E0B` | GPS lemah, pending, clock-out |
| `warning-subtle` | `#FFFBEB` | Latar tint warning |
| `destructive` | `#EF4444` | Error, luar area, telat, hapus |
| `destructive-subtle` | `#FEF2F2` | Latar tint error |
| `background` | `#F6F8FB` | Latar halaman (bukan putih polos — kartu jadi "mengangkat") |
| `surface` | `#FFFFFF` | Kartu, panel, nav |
| `border` | `#E2E8F0` | Garis pemisah, outline input |
| `text-primary` | `#0F172A` | Judul, isi utama |
| `text-secondary` | `#64748B` | Caption, label, placeholder |

**Aturan:** teks berwarna semantik selalu di atas latar *subtle*-nya (mis. `success` di atas `success-subtle`) — kontras ≥ 4.5:1. Jangan pakai warna semantik untuk dekorasi.

### 2.2 Tipografi

- **Font:** Inter (web: `next/font`; mobile: `@expo-google-fonts/inter`). Fallback system-ui.
- **Skala:** 12 / 14 / 16 / 18 / 20 / 24 / 30. Body = 14–16.
- **Bobot:** 400 body · 500 label/tombol · 600 judul kartu & nilai penting · 700 angka statistik.
- Judul memakai `tracking-tight`. Angka besar (statistik, jam) memakai `tabular-nums`.

### 2.3 Radius (berbagi skala web–mobile)

| Token | px | Pemakaian |
| :--- | :--- | :--- |
| `sm` | 8 | Input kecil, select, chip |
| `md` | 12 | Tombol, input |
| `lg` | 16 | Kartu list, foto |
| `xl` | 20 | Kartu utama, dialog |
| `full` | 9999 | Avatar, badge, marker |

### 2.4 Elevasi

| Token | Pemakaian | Web (box-shadow) |
| :--- | :--- | :--- |
| `card` | Kartu di atas background | `0 1px 2px rgb(15 23 42/.04), 0 1px 3px rgb(15 23 42/.06)` |
| `elevated` | Hover kartu, dropdown | `0 4px 16px -4px rgb(15 23 42/.10)` |
| `floating` | Dialog, bottom sheet, FAB | `0 16px 40px -12px rgb(15 23 42/.22)` |

Mobile: elevation 1 / 4 / 12 (Android), shadowOpacity 0.06/0.10/0.22 (iOS).

### 2.5 Spacing & Grid

Skala 4px (4, 8, 12, 16, 20, 24, 32…). Padding kartu 16 (mobile) / 24 (desktop).
Jarak antar kartu 16. Konten maksimal: form 512px, dashboard 1152px.

### 2.6 Motion

| Durasi | Pemakaian | Easing |
| :--- | :--- | :--- |
| 150ms | Hover, press (scale 0.98) | ease-out |
| 300ms | Muncul kartu/dialog (fade + slide-up 12px) | ease-out |
| 2s loop | Denyut marker live | ease-out |

Hormati `prefers-reduced-motion`: matikan semua kecuali umpan balik esensial.

---

## 3. Komponen (paritas Web ⇄ Mobile)

| Komponen | Spesifikasi singkat |
| :--- | :--- |
| **Button** | Tinggi 40 (lg 48), radius `md`, font 500. Varian: primary (biru, shadow tipis), outline (border + putih), ghost, destructive, success. Loading = spinner menggantikan ikon. Press = scale 0.98 |
| **Card** | Surface putih, radius `xl`, shadow `card`, padding 16/24. Header: judul 600 + deskripsi secondary |
| **Input** | Tinggi 40, radius `md`, border `border`; fokus: border primary + ring primary 30%. Label 14/500 di atas. Error: border destructive + teks 12 merah |
| **Select** | Sama persis dengan Input (tinggi/radius/ring). Panah bawaan browser diganti chevron agar seragam lintas platform |
| **Textarea** | Chrome sama dengan Input, `resize-y`, default 3 baris |
| **Alert** | Kotak pesan inline: ikon + teks, radius `md`, tint subtle + teks semantik. Varian: info/success/warning/destructive. Ikon wajib — makna tak boleh lewat warna saja |
| **Badge** | Radius full, 12/500, tint subtle + teks semantik. Varian: default(biru)/success/destructive/warning/secondary |
| **Dialog / Bottom sheet** | Mobile: sheet dari bawah, radius atas `xl`, handle bar; Desktop: tengah, radius `xl`, shadow floating. Overlay slate-900/60 + blur |
| **Avatar** | Foto bulat penuh; fallback inisial di atas primary. Ukuran 36 (nav) / 40 (list) / 96 (profil) |
| **Toast** | Atas-tengah, radius `lg`, ikon semantik, 4 detik (error: sampai ditutup) |
| **Empty state** | Ikon 40px dalam lingkaran `primary-subtle`, judul 1 baris, sub 1 baris, aksi opsional |
| **Stat tile** | Ikon dalam tile 40px tint semantik + angka 24/700 `tabular-nums` + label 12 secondary |
| **Marker peta** | Lingkaran 36px inisial putih; biru = posisi absen, hijau berdenyut = live, merah = luar area |

---

## 4. Pola Layout

### 4.1 Web

- **Mobile (<768px):** bottom nav 4 item (Absen · Riwayat · Admin* · Profil), header sticky blur. Konten 1 kolom.
- **Desktop (≥768px):** sidebar 256px (logo, nav utama, seksi ADMIN, versi di footer) + header + konten.
- Header: tinggi 64, putih 80% + backdrop-blur, judul halaman kiri, identitas + logout kanan.
- Item nav aktif: teks primary + latar `primary-subtle` (pill radius `md`); ikon Lucide 20px stroke 2.

### 4.2 Mobile App (React Native)

- **Layar Auth** (sebelum login): satu layar dengan segmented control **Masuk / Daftar** di atas kartu — register memakai kode pendaftaran yang sama dengan web. Alamat server diatur lewat modal di bawah kartu.
- **Tab bar bawah** (native): Absen · Riwayat · Profil (+ tab Admin bila role administrator). Ikon Lucide RN.
- Stack per tab; header native kecil (large title di iOS untuk Riwayat).
- **Layar Absen** = layar utama app (tab pertama, terbuka default): kartu status lokasi → viewfinder kamera → tombol besar penuh di bawah (safe-area).
- Bottom sheet untuk detail riwayat (foto + meta), bukan halaman penuh.
- Pull-to-refresh di Riwayat & daftar admin; skeleton saat load pertama.
- Haptic ringan saat absen sukses; layar sukses hijau penuh 1.5 detik.
- Izin: minta lokasi *saat pertama buka layar Absen* (bukan saat install); background location diminta terpisah dengan layar penjelasan (untuk tracking lapangan).

---

## 5. Panduan per Layar

| Layar | Aturan utama |
| :--- | :--- |
| **Login/Register** | Desktop (≥1024px): dua panel — kiri panel brand gradasi (logo, headline, 3 keunggulan), kanan kartu form di atas `background`. Mobile/tablet: latar gradasi brand penuh, logo di atas kartu putih. Satu kolom, tanpa distraksi |
| **Check-in** | Status lokasi selalu di atas (hijau/merah/amber). Kamera rasio 3:4 (mobile). Tombol kirim disabled sampai foto + lokasi valid, dengan teks alasan di bawahnya. Sukses = kartu hijau + jam |
| **Riwayat** | Kalender kiri/atas (hijau/merah per hari), list kanan/bawah. Detail via dialog/sheet dengan foto besar |
| **Peta Live** | Peta memenuhi layar, badge status di atas, legend warna di bawah. Popup: foto, nama, jam, status live |
| **Rekap** | Toolbar: bulan + filter user + ekspor (CSV/PDF). Ringkasan dulu, detail kemudian. Telat merah, lembur hijau, kosong "-" |
| **Pengguna** | List kartu per user: avatar, nama+email, select role, aksi edit/hapus. Administrator selalu teratas |
| **Pengaturan** | Tab General: kartu 2 kolom (≥1280px) — Identitas Aplikasi & Kode Pendaftaran berdampingan (tombol simpan rata bawah), Informasi Sistem selebar penuh. Tab Area: peta editor + form berdampingan (desktop) / bertumpuk (mobile); slider radius langsung terlihat di peta |
| **Profil** | Kartu identitas (avatar besar + role badge) → kartu nama → kartu ganti sandi |

---

## 6. Aksesibilitas

- Kontras teks ≥ 4.5:1; komponen UI ≥ 3:1.
- Semua interaktif bisa keyboard (web) / screen reader (`aria-label` / `accessibilityLabel`).
- Fokus terlihat: ring 2px primary offset 2.
- Status dinamis diumumkan via `aria-live="polite"`.
- Jangan komunikasikan makna dengan warna saja — selalu sertai ikon/teks (mis. badge "Luar area").

## 7. Aset

- **Ikon:** Lucide (web: `lucide-react`; mobile: `lucide-react-native`), 20px nav / 16px inline, stroke 2.
- **Logo:** pin lokasi putih di tile biru radius `md` + wordmark Inter 700.
- **Foto:** absensi 3:4 atau 16:9 radius `lg`; avatar bulat.
- **Ilustrasi empty state:** cukup ikon Lucide dalam lingkaran tint — tanpa ilustrasi pihak ketiga.

## 8. Dark Mode (rencana)

Belum diimplementasikan. Saat dikerjakan: token dibalik (background `#0B1220`, surface `#111A2C`, border `#1E293B`, teks dibalik), warna semantik dinaikkan satu tingkat kecerahan. Struktur token sudah siap karena semua komponen memakai token, bukan nilai langsung.

## 9. Implementasi Web (pemetaan token)

Token didefinisikan di [tailwind.config.ts](tailwind.config.ts) (warna, radius, shadow, animasi) dan
[src/app/globals.css](src/app/globals.css) (CSS vars, marker peta, scrollbar). Komponen primitives di
`src/components/ui/` adalah satu-satunya tempat styling dasar — halaman hanya menyusun komponen.
**Aturan kontribusi:** dilarang menulis warna hex langsung di halaman; selalu pakai token.
