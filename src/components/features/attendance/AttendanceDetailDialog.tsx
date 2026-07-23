'use client';

import { MapPin, Clock, Crosshair, StickyNote } from 'lucide-react';
import type { AttendanceRecordResponse } from '@/types/api';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistance } from '@/lib/geo/distance';
import { formatDateTime } from '@/lib/utils';

interface AttendanceDetailDialogProps {
  record: AttendanceRecordResponse | null;
  onClose: () => void;
}

export function AttendanceDetailDialog({ record, onClose }: AttendanceDetailDialogProps) {
  return (
    <Dialog
      open={record !== null}
      onClose={onClose}
      title={record?.type === 'clock_in' ? 'Detail Absen Masuk' : 'Detail Absen Pulang'}
    >
      {record && (
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={record.photoUrl}
            alt={`Foto absensi ${record.userName}`}
            className="aspect-[3/4] w-full rounded-lg object-cover md:aspect-video"
          />

          <div className="flex flex-col gap-2.5 text-sm">
            <p className="flex items-center gap-2 text-text-primary">
              <Clock className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              {formatDateTime(record.timestamp)}
              {record.shiftNumber != null && (
                <Badge variant="secondary">Shift {record.shiftNumber}</Badge>
              )}
            </p>
            <p className="flex items-center gap-2 text-text-primary">
              <Crosshair className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
              {record.accuracyMeters != null && (
                <span className="text-text-secondary">(±{Math.round(record.accuracyMeters)}m)</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <Badge variant={record.isWithinGeofence ? 'success' : 'destructive'}>
                {record.isWithinGeofence ? 'Dalam area' : 'Luar area'}
              </Badge>
              <span className="text-text-secondary">
                {formatDistance(record.distanceFromCenter)} dari{' '}
                {record.geofenceName ?? 'pusat area'}
              </span>
            </div>
            {record.notes && (
              <p className="flex items-start gap-2 text-text-primary">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                {record.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
