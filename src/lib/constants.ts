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
