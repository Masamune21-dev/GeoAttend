'use client';

import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { AlertTriangle, Clock, MapPin, Route, Timer } from 'lucide-react';
import { useGeofence, useLocationTrail, type TrailTarget } from '@/hooks/useAttendance';
import type { AttendanceRecordResponse } from '@/types/api';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistance } from '@/lib/geo/distance';
import { formatTime } from '@/lib/utils';

const TrailMap = dynamic(() => import('@/components/features/map/TrailMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface LocationTrailDialogProps {
  target: TrailTarget | null;
  onClose: () => void;
}

function PhotoCard({
  record,
  label,
}: {
  record: AttendanceRecordResponse | null;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {record ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={record.photoUrl}
            alt={`Foto ${label.toLowerCase()} ${record.userName}`}
            className="aspect-[3/4] w-full rounded-lg object-cover"
          />
          <span className="text-sm text-text-primary">{formatTime(record.timestamp)}</span>
        </>
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-border text-center text-xs text-text-secondary">
          Tidak ada
        </div>
      )}
    </div>
  );
}

/**
 * Riwayat lokasi satu sesi kerja: rute perjalanan, titik berhenti, dan foto
 * absen masuk & pulang. Dibuka dari tabel Detail Harian di rekap bulanan.
 */
export function LocationTrailDialog({ target, onClose }: LocationTrailDialogProps) {
  const { data, isLoading, error } = useLocationTrail(target);
  const { data: geofence } = useGeofence();
  const trail = data?.data;

  const dateLabel = target
    ? format(new Date(`${target.date}T00:00:00`), 'EEEE, dd MMMM yyyy', { locale: localeId })
    : '';
  const mockedCount = trail?.points.filter((p) => p.isMocked).length ?? 0;

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={`Riwayat Lokasi — ${target?.userName ?? ''}`}
      className="md:max-w-3xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{dateLabel}</p>

        {isLoading ? (
          <Skeleton className="h-[320px] w-full md:h-[420px]" />
        ) : error || !trail ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">
            Tidak ada sesi kerja pada tanggal ini.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {trail.sessionStart ? formatTime(trail.sessionStart) : '--:--'} –{' '}
                {trail.sessionEnd ? formatTime(trail.sessionEnd) : 'belum pulang'}
              </Badge>
              <Badge variant="secondary">
                <Route className="h-3 w-3" aria-hidden="true" />
                {formatDistance(trail.totalDistanceMeters)}
              </Badge>
              <Badge variant="secondary">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {trail.points.length} titik
              </Badge>
              {trail.stops.length > 0 && (
                <Badge variant="warning">
                  <Timer className="h-3 w-3" aria-hidden="true" />
                  {trail.stops.length} perhentian
                </Badge>
              )}
              {mockedCount > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {mockedCount} titik lokasi palsu
                </Badge>
              )}
            </div>

            <div className="h-[320px] overflow-hidden rounded-lg border border-border md:h-[420px]">
              <TrailMap
                key={`${trail.userId}-${trail.date}-${trail.sessionStart ?? 'x'}`}
                points={trail.points}
                stops={trail.stops}
                clockIn={trail.clockIn}
                clockOut={trail.clockOut}
                geofence={geofence ?? null}
              />
            </div>

            {trail.points.length === 0 && (
              <p className="rounded-lg bg-background p-3 text-sm text-text-secondary">
                Belum ada jejak lokasi pada sesi ini — aplikasi mobile belum terpasang,
                pelacakan tidak aktif, atau versi aplikasi belum mendukung perekaman jejak.
              </p>
            )}
            {trail.truncated && (
              <p className="text-xs text-text-secondary">
                Jejak sangat panjang — hanya sebagian awal sesi yang ditampilkan.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <PhotoCard record={trail.clockIn} label="Absen Masuk" />
              <PhotoCard record={trail.clockOut} label="Absen Pulang" />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
