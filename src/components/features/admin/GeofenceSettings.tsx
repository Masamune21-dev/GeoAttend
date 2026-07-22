'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useGeofence } from '@/hooks/useAttendance';
import type { UpdateGeofenceInput } from '@/types/api';
import {
  DEFAULT_MAP_CENTER,
  MAX_GEOFENCE_RADIUS,
  MIN_GEOFENCE_RADIUS,
} from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistance } from '@/lib/geo/distance';

const GeofenceEditorMap = dynamic(
  () => import('@/components/features/map/GeofenceEditorMap'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

/** Tab "Area Absensi": editor geofence interaktif. */
export function GeofenceSettings() {
  const queryClient = useQueryClient();
  const { data: geofence, isLoading } = useGeofence();

  const [form, setForm] = useState<UpdateGeofenceInput>({
    name: 'Kantor Pusat',
    latitude: DEFAULT_MAP_CENTER[0],
    longitude: DEFAULT_MAP_CENTER[1],
    radiusMeters: 100,
    isActive: true,
  });

  useEffect(() => {
    if (geofence) {
      setForm({
        name: geofence.name,
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        radiusMeters: geofence.radiusMeters,
        isActive: geofence.isActive,
      });
    }
  }, [geofence]);

  const saveMutation = useMutation({
    mutationFn: async (input: UpdateGeofenceInput) => {
      const res = await fetch('/api/geofence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal menyimpan geofence');
      return body;
    },
    onSuccess: () => {
      toast.success('Konfigurasi geofence tersimpan');
      queryClient.invalidateQueries({ queryKey: ['geofence'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isValidCoords =
    form.latitude >= -90 && form.latitude <= 90 && form.longitude >= -180 && form.longitude <= 180;

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Area Absensi</CardTitle>
          <CardDescription>
            Seret pin atau klik peta untuk memindahkan pusat area. Karyawan hanya bisa absen
            di dalam lingkaran ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gf-name">Nama Lokasi</Label>
            <Input
              id="gf-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Kantor Pusat Jakarta"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gf-lat">Latitude</Label>
              <Input
                id="gf-lat"
                type="number"
                step="0.0000001"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: Number(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gf-lng">Longitude</Label>
              <Input
                id="gf-lng"
                type="number"
                step="0.0000001"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gf-radius">
              Radius: <strong>{formatDistance(form.radiusMeters)}</strong>
            </Label>
            <input
              id="gf-radius"
              type="range"
              min={MIN_GEOFENCE_RADIUS}
              max={MAX_GEOFENCE_RADIUS}
              step={10}
              value={form.radiusMeters}
              onChange={(e) => setForm((f) => ({ ...f, radiusMeters: Number(e.target.value) }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{MIN_GEOFENCE_RADIUS}m</span>
              <span>{MAX_GEOFENCE_RADIUS / 1000}km</span>
            </div>
          </div>

          {!isValidCoords && (
            <p role="alert" className="text-sm text-destructive">
              Koordinat tidak valid (lat: -90..90, lng: -180..180)
            </p>
          )}

          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={!isValidCoords || form.name.trim().length === 0}
            isLoading={saveMutation.isPending}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Simpan Konfigurasi
          </Button>
        </CardContent>
      </Card>

      <div className="h-[420px] overflow-hidden rounded-xl border border-border lg:h-auto lg:min-h-[480px]">
        <GeofenceEditorMap
          latitude={form.latitude}
          longitude={form.longitude}
          radiusMeters={form.radiusMeters}
          onPositionChange={(lat, lng) =>
            setForm((f) => ({
              ...f,
              latitude: Math.round(lat * 1e7) / 1e7,
              longitude: Math.round(lng * 1e7) / 1e7,
            }))
          }
        />
      </div>
    </div>
  );
}
