import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../theme';

const HEIGHT = 200;

interface Props {
  /** Posisi pengguna; null saat GPS belum dapat fix. */
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  /** Pusat & radius area absensi; null bila geofence belum dikonfigurasi. */
  centerLatitude: number | null;
  centerLongitude: number | null;
  radiusMeters: number | null;
  isInside: boolean;
  areaName: string | null;
  distanceLabel: string | null;
}

/**
 * Peta area absensi — Leaflet + ubin OpenStreetMap di dalam WebView.
 *
 * Sengaja memakai tumpukan yang sama dengan peta admin di web (react-leaflet +
 * tile OSM) supaya tampilannya konsisten dan TIDAK perlu API key: peta native
 * (react-native-maps / expo-maps) di Android wajib memakai Google Maps SDK
 * yang menuntut kunci API berbayar.
 *
 * HTML dirakit sebagai string; satu-satunya nilai yang disisipkan ke dalamnya
 * adalah angka koordinat/radius — teks bebas seperti nama area dirender di sisi
 * React Native, bukan di dalam WebView.
 */
export function GeofenceMap({
  latitude,
  longitude,
  accuracyMeters,
  centerLatitude,
  centerLongitude,
  radiusMeters,
  isInside,
  areaName,
  distanceLabel,
}: Props) {
  // Titik fokus peta: posisi pengguna bila ada, kalau tidak pusat area.
  const focusLat = latitude ?? centerLatitude;
  const focusLng = longitude ?? centerLongitude;

  const html = useMemo(() => {
    if (focusLat == null || focusLng == null) return null;

    const accent = isInside ? '#16A34A' : '#EF4444';
    const hasFence = centerLatitude != null && centerLongitude != null && radiusMeters != null;
    // Zoom menyesuaikan radius supaya lingkaran area selalu muat di bingkai.
    const zoom = !hasFence ? 17 : radiusMeters! <= 60 ? 18 : radiusMeters! <= 150 ? 17 : 16;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#E8EDF3}
  .leaflet-control-attribution{font-size:8px;background:rgba(255,255,255,.7)}
  .me{width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
  #fallback{display:none;height:100%;align-items:center;justify-content:center;
    font:12px system-ui,sans-serif;color:#64748B;text-align:center;padding:0 24px}
</style>
</head>
<body>
<div id="map"></div>
<div id="fallback">Peta tidak dapat dimuat — periksa koneksi internet.<br>Verifikasi lokasi di bawah tetap berjalan.</div>
<script
  src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  onerror="document.getElementById('map').style.display='none';document.getElementById('fallback').style.display='flex'"
></script>
<script>
  if (typeof L === 'undefined') {
    document.getElementById('map').style.display = 'none';
    document.getElementById('fallback').style.display = 'flex';
  } else {
  var map = L.map('map', { zoomControl: false, attributionControl: true, dragging: true, tap: false })
    .setView([${focusLat}, ${focusLng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  ${
    hasFence
      ? `L.circle([${centerLatitude}, ${centerLongitude}], {
           radius: ${radiusMeters},
           color: '${accent}', weight: 2, fillColor: '${accent}', fillOpacity: 0.12
         }).addTo(map);
         L.circleMarker([${centerLatitude}, ${centerLongitude}], {
           radius: 4, color: '#0F172A', fillColor: '#0F172A', fillOpacity: 1, weight: 0
         }).addTo(map);`
      : ''
  }
  ${
    latitude != null && longitude != null
      ? `${
          accuracyMeters != null && accuracyMeters > 0
            ? `L.circle([${latitude}, ${longitude}], {
                 radius: ${accuracyMeters}, color: '#2563EB', weight: 0,
                 fillColor: '#2563EB', fillOpacity: 0.12
               }).addTo(map);`
            : ''
        }
        L.marker([${latitude}, ${longitude}], {
          icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16,16], iconAnchor: [8,8] })
        }).addTo(map);`
      : ''
  }
  }
</script>
</body>
</html>`;
  }, [
    focusLat,
    focusLng,
    latitude,
    longitude,
    accuracyMeters,
    centerLatitude,
    centerLongitude,
    radiusMeters,
    isInside,
  ]);

  return (
    <View style={styles.wrap}>
      <View style={styles.canvas}>
        {html ? (
          <WebView
            source={{ html }}
            style={styles.web}
            scrollEnabled={false}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            androidLayerType="hardware"
            // Peta hanya untuk dilihat; jangan buka tautan apa pun di dalamnya.
            setSupportMultipleWindows={false}
            renderLoading={() => (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Memuat peta…</Text>
              </View>
            )}
            startInLoadingState
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Menunggu sinyal GPS…</Text>
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText} numberOfLines={1}>
          {areaName
            ? `${areaName} · radius ${radiusMeters != null ? Math.round(radiusMeters) : '—'} m`
            : 'Area absensi belum dikonfigurasi'}
        </Text>
        <Text style={styles.legendText} numberOfLines={1}>
          {distanceLabel ?? (accuracyMeters != null ? `GPS ±${Math.round(accuracyMeters)} m` : '')}
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
  },
  canvas: { height: HEIGHT, backgroundColor: '#E8EDF3' },
  web: { flex: 1, backgroundColor: '#E8EDF3' },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EDF3',
  },
  placeholderText: { fontSize: 12, color: colors.textSecondary },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  legendText: { fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
});
