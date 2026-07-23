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
  role: z.enum(['administrator', 'admin', 'noc', 'teknisi', 'employee']).optional(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter').optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UploadAvatarSchema = z.object({
  photoBase64: z.string().startsWith('data:image/jpeg;base64,'),
});
export type UploadAvatarInput = z.infer<typeof UploadAvatarSchema>;

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
  role: z.enum(['administrator', 'admin', 'noc', 'teknisi', 'employee']),
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

export const LEAVE_TYPES = ['sakit', 'izin', 'cuti', 'libur'] as const;
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
  role: 'administrator' | 'admin' | 'noc' | 'teknisi' | 'employee';
  image?: string | null;
  createdAt?: string;
}

export interface ShiftSettingResponse {
  id: string;
  role: string;
  shiftNumber: number;
  startTime: string; // "HH:mm"
  endTime: string;
}

export const UpdateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().optional(),
});
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;

export interface LiveLocationResponse {
  userId: string;
  userName: string;
  role: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  updatedAt: string; // ISO 8601
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
