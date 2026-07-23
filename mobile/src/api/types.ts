/**
 * Tipe API — subset dari `src/types/api.ts` proyek web.
 * Jaga agar sinkron bila kontrak API berubah.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string; // 'administrator' | 'admin' | 'noc' | 'teknisi' | 'employee'
  image?: string | null;
  coverImage?: string | null;
}

export interface AttendanceRecordResponse {
  id: string;
  userId: string;
  userName: string;
  type: 'clock_in' | 'clock_out';
  shiftNumber: number | null;
  timestamp: string; // ISO 8601
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  photoUrl: string;
  isWithinGeofence: boolean;
  distanceFromCenter: number;
  geofenceName?: string | null;
  notes?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface GeofenceResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface ShiftSettingResponse {
  id: string;
  role: string;
  shiftNumber: number;
  startTime: string; // "HH:mm"
  endTime: string;
}

export type LeaveType = 'sakit' | 'izin' | 'cuti' | 'libur';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequestResponse {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  type: LeaveType;
  startDate: string; // "yyyy-MM-dd"
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string;
}
