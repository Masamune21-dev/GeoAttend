import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../theme';

export interface TeamMarker {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  /** false = posisi kedaluwarsa (> 6 menit) — digambar abu-abu. */
  live: boolean;
  /** Teks kecil di popup, mis. "terakhir 14:32". */
  caption: string;
}

interface Props {
  markers: TeamMarker[];
  /** Pusat & radius area absensi; null bila geofence belum dikonfigurasi. */
  centerLatitude: number | null;
  centerLongitude: number | null;
  radiusMeters: number | null;
  height?: number;
}

/**
 * Peta posisi tim — Leaflet + ubin OSM di dalam WebView, tumpukan yang sama
 * dengan [[GeofenceMap]] dan peta admin di web. Tidak memakai peta native
 * karena react-native-maps/expo-maps di Android menuntut Google Maps SDK
 * berbayar.
 *
 * **Nama karyawan tidak pernah disisipkan sebagai HTML.** Data dikirim sebagai
 * JSON lalu popup-nya dibangun dengan `textContent`, jadi nama yang mengandung
 * karakter seperti `<` atau kutip tidak bisa merusak — apalagi menjalankan
 * apa pun di dalam WebView.
 */
export function TeamMap({
  markers,
  centerLatitude,
  centerLongitude,
  radiusMeters,
  height = 320,
}: Props) {
  const html = useMemo(() => {
    const focus = markers[0];
    const focusLat = focus?.latitude ?? centerLatitude;
    const focusLng = focus?.longitude ?? centerLongitude;
    if (focusLat == null || focusLng == null) return null;

    const hasFence = centerLatitude != null && centerLongitude != null && radiusMeters != null;
    const payload = JSON.stringify(
      markers.map((m) => ({
        n: m.name,
        c: m.caption,
        lat: m.latitude,
        lng: m.longitude,
        a: m.accuracyMeters,
        live: m.live,
      }))
    );

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#E8EDF3}
  .leaflet-control-attribution{font-size:8px;background:rgba(255,255,255,.7)}
  .pin{width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
  .pin.on{background:#16A34A}
  .pin.off{background:#94A3B8}
  .pop b{display:block;font:600 12px system-ui,sans-serif;color:#0F172A}
  .pop span{font:11px system-ui,sans-serif;color:#64748B}
  #fallback{display:none;height:100%;align-items:center;justify-content:center;
    font:12px system-ui,sans-serif;color:#64748B;text-align:center;padding:0 24px}
</style>
</head>
<body>
<div id="map"></div>
<div id="fallback">Peta tidak dapat dimuat — periksa koneksi internet.<br>Daftar posisi di bawah tetap tampil.</div>
<script
  src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  onerror="document.getElementById('map').style.display='none';document.getElementById('fallback').style.display='flex'"
></script>
<script>
  if (typeof L === 'undefined') {
    document.getElementById('map').style.display = 'none';
    document.getElementById('fallback').style.display = 'flex';
  } else {
  var map = L.map('map', { zoomControl: false, attributionControl: true, tap: false })
    .setView([${focusLat}, ${focusLng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  ${
    hasFence
      ? `L.circle([${centerLatitude}, ${centerLongitude}], {
           radius: ${radiusMeters}, color: '#2563EB', weight: 2,
           fillColor: '#2563EB', fillOpacity: 0.08
         }).addTo(map);`
      : ''
  }
  var people = ${payload};
  var bounds = [];
  people.forEach(function (p) {
    if (p.a && p.a > 0) {
      L.circle([p.lat, p.lng], {
        radius: p.a, color: p.live ? '#16A34A' : '#94A3B8', weight: 0,
        fillColor: p.live ? '#16A34A' : '#94A3B8', fillOpacity: 0.10
      }).addTo(map);
    }
    var marker = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="pin ' + (p.live ? 'on' : 'off') + '"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7]
      })
    }).addTo(map);

    // Nama & keterangan lewat textContent — bukan string HTML.
    var box = document.createElement('div');
    box.className = 'pop';
    var nama = document.createElement('b');
    nama.textContent = p.n;
    var ket = document.createElement('span');
    ket.textContent = p.c;
    box.appendChild(nama);
    box.appendChild(ket);
    marker.bindPopup(box);

    bounds.push([p.lat, p.lng]);
  });
  ${hasFence ? `bounds.push([${centerLatitude}, ${centerLongitude}]);` : ''}
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
  }
</script>
</body>
</html>`;
  }, [markers, centerLatitude, centerLongitude, radiusMeters]);

  return (
    <View style={[styles.canvas, { height }]}>
      {html ? (
        <WebView
          source={{ html }}
          style={styles.web}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          androidLayerType="hardware"
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
          <Text style={styles.placeholderText}>Belum ada posisi untuk ditampilkan</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: '#E8EDF3', borderBottomWidth: 1, borderBottomColor: colors.border },
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
    paddingHorizontal: spacing.xl,
  },
  placeholderText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
