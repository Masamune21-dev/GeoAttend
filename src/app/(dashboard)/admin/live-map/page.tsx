'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { startOfDay } from 'date-fns';
import { Eye, EyeOff, Radio, Users } from 'lucide-react';
import { useAttendanceList, useGeofence, useLiveLocations } from '@/hooks/useAttendance';
import type { AttendanceRecordResponse } from '@/types/api';
import type { LiveMarkerData } from '@/components/features/map/LiveMap';
import { LiveAttendeeList } from '@/components/features/map/LiveAttendeeList';
import { haversineDistance } from '@/lib/geo/distance';
import { LIVE_FRESHNESS_MS, LIVE_MAP_POLL_INTERVAL } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const LiveMap = dynamic(() => import('@/components/features/map/LiveMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export default function LiveMapPage() {
  const [showGeofence, setShowGeofence] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Naik tiap klik daftar — klik ulang pada orang yang sama tetap memusatkan peta.
  const [focusNonce, setFocusNonce] = useState(0);

  const focusUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setFocusNonce((n) => n + 1);
  }, []);

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

  // Gabungkan dengan posisi live. Posisi live yang KEDALUWARSA tetap dipakai —
  // karyawan yang berhenti bergerak berhenti mengirim update, dan titik
  // terakhirnya jauh lebih benar daripada titik absen. Yang berubah hanya
  // labelnya ('stale'), bukan koordinatnya. Titik absen hanya dipakai bila
  // karyawan belum pernah mengirim posisi live sama sekali.
  const markers = useMemo<LiveMarkerData[]>(() => {
    const liveByUser = new Map((liveData?.data ?? []).map((l) => [l.userId, l]));
    const now = Date.now();
    return presentRecords.map((record) => {
      const live = liveByUser.get(record.userId);
      if (!live) return { ...record, positionSource: 'attendance' as const };

      const isFresh = now - new Date(live.updatedAt).getTime() < LIVE_FRESHNESS_MS;
      const distance = geofence
        ? haversineDistance(
            live.latitude,
            live.longitude,
            geofence.latitude,
            geofence.longitude
          )
        : record.distanceFromCenter;

      return {
        ...record,
        latitude: live.latitude,
        longitude: live.longitude,
        accuracyMeters: live.accuracyMeters,
        // Dihitung ulang dari posisi live: karyawan yang absen di kantor lalu
        // pergi ke lapangan harus terhitung "luar area", bukan tetap "dalam area".
        isWithinGeofence: geofence
          ? distance <= geofence.radiusMeters
          : record.isWithinGeofence,
        distanceFromCenter: distance,
        positionSource: isFresh ? ('live' as const) : ('stale' as const),
        lastUpdate: live.updatedAt,
      };
    });
  }, [presentRecords, liveData, geofence]);

  const liveCount = markers.filter((m) => m.positionSource === 'live').length;
  const staleCount = markers.filter((m) => m.positionSource === 'stale').length;
  const withinCount = markers.filter((m) => m.isWithinGeofence).length;

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
        {staleCount > 0 && <Badge variant="secondary">{staleCount} terakhir diketahui</Badge>}
        <Badge variant="success">{withinCount} dalam area</Badge>
        {markers.length - withinCount > 0 && (
          <Badge variant="destructive">{markers.length - withinCount} luar area</Badge>
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="min-h-[240px] flex-1 overflow-hidden rounded-lg border border-border">
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
            <LiveMap
              records={markers}
              geofence={geofence ?? null}
              showGeofence={showGeofence}
              selectedUserId={selectedUserId}
              focusNonce={focusNonce}
              onSelectUser={setSelectedUserId}
            />
          )}
        </div>

        {/* Jalur akses ke karyawan yang marker-nya bertumpuk di satu titik. */}
        {isLoading ? (
          <Skeleton className="h-40 w-full lg:h-auto lg:w-80 lg:shrink-0" />
        ) : (
          <LiveAttendeeList
            records={markers}
            selectedUserId={selectedUserId}
            onSelect={focusUser}
            className="h-56 lg:h-auto lg:w-80 lg:shrink-0"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-green-600" /> Live — posisi terkini
          (update ≤ {Math.round(LIVE_FRESHNESS_MS / 60_000)} menit)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-400" /> Posisi terakhir diketahui
          (app tertutup / sinyal hilang)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" /> Posisi saat absen (belum
          pernah melapor)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive" /> Di luar area
        </span>
      </div>
    </div>
  );
}
