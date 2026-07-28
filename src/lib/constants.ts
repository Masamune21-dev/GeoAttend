export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'GeoAttend';
export const APP_VERSION = '1.2.0';

export const DEFAULT_MAP_CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? -6.2087634),
  Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? 106.845599),
];

export const DEFAULT_ZOOM_LEVEL = 16;

export const MIN_GEOFENCE_RADIUS = 10;
export const MAX_GEOFENCE_RADIUS = 5000;

/** Akurasi GPS di atas nilai ini (meter) dianggap lemah dan diberi peringatan. */
export const GPS_WEAK_ACCURACY_THRESHOLD = 50;

/** Interval polling live map (ms). */
export const LIVE_MAP_POLL_INTERVAL = 30_000;

/**
 * Interval heartbeat posisi dari app mobile saat karyawan DIAM (ms). Selama
 * tidak bergerak GPS tak menghasilkan update baru, jadi app tetap melapor
 * berkala agar server tahu "orangnya masih di titik ini".
 */
export const LIVE_HEARTBEAT_INTERVAL_MS = 300_000;

/**
 * Posisi live dianggap "segar" bila update terakhir lebih baru dari ini
 * (= heartbeat + toleransi 1 menit untuk jaringan lambat / batch Android).
 * Di atas ambang ini marker TIDAK kembali ke titik absen — hanya labelnya
 * berubah jadi "terakhir terlihat". Lihat admin/live-map/page.tsx.
 */
export const LIVE_FRESHNESS_MS = LIVE_HEARTBEAT_INTERVAL_MS + 60_000;

/**
 * Jendela "sesi kerja terbuka" (jam). Sebuah sesi (clock-in → clock-out) bisa
 * menembus tengah malam (mis. Shift 2 masuk 15:00, pulang 02:00 keesokan hari),
 * jadi status "sedang bekerja" & validasi urutan absen memakai jendela bergulir
 * ini — bukan "sejak tengah malam". Shift 8 jam + lembur realistis < 18 jam.
 */
export const OPEN_SESSION_WINDOW_HOURS = 18;

// --- Jejak lokasi (riwayat perjalanan karyawan) ---

/** Titik jejak disimpan bila bergerak minimal sejauh ini dari titik terakhir (meter). */
export const TRAIL_MIN_DISTANCE_M = 25;

/**
 * ...ATAU bila sudah selewat ini sejak titik terakhir (ms). Cabang kedua inilah
 * heartbeat "orangnya masih di sini" yang membentuk titik berhenti pada peta.
 */
export const TRAIL_MIN_INTERVAL_MS = 60_000;

/** Fix GPS dengan akurasi lebih buruk dari ini dibuang (sampah, bukan jejak). */
export const TRAIL_MAX_ACCURACY_M = 150;

/** Batas titik yang diambil dari database untuk satu respons riwayat. */
export const TRAIL_MAX_POINTS = 5_000;

/** Di atas jumlah ini titik ditipiskan sebelum dikirim agar peta tidak tersendat. */
export const TRAIL_RENDER_MAX_POINTS = 1_500;

/** Retensi jejak lokasi (hari). Lihat scripts/cleanup-trails.ts. */
export const TRAIL_RETENTION_DAYS = 90;

/**
 * Radius "tempat yang sama" untuk deteksi berhenti (meter). Dipatok pada level
 * akurasi Accuracy.Balanced (±100 m): lebih ketat dari ini, jitter GPS memecah
 * satu kunjungan menjadi banyak potongan pendek yang lalu terbuang semua.
 */
export const STOP_RADIUS_M = 100;

/** Durasi minimal agar dianggap "berhenti" — bukan macet / lampu merah (ms). */
export const STOP_MIN_DURATION_MS = 10 * 60_000;

export const MAX_PHOTO_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5);

/** Role yang punya SOP jam kerja. Role 'employee' = belum ditetapkan admin. */
export const WORK_ROLES = ['admin', 'noc', 'teknisi'] as const;
export type WorkRole = (typeof WORK_ROLES)[number];

export const ALL_ROLES = [...WORK_ROLES, 'employee'] as const;

/** Default SOP perusahaan (bisa diubah admin di halaman Pengaturan). */
export const DEFAULT_SHIFTS = [
  { role: 'admin', shiftNumber: 1, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', shiftNumber: 2, startTime: '15:00', endTime: '22:00' },
  { role: 'noc', shiftNumber: 1, startTime: '07:00', endTime: '15:00' },
  { role: 'noc', shiftNumber: 2, startTime: '15:00', endTime: '22:00' },
  { role: 'teknisi', shiftNumber: 1, startTime: '08:00', endTime: '16:00' },
] as const;
