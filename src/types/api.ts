import { z } from 'zod';

// --- Request Schemas ---
export const CreateAttendanceSchema = z.object({
  type: z.enum(['clock_in', 'clock_out']),
  shiftNumber: z.number().int().min(1).max(3).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().optional(),
  photoBase64: z.string().startsWith('data:image/jpeg;base64,'),
  notes: z.string().max(500).optional(),
});
export type CreateAttendanceInput = z.infer<typeof CreateAttendanceSchema>;

export const UpdateGeofenceSchema = z.object({
  name: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(5000),
  isActive: z.boolean(),
});
export type UpdateGeofenceInput = z.infer<typeof UpdateGeofenceSchema>;

export const UpdateUserSchema = z.object({
  role: z.enum(['administrator', 'admin', 'noc', 'teknisi', 'employee', 'gudang']).optional(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter').optional(),
  /** Tim jaga lembur teknisi; null untuk mengosongkan */
  technicianTeam: z.enum(['ganjil', 'genap']).nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UploadAvatarSchema = z.object({
  photoBase64: z.string().startsWith('data:image/jpeg;base64,'),
});
export type UploadAvatarInput = z.infer<typeof UploadAvatarSchema>;

export const UploadCoverSchema = z.object({
  photoBase64: z.string().startsWith('data:image/jpeg;base64,'),
});
export type UploadCoverInput = z.infer<typeof UploadCoverSchema>;

export const UpdateAppSettingsSchema = z.object({
  appName: z.string().min(1).max(64).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  /** Kode pendaftaran akun; string kosong/null = tutup pendaftaran. */
  registrationCode: z.string().max(64).nullable().optional(),
});
export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsSchema>;

export const UploadLogoSchema = z.object({
  photoBase64: z.string().regex(/^data:image\/(png|jpeg);base64,/, 'Logo harus PNG atau JPEG'),
});

export const ResetDataSchema = z.object({
  scope: z.enum(['attendance', 'users']),
  confirm: z.literal('RESET'),
});

export const RestoreBackupSchema = z.object({
  version: z.literal(1),
  data: z.object({
    users: z.array(z.record(z.unknown())),
    accounts: z.array(z.record(z.unknown())),
    geofences: z.array(z.record(z.unknown())),
    shiftSettings: z.array(z.record(z.unknown())),
    attendanceRecords: z.array(z.record(z.unknown())),
    appSettings: z.array(z.record(z.unknown())).optional(),
    leaveRequests: z.array(z.record(z.unknown())).optional(),
  }),
});

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
  role: z.enum(['administrator', 'admin', 'noc', 'teknisi', 'employee', 'gudang']),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const UpsertShiftsSchema = z.object({
  shifts: z
    .array(
      z
        .object({
          role: z.enum(['admin', 'noc', 'teknisi']),
          shiftNumber: z.number().int().min(1).max(3),
          startTime: z.string().regex(TIME_REGEX, 'Format jam harus HH:mm'),
          endTime: z.string().regex(TIME_REGEX, 'Format jam harus HH:mm'),
        })
        .refine(
          (shift) => {
            const toMin = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
            return toMin(shift.startTime) < toMin(shift.endTime);
          },
          { message: 'Jam masuk harus lebih awal dari jam pulang' }
        )
    )
    .min(1)
    .max(12)
    .refine(
      (shifts) => {
        const keys = shifts.map((s) => `${s.role}-${s.shiftNumber}`);
        return new Set(keys).size === keys.length;
      },
      { message: 'Kombinasi role + nomor shift tidak boleh duplikat' }
    ),
});
export type UpsertShiftsInput = z.infer<typeof UpsertShiftsSchema>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const LEAVE_TYPES = ['sakit', 'izin', 'cuti', 'telat', 'siang', 'remote', 'libur'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export const CreateLeaveSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().regex(DATE_REGEX, 'Format tanggal harus yyyy-MM-dd'),
    endDate: z.string().regex(DATE_REGEX, 'Format tanggal harus yyyy-MM-dd'),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
  });
export type CreateLeaveInput = z.infer<typeof CreateLeaveSchema>;

export const ReviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(500).optional(),
});
export type ReviewLeaveInput = z.infer<typeof ReviewLeaveSchema>;

// --- Response Types ---
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
  createdAt: string; // ISO 8601
}

