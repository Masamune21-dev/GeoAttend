'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OPEN_SESSION_WINDOW_HOURS } from '@/lib/constants';
import type {
  AttendanceRecordResponse,
  CreateAttendanceInput,
  CreateLeaveInput,
  GeofenceResponse,
  LeaveRequestResponse,
  LiveLocationResponse,
  LocationTrailResponse,
  PaginatedResponse,
  ReviewLeaveInput,
  ShiftSettingResponse,
  UserProfile,
} from '@/types/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(body?.message ?? 'Terjadi kesalahan'), {
      code: body?.code,
      details: body?.details,
      status: res.status,
    });
  }
  return body as T;
}

export interface AttendanceFilters {
  page?: number;
  limit?: number;
  userId?: string;
  from?: string;
  to?: string;
  today?: boolean;
}

function buildQuery(filters: AttendanceFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.today) params.set('today', 'true');
  return params.toString();
}

/** Query daftar record absensi. */
export function useAttendanceList(filters: AttendanceFilters, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['attendance', filters],
    queryFn: () =>
      fetchJson<PaginatedResponse<AttendanceRecordResponse>>(
        `/api/attendance?${buildQuery(filters)}`
      ),
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

/** Query record absensi hari ini milik user login (kehadiran pada TANGGAL ini). */
export function useTodayAttendance() {
  return useQuery({
    queryKey: ['attendance', 'today', 'self'],
    queryFn: () =>
      fetchJson<PaginatedResponse<AttendanceRecordResponse>>(
        '/api/attendance?today=true&userId=self&limit=10'
      ),
    staleTime: 30_000,
  });
}

/**
 * Status "sesi kerja terbuka" milik user login: record absensi TERAKHIR dalam
 * jendela bergulir {@link OPEN_SESSION_WINDOW_HOURS} jam. Beda dari
 * {@link useTodayAttendance} — jendela ini menembus tengah malam, jadi Shift 2
 * yang masuk 15:00 & belum pulang tetap terbaca "sedang bekerja" pada jam 02:00
 * keesokan hari (tombol jadi "Absen Pulang", bukan "Absen Masuk").
 */
export function useOpenSession() {
  return useQuery({
    queryKey: ['attendance', 'open-session', 'self'],
    queryFn: async () => {
      const from = new Date(
        Date.now() - OPEN_SESSION_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();
      const res = await fetchJson<PaginatedResponse<AttendanceRecordResponse>>(
        `/api/attendance?userId=self&from=${encodeURIComponent(from)}&limit=1`
      );
      const lastRecord = res.data[0] ?? null;
      return { lastRecord, isOpen: lastRecord?.type === 'clock_in' };
    },
    staleTime: 30_000,
  });
}

/** Query konfigurasi geofence aktif. Mengembalikan null jika belum dikonfigurasi. */
export function useGeofence() {
  return useQuery({
    queryKey: ['geofence'],
    queryFn: async (): Promise<GeofenceResponse | null> => {
      const res = await fetch('/api/geofence');
      if (res.status === 404) return null;
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal memuat geofence');
      return body as GeofenceResponse;
    },
    staleTime: 5 * 60_000,
  });
}

/** Query konfigurasi jam kerja SOP per role. */
export function useShifts() {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: () => fetchJson<{ data: ShiftSettingResponse[] }>('/api/shifts'),
    staleTime: 5 * 60_000,
  });
}

/** Query daftar pengguna (admin saja). */
export function useUsers(search = '') {
  return useQuery({
    queryKey: ['users', search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      return fetchJson<{ data: UserProfile[] }>(`/api/users?${params}`);
    },
    staleTime: 60_000,
  });
}

/** Query posisi live seluruh karyawan (administrator saja). Polling cepat. */
export function useLiveLocations(pollIntervalMs = 10_000) {
  return useQuery({
    queryKey: ['live-locations'],
    queryFn: () => fetchJson<{ data: LiveLocationResponse[] }>('/api/locations'),
    refetchInterval: pollIntervalMs,
    staleTime: 5_000,
  });
}

export interface TrailTarget {
  userId: string;
  userName: string;
  date: string; // "yyyy-MM-dd"
  /** ISO jam absen masuk — memilih sesi yang tepat bila ada 2 shift sehari */
  clockInAt: string | null;
}

/**
 * Riwayat jejak lokasi satu SESI kerja (administrator saja). Query baru
 * menembak ketika dialog dibuka (target != null), bukan saat halaman rekap
 * dirender — jejak bisa ribuan titik dan tidak perlu diambil sebelum diminta.
 */
export function useLocationTrail(target: TrailTarget | null) {
  return useQuery({
    queryKey: ['location-trail', target?.userId, target?.date, target?.clockInAt],
    queryFn: () => {
      const params = new URLSearchParams({ userId: target!.userId, date: target!.date });
      if (target!.clockInAt) params.set('clockInAt', target!.clockInAt);
      return fetchJson<{ data: LocationTrailResponse }>(`/api/locations/trail?${params}`);
    },
    enabled: target !== null,
    staleTime: 5 * 60_000, // jejak sesi yang sudah lewat tidak berubah lagi
  });
}

export interface LeaveFilters {
  userId?: string;
  from?: string; // yyyy-MM-dd
  to?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

/** Query daftar pengajuan izin/libur. */
export function useLeaves(filters: LeaveFilters = {}) {
  return useQuery({
    queryKey: ['leaves', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.status) params.set('status', filters.status);
      return fetchJson<{ data: LeaveRequestResponse[] }>(`/api/leaves?${params}`);
    },
    staleTime: 30_000,
  });
}

/** Mutation membuat pengajuan izin / penanda libur. */
export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeaveInput) =>
      fetchJson<LeaveRequestResponse>('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}

/** Mutation menyetujui/menolak pengajuan (administrator). */
export function useReviewLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ReviewLeaveInput & { id: string }) =>
      fetchJson<{ data: { id: string; status: string } }>(`/api/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}

/** Mutation membatalkan/menghapus pengajuan. */
export function useDeleteLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ data: { id: string } }>(`/api/leaves/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}

/** Mutation membuat record absensi baru. */
export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceInput) =>
      fetchJson<AttendanceRecordResponse>('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
