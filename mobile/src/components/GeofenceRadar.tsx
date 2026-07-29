import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { colors, spacing } from '../theme';

const HEIGHT = 190;
/** Jari-jari lingkaran geofence dalam piksel. */
const FENCE_PX = 58;
/** Batas gambar agar titik yang sangat jauh tetap terlihat di tepi. */
const MAX_PX = 84;

interface Props {
  /** null saat GPS belum dapat fix. */
  distanceMeters: number | null;
  /** Arah pengguna dari pusat area, derajat (0 = utara). */
  bearing: number | null;
  radiusMeters: number | null;
  accuracyMeters: number | null;
  isInside: boolean;
  /** Nama area; null bila geofence belum dikonfigurasi. */
  areaName: string | null;
}

/**
 * Visual posisi relatif terhadap area absensi — pengganti peta.
 *
 * Aplikasi belum memuat `react-native-maps` (butuh native build + API key),
 * jadi hubungan "saya vs area kantor" digambar langsung dari angka yang sudah
 * kita punya: jarak haversine + arah kompas. Skalanya linier di dalam pagar,
 * lalu ditekan di luar pagar supaya titik sejauh berapa pun tetap masuk bingkai.
 */
export function GeofenceRadar({
  distanceMeters,
  bearing,
  radiusMeters,
  accuracyMeters,
  isInside,
  areaName,
}: Props) {
  const [width, setWidth] = useState(0);
  const accent = isInside ? colors.success : colors.destructive;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  let dotX: number | null = null;
  let dotY: number | null = null;
  if (distanceMeters != null && radiusMeters != null && radiusMeters > 0) {
    const ratio = distanceMeters / radiusMeters;
    const px =
      ratio <= 1 ? ratio * FENCE_PX : FENCE_PX + (MAX_PX - FENCE_PX) * (1 - 1 / Math.sqrt(ratio));
    const rad = (((bearing ?? 0) - 90) * Math.PI) / 180;
    dotX = Math.cos(rad) * px;
    dotY = Math.sin(rad) * px;
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <G x={width / 2} y={HEIGHT / 2}>
            {/* Cincin skala */}
            <Circle r={MAX_PX} fill="none" stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
            <Circle r={FENCE_PX} fill={accent} fillOpacity={0.08} stroke={accent} strokeWidth={1.5} />
            <Circle r={FENCE_PX / 2} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={1} />

            {/* Salib arah mata angin */}
            <Line x1={-MAX_PX} y1={0} x2={MAX_PX} y2={0} stroke={colors.border} strokeWidth={1} />
            <Line x1={0} y1={-MAX_PX} x2={0} y2={MAX_PX} stroke={colors.border} strokeWidth={1} />
            <SvgText x={0} y={-MAX_PX - 6} fontSize={9} fill={colors.textMuted} textAnchor="middle">
              U
            </SvgText>

            {/* Pusat area */}
            <Circle r={5} fill={colors.textPrimary} />

            {/* Posisi pengguna */}
            {dotX != null && dotY != null && (
              <G x={dotX} y={dotY}>
                <Circle r={13} fill={colors.primary} fillOpacity={0.18} />
                <Circle r={7} fill={colors.primary} stroke={colors.surface} strokeWidth={2.5} />
              </G>
            )}
          </G>
        </Svg>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendText} numberOfLines={1}>
          {areaName
            ? `${areaName} · radius ${radiusMeters != null ? Math.round(radiusMeters) : '—'} m`
            : 'Area absensi belum dikonfigurasi'}
        </Text>
        <Text style={styles.legendText}>
          {accuracyMeters != null ? `GPS ±${Math.round(accuracyMeters)} m` : 'Mencari sinyal…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.sm,
    minHeight: HEIGHT,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  legendText: { fontSize: 10.5, color: colors.textSecondary, flexShrink: 1 },
});
