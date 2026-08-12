import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { api } from '../api/client';
import type { GeofenceResponse, LiveLocationResponse } from '../api/types';
import { formatTime, haversineDistance, formatDistance } from '../lib/geo';
import { Badge, Card, EmptyState, HeaderIconButton, ScreenHeader } from '../components/ui';
import { TeamMap, type TeamMarker } from '../components/TeamMap';
import { colors, spacing } from '../theme';

/**
 * Peta posisi tim untuk administrator.
 *
 * Ambang "live" **6 menit**, angka yang sama dengan `LIVE_FRESHNESS_MS` di web —
 * app mobile mengirim posisi per batch ~5 menit, jadi ambang yang lebih ketat
 * akan menandai karyawan yang sebenarnya normal sebagai kedaluwarsa.
 *
 * Posisi kedaluwarsa **tetap digambar di titik terakhir** (abu-abu), bukan
 * dihilangkan: "terakhir terlihat di sini" jauh lebih berguna bagi administrator
 * daripada penanda yang lenyap.
 */

const LIVE_FRESHNESS_MS = 6 * 60 * 1000;
const POLL_MS = 15_000;

export function TeamMapScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [locations, setLocations] = useState<LiveLocationResponse[]>([]);
  const [geofence, setGeofence] = useState<GeofenceResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Geofence hampir tidak pernah berubah — cukup diambil sekali, jangan ikut
  // polling 15 detik.
  const geofenceLoaded = useRef(false);

  const loadData = useCallback(async () => {
    const res = await api<{ data: LiveLocationResponse[] }>('/api/locations');
    setLocations(res.data);
    setNow(Date.now());

    if (!geofenceLoaded.current) {
      geofenceLoaded.current = true;
      const fence = await api<GeofenceResponse>('/api/geofence').catch(() => null);
      setGeofence(fence);
    }
  }, []);

  useEffect(() => {
    loadData()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [loadData]);

  // Polling hanya saat layar benar-benar dilihat — layar lain tetap ter-mount
  // di stack, dan pemborosan kuota/baterai di latar tidak ada gunanya.
  useEffect(() => {
    if (!isFocused) return;
    const timer = setInterval(() => {
      loadData().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [isFocused, loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [loadData]);

  const rows = useMemo(
    () =>
      locations.map((loc) => {
        const age = now - new Date(loc.updatedAt).getTime();
        const live = age < LIVE_FRESHNESS_MS;
        const distance =
          geofence != null
            ? haversineDistance(loc.latitude, loc.longitude, geofence.latitude, geofence.longitude)
            : null;
        return {
          loc,
          live,
          distance,
          inside: distance != null && geofence != null ? distance <= geofence.radiusMeters : null,
        };
      }),
    [locations, now, geofence]
  );

  const markers: TeamMarker[] = useMemo(
    () =>
      rows.map(({ loc, live }) => ({
        userId: loc.userId,
        name: loc.userName,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyMeters: loc.accuracyMeters,
        live,
        caption: live ? `live · ${formatTime(loc.updatedAt)}` : `terakhir ${formatTime(loc.updatedAt)}`,
      })),
    [rows]
  );

  const liveCount = rows.filter((r) => r.live).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Peta Tim"
        subtitle={
          loading
            ? 'Memuat posisi…'
            : `${liveCount} dari ${rows.length} sedang live · segar tiap 15 detik`
        }
        left={
          // Sebagai TAB layar ini tidak punya tujuan kembali — tombolnya hanya
          // digambar saat benar-benar dibuka bertumpuk di atas layar lain.
          navigation.canGoBack() ? (
            <HeaderIconButton
              icon={ChevronLeft}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Kembali"
            />
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <TeamMap
          markers={markers}
          centerLatitude={geofence?.latitude ?? null}
          centerLongitude={geofence?.longitude ?? null}
          radiusMeters={geofence?.radiusMeters ?? null}
        />

        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {rows.length === 0 ? (
            loading ? (
              <Card>
                <Text style={styles.subtle}>Memuat…</Text>
              </Card>
            ) : (
              <EmptyState
                icon={MapPin}
                title="Belum ada yang terlacak"
                hint="Posisi muncul setelah karyawan absen masuk, dan hilang setelah pulang."
              />
            )
          ) : (
            rows.map(({ loc, live, distance, inside }) => (
              <Card key={loc.userId} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: live ? colors.success : colors.border }]} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {loc.userName}
                  </Text>
                  <Text style={styles.subtle} numberOfLines={1}>
                    {live ? 'Live' : `Terakhir ${formatTime(loc.updatedAt)}`}
                    {distance != null ? ` · ${formatDistance(distance)} dari area` : ''}
                  </Text>
                </View>
                {inside != null && (
                  <Badge
                    text={inside ? 'Dalam area' : 'Luar area'}
                    tone={inside ? 'success' : 'warning'}
                  />
                )}
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  subtle: { fontSize: 12, color: colors.textSecondary },
});
