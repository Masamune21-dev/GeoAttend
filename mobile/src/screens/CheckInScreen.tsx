import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  Camera,
  CalendarCheck,
  CircleCheck,
  Satellite,
  SwitchCamera,
  TreePalm,
  TriangleAlert,
  UserRound,
  X,
  Zap,
} from 'lucide-react-native';
import { api, ApiRequestError, authImageHeaders, toAbsoluteUrl } from '../api/client';
import type {
  AttendanceKind,
  AttendanceRecordResponse,
  GeofenceResponse,
  PaginatedResponse,
  ScheduleEntry,
  ScheduleResponse,
  ShiftSettingResponse,
} from '../api/types';
import { useSession } from '../auth/session';
import {
  bearingDegrees,
  formatClock,
  formatDistance,
  formatTime,
  haversineDistance,
  toLocalDateString,
} from '../lib/geo';
import { toLocalMonth } from '../lib/schedule';
import { deriveOpenSession, sessionWindowStart } from '../lib/session';
import { pickShift } from '../lib/shifts';
import { isTracking, startTracking, stopTracking } from '../tracking/locationTask';
import { GeofenceRadar } from '../components/GeofenceRadar';
import { Avatar, Button, Card, Field } from '../components/ui';
import { colors, radius, shadow, spacing, type } from '../theme';

const GPS_WEAK_THRESHOLD = 50;

