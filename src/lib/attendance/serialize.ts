import type { attendanceRecords } from '@/lib/db/schema';
import type { AttendanceRecordResponse } from '@/types/api';

export type AttendanceRow = {
  record: typeof attendanceRecords.$inferSelect;
  userName: string | null;
  userImage: string | null;
  geofenceName: string | null;
};

/**
 * Konversi satu baris hasil join absensi menjadi bentuk respons API.
 * Kolom `numeric` Postgres dikembalikan drizzle sebagai string, jadi semuanya
 * dinormalkan ke Number di sini — bukan di setiap route.
 */
export function toAttendanceResponse(row: AttendanceRow): AttendanceRecordResponse {
  const { record } = row;
  return {
    id: record.id,
    userId: record.userId,
    userName: row.userName ?? 'Pengguna terhapus',
    userAvatar: row.userImage,
    type: record.type as 'clock_in' | 'clock_out',
    shiftNumber: record.shiftNumber,
    timestamp: record.timestamp.toISOString(),
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    accuracyMeters: record.accuracyMeters ? Number(record.accuracyMeters) : null,
    photoUrl: record.photoUrl,
    isWithinGeofence: record.isWithinGeofence,
    distanceFromCenter: record.distanceFromCenter ? Number(record.distanceFromCenter) : 0,
    geofenceName: row.geofenceName,
    notes: record.notes,
  };
}
