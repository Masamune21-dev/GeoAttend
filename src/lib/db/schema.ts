import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  numeric,
  boolean,
  jsonb,
  index,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================
// Tabel Better Auth (user, session, account, verification)
// Nama export harus sesuai model Better Auth (singular),
// nama tabel SQL mengikuti PRD (plural).
// ============================================

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  coverImage: text('cover_image'), // foto sampul profil (opsional)
  role: varchar('role', { length: 20 }).default('employee').notNull(), // 'admin' | 'employee'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index('sessions_token_idx').on(table.token),
  })
);

export const account = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: text('account_id').notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'), // hash password (scrypt via Better Auth)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verification = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Tabel Domain GeoAttend
// ============================================

export const geofences = pgTable('geofences', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  radiusMeters: numeric('radius_meters', { precision: 6, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Jam kerja SOP per role. Satu role bisa punya beberapa shift
 * (mis. admin & noc: 2 shift; teknisi: 1 shift).
 */
export const shiftSettings = pgTable(
  'shift_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    role: varchar('role', { length: 20 }).notNull(), // 'admin' | 'noc' | 'teknisi'
    shiftNumber: integer('shift_number').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(), // format "HH:mm"
    endTime: varchar('end_time', { length: 5 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    roleShiftUnique: uniqueIndex('shift_settings_role_number_idx').on(
      table.role,
      table.shiftNumber
    ),
  })
);

/**
 * Pengaturan aplikasi (key-value): app_name, app_logo, dll.
 */
export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Posisi live terakhir per pengguna (satu baris per user, di-upsert).
 * Diisi selama pengguna berstatus clock-in; dihapus saat clock-out.
 */
export const liveLocations = pgTable('live_locations', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  accuracyMeters: numeric('accuracy_meters', { precision: 6, scale: 2 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Pengajuan izin (sakit/izin/cuti — perlu persetujuan administrator)
 * dan penanda libur (self-service dari halaman absensi, langsung approved).
 * Tanggal disimpan sebagai string "yyyy-MM-dd" (tanggal lokal, konsisten
 * dengan pengelompokan rekap harian).
 */
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 10 }).notNull(), // 'sakit' | 'izin' | 'cuti' | 'libur'
    startDate: varchar('start_date', { length: 10 }).notNull(), // "yyyy-MM-dd"
    endDate: varchar('end_date', { length: 10 }).notNull(),
    reason: text('reason'),
    status: varchar('status', { length: 10 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: index('leave_requests_user_date_idx').on(table.userId, table.startDate),
    statusIdx: index('leave_requests_status_idx').on(table.status),
  })
);

/**
 * Jadwal shift per-karyawan (role admin & noc). Satu baris = shift seorang
 * karyawan pada satu tanggal, diisi administrator (grid bulanan + rotasi).
 * Tanggal disimpan "yyyy-MM-dd" (lokal), konsisten dengan leave_requests.
 */
export const scheduleEntries = pgTable(
  'schedule_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    date: varchar('date', { length: 10 }).notNull(), // "yyyy-MM-dd"
    shift: varchar('shift', { length: 10 }).notNull(), // '1' | '2' | 'libur'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex('schedule_entries_user_date_idx').on(table.userId, table.date),
    dateIdx: index('schedule_entries_date_idx').on(table.date),
  })
);

/**
 * Pengajuan tukar shift antar karyawan (satu role, beda shift, tanggal ke depan).
 * Alur: pengaju → rekan (target) setuju → administrator setujui → jadwal ditukar.
 */
export const shiftSwapRequests = pgTable(
  'shift_swap_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requesterId: text('requester_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    targetId: text('target_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    date: varchar('date', { length: 10 }).notNull(), // "yyyy-MM-dd"
    requesterShift: varchar('requester_shift', { length: 10 }).notNull(), // '1' | '2'
    targetShift: varchar('target_shift', { length: 10 }).notNull(),
    // 'pending_peer' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled'
    status: varchar('status', { length: 20 }).default('pending_peer').notNull(),
    reason: text('reason'),
    peerRespondedAt: timestamp('peer_responded_at'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    targetStatusIdx: index('shift_swap_target_status_idx').on(table.targetId, table.status),
    requesterIdx: index('shift_swap_requester_idx').on(table.requesterId),
    dateIdx: index('shift_swap_date_idx').on(table.date),
  })
);

/**
 * Piket kebersihan: satu karyawan bertugas ngepel per hari (bergiliran).
 * `done` ditandai oleh yang bertugas saat sudah melakukan piket.
 */
export const piketAssignments = pgTable(
  'piket_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    date: varchar('date', { length: 10 }).notNull(), // "yyyy-MM-dd"
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    done: boolean('done').default(false).notNull(),
    doneAt: timestamp('done_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    dateUnique: uniqueIndex('piket_assignments_date_idx').on(table.date),
  })
);

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'clock_in' | 'clock_out'
    shiftNumber: integer('shift_number'), // shift yang dipilih saat absen (null utk data lama / role tanpa shift)
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
    accuracyMeters: numeric('accuracy_meters', { precision: 6, scale: 2 }),
    photoUrl: text('photo_url').notNull(),
    geofenceId: uuid('geofence_id').references(() => geofences.id),
    isWithinGeofence: boolean('is_within_geofence').notNull(),
    distanceFromCenter: numeric('distance_from_center', { precision: 8, scale: 2 }), // meter
    notes: text('notes'),
    metadata: jsonb('metadata'), // Info device, browser, dll.
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userTimestampIdx: index('attendance_user_timestamp_idx').on(table.userId, table.timestamp),
    timestampIdx: index('attendance_timestamp_idx').on(table.timestamp),
  })
);
