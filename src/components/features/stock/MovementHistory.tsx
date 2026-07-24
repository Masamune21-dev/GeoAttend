'use client';

import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Inbox, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockMovements, type MovementFilters } from '@/hooks/useStock';
import type { StockMovementResponse } from '@/types/api';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TypeBadge({ type }: { type: StockMovementResponse['type'] }) {
  if (type === 'masuk')
    return (
      <Badge variant="success">
        <ArrowDownToLine className="h-3 w-3" /> Masuk
      </Badge>
    );
  if (type === 'keluar')
    return (
      <Badge variant="warning">
        <ArrowUpFromLine className="h-3 w-3" /> Keluar
      </Badge>
    );
  return <Badge variant="secondary">Penyesuaian</Badge>;
}

export function MovementHistory() {
  const [filters, setFilters] = useState<MovementFilters>({ page: 1, limit: 50 });
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const { data, isLoading } = useStockMovements(filters);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const update = (patch: Partial<MovementFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-surface p-3 shadow-card">
        <SlidersHorizontal className="h-4 w-4 shrink-0 self-center text-text-secondary" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Tipe</label>
          <Select
            className="h-9 w-36"
            value={filters.type ?? ''}
            onChange={(e) => update({ type: e.target.value || undefined })}
          >
            <option value="">Semua</option>
            <option value="masuk">Masuk</option>
            <option value="keluar">Keluar</option>
            <option value="adjust">Penyesuaian</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Dari</label>
          <Input
            type="date"
            className="h-9 w-40"
            value={filters.from ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Sampai</label>
          <Input
            type="date"
            className="h-9 w-40"
            value={filters.to ?? ''}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>
        {(filters.type || filters.from || filters.to) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ page: 1, limit: 50 })}
          >
            Reset
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-subtle">
            <Inbox className="h-7 w-7 text-primary" aria-hidden="true" />
          </span>
          <p className="text-sm text-text-secondary">Belum ada pergerakan stok.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2.5 font-semibold">Waktu</th>
                <th className="px-3 py-2.5 font-semibold">Barang</th>
                <th className="px-3 py-2.5 font-semibold">Tipe</th>
                <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
                <th className="px-3 py-2.5 font-semibold">Oleh</th>
                <th className="px-3 py-2.5 font-semibold">Foto</th>
                <th className="px-3 py-2.5 font-semibold">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border/50 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{formatDateTime(m.createdAt)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-text-primary">{m.itemName}</p>
                    <p className="font-mono text-xs text-text-secondary">{m.itemCode}</p>
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge type={m.type} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    <span
                      className={
                        m.type === 'keluar'
                          ? 'text-amber-700'
                          : m.type === 'masuk'
                            ? 'text-green-700'
                            : 'text-text-primary'
                      }
                    >
                      {m.type === 'keluar' ? '−' : m.type === 'masuk' ? '+' : ''}
                      {m.quantity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{m.createdByName ?? '—'}</td>
                  <td className="px-3 py-2">
                    {m.photoUrl ? (
                      <button type="button" onClick={() => setZoomPhoto(m.photoUrl)} aria-label="Lihat foto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.photoUrl} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-border" />
                      </button>
                    ) : (
                      <span className="text-xs text-text-secondary/60">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-text-secondary">{m.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            Halaman {pagination.page} dari {pagination.totalPages} · {pagination.total} data
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => update({ page: pagination.page - 1 })}
            >
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => update({ page: pagination.page + 1 })}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!zoomPhoto} onClose={() => setZoomPhoto(null)} title="Foto Barang">
        {zoomPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={zoomPhoto} alt="Foto barang" className="w-full rounded-lg object-contain" />
        )}
      </Dialog>
    </div>
  );
}
