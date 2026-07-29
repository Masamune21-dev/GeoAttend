/**
 * Design token GeoAttend mobile — mengikuti redesign "GeoAttend App Redesign".
 *
 * Basis warna tetap Tailwind slate + blue (selaras web), tapi permukaan layar
 * memakai `background` yang sedikit lebih dingin (#F6F8FB) dan kartu diangkat
 * dengan shadow halus, bukan garis border — itu yang membedakan tampilan baru
 * dari versi lama.
 */
export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySubtle: '#EFF6FF',
  success: '#16A34A',
  successStrong: '#15803D',
  successSubtle: '#ECFDF5',
  destructive: '#EF4444',
  destructiveStrong: '#B91C1C',
  destructiveSubtle: '#FEF2F2',
  warning: '#F59E0B',
  warningStrong: '#B45309',
  warningSubtle: '#FFFBEB',
  background: '#F6F8FB',
  surface: '#FFFFFF',
  /** Latar netral untuk chip, segmented, placeholder. */
  muted: '#F1F5F9',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  /** Teks/ikon non-aktif (tab bar, hint). */
  textMuted: '#94A3B8',
  /** Teks di atas permukaan primary. */
  onPrimary: '#FFFFFF',
  onPrimarySubtle: 'rgba(255,255,255,0.75)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  full: 999,
} as const;

/** Skala tipografi — dipakai lewat `type.*` agar konsisten antar layar. */
export const type = {
  /** Judul besar layar ("Inventaris Barang"). */
  display: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  /** Judul header layar. */
  title: { fontSize: 18, fontWeight: '800' },
  /** Judul section / kartu. */
  section: { fontSize: 15, fontWeight: '700' },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 14, fontWeight: '400' },
  bodyStrong: { fontSize: 13.5, fontWeight: '600' },
  small: { fontSize: 12.5, fontWeight: '400' },
  tiny: { fontSize: 11.5, fontWeight: '400' },
  /** Label chip & badge. */
  micro: { fontSize: 10.5, fontWeight: '700' },
} as const;

/**
 * Elevasi. `card` untuk kartu biasa, `raised` untuk elemen mengambang
 * (FAB, tombol absen di header, tombol tab tengah).
 */
export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

/** Palet avatar deterministik (fallback inisial). */
const AVATAR_PALETTE = ['#2563EB', '#0EA5E9', '#16A34A', '#B45309', '#7C3AED', '#DB2777'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function initialsOf(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