export interface AttendanceRecordResponse {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GeofenceResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'administrator' | 'admin' | 'noc' | 'teknisi' | 'employee' | 'gudang';
  image?: string | null;
  /** Tim jaga lembur malam (khusus teknisi) */
  technicianTeam?: TechnicianTeam | null;
  createdAt?: string;
}

export interface ShiftSettingResponse {
  id: string;
  role: string;
  shiftNumber: number;
  startTime: string; // "HH:mm"
  endTime: string;
}

export const LocationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().optional(),
  isMocked: z.boolean().optional(),
  recordedAt: z.string().datetime(), // ISO 8601, waktu fix GPS di perangkat
});
export type LocationPointInput = z.infer<typeof LocationPointSchema>;

/**
 * Dua bentuk payload sengaja didukung sekaligus:
 * - LAMA (app mobile ≤ 1.5.0 dan LiveTracker web): { latitude, longitude,
 *   accuracyMeters } — satu titik, waktunya diambil saat server menerima.
 * - BARU (app mobile ≥ 1.6.0): { points: [...] } — seluruh batch dari deferred
 *   location updates Android, jadi tidak ada titik perjalanan yang dibuang.
 *
 * Kompatibilitas mundur WAJIB dipertahankan: app mobile tidak punya mekanisme
 * OTA, sehingga HP yang belum di-update masih mengirim payload lama untuk
 * waktu yang lama.
 */
export const UpdateLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyMeters: z.number().positive().optional(),
    points: z.array(LocationPointSchema).min(1).max(60).optional(),
  })
  .refine((v) => v.points != null || (v.latitude != null && v.longitude != null), {
    message: 'Kirim `points` (batch) atau latitude + longitude (payload lama)',
  });
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;

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

// --- Riwayat jejak lokasi (administrator saja) ---

export interface TrailPointResponse {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  isMocked: boolean;
  recordedAt: string; // ISO 8601
}

export interface TrailStopResponse {
  latitude: number;
  longitude: number;
  startedAt: string; // ISO 8601
  endedAt: string;
  durationMinutes: number;
  pointCount: number;
}

export interface LocationTrailResponse {
  userId: string;
  userName: string;
  date: string; // "yyyy-MM-dd"
  shiftNumber: number | null;
  sessionStart: string | null; // ISO 8601
  sessionEnd: string | null;
  clockIn: AttendanceRecordResponse | null;
  clockOut: AttendanceRecordResponse | null;
  points: TrailPointResponse[];
  stops: TrailStopResponse[];
  totalDistanceMeters: number;
  /** true bila jejak dipotong di TRAIL_MAX_POINTS (sesi luar biasa panjang) */
  truncated: boolean;
  /** true bila titik ditipiskan agar peta tetap responsif */
  thinned: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// --- Jadwal Shift & Tukar Shift ---

export const SCHEDULE_SHIFTS = ['1', '2', 'libur'] as const;
export type ScheduleShift = (typeof SCHEDULE_SHIFTS)[number];

export const UpsertScheduleSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus yyyy-MM'),
  entries: z
    .array(
      z.object({
        userId: z.string().min(1),
        date: z.string().regex(DATE_REGEX, 'Format tanggal harus yyyy-MM-dd'),
        shift: z.enum(SCHEDULE_SHIFTS),
      })
    )
    .max(500),
});
export type UpsertScheduleInput = z.infer<typeof UpsertScheduleSchema>;

export interface ScheduleEntry {
  userId: string;
  date: string; // "yyyy-MM-dd"
  shift: ScheduleShift;
}

export interface ScheduleUser {
  id: string;
  name: string;
  role: string;
  image: string | null;
  /** Tim jaga lembur malam (khusus teknisi); null bila belum ditetapkan */
  technicianTeam: TechnicianTeam | null;
}

export interface ScheduleResponse {
  users: ScheduleUser[];
  entries: ScheduleEntry[];
  /**
   * false bila daftar peserta belum pernah diatur — grid memakai perilaku
   * lama (semua karyawan ber-role terjadwal).
   */
  participantsConfigured: boolean;
}

// --- Tim jaga lembur teknisi (ganjil/genap) ---

export const TECHNICIAN_TEAMS = ['ganjil', 'genap'] as const;
export type TechnicianTeam = (typeof TECHNICIAN_TEAMS)[number];

export const UpdateScheduleParticipantsSchema = z.object({
  userIds: z.array(z.string().min(1)).max(200),
});
export type UpdateScheduleParticipantsInput = z.infer<
  typeof UpdateScheduleParticipantsSchema
