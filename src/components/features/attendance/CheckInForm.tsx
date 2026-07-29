'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarCheck, CheckCircle2, Clock, LogIn, LogOut, Palmtree, Zap } from 'lucide-react';
import { useSession } from '@/lib/auth/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  useCreateAttendance,
  useGeofence,
  useOpenSession,
  useShifts,
} from '@/hooks/useAttendance';
import { useSchedule } from '@/hooks/useSchedule';
import { haversineDistance } from '@/lib/geo/distance';
import { toLocalDateString } from '@/lib/leaves';
import { toLocalMonth } from '@/lib/schedule/rotation';
import { shiftOnDate, shiftToNumber } from '@/lib/schedule/libur';
import { pickShift, type ShiftTime } from '@/lib/shifts/calc';
import { CameraCapture } from './CameraCapture';
import { LeaveSection } from './LeaveSection';
import { LocationStatus } from './LocationStatus';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatTime } from '@/lib/utils';

export function CheckInForm() {
  const { data: session } = useSession();
  const { coords, error: geoError } = useGeolocation();
  const { data: geofence, isLoading: geofenceLoading } = useGeofence();
  const { data: sessionData, isLoading: sessionLoading } = useOpenSession();
  const { data: shiftsData, isLoading: shiftsLoading } = useShifts();
  const today = toLocalDateString(new Date());
  const { data: scheduleData } = useSchedule(toLocalMonth(new Date()), 'self');
  const createAttendance = useCreateAttendance();

  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  /** Judul layar konfirmasi setelah kirim (null = belum kirim apa pun). */
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [manualShift, setManualShift] = useState<number | null>(null);
  /** Karyawan menekan "Mulai Lembur Urgent" (hanya relevan saat belum ada sesi). */
  const [overtimeMode, setOvertimeMode] = useState(false);

  const lastRecord = sessionData?.lastRecord ?? undefined;
  const nextType: 'clock_in' | 'clock_out' =
    sessionData?.isOpen ? 'clock_out' : 'clock_in';

  // Jenis sesi yang sedang dikerjakan. Saat menutup sesi, jenisnya WAJIB
  // mengikuti sesi yang terbuka — tidak bisa membuka lembur lalu menutupnya
  // sebagai absen shift (server juga menegakkan aturan ini).
  const kind: 'shift' | 'lembur' =
    nextType === 'clock_out' ? lastRecord?.kind ?? 'shift' : overtimeMode ? 'lembur' : 'shift';
  const isOvertime = kind === 'lembur';

  // Shift milik role user login (untuk pilihan shift saat absen)
  const roleShifts: ShiftTime[] = useMemo(() => {
    const role = session?.user.role;
    if (!role) return [];
    return (shiftsData?.data ?? [])
      .filter((s) => s.role === role)
      .map((s) => ({
        role: s.role,
        shiftNumber: s.shiftNumber,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
      .sort((a, b) => a.shiftNumber - b.shiftNumber);
  }, [session?.user.role, shiftsData]);

  // Jadwal shift HARI INI milik user login ('1' | '2' | 'libur' | null bila belum
  // dijadwalkan). Dipakai untuk banner "hari ini jadwal kamu …" dan default shift.
  const todayShift = useMemo(
    () => shiftOnDate(scheduleData?.entries ?? [], session?.user.id, today),
    [scheduleData, session?.user.id, today]
  );
  const scheduledShiftNumber = shiftToNumber(todayShift);
  const scheduledShift = useMemo(
    () => roleShifts.find((s) => s.shiftNumber === scheduledShiftNumber) ?? null,
    [roleShifts, scheduledShiftNumber]
  );

  // Default shift: absen pulang mengikuti shift absen masuk sesi berjalan (record
  // terakhir saat sesi terbuka = clock-in-nya); absen masuk memakai shift dari
  // JADWAL hari ini, dan bila tidak terjadwal baru jatuh ke shift dengan jam
  // masuk terdekat dari sekarang.
  const defaultShift = useMemo(() => {
    if (roleShifts.length === 0) return null;
    if (
      nextType === 'clock_out' &&
      lastRecord?.shiftNumber != null &&
      roleShifts.some((s) => s.shiftNumber === lastRecord.shiftNumber)
    ) {
      return lastRecord.shiftNumber;
    }
    if (scheduledShift) return scheduledShift.shiftNumber;
    return pickShift(new Date(), roleShifts)?.shiftNumber ?? null;
  }, [roleShifts, nextType, lastRecord, scheduledShift]);

  const selectedShift =
    manualShift != null && roleShifts.some((s) => s.shiftNumber === manualShift)
      ? manualShift
      : defaultShift;

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

  // Absen masuk & pulang sama-sama boleh di luar area. Absen MASUK di luar area
  // (mis. teknisi langsung ke lapangan) wajib disertai alasan. Untuk LEMBUR
  // URGENT, di luar area itu wajar (lokasi pelanggan) — tapi alasan/gangguan
  // selalu wajib karena lembur berujung ke perhitungan upah.
  const isOutside = Boolean(coords && geofence && !isInside);
  const needReason = isOvertime
    ? nextType === 'clock_in'
    : nextType === 'clock_in' && isOutside;
  const canSubmit =
    Boolean(coords && photo) &&
    (!needReason || notes.trim().length > 0) &&
    !createAttendance.isPending;

  const handleSubmit = () => {
    if (!coords || !photo) return;

    createAttendance.mutate(
      {
        type: nextType,
        kind,
        shiftNumber: isOvertime ? undefined : selectedShift ?? undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
        photoBase64: photo,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            isOvertime
              ? nextType === 'clock_in'
                ? 'Lembur urgent dimulai — menunggu verifikasi admin'
                : 'Lembur selesai & tercatat'
              : nextType === 'clock_in'
                ? 'Absen masuk berhasil dicatat'
                : 'Absen pulang berhasil dicatat'
          );
          setPhoto(null);
          setNotes('');
          setManualShift(null);
          setOvertimeMode(false);
          setSubmittedTitle(
            isOvertime
              ? nextType === 'clock_in'
                ? 'Lembur Dimulai!'
                : 'Lembur Selesai!'
              : 'Absensi Tercatat!'
          );
        },
        onError: (err: Error & { code?: string }) => {
          switch (err.code) {
            case 'GEOFENCE_VIOLATION':
            case 'GEOFENCE_REASON_REQUIRED':
            case 'OVERTIME_REASON_REQUIRED':
              toast.error(err.message);
              break;
            case 'DUPLICATE_CHECKIN':
              toast.warning('Anda sudah absen masuk dan belum absen pulang');
              break;
            case 'INVALID_SEQUENCE':
              toast.warning('Anda harus absen masuk terlebih dahulu');
              break;
            case 'INVALID_SHIFT':
              toast.error('Shift yang dipilih tidak tersedia untuk role Anda');
              break;
            default:
              toast.error(err.message || 'Tidak dapat terhubung ke server');
          }
        },
      }
    );
  };

  if (geofenceLoading || sessionLoading || shiftsLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="aspect-[3/4] w-full md:aspect-video" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (submittedTitle) {
    return (
      <Card className="animate-scale-in">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success-subtle">
            <CheckCircle2 className="h-11 w-11 text-success" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight text-text-primary">
              {submittedTitle}
            </p>
            <p className="mt-1 text-sm text-text-secondary tabular-nums">
              {formatTime(new Date())} — data Anda sudah tersimpan.
            </p>
          </div>
          <Button variant="outline" onClick={() => setSubmittedTitle(null)}>
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
              {isOvertime ? (
                <>
                  <Zap className="h-5 w-5 text-warning" aria-hidden="true" />
                  {nextType === 'clock_in' ? 'Mulai Lembur Urgent' : 'Selesai Lembur'}
                </>
              ) : nextType === 'clock_in' ? (
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
                {isOvertime && nextType === 'clock_out' ? (
                  <>Lembur berjalan sejak pukul {formatTime(lastRecord.timestamp)}</>
                ) : (
                  <>
                    Terakhir: {lastRecord.type === 'clock_in' ? 'masuk' : 'pulang'}
                    {lastRecord.shiftNumber != null && ` (Shift ${lastRecord.shiftNumber})`} pukul{' '}
                    {formatTime(lastRecord.timestamp)}
                  </>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Sesi lembur urgent — jadwal shift tidak relevan, jadi diganti penjelasan */}
            {isOvertime ? (
              <Alert variant="warning" hideIcon>
                <span className="flex items-start gap-2.5">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {nextType === 'clock_in' ? (
                      <>
                        <strong>Lembur di luar jam shift.</strong> Seluruh durasinya dihitung
                        lembur — tidak ada telat atau pulang cepat. Boleh di lokasi pelanggan,
                        di luar area kantor.
                      </>
                    ) : (
                      <>
                        <strong>Tutup sesi lembur.</strong> Ambil <strong>foto hasil
                        perbaikan</strong> sebagai bukti pekerjaan selesai.
                      </>
                    )}
                  </span>
                </span>
              </Alert>
            ) : /* Jadwal hari ini — supaya karyawan tahu shift-nya tanpa buka halaman Jadwal */
            todayShift === 'libur' ? (
              <Alert variant="warning" hideIcon>
                <span className="flex items-start gap-2.5">
                  <Palmtree className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <strong>Hari ini kamu Libur.</strong> Sudah otomatis tercatat di rekap —
                    tidak perlu menandai apa pun. Tetap bisa absen bila diminta masuk.
                  </span>
                </span>
              </Alert>
            ) : todayShift ? (
              <Alert variant="info" hideIcon>
                <span className="flex items-start gap-2.5">
                  <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Hari ini jadwal kamu <strong>Shift {todayShift}</strong>
                    {scheduledShift && (
                      <span className="tabular-nums">
                        {' '}
                        · {scheduledShift.startTime}–{scheduledShift.endTime}
                      </span>
                    )}
                  </span>
                </span>
              </Alert>
            ) : (
              <Alert variant="info" hideIcon>
                <span className="flex items-start gap-2.5">
                  <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Hari ini kamu belum dijadwalkan shift.</span>
                </span>
              </Alert>
            )}

            {!isOvertime && roleShifts.length >= 2 && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-text-primary">
                  Pilih Shift
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {roleShifts.map((shift) => {
                    const isSelected = selectedShift === shift.shiftNumber;
                    return (
                      <button
                        key={shift.shiftNumber}
                        type="button"
                        onClick={() => setManualShift(shift.shiftNumber)}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-md border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          isSelected
                            ? 'border-primary bg-primary-subtle font-semibold text-primary'
                            : 'border-border bg-white text-text-primary hover:bg-secondary'
                        )}
                      >
                        <span>Shift {shift.shiftNumber}</span>
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            isSelected ? 'text-primary' : 'text-text-secondary'
                          )}
                        >
                          {shift.startTime}–{shift.endTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {nextType === 'clock_out' ? (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    Otomatis mengikuti shift absen masuk hari ini — ubah bila perlu.
                  </p>
                ) : scheduledShift ? (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    Otomatis mengikuti jadwal hari ini — ubah bila perlu.
                  </p>
                ) : null}
              </fieldset>
            )}
            <LocationStatus
              coords={coords}
              error={geoError}
              geofence={geofence}
              distanceMeters={distanceMeters}
              isInside={isInside}
            />
          </CardContent>
        </Card>

        <LeaveSection scheduledLibur={todayShift === 'libur'} />
      </div>

      <div className="flex flex-col gap-4">
        <CameraCapture
          capturedImage={photo}
          onCapture={setPhoto}
          onRetake={() => setPhoto(null)}
        />

        {photo && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">
              {isOvertime && nextType === 'clock_in'
                ? 'Alasan / gangguan yang ditangani (wajib)'
                : needReason
                  ? 'Alasan absen di luar area (wajib)'
                  : 'Catatan (opsional)'}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={
                isOvertime && nextType === 'clock_in'
                  ? 'Contoh: FO putus Jl. Merdeka — tiket #1234'
                  : needReason
                    ? 'Contoh: Langsung ke lapangan / lokasi pelanggan'
                    : 'Contoh: Datang tepat waktu'
              }
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
            : isOvertime
              ? nextType === 'clock_in'
                ? 'Mulai Lembur Urgent'
                : 'Selesai Lembur'
              : nextType === 'clock_in'
                ? 'Kirim Absen Masuk'
                : 'Kirim Absen Pulang'}
        </Button>

        {/* Pintu masuk lembur urgent — hanya saat tidak ada sesi berjalan, supaya
            sesi shift & sesi lembur tidak pernah terbuka bersamaan. */}
        {nextType === 'clock_in' &&
          (overtimeMode ? (
            <Button variant="ghost" onClick={() => setOvertimeMode(false)}>
              Batal, kembali ke absen biasa
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOvertimeMode(true)}>
              <Zap className="h-4 w-4 text-warning" aria-hidden="true" />
              Dipanggil lembur? Mulai Lembur Urgent
            </Button>
          ))}

        {!photo && (
          <p className="text-center text-xs text-text-secondary">
            Ambil foto terlebih dahulu untuk mengaktifkan tombol kirim
          </p>
        )}
        {isOutside && !isOvertime && (
          <p className="text-center text-xs text-text-secondary">
            {nextType === 'clock_out'
              ? 'Anda di luar area — absen pulang tetap bisa dan tercatat sebagai “luar area”.'
              : 'Anda di luar area — absen masuk tetap bisa, wajib isi alasan (mis. langsung ke lapangan).'}
          </p>
        )}
        {photo && needReason && !notes.trim() && (
          <p className="text-center text-xs font-medium text-amber-700">
            Isi alasan dulu untuk mengaktifkan tombol kirim.
          </p>
        )}
      </div>
    </div>
  );
}
