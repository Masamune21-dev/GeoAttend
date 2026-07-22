'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, LogIn, LogOut } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  useCreateAttendance,
  useGeofence,
  useTodayAttendance,
} from '@/hooks/useAttendance';
import { haversineDistance } from '@/lib/geo/distance';
import { CameraCapture } from './CameraCapture';
import { LocationStatus } from './LocationStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime } from '@/lib/utils';

export function CheckInForm() {
  const { coords, error: geoError } = useGeolocation();
  const { data: geofence, isLoading: geofenceLoading } = useGeofence();
  const { data: todayData, isLoading: todayLoading } = useTodayAttendance();
  const createAttendance = useCreateAttendance();

  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const todayRecords = todayData?.data ?? [];
  const lastRecord = todayRecords[0];
  const nextType: 'clock_in' | 'clock_out' =
    lastRecord?.type === 'clock_in' ? 'clock_out' : 'clock_in';

  const { distanceMeters, isInside } = useMemo(() => {
    if (!coords || !geofence) {
      return { distanceMeters: null as number | null, isInside: false };
    }
    const distance = haversineDistance(
      coords.latitude,
      coords.longitude,
      geofence.latitude,
      geofence.longitude
    );
    const buffer = Math.min(coords.accuracy ?? 0, 50);
    return {
      distanceMeters: distance,
      isInside: distance <= geofence.radiusMeters + buffer,
    };
  }, [coords, geofence]);

  const canSubmit = Boolean(coords && photo && (isInside || !geofence)) && !createAttendance.isPending;

  const handleSubmit = () => {
    if (!coords || !photo) return;

    createAttendance.mutate(
      {
        type: nextType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
        photoBase64: photo,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            nextType === 'clock_in' ? 'Absen masuk berhasil dicatat' : 'Absen pulang berhasil dicatat'
          );
          setPhoto(null);
          setNotes('');
          setJustSubmitted(true);
        },
        onError: (err: Error & { code?: string }) => {
          switch (err.code) {
            case 'GEOFENCE_VIOLATION':
              toast.error(err.message);
              break;
            case 'DUPLICATE_CHECKIN':
              toast.warning('Anda sudah absen masuk hari ini');
              break;
            case 'INVALID_SEQUENCE':
              toast.warning('Anda harus absen masuk terlebih dahulu');
              break;
            default:
              toast.error(err.message || 'Tidak dapat terhubung ke server');
          }
        },
      }
    );
  };

  if (geofenceLoading || todayLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="aspect-[3/4] w-full md:aspect-video" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (justSubmitted) {
    return (
      <Card className="animate-scale-in">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success-subtle">
            <CheckCircle2 className="h-11 w-11 text-success" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight text-text-primary">
              Absensi Tercatat!
            </p>
            <p className="mt-1 text-sm text-text-secondary tabular-nums">
              {formatTime(new Date())} — data Anda sudah tersimpan.
            </p>
          </div>
          <Button variant="outline" onClick={() => setJustSubmitted(false)}>
            Kembali
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {nextType === 'clock_in' ? (
                <>
                  <LogIn className="h-5 w-5 text-primary" aria-hidden="true" />
                  Absen Masuk
                </>
              ) : (
                <>
                  <LogOut className="h-5 w-5 text-warning" aria-hidden="true" />
                  Absen Pulang
                </>
              )}
            </CardTitle>
            {lastRecord && (
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Terakhir: {lastRecord.type === 'clock_in' ? 'masuk' : 'pulang'} pukul{' '}
                {formatTime(lastRecord.timestamp)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <LocationStatus
              coords={coords}
              error={geoError}
              geofence={geofence}
              distanceMeters={distanceMeters}
              isInside={isInside}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <CameraCapture
          capturedImage={photo}
          onCapture={setPhoto}
          onRetake={() => setPhoto(null)}
        />

        {photo && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-text-primary">
              Catatan (opsional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Contoh: Datang tepat waktu"
              className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        )}

        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          isLoading={createAttendance.isPending}
        >
          {createAttendance.isPending
            ? 'Mengirim...'
            : nextType === 'clock_in'
              ? 'Kirim Absen Masuk'
              : 'Kirim Absen Pulang'}
        </Button>

        {!photo && (
          <p className="text-center text-xs text-text-secondary">
            Ambil foto terlebih dahulu untuk mengaktifkan tombol kirim
          </p>
        )}
      </div>
    </div>
  );
}
