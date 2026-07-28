'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSwapInput,
  MarkPiketDoneInput,
  PiketResponse,
  ReviewSwapInput,
  ScheduleResponse,
  ScheduleUser,
  SwapCandidate,
  SwapRequestResponse,
  TechnicianTeam,
  UpdateScheduleParticipantsInput,
  UpsertPiketInput,
  UpsertScheduleInput,
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

/** Jadwal shift satu bulan. Admin tanpa userId → grid penuh; userId='self' → milik sendiri. */
export function useSchedule(month: string, userId?: string) {
  return useQuery({
    queryKey: ['schedules', month, userId ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams({ month });
      if (userId) params.set('userId', userId);
      return fetchJson<ScheduleResponse>(`/api/schedules?${params}`);
    },
    staleTime: 30_000,
  });
}

/** Simpan (replace) jadwal satu bulan (administrator). */
export function useSaveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertScheduleInput) =>
      fetchJson<{ data: { month: string; saved: number } }>('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export interface ScheduleParticipantsResponse {
  candidates: ScheduleUser[];
  participantIds: string[];
  configured: boolean;
}

/** Kandidat & daftar peserta grid jadwal (administrator). */
export function useScheduleParticipants(enabled = true) {
  return useQuery({
    queryKey: ['schedule-participants'],
    queryFn: () =>
      fetchJson<ScheduleParticipantsResponse>('/api/schedules/participants'),
    enabled,
    staleTime: 60_000,
  });
}

/** Simpan daftar peserta grid jadwal (administrator). */
export function useSaveScheduleParticipants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateScheduleParticipantsInput) =>
      fetchJson<{ data: { saved: number } }>('/api/schedules/participants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-participants'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['piket'] });
    },
  });
}

/** Tetapkan tim jaga lembur (ganjil/genap) seorang teknisi. */
export function useSetTechnicianTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, team }: { userId: string; team: TechnicianTeam | null }) =>
      fetchJson<{ data: unknown }>(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianTeam: team }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-participants'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export interface SwapFilters {
  status?: string;
}

/** Daftar pengajuan tukar shift. */
export function useSwaps(filters: SwapFilters = {}) {
  return useQuery({
    queryKey: ['swaps', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      return fetchJson<{ data: SwapRequestResponse[] }>(`/api/swaps?${params}`);
    },
    staleTime: 20_000,
  });
}

/** Kandidat rekan tukar (satu role, beda shift) untuk sebuah tanggal. */
export function useSwapCandidates(date: string | null) {
  return useQuery({
    queryKey: ['swap-candidates', date],
    enabled: !!date,
    queryFn: () =>
      fetchJson<{ requesterShift: string | null; candidates: SwapCandidate[] }>(
        `/api/swaps/candidates?date=${date}`
      ),
    staleTime: 10_000,
  });
}

/** Ajukan tukar shift. */
export function useCreateSwap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSwapInput) =>
      fetchJson<SwapRequestResponse>('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['swaps'] }),
  });
}

/** Aksi pada pengajuan tukar (peer_accept/peer_reject/approve/reject). */
export function useReviewSwap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ReviewSwapInput & { id: string }) =>
      fetchJson<{ data: { id: string; status: string } }>(`/api/swaps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/** Batalkan pengajuan tukar milik sendiri. */
export function useDeleteSwap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ data: { id: string } }>(`/api/swaps/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['swaps'] }),
  });
}

/** Jadwal piket kebersihan satu bulan. */
export function usePiket(month: string) {
  return useQuery({
    queryKey: ['piket', month],
    queryFn: () => fetchJson<PiketResponse>(`/api/piket?month=${month}`),
    staleTime: 30_000,
  });
}

/** Simpan jadwal piket satu bulan (administrator). */
export function useSavePiket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertPiketInput) =>
      fetchJson<{ data: { month: string; saved: number } }>('/api/piket', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['piket'] }),
  });
}

/** Tandai piket sudah/belum dilakukan. */
export function useMarkPiketDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarkPiketDoneInput) =>
      fetchJson<{ data: { date: string; done: boolean } }>('/api/piket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['piket'] }),
  });
}
