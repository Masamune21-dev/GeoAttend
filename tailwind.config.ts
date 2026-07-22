import type { Config } from 'tailwindcss';

/**
 * Design tokens GeoAttend — lihat DESIGN.md.
 * Halaman tidak boleh memakai warna hex langsung; selalu lewat token ini.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          subtle: '#EFF6FF',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
        accent: '#0EA5E9',
        destructive: {
          DEFAULT: '#EF4444',
          subtle: '#FEF2F2',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#16A34A',
          subtle: '#ECFDF5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          subtle: '#FFFBEB',
        },
        background: '#F6F8FB',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
      },
      borderRadius: {
        sm: '0.5rem', // 8 — chip, select kecil
        DEFAULT: '0.75rem',
        md: '0.75rem', // 12 — tombol, input
        lg: '1rem', // 16 — kartu list, foto
        xl: '1.25rem', // 20 — kartu utama, dialog
        '2xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        elevated: '0 4px 16px -4px rgb(15 23 42 / 0.10), 0 2px 6px -2px rgb(15 23 42 / 0.06)',
        floating: '0 16px 40px -12px rgb(15 23 42 / 0.22)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        'slide-up': 'slide-up 300ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
