'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStockCategoryInput,
  CreateStockItemInput,
  CreateStockMovementInput,
  PaginatedResponse,
  StockCategoryResponse,
  StockItemResponse,
  StockMovementResponse,
  StockOverviewResponse,
  UpdateStockItemInput,
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

const jsonInit = (method: string, payload: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

/** Invalidasi seluruh cache stok setelah perubahan data. */
function invalidateStock(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['stock'] });
}

// ---------- Overview ----------

export function useStockOverview(period?: { from: string; to: string }) {
  return useQuery({
    queryKey: ['stock', 'overview', period ?? null],
    queryFn: () => {
      const params = new URLSearchParams();
      if (period) {
        params.set('from', period.from);
        params.set('to', period.to);
      }
      return fetchJson<StockOverviewResponse>(`/api/stock/overview?${params}`);
    },
    staleTime: 30_000,
  });
}

// ---------- Kategori ----------

export function useStockCategories() {
  return useQuery({
    queryKey: ['stock', 'categories'],
    queryFn: () => fetchJson<{ data: StockCategoryResponse[] }>('/api/stock/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useCreateStockCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStockCategoryInput) =>
      fetchJson<StockCategoryResponse>('/api/stock/categories', jsonInit('POST', input)),
    onSuccess: () => invalidateStock(qc),
  });
}

// ---------- Barang ----------

export interface StockItemFilters {
  categoryId?: string;
  search?: string;
  includeInactive?: boolean;
}

export function useStockItems(filters: StockItemFilters = {}) {
  return useQuery({
    queryKey: ['stock', 'items', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.search) params.set('search', filters.search);
      if (filters.includeInactive) params.set('includeInactive', '1');
      return fetchJson<{ data: StockItemResponse[] }>(`/api/stock/items?${params}`);
    },
    staleTime: 15_000,
  });
}

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStockItemInput) =>
      fetchJson<StockItemResponse>('/api/stock/items', jsonInit('POST', input)),
    onSuccess: () => invalidateStock(qc),
  });
}

export function useUpdateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateStockItemInput & { id: string }) =>
      fetchJson<StockItemResponse>(`/api/stock/items/${id}`, jsonInit('PATCH', input)),
    onSuccess: () => invalidateStock(qc),
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`/api/stock/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateStock(qc),
  });
}

// ---------- Pergerakan (masuk/keluar) ----------

export interface MovementFilters {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useStockMovements(filters: MovementFilters = {}) {
  return useQuery({
    queryKey: ['stock', 'movements', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.itemId) params.set('itemId', filters.itemId);
      if (filters.type) params.set('type', filters.type);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      return fetchJson<PaginatedResponse<StockMovementResponse>>(`/api/stock/movements?${params}`);
    },
    staleTime: 15_000,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStockMovementInput) =>
      fetchJson<StockMovementResponse>('/api/stock/movements', jsonInit('POST', input)),
    onSuccess: () => invalidateStock(qc),
  });
}
