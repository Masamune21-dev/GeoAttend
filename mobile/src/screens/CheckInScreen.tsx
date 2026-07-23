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
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { api, ApiRequestError } from '../api/client';
import type {
  AttendanceRecordResponse,
  GeofenceResponse,
  PaginatedResponse,
  ShiftSettingResponse,
} from '../api/types';
import { useSession } from '../auth/session';
import { haversineDistance, formatDistance, formatTime } from '../lib/geo';
import { pickShift } from '../lib/shifts';
import { startTracking, stopTracking } from '../tracking/locationTask';
import { Badge, Button, Card, Field } from '../components/ui';
import { colors, spacing } from '../theme';

const GPS_WEAK_THRESHOLD = 50;

export function CheckInScreen() {
  const { user } = useSession();

  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [geofence, setGeofence] = useState<GeofenceResponse | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecordResponse[]>([]);
  const [shifts, setShifts] = useState<ShiftSettingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [manualShift, setManualShift] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null); // data URI JPEG
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- Lokasi foreground (indikator jarak) ---
  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mounted) setGeoError('Izin lokasi ditolak — aktifkan di pengaturan HP');
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (loc) => {
          if (mounted) {
            setCoords(loc.coords);
            setGeoError(null);
          }
        }
      );
    })();
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  // --- Data server ---
  const loadData = useCallback(async () => {
    const [geofenceRes, todayRes, shiftsRes] = await Promise.all([
      api<GeofenceResponse>('/api/geofence').catch((err) =>
        err instanceof ApiRequestError && err.status === 404 ? null : Promise.reject(err)
      ),
      api<PaginatedResponse<AttendanceRecordResponse>>(
        '/api/attendance?today=true&userId=self&limit=10'
      ),
      api<{ data: ShiftSettingResponse[] }>('/api/shifts'),
    ]);
    setGeofence(geofenceRes);
    setTodayRecords(todayRes.data);
    setShifts(shiftsRes.data);
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
  const lastRecord = todayRecords[0];
  const nextType: 'clock_in' | 'clock_out' =
    lastRecord?.type === 'clock_in' ? 'clock_out' : 'clock_in';

  const roleShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.role === user?.role)
        .sort((a, b) => a.shiftNumber - b.shiftNumber),
    [shifts, user?.role]
  );

  const defaultShift = useMemo(() => {
    if (roleShifts.length === 0) return null;
    if (nextType === 'clock_out') {
      const lastClockIn = todayRecords.find((r) => r.type === 'clock_in');
      if (
        lastClockIn?.shiftNumber != null &&
        roleShifts.some((s) => s.shiftNumber === lastClockIn.shiftNumber)
      ) {
        return lastClockIn.shiftNumber;
      }
    }
    return pickShift(new Date(), roleShifts)?.shiftNumber ?? null;
  }, [roleShifts, nextType, todayRecords]);

  const selectedShift =
    manualShift != null && roleShifts.some((s) => s.shiftNumber === manualShift)
      ? manualShift
      : defaultShift;

  const { distanceMeters, isInside } = useMemo(() => {
    if (!coords || !geofence) return { distanceMeters: null as number | null, isInside: false };
    const d = haversineDistance(
      coords.latitude,
      coords.longitude,
      geofence.latitude,
      geofence.longitude
    );
    const buffer = Math.min(coords.accuracy ?? 0, 50);
    return { distanceMeters: d, isInside: d <= geofence.radiusMeters + buffer };
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
      setCameraOpen(false);
    } catch (err) {
      Alert.alert('Gagal mengambil foto', err instanceof Error ? err.message : 'Coba lagi');
    } finally {
      setCapturing(false);
    }
  };

  // --- Kirim absensi ---
  const canSubmit =
    Boolean(coords && photo && (isInside || !geofence)) && !submitting;

  const handleSubmit = async () => {
    if (!coords || !photo) return;
    setSubmitting(true);
    try {
      await api<AttendanceRecordResponse>('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          type: nextType,
          shiftNumber: selectedShift ?? undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters:
            coords.accuracy != null && coords.accuracy > 0 ? coords.accuracy : undefined,
          photoBase64: photo,
          notes: notes.trim() || undefined,
        }),
      });

      setPhoto(null);
      setNotes('');
      setManualShift(null);
      await loadData().catch(() => undefined);

      if (nextType === 'clock_in') {
        const ok = await startTracking();
        Alert.alert(
          'Absen masuk tercatat ✓',
          ok
            ? 'Posisi Anda akan terpantau selama jam kerja.'
            : 'Absen tercatat, tapi izin lokasi background ditolak — pelacakan live tidak aktif.'
        );
      } else {
        await stopTracking();
        Alert.alert('Absen pulang tercatat ✓', 'Pelacakan posisi dihentikan. Selamat beristirahat!');
      }
    } catch (err) {
      const e = err as ApiRequestError;
      switch (e.code) {
        case 'GEOFENCE_VIOLATION':
          Alert.alert('Di luar area', e.message);
          break;
        case 'DUPLICATE_CHECKIN':
          Alert.alert('Sudah absen', 'Anda sudah absen masuk hari ini');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textSecondary }}>Memuat...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Header status */}
      <Card>
        <Text style={styles.title}>
          {nextType === 'clock_in' ? '📥 Absen Masuk' : '📤 Absen Pulang'}
        </Text>
        {lastRecord && (
          <Text style={styles.subtle}>
            Terakhir: {lastRecord.type === 'clock_in' ? 'masuk' : 'pulang'}
            {lastRecord.shiftNumber != null ? ` (Shift ${lastRecord.shiftNumber})` : ''} pukul{' '}
            {formatTime(lastRecord.timestamp)}
          </Text>
        )}

        {/* Pilihan shift */}
        {roleShifts.length >= 2 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Pilih Shift</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {roleShifts.map((shift) => {
                const active = selectedShift === shift.shiftNumber;
                return (
                  <Pressable
                    key={shift.shiftNumber}
                    onPress={() => setManualShift(shift.shiftNumber)}
                    style={[styles.shiftButton, active && styles.shiftButtonActive]}
                  >
                    <Text
                      style={[
                        styles.shiftButtonTitle,
                        active && { color: colors.primary },
                      ]}
                    >
                      Shift {shift.shiftNumber}
                    </Text>
                    <Text
                      style={[styles.subtle, active && { color: colors.primary }]}
                    >
                      {shift.startTime}–{shift.endTime}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {nextType === 'clock_out' && (
              <Text style={styles.subtle}>
                Otomatis mengikuti shift absen masuk — ubah bila perlu
              </Text>
            )}
          </View>
        )}

        {/* Status lokasi */}
        {geoError ? (
          <View style={[styles.statusBox, { backgroundColor: colors.destructiveSubtle }]}>
            <Text style={{ color: '#B91C1C' }}>{geoError}</Text>
          </View>
        ) : !coords ? (
          <View style={[styles.statusBox, { backgroundColor: '#F1F5F9' }]}>
            <Text style={{ color: colors.textSecondary }}>📡 Mencari sinyal GPS...</Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.statusBox,
                { backgroundColor: isInside || !geofence ? colors.successSubtle : colors.destructiveSubtle },
              ]}
            >
              <Text
                style={{
                  color: isInside || !geofence ? '#15803D' : '#B91C1C',
                  fontWeight: '600',
                }}
              >
                {!geofence
                  ? 'Area absensi belum dikonfigurasi'
                  : isInside
                    ? '✓ Anda berada di dalam area absensi'
                    : '✗ Anda di luar area absensi'}
              </Text>
              {geofence && distanceMeters != null && (
                <Text style={styles.subtle}>
                  {geofence.name} · radius {Math.round(geofence.radiusMeters)} m · jarak Anda{' '}
                  {formatDistance(distanceMeters)}
                </Text>
              )}
            </View>
            {gpsWeak && (
              <View style={[styles.statusBox, { backgroundColor: colors.warningSubtle }]}>
                <Text style={{ color: '#B45309' }}>
                  ⚠️ Sinyal GPS lemah (±{Math.round(coords.accuracy ?? 0)}m). Pindah ke area
                  terbuka untuk hasil akurat.
                </Text>
              </View>
            )}
          </>
        )}
      </Card>

      {/* Foto */}
      <Card>
        <Text style={styles.label}>Foto Bukti (wajib)</Text>
        {photo ? (
          <>
            <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />
            <Button title="Ambil Ulang" variant="outline" onPress={() => setPhoto(null)} />
          </>
        ) : (
          <Button title="📷 Ambil Foto" variant="outline" onPress={openCamera} />
        )}

        {photo && (
          <Field
            label="Catatan (opsional)"
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
            multiline
            placeholder="Contoh: Datang tepat waktu"
          />
        )}

        <Button
          title={
            submitting
              ? 'Mengirim...'
              : nextType === 'clock_in'
                ? 'Kirim Absen Masuk'
                : 'Kirim Absen Pulang'
          }
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
        {!photo && (
          <Text style={[styles.subtle, { textAlign: 'center' }]}>
            Ambil foto terlebih dahulu untuk mengaktifkan tombol kirim
          </Text>
        )}
      </Card>

      {/* Modal kamera */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          <View style={styles.cameraControls}>
            <Pressable onPress={() => setCameraOpen(false)} style={styles.cameraSide}>
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
              <Text style={styles.cameraSideText}>🔄 Balik</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  subtle: { fontSize: 13, color: colors.textSecondary },
  statusBox: { borderRadius: 10, padding: 12, gap: 4 },
  shiftButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  shiftButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  shiftButtonTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12 },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 24,
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
