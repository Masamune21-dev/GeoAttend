'use client';

import { MapPin, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { GeoCoordinates } from '@/lib/geo/types';
import type { GeofenceResponse } from '@/types/api';
import { formatDistance } from '@/lib/geo/distance';
import { GPS_WEAK_ACCURACY_THRESHOLD } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface LocationStatusProps {
  coords: GeoCoordinates | null;
  error: string | null;
  geofence: GeofenceResponse | null | undefined;
  distanceMeters: number | null;
  isInside: boolean;
}

export function LocationStatus({
  coords,
  error,
  geofence,
  distanceMeters,
  isInside,
}: LocationStatusProps) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-destructive-subtle p-3 text-sm text-destructive">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{error}</p>
      </div>
    );
  }

  if (!coords) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-secondary p-3 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <p>Mencari sinyal GPS...</p>
      </div>
    );
  }

  const isWeakSignal = (coords.accuracy ?? 0) > GPS_WEAK_ACCURACY_THRESHOLD;

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div
        className={cn(
          'flex items-start gap-2 rounded-md p-3 text-sm',
          !geofence
            ? 'bg-warning-subtle text-amber-700'
            : isInside
              ? 'bg-success-subtle text-green-700'
              : 'bg-destructive-subtle text-destructive'
        )}
      >
        {!geofence ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : isInside ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <div>
          {!geofence ? (
            <p className="font-medium">Geofence belum dikonfigurasi admin</p>
          ) : isInside ? (
            <p className="font-medium">Anda berada di dalam area absensi</p>
          ) : (
            <p className="font-medium">
              Anda berada di luar area absensi
              {distanceMeters != null && ` (jarak: ${formatDistance(distanceMeters)})`}
            </p>
          )}
          {geofence && (
            <p className="mt-0.5 text-xs opacity-80">
              <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
              {geofence.name} · radius {formatDistance(geofence.radiusMeters)}
              {distanceMeters != null && isInside && ` · jarak Anda ${formatDistance(distanceMeters)}`}
            </p>
          )}
        </div>
      </div>

      {isWeakSignal && (
        <div className="flex items-start gap-2 rounded-md bg-warning-subtle p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Sinyal GPS lemah (akurasi ±{Math.round(coords.accuracy ?? 0)}m). Pindah ke area
            terbuka untuk hasil lebih akurat.
          </p>
        </div>
      )}
    </div>
  );
}
