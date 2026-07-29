'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Crosshair, MapPin, Search, Users } from 'lucide-react';
import type { LiveMarkerData } from './LiveMap';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDistance } from '@/lib/geo/distance';
import { cn, formatDateTime, formatTime, getInitials } from '@/lib/utils';

interface LiveAttendeeListProps {
  records: LiveMarkerData[];
  selectedUserId: string | null;
  /** Dipanggil saat sebuah baris diklik — peta memusat ke karyawan tersebut. */
  onSelect: (userId: string) => void;
  className?: string;
}

const SOURCE_LABEL: Record<LiveMarkerData['positionSource'], string> = {
  live: 'Live',
  stale: 'Terakhir diketahui',
  attendance: 'Posisi saat absen',
};

const SOURCE_DOT: Record<LiveMarkerData['positionSource'], string> = {
  live: 'bg-green-600',
  stale: 'bg-slate-400',
  attendance: 'bg-primary',
};

/**
 * Daftar karyawan yang sedang hadir, di samping peta live.
 *
 * Alasan keberadaannya: beberapa karyawan yang absen di titik yang sama
 * (mis. satu kantor) menghasilkan marker yang bertumpuk — hanya marker paling
 * atas yang bisa diklik, sisanya tak terjangkau. Daftar ini memberi jalur akses
 * yang pasti ke SETIAP orang: klik baris → peta memusat ke marker-nya sekaligus
 * membuka pratinjau foto absennya.
 */
export function LiveAttendeeList({
  records,
  selectedUserId,
  onSelect,
  className,
}: LiveAttendeeListProps) {
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<LiveMarkerData | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matched = keyword
      ? records.filter((r) => r.userName.toLowerCase().includes(keyword))
      : records;
    // Urut: yang di luar area dulu (paling perlu diperiksa), lalu nama.
    return [...matched].sort((a, b) => {
      if (a.isWithinGeofence !== b.isWithinGeofence) return a.isWithinGeofence ? 1 : -1;
      return a.userName.localeCompare(b.userName, 'id');
    });
  }, [records, query]);

  // Marker yang diklik langsung di peta ikut menyorot barisnya di daftar —
  // termasuk saat baris tersebut sedang di luar area pandang.
  useEffect(() => {
    if (!selectedUserId) return;
    listRef.current
      ?.querySelector(`[data-user-id="${CSS.escape(selectedUserId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedUserId]);

  // Foto absen yang sedang dipratinjau harus ikut hidup bila datanya ter-refresh.
  const previewRecord = preview
    ? (records.find((r) => r.userId === preview.userId) ?? preview)
    : null;

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col rounded-lg border border-border bg-surface',
        className
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-primary">Sedang Hadir</h2>
          <Badge variant="secondary" className="ml-auto">
            {records.length}
          </Badge>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama…"
            aria-label="Cari karyawan"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-4 text-sm text-text-secondary">
          {records.length === 0 ? 'Belum ada yang absen masuk' : 'Nama tidak ditemukan'}
        </p>
      ) : (
        <ul ref={listRef} className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {filtered.map((record) => (
            <li key={record.userId} data-user-id={record.userId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(record.userId);
                  setPreview(record);
                }}
                aria-label={`Lihat foto absen ${record.userName}`}
                className={cn(
                  'flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  record.userId === selectedUserId && 'bg-primary-subtle'
                )}
              >
                {record.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={record.photoUrl}
                    alt={`Foto absen ${record.userName}`}
                    className="h-11 w-11 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white"
                  >
                    {getInitials(record.userName)}
                  </span>
                )}

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-text-primary">
                    {record.userName}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        SOURCE_DOT[record.positionSource]
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {SOURCE_LABEL[record.positionSource]} · masuk{' '}
                      {formatTime(record.timestamp)}
                    </span>
                  </span>
                </span>

                {!record.isWithinGeofence && (
                  <Badge variant="destructive" className="shrink-0">
                    Luar
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={previewRecord !== null}
        onClose={() => setPreview(null)}
        title={previewRecord?.userName}
      >
        {previewRecord && (
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewRecord.photoUrl}
              alt={`Foto absen ${previewRecord.userName}`}
              className="aspect-[3/4] w-full rounded-lg object-cover md:aspect-video"
            />

            <div className="flex flex-col gap-2.5 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-text-primary">
                <Clock className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                Masuk {formatDateTime(previewRecord.timestamp)}
                {previewRecord.shiftNumber != null && (
                  <Badge variant="secondary">Shift {previewRecord.shiftNumber}</Badge>
                )}
                {previewRecord.kind === 'lembur' && <Badge variant="warning">Lembur</Badge>}
              </p>

              <p className="flex flex-wrap items-center gap-2 text-text-primary">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    SOURCE_DOT[previewRecord.positionSource]
                  )}
                  aria-hidden="true"
                />
                {SOURCE_LABEL[previewRecord.positionSource]}
                {previewRecord.lastUpdate && (
                  <span className="text-text-secondary">
                    · update {formatTime(previewRecord.lastUpdate)}
                  </span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <Badge variant={previewRecord.isWithinGeofence ? 'success' : 'destructive'}>
                  {previewRecord.isWithinGeofence ? 'Dalam area' : 'Luar area'}
                </Badge>
                <span className="text-text-secondary">
                  {formatDistance(previewRecord.distanceFromCenter)} dari{' '}
                  {previewRecord.geofenceName ?? 'pusat area'}
                </span>
              </div>

              <p className="flex flex-wrap items-center gap-2 text-text-primary">
                <Crosshair className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                {previewRecord.latitude.toFixed(6)}, {previewRecord.longitude.toFixed(6)}
                {previewRecord.accuracyMeters != null && (
                  <span className="text-text-secondary">
                    (±{Math.round(previewRecord.accuracyMeters)}m)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </Dialog>
    </aside>
  );
}