>;

export type SwapStatus =
  | 'pending_peer'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export const CreateSwapSchema = z.object({
  date: z.string().regex(DATE_REGEX, 'Format tanggal harus yyyy-MM-dd'),
  targetUserId: z.string().min(1),
  reason: z.string().max(500).optional(),
});
export type CreateSwapInput = z.infer<typeof CreateSwapSchema>;

export const ReviewSwapSchema = z.object({
  action: z.enum(['peer_accept', 'peer_reject', 'approve', 'reject']),
  reviewNote: z.string().max(500).optional(),
});
export type ReviewSwapInput = z.infer<typeof ReviewSwapSchema>;

export interface SwapRequestResponse {
  id: string;
  requesterId: string;
  requesterName: string;
  targetId: string;
  targetName: string;
  date: string; // "yyyy-MM-dd"
  requesterShift: string; // '1' | '2'
  targetShift: string;
  status: SwapStatus;
  reason: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string; // ISO 8601
}

export interface SwapCandidate {
  id: string;
  name: string;
  shift: string; // '1' | '2'
}

// --- Piket Kebersihan ---

export const UpsertPiketSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus yyyy-MM'),
  assignments: z
    .array(
      z.object({
        date: z.string().regex(DATE_REGEX, 'Format tanggal harus yyyy-MM-dd'),
        userId: z.string().min(1),
      })
    )
    .max(40),
});
export type UpsertPiketInput = z.infer<typeof UpsertPiketSchema>;

export const MarkPiketDoneSchema = z.object({
  date: z.string().regex(DATE_REGEX, 'Format tanggal harus yyyy-MM-dd'),
  done: z.boolean(),
});
export type MarkPiketDoneInput = z.infer<typeof MarkPiketDoneSchema>;

export interface PiketAssignment {
  date: string; // "yyyy-MM-dd"
  userId: string;
  userName: string;
  done: boolean;
}

export interface PiketResponse {
  users: ScheduleUser[];
  assignments: PiketAssignment[];
}

// --- Stok Gudang ---

export const STOCK_MOVEMENT_TYPES = ['masuk', 'keluar', 'adjust'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** habis: stok <= 0 · menipis: 0 < stok <= minStock · aman: stok > minStock */
export type StockStatus = 'habis' | 'menipis' | 'aman';

export const CreateStockCategorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi').max(100),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateStockCategoryInput = z.infer<typeof CreateStockCategorySchema>;

export const CreateStockItemSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(50),
  name: z.string().min(1, 'Nama barang wajib diisi').max(255),
  categoryId: z.string().uuid().nullable().optional(),
  unit: z.string().min(1).max(20).optional(),
  openingStock: z.number().int().optional(),
  minStock: z.number().int().min(0).optional(),
  photoBase64: z.string().startsWith('data:image/jpeg;base64,').optional(),
});
export type CreateStockItemInput = z.infer<typeof CreateStockItemSchema>;

export const UpdateStockItemSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  unit: z.string().min(1).max(20).optional(),
  openingStock: z.number().int().optional(),
  minStock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  photoBase64: z.string().startsWith('data:image/jpeg;base64,').optional(),
});
export type UpdateStockItemInput = z.infer<typeof UpdateStockItemSchema>;

export const CreateStockMovementSchema = z
  .object({
    itemId: z.string().uuid(),
    type: z.enum(STOCK_MOVEMENT_TYPES),
    quantity: z.number().int(),
    note: z.string().max(500).optional(),
    photoBase64: z.string().startsWith('data:image/jpeg;base64,').optional(),
  })
  .refine((v) => (v.type === 'adjust' ? v.quantity !== 0 : v.quantity >= 1), {
    message: 'Jumlah masuk/keluar minimal 1; penyesuaian tidak boleh 0',
    path: ['quantity'],
  });
export type CreateStockMovementInput = z.infer<typeof CreateStockMovementSchema>;

export interface StockCategoryResponse {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
}

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
  lastMovementAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
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
  createdAt: string; // ISO 8601
}

export interface StockOverviewResponse {
  totalItems: number;
  totalStock: number;
  totalIn: number; // total masuk pada periode
  totalOut: number; // total keluar pada periode
  lowStockCount: number;
  outOfStockCount: number;
  period: { from: string; to: string }; // yyyy-MM-dd
  recentMovements: StockMovementResponse[];
  lowStockItems: StockItemResponse[];
}
