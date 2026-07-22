'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { startOfDay } from 'date-fns';
import { Eye, EyeOff, Radio, Users } from 'lucide-react';
import { useAttendanceList, useGeofence, useLiveLocations } from '@/hooks/useAttendance';
import type { AttendanceRecordResponse } from '@/types/api';
import type { LiveMarkerData } from '@/components/features/map/LiveMap';
import { LIVE_MAP_POLL_INTERVAL } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const LiveMap = dynamic(() => import('@/components/features/map/LiveMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

/** Posisi live dianggap segar bila update terakhir < 90 detik lalu. */
const LIVE_FRESHNESS_MS = 90_000;

export default function LiveMapPage() {
  const [showGeofence, setShowGeofence] = useState(true);

  const { data: geofence } = useGeofence();
  const { data, isLoading } = useAttendanceList(
    { from: startOfDay(new Date()).toISOString(), limit: 100 },
    { refetchInterval: LIVE_MAP_POLL_INTERVAL }
  );
  const { data: liveData } = useLiveLocations();

  const records = useMemo(() => data?.data ?? [], [data]);

  // Hanya tampilkan pengguna yang masih hadir: ambil record TERAKHIR per user,
  // lalu buang yang statusnya sudah clock_out (sudah pulang).
  const presentRecords = useMemo(() => {
    const latestByUser = new Map<string, AttendanceRecordResponse>();
    // API mengembalikan urutan timestamp desc → record pertama per user = terbaru
    for (const record of records) {
      if (!latestByUser.has(record.userId)) {
        latestByUser.set(record.userId, record);
      }
    }
    return Array.from(latestByUser.values()).filter((r) => r.type === 'clock_in');
  }, [records]);

  // Gabungkan dengan posisi live: bila ada update segar, marker pindah
  // ke posisi terkini karyawan (pelacakan lapangan); bila tidak, tampilkan
  // posisi terakhir yang diketahui (saat absen).
  const markers = useMemo<LiveMarkerData[]>(() => {
    const liveByUser = new Map((liveData?.data ?? []).map((l) => [l.userId, l]));
    const now = Date.now();
    return presentRecords.map((record) => {
      const live = liveByUser.get(record.userId);
      const isFresh =
        live !== undefined && now - new Date(live.updatedAt).getTime() < LIVE_FRESHNESS_MS;
      if (!isFresh) return record;
      return {
        ...record,
        latitude: live.latitude,
        longitude: live.longitude,
        isLive: true,
        lastUpdate: live.updatedAt,
      };
    });
  }, [presentRecords, liveData]);

  const liveCount = markers.filter((m) => m.isLive).length;
  const withinCount = presentRecords.filter((r) => r.isWithinGeofence).length;

  return (
    <div className="flex h-[calc(100dvh-160px)] flex-col gap-3 md:h-[calc(100dvh-120px)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          <Users className="h-3 w-3" aria-hidden="true" />
          {presentRecords.length} sedang hadir
        </Badge>
        <Badge variant="success">
          <Radio className="h-3 w-3" aria-hidden="true" />
          {liveCount} live
        </Badge>
        <Badge variant="success">{withinCount} dalam area</Badge>
        {presentRecords.length - withinCount > 0 && (
          <Badge variant="destructive">{presentRecords.length - withinCount} luar area</Badge>
        )}
        <Badge variant="secondary">{records.length} total absensi hari ini</Badge>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setShowGeofence((v) => !v)}
        >
          {showGeofence ? (
            <>
              <EyeOff className="h-4 w-4" aria-hidden="true" /> Sembunyikan Geofence
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" aria-hidden="true" /> Tampilkan Geofence
            </>
          )}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : presentRecords.length === 0 && !geofence ? (
          <div className="flex h-full items-center justify-center bg-surface">
            <p className="text-sm text-text-secondary">
              {records.length > 0
                ? 'Semua karyawan sudah absen pulang'
                : 'Belum ada absensi hari ini'}
            </p>
          </div>
        ) : (
          <LiveMap records={markers} geofence={geofence ?? null} showGeofence={showGeofence} />
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-green-600" /> Live — posisi terkini
          (update ≤ 90 detik)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" /> Posisi saat absen (app
          karyawan tertutup)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive" /> Absen di luar area
        </span>
      </div>
    </div>
  );
}