export function CheckInScreen() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [geofence, setGeofence] = useState<GeofenceResponse | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecordResponse[]>([]);
  const [shifts, setShifts] = useState<ShiftSettingResponse[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [manualShift, setManualShift] = useState<number | null>(null);
  /** Karyawan menekan "Mulai Lembur Urgent" (hanya relevan saat belum ada sesi). */
  const [overtimeMode, setOvertimeMode] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null); // data URI JPEG
  const [photoAt, setPhotoAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- Lokasi foreground (indikator jarak) ---
  // Hanya aktif saat layar Absen benar-benar dibuka. Tab bawah membuat layar
  // tetap "mounted" walau pindah tab; tanpa gerbang fokus ini, GPS akurasi
  // tinggi akan terus menyala di tab lain — sumber panas & boros baterai
  // terbesar. Saat pindah tab, langganan dilepas dan GNSS ikut mati.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;

    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setGeoError('Izin lokasi ditolak — aktifkan di pengaturan HP');
        return;
      }
      const subscription = await Location.watchPositionAsync(
        // High tetap dipakai (akurasi penting saat menilai di dalam/luar area),
        // tapi cadence dilonggarkan 5→10 dtk agar GPS punya jeda bernapas.
        { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 10 },
        (loc) => {
          if (!cancelled) {
            setCoords(loc.coords);
            setGeoError(null);
          }
        }
      );
      // Bila layar sudah tak fokus selama menunggu di atas, segera lepas.
      if (cancelled) subscription.remove();
      else sub = subscription;
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [isFocused]);

  // Indikator "Tracking On" di header — status sebenarnya dari task background.
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    isTracking().then((on) => {
      if (active) setTracking(on);
    });
    return () => {
      active = false;
    };
  }, [isFocused, recentRecords]);

  // --- Data server ---
  const loadData = useCallback(async () => {
    // Record terakhir dalam jendela sesi (menembus tengah malam), bukan "hari ini".
    const [geofenceRes, recentRes, shiftsRes, scheduleRes] = await Promise.all([
      api<GeofenceResponse>('/api/geofence').catch((err) =>
        err instanceof ApiRequestError && err.status === 404 ? null : Promise.reject(err)
      ),
      api<PaginatedResponse<AttendanceRecordResponse>>(
        `/api/attendance?userId=self&from=${encodeURIComponent(sessionWindowStart())}&limit=10`
      ),
      api<{ data: ShiftSettingResponse[] }>('/api/shifts'),
      // Jadwal bulan berjalan milik sendiri. Gagal ambil jadwal tidak boleh
      // menghalangi absensi — cukup banner jadwalnya yang kosong.
      api<ScheduleResponse>(
        `/api/schedules?month=${toLocalMonth(new Date())}&userId=self`
      ).catch(() => ({ users: [], entries: [], participantsConfigured: false })),
    ]);
    setGeofence(geofenceRes);
    setRecentRecords(recentRes.data);
    setShifts(shiftsRes.data);
    setScheduleEntries(scheduleRes.entries);
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => Alert.alert('Gagal memuat data', err?.message ?? 'Coba lagi'))
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [loadData]);

  // --- Turunan ---
  const { nextType, openRecord } = useMemo(() => deriveOpenSession(recentRecords), [recentRecords]);
  const lastRecord = recentRecords[0];

  // Jenis sesi yang sedang dikerjakan. Saat menutup sesi, jenisnya WAJIB
  // mengikuti sesi yang terbuka (server juga menegakkan aturan yang sama).
  const kind: AttendanceKind =
    nextType === 'clock_out' ? openRecord?.kind ?? 'shift' : overtimeMode ? 'lembur' : 'shift';
  const isOvertime = kind === 'lembur';

  const roleShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.role === user?.role)
        .sort((a, b) => a.shiftNumber - b.shiftNumber),
    [shifts, user?.role]
  );

  // Jadwal shift HARI INI ('1' | '2' | 'libur' | null bila belum dijadwalkan)
  const today = toLocalDateString(new Date());
  const todayShift = useMemo(
    () => scheduleEntries.find((e) => e.date === today)?.shift ?? null,
    [scheduleEntries, today]
  );
  const scheduledShift = useMemo(
    () =>
      todayShift === '1' || todayShift === '2'
        ? roleShifts.find((s) => s.shiftNumber === Number(todayShift)) ?? null
        : null,
    [roleShifts, todayShift]
  );

  // Absen pulang mengikuti shift absen masuk sesi berjalan; absen masuk memakai
  // shift dari JADWAL hari ini, baru jatuh ke shift dengan jam masuk terdekat.
  const defaultShift = useMemo(() => {
    if (roleShifts.length === 0) return null;
    if (nextType === 'clock_out') {
      // Record terbaru saat sesi terbuka = clock-in-nya (desc, paling atas).
      const lastClockIn = recentRecords.find((r) => r.type === 'clock_in');
      if (
        lastClockIn?.shiftNumber != null &&
        roleShifts.some((s) => s.shiftNumber === lastClockIn.shiftNumber)
      ) {
        return lastClockIn.shiftNumber;
      }
    }
    if (scheduledShift) return scheduledShift.shiftNumber;
    return pickShift(new Date(), roleShifts)?.shiftNumber ?? null;
  }, [roleShifts, nextType, recentRecords, scheduledShift]);

  const selectedShift =
    manualShift != null && roleShifts.some((s) => s.shiftNumber === manualShift)
      ? manualShift
      : defaultShift;

  const { distanceMeters, bearing, isInside } = useMemo(() => {
    if (!coords || !geofence) {
      return { distanceMeters: null as number | null, bearing: null as number | null, isInside: false };
    }
    const d = haversineDistance(
      coords.latitude,
      coords.longitude,
      geofence.latitude,
      geofence.longitude
    );
    const buffer = Math.min(coords.accuracy ?? 0, 50);
    return {
      distanceMeters: d,
      bearing: bearingDegrees(geofence.latitude, geofence.longitude, coords.latitude, coords.longitude),
      isInside: d <= geofence.radiusMeters + buffer,
    };
  }, [coords, geofence]);

  const gpsWeak = (coords?.accuracy ?? 0) > GPS_WEAK_THRESHOLD;

  // --- Kamera ---
  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Kamera diperlukan', 'Izinkan akses kamera di pengaturan HP');
        return;
      }
    }
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!raw?.uri) throw new Error('Gagal mengambil foto');
      // Resize + kompres sesuai kontrak API (maks sisi 1200px, JPEG q0.8)
      const processed = await manipulateAsync(raw.uri, [{ resize: { width: 1200 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
        base64: true,
      });
      setPhoto(`data:image/jpeg;base64,${processed.base64}`);
      setPhotoAt(new Date());
      setCameraOpen(false);
    } catch (err) {
      Alert.alert('Gagal mengambil foto', err instanceof Error ? err.message : 'Coba lagi');
    } finally {
      setCapturing(false);
    }
  };

  // --- Kirim absensi ---
  // Absen masuk & pulang boleh di luar area. Absen MASUK di luar area (mis. teknisi
  // langsung ke lapangan) wajib disertai alasan.
  // Untuk LEMBUR URGENT, di luar area itu wajar (lokasi pelanggan) — tapi
  // alasan/gangguan selalu wajib karena lembur berujung ke perhitungan upah.
  const isOutside = Boolean(coords && geofence && !isInside);
  const needReason = isOvertime ? nextType === 'clock_in' : nextType === 'clock_in' && isOutside;
  const canSubmit =
    Boolean(coords && photo) && (!needReason || notes.trim().length > 0) && !submitting;

  const handleSubmit = async () => {
    if (!coords || !photo) return;
    setSubmitting(true);
    try {
      await api<AttendanceRecordResponse>('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          type: nextType,
          kind,
          shiftNumber: isOvertime ? undefined : selectedShift ?? undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters:
            coords.accuracy != null && coords.accuracy > 0 ? coords.accuracy : undefined,
          photoBase64: photo,
          notes: notes.trim() || undefined,
        }),
      });

      setPhoto(null);
      setPhotoAt(null);
      setNotes('');
      setManualShift(null);
      setOvertimeMode(false);
      await loadData().catch(() => undefined);

      if (nextType === 'clock_in') {
        // Izin "sepanjang waktu" sudah ada → langsung mulai tracking.
        // Belum ada → jelaskan dulu bahwa Android akan MEMBUKA PENGATURAN
        // (bukan keluar aplikasi), lalu biarkan user memilih.
        const title = isOvertime ? 'Lembur urgent dimulai ✓' : 'Absen masuk tercatat ✓';
        const bg = await Location.getBackgroundPermissionsAsync();
        if (bg.granted) {
          await startTracking();
          setTracking(await isTracking());
          Alert.alert(
            title,
            isOvertime
              ? 'Posisi Anda terpantau selama lembur. Jangan lupa tekan "Selesai Lembur" setelah pekerjaan beres — sesi menunggu verifikasi admin.'
              : 'Posisi Anda terpantau selama jam kerja.'
          );
        } else {
          Alert.alert(
            title,
            'Agar posisi tetap terpantau saat aplikasi ditutup, izin lokasi perlu diubah ke "Izinkan sepanjang waktu".\n\nHP akan membuka halaman Pengaturan — setelah memilih, kembali ke aplikasi ini.',
            [
              { text: 'Nanti Saja', style: 'cancel' },
              {
                text: 'Aktifkan Pelacakan',
                onPress: async () => {
                  const ok = await startTracking();
                  setTracking(await isTracking());
                  if (!ok) {
                    Alert.alert(
                      'Pelacakan tidak aktif',
                      'Izin "sepanjang waktu" belum diberikan. Posisi hanya terkirim saat aplikasi terbuka.'
                    );
                  }
                },
              },
            ]
          );
        }
      } else {
        await stopTracking();
        setTracking(false);
        Alert.alert(
          isOvertime ? 'Lembur selesai ✓' : 'Absen pulang tercatat ✓',
          isOvertime
            ? 'Seluruh durasi lembur tercatat. Admin akan memverifikasinya di rekap.'
            : 'Pelacakan posisi dihentikan. Selamat beristirahat!'
        );
      }
    } catch (err) {
      const e = err as ApiRequestError;
      switch (e.code) {
        case 'GEOFENCE_VIOLATION':
        case 'GEOFENCE_REASON_REQUIRED':
          Alert.alert('Di luar area', e.message);
          break;
        case 'OVERTIME_REASON_REQUIRED':
          Alert.alert('Alasan wajib diisi', e.message);
          break;
        case 'DUPLICATE_CHECKIN':
          Alert.alert('Sudah absen', 'Anda sudah absen masuk dan belum absen pulang');
          break;
        case 'INVALID_SEQUENCE':
          Alert.alert('Urutan salah', 'Anda harus absen masuk terlebih dahulu');
          break;
        case 'INVALID_SHIFT':
          Alert.alert('Shift tidak valid', 'Shift yang dipilih tidak tersedia untuk role Anda');
          break;
        default:
          Alert.alert('Gagal mengirim', e.message ?? 'Tidak dapat terhubung ke server');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitTitle = submitting
    ? 'Mengirim...'
    : isOvertime
      ? nextType === 'clock_in'
        ? 'Mulai Lembur Urgent'
        : 'Selesai Lembur'
      : nextType === 'clock_in'
        ? 'Kirim Presensi Masuk'
        : 'Kirim Presensi Pulang';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header putih dengan indikator pelacakan */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Avatar
          name={user?.name ?? '?'}
          size={36}
          uri={toAbsoluteUrl(user?.image)}
          headers={authImageHeaders()}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>GeoAttend</Text>
          <View style={styles.trackRow}>
            <View
              style={[styles.trackDot, { backgroundColor: tracking ? colors.success : colors.textMuted }]}
            />
            <Text
              style={[
                styles.trackText,
                { color: tracking ? colors.success : colors.textSecondary },
              ]}
            >
              {tracking ? 'Tracking On' : 'Tracking Off'}
            </Text>
          </View>
        </View>
        {openRecord ? (
          <View style={styles.sessionPill}>
            <Text style={styles.sessionPillText}>
              {isOvertime ? 'Lembur' : 'Sesi'} sejak {formatTime(openRecord.timestamp)}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GeofenceRadar
          distanceMeters={distanceMeters}
          bearing={bearing}
          radiusMeters={geofence?.radiusMeters ?? null}
          accuracyMeters={coords?.accuracy ?? null}
          isInside={isInside || !geofence}
          areaName={geofence?.name ?? null}
        />

        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {loading ? (
            <Text style={styles.subtle}>Memuat…</Text>
          ) : null}

          {/* Verifikasi lokasi */}
          {geoError ? (
            <View style={[styles.statusBox, { backgroundColor: colors.destructiveSubtle }]}>
              <Text style={{ color: colors.destructiveStrong, fontWeight: '600' }}>{geoError}</Text>
            </View>
          ) : !coords ? (
            <View style={[styles.statusBox, styles.statusRow, { backgroundColor: colors.muted }]}>
              <Satellite size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>Mencari sinyal GPS...</Text>
            </View>
          ) : (
            <View
              style={[
                styles.statusBox,
                {
                  backgroundColor:
                    isInside || !geofence ? colors.successSubtle : colors.destructiveSubtle,
                },
              ]}
            >
              <View style={styles.statusRow}>
                {isInside || !geofence ? (
                  <CircleCheck size={18} color={colors.successStrong} />
                ) : (
                  <TriangleAlert size={18} color={colors.destructiveStrong} />
                )}
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: '700',
                    color: isInside || !geofence ? colors.successStrong : colors.destructiveStrong,
                  }}
                >
                  {!geofence
                    ? 'Area absensi belum dikonfigurasi'
                    : isInside
                      ? 'Verifikasi Geofence Berhasil'
                      : 'Anda di luar area absensi'}
                </Text>
              </View>
              {geofence && distanceMeters != null && (
                <Text
                  style={[
                    styles.statusHint,
                    { color: isInside ? '#166534' : colors.destructiveStrong },
                  ]}
                >
                  {isInside
                    ? `Anda terdeteksi di area kantor (${geofence.name})`
                    : `Jarak Anda ${formatDistance(distanceMeters)} dari pusat ${geofence.name}`}
                </Text>
              )}

              <View style={styles.statGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>TITIK KOORDINAT</Text>
                  <Text style={styles.statValue}>
                    {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>AKURASI GPS</Text>
                  <Text style={styles.statValue}>
                    ± {Math.round(coords.accuracy ?? 0)} Meter
                  </Text>
                </View>
              </View>

              {geofence && !isInside && (
                <Text style={[styles.statusHint, { color: colors.warningStrong }]}>
                  {nextType === 'clock_out'
                    ? 'Absen pulang tetap bisa walau di luar area — tercatat sebagai “luar area”.'
                    : 'Absen masuk tetap bisa, wajib isi alasan (mis. langsung ke lapangan).'}
                </Text>
              )}
            </View>
          )}

          {gpsWeak && coords && (
            <View style={[styles.statusBox, styles.statusRow, { backgroundColor: colors.warningSubtle }]}>
              <TriangleAlert size={18} color={colors.warningStrong} />
              <Text style={{ flex: 1, fontSize: 12.5, color: colors.warningStrong }}>
                Sinyal GPS lemah (±{Math.round(coords.accuracy ?? 0)}m). Pindah ke area terbuka
                untuk hasil akurat.
              </Text>
            </View>
          )}

          {/* Konteks sesi: lembur / jadwal hari ini */}
          {isOvertime ? (
            <View style={[styles.statusBox, { backgroundColor: colors.warningSubtle }]}>
              <View style={styles.statusRow}>
                <Zap size={18} color={colors.warningStrong} />
                <Text style={{ flex: 1, fontWeight: '700', color: colors.warningStrong }}>
                  {nextType === 'clock_in' ? 'Lembur di luar jam shift' : 'Tutup sesi lembur'}
                </Text>
              </View>
              <Text style={[styles.statusHint, { color: colors.warningStrong }]}>
                {nextType === 'clock_in'
                  ? 'Seluruh durasinya dihitung lembur — tidak ada telat atau pulang cepat. Boleh di lokasi pelanggan, di luar area kantor.'
                  : 'Ambil foto hasil perbaikan sebagai bukti pekerjaan selesai.'}
              </Text>
            </View>
          ) : todayShift === 'libur' ? (
            <View style={[styles.statusBox, { backgroundColor: colors.warningSubtle }]}>
              <View style={styles.statusRow}>
                <TreePalm size={18} color={colors.warningStrong} />
                <Text style={{ flex: 1, fontWeight: '700', color: colors.warningStrong }}>
                  Hari ini kamu Libur
                </Text>
              </View>
              <Text style={[styles.statusHint, { color: colors.warningStrong }]}>
                Sudah otomatis tercatat di rekap — tidak perlu menandai apa pun. Tetap bisa absen
                bila diminta masuk.
              </Text>
            </View>
          ) : todayShift ? (
            <View style={[styles.statusBox, styles.statusRow, { backgroundColor: colors.primarySubtle }]}>
              <CalendarCheck size={18} color={colors.primary} />
              <Text style={{ flex: 1, fontWeight: '600', color: colors.primary }}>
                Hari ini jadwal kamu Shift {todayShift}
                {scheduledShift ? ` · ${scheduledShift.startTime}–${scheduledShift.endTime}` : ''}
              </Text>
            </View>
          ) : !loading ? (
            <View style={[styles.statusBox, styles.statusRow, { backgroundColor: colors.muted }]}>
              <CalendarCheck size={18} color={colors.textSecondary} />
              <Text style={{ flex: 1, color: colors.textSecondary }}>
                Hari ini kamu belum dijadwalkan shift
              </Text>
            </View>
          ) : null}

          {/* Pilihan shift */}
          {!isOvertime && roleShifts.length >= 2 && (
            <Card style={{ gap: spacing.md }}>
              <Text style={styles.cardTitle}>Pilih Shift</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {roleShifts.map((shift) => {
                  const active = selectedShift === shift.shiftNumber;
                  return (
                    <Pressable
                      key={shift.shiftNumber}
                      onPress={() => setManualShift(shift.shiftNumber)}
                      style={[styles.shiftButton, active && styles.shiftButtonActive]}
                    >
                      <Text style={[styles.shiftTitle, active && { color: colors.primary }]}>
                        Shift {shift.shiftNumber}
                      </Text>
                      <Text style={[styles.subtle, active && { color: colors.primary }]}>
                        {shift.startTime}–{shift.endTime}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {nextType === 'clock_out' ? (
                <Text style={styles.subtle}>
                  Otomatis mengikuti shift absen masuk — ubah bila perlu
                </Text>
              ) : scheduledShift ? (
                <Text style={styles.subtle}>Otomatis mengikuti jadwal hari ini — ubah bila perlu</Text>
              ) : null}
            </Card>
          )}

          {/* Bukti foto */}
          <Card style={{ gap: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                {isOvertime && nextType === 'clock_out'
                  ? 'Foto Hasil Perbaikan (wajib)'
                  : 'Bukti Foto Real-Time'}
              </Text>
              {photoAt ? <Text style={styles.subtle}>{formatClock(photoAt)}</Text> : null}
            </View>

            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />
                <Button title="Ambil Ulang" variant="outline" icon={Camera} onPress={() => setPhoto(null)} />
              </>
            ) : (
              <Pressable
                onPress={openCamera}
                style={({ pressed }) => [styles.photoPlaceholder, pressed && { opacity: 0.7 }]}
              >
                <UserRound size={26} color={colors.textMuted} strokeWidth={1.6} />
                <Text style={styles.photoHint}>Ketuk untuk ambil foto wajah</Text>
                <Text style={[styles.photoHint, { fontSize: 10.5 }]}>
                  Pastikan wajah berada di dalam panduan
                </Text>
              </Pressable>
            )}

            {photo && (
              <Field
                label={
                  isOvertime && nextType === 'clock_in'
                    ? 'Alasan / gangguan yang ditangani (wajib)'
                    : needReason
                      ? 'Alasan absen di luar area (wajib)'
                      : 'Catatan (opsional)'
                }
                value={notes}
                onChangeText={setNotes}
                maxLength={500}
                multiline
                placeholder={
                  isOvertime && nextType === 'clock_in'
                    ? 'Contoh: FO putus Jl. Merdeka — tiket #1234'
                    : needReason
                      ? 'Contoh: Langsung ke lapangan / lokasi pelanggan'
                      : 'Contoh: Datang tepat waktu'
                }
              />
            )}
          </Card>

          <Button
            title={submitTitle}
            icon={Camera}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={shadow.card}
          />

          {!photo && (
            <Text style={[styles.subtle, { textAlign: 'center' }]}>
              Ambil foto terlebih dahulu untuk mengaktifkan tombol kirim
            </Text>
          )}
          {photo && needReason && !notes.trim() && (
            <Text style={[styles.subtle, { textAlign: 'center', color: colors.warningStrong, fontWeight: '600' }]}>
              Isi alasan dulu untuk mengaktifkan tombol kirim
            </Text>
          )}

          {/* Pintu masuk lembur urgent — hanya saat tidak ada sesi berjalan, supaya
              sesi shift & sesi lembur tidak pernah terbuka bersamaan. */}
          {nextType === 'clock_in' && (
            <Button
              title={
                overtimeMode ? 'Batal, kembali ke absen biasa' : 'Dipanggil lembur? Mulai Lembur Urgent'
              }
              icon={overtimeMode ? undefined : Zap}
              variant="outline"
              onPress={() => {
                setOvertimeMode((v) => !v);
                setNotes('');
              }}
            />
          )}

          {lastRecord && !openRecord ? (
            <Text style={[styles.subtle, { textAlign: 'center' }]}>
              Terakhir: {lastRecord.type === 'clock_in' ? 'masuk' : 'pulang'}
              {lastRecord.shiftNumber != null ? ` (Shift ${lastRecord.shiftNumber})` : ''} pukul{' '}
              {formatTime(lastRecord.timestamp)}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Modal kamera */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          <View style={[styles.cameraControls, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <Pressable onPress={() => setCameraOpen(false)} style={styles.cameraSide}>
              <X size={26} color="#FFF" />
              <Text style={styles.cameraSideText}>Batal</Text>
            </Pressable>
            <Pressable
              onPress={capture}
              disabled={capturing}
              style={[styles.shutter, capturing && { opacity: 0.5 }]}
            />
            <Pressable
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
              style={styles.cameraSide}
            >
              <SwitchCamera size={26} color="#FFF" />
              <Text style={styles.cameraSideText}>Balik</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  trackDot: { width: 6, height: 6, borderRadius: 3 },
  trackText: { fontSize: 11, fontWeight: '600' },
  sessionPill: {
    backgroundColor: colors.primarySubtle,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sessionPillText: { fontSize: 10.5, fontWeight: '700', color: colors.primary },

  statusBox: { borderRadius: radius.lg, padding: spacing.lg, gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusHint: { fontSize: 12 },
  statGrid: { flexDirection: 'row', gap: spacing.lg, marginTop: 2 },
  statLabel: { fontSize: 9.5, letterSpacing: 0.3, color: colors.textSecondary },
  statValue: { fontSize: 12.5, fontWeight: '600', color: colors.textPrimary },

  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  subtle: { fontSize: 12.5, color: colors.textSecondary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  shiftButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  shiftButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  shiftTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoHint: { fontSize: 12, color: colors.textSecondary },

  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: spacing.xxl,
    backgroundColor: '#000',
  },
  cameraSide: { width: 72, alignItems: 'center' },
  cameraSideText: { color: '#FFF', fontSize: 15 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
