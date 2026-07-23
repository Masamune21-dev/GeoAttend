import type { LeaveStatus, LeaveType } from '@/types/api';

/** Label Indonesia untuk jenis izin/libur. */
export function getLeaveTypeLabel(type: string): string {
  switch (type as LeaveType) {
    case 'sakit':
      return 'Sakit';
    case 'izin':
      return 'Izin';
    case 'cuti':
      return 'Cuti';
    case 'libur':
      return 'Libur';
    default:
      return type;
  }
}

/** Label Indonesia untuk status pengajuan. */
export function getLeaveStatusLabel(status: string): string {
  switch (status as LeaveStatus) {
    case 'pending':
      return 'Menunggu';
    case 'approved':
      return 'Disetujui';
    case 'rejected':
      return 'Ditolak';
    default:
      return status;
  }
}

/** "yyyy-MM-dd" lokal dari sebuah Date. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Kembangkan rentang tanggal "yyyy-MM-dd" (inklusif) menjadi daftar tanggal.
 * Dibatasi maksimal `maxDays` untuk mencegah rentang tak wajar.
 */
export function expandDateRange(startDate: string, endDate: string, maxDays = 62): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end && dates.length < maxDays) {
    dates.push(toLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Dua rentang tanggal (string ISO lokal) saling tumpang-tindih? */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
