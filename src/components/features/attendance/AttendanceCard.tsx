'use client';

import { LogIn, LogOut, MapPin } from 'lucide-react';
import type { AttendanceRecordResponse } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { formatDistance } from '@/lib/geo/distance';
import { formatTime, formatDate, cn } from '@/lib/utils';

interface AttendanceCardProps {
  record: AttendanceRecordResponse;
  onClick?: () => void;
  showUserName?: boolean;
  showDate?: boolean;
}

export function AttendanceCard({ record, onClick, showUserName, showDate }: AttendanceCardProps) {
  const isClockIn = record.type === 'clock_in';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border/80 bg-surface p-3 text-left shadow-card transition-all hover:border-slate-300 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isClockIn ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning'
        )}
        aria-hidden="true"
      >
        {isClockIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {showUserName ? record.userName : isClockIn ? 'Absen Masuk' : 'Absen Pulang'}
        </p>
        <p className="text-xs text-text-secondary">
          {showDate ? `${formatDate(record.timestamp)} · ` : ''}
          {formatTime(record.timestamp)}
          {' · '}
          <MapPin className="inline h-3 w-3" aria-hidden="true" />{' '}
          {formatDistance(record.distanceFromCenter)} dari pusat
        </p>
      </div>

      <Badge variant={record.isWithinGeofence ? 'success' : 'destructive'}>
        {record.isWithinGeofence ? 'Dalam area' : 'Luar area'}
      </Badge>
    </button>
  );
}
