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

/** 'lembur' = lembur urgent di luar shift (dihitung 100% lembur di rekap). */
export type AttendanceKind = 'shift' | 'lembur';
export type OvertimeStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceRecordResponse {
  id: string;
  userId: string;
  userName: string;
  type: 'clock_in' | 'clock_out';
  kind: AttendanceKind;
  /** Status verifikasi sesi lembur (hanya di record pembuka sesi lembur) */
  overtimeStatus: OvertimeStatus | null;
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

/** Satu titik jejak yang dikirim ke POST /api/locations (maks 60 per request). */
export interface LocationPointInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  isMocked?: boolean;
  recordedAt: string; // ISO 8601, waktu fix GPS di perangkat
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

export type LeaveType = 'sakit' | 'izin' | 'cuti' | 'telat' | 'siang' | 'remote' | 'libur';
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

// --- Jadwal Shift, Tukar Shift, Piket ---

export type ScheduleShift = '1' | '2' | 'libur';

export interface ScheduleEntry {
  userId: string;
  date: string; // "yyyy-MM-dd"
  shift: ScheduleShift;
}

export interface ScheduleUser {
  id: string;
  name: string;
  role: string;
}

export interface ScheduleResponse {
  users: ScheduleUser[];
  entries: ScheduleEntry[];
}

/** Roster "siapa shift berapa" satu hari — GET /api/schedules/today. */
export interface DayRosterMember {
  userId: string;
  name: string;
  role: string;
  image: string | null;
  shift: ScheduleShift | null;
}

export interface DayRosterResponse {
  date: string; // "yyyy-MM-dd"
  members: DayRosterMember[];
}

export type SwapStatus =
  | 'pending_peer'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'cancelled';

/** 'shift' = tukar shift satu tanggal; 'libur' = tukar hari libur di dua tanggal. */
export type SwapKind = 'shift' | 'libur';

export interface SwapRequestResponse {
  id: string;
  kind: SwapKind;
  requesterId: string;
  requesterName: string;
  targetId: string;
  targetName: string;
  date: string; // "yyyy-MM-dd" — kind='libur': tanggal libur pengaju
  targetDate: string | null; // kind='libur': tanggal libur rekan
  requesterShift: string; // '1' | '2' | 'libur'
  targetShift: string;
  status: SwapStatus;
  reason: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface SwapCandidate {
  id: string;
  name: string;
  /** Shift rekan pada tanggal diajukan — mode libur: yang akan diambil pengaju. */
  shift: string; // '1' | '2'
  /** Hanya mode libur: tanggal libur rekan yang ditawarkan. */
  targetDate?: string;
  /** Hanya mode libur: shift pengaju di `targetDate`, yang akan diambil rekan. */
  targetShift?: string;
}

export interface PiketAssignment {
  date: string; // "yyyy-MM-dd"
  userId: string;
  userName: string;
  /** Foto profil petugas; null bila belum pasang. */
  userImage: string | null;
  done: boolean;
}

export interface PiketResponse {
  users: ScheduleUser[];
  assignments: PiketAssignment[];
}

// --- Stok Gudang ---

export type StockMovementType = 'masuk' | 'keluar' | 'adjust';
export type StockStatus = 'habis' | 'menipis' | 'aman';

export interface StockItemResponse {
  id: string;
  code: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  photoUrl: string | null;
  openingStock: number;
  minStock: number;
  currentStock: number;
  status: StockStatus;
  isActive: boolean;
  lastMovementAt: string | null;
  createdAt: string;
}

export interface StockMovementResponse {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: StockMovementType;
  quantity: number;
  photoUrl: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

// --- Rekap absensi bulanan (GET /api/reports/recap) ---

/** Satu baris detail harian rekap — bentuknya sama dengan tabel di web. */
export interface RecapRow {
  key: string;
  date: string; // "yyyy-MM-dd"
  userId: string;
  userName: string;
  role: string;
  clockInAt: string | null; // ISO 8601
  clockOutAt: string | null;
  clockInTime: string | null; // "HH:mm"
  clockOutTime: string | null;
  shiftNumber: number | null;
  lateMinutes: number;
  overtimeMinutes: number;
  earlyLeaveMinutes: number;
  /** null = hadir; selain itu 'sakit' | 'izin' | 'cuti' | 'libur' */
  leaveType: string | null;
  kind: AttendanceKind;
  overtimeStatus: OvertimeStatus | null;
  overtimeRecordId: string | null;
}

export interface RecapSummary {
  userId: string;
  userName: string;
  role: string;
  presentDays: number;
  sakitDays: number;
  izinDays: number;
  cutiDays: number;
  liburDays: number;
  totalLateMinutes: number;
  /** Lembur biasa: datang lebih awal + pulang lebih larut dari jam shift. */
  totalOvertimeMinutes: number;
  totalEarlyLeaveMinutes: number;
  /** Lembur urgent yang sudah disetujui admin (dihitung terpisah). */
  overtimeUrgentMinutes: number;
  overtimeUrgentCount: number;
  overtimeUrgentPending: number;
}

export interface RecapResponse {
  month: string; // "yyyy-MM"
  user: { id: string; name: string; role: string };
  summary: RecapSummary;
  rows: RecapRow[];
}

/** Posisi live satu karyawan (administrator saja). */
export interface LiveLocationResponse {
  userId: string;
  userName: string;
  userAvatar: string | null;
  role: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  updatedAt: string; // ISO 8601
}

/** Baris daftar karyawan di panel administrator. */
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  technicianTeam: string | null;
}
