import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format: "27 Oktober 2023" */
export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd MMMM yyyy', { locale: localeId });
}

/** Format: "08:00" */
export function formatTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm');
}

/** Format: "Jumat, 27 Oktober 2023 08:00" */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'EEEE, dd MMMM yyyy HH:mm', { locale: localeId });
}

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
};

/** Label role untuk ditampilkan di UI. */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return '-';
  return ROLE_LABELS[role] ?? role;
}

/** Ambil inisial dari nama, maksimal 2 huruf. */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
