'use client';

import { useEffect, useMemo } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {
  AttendanceRecordResponse,
  GeofenceResponse,
  TrailPointResponse,
  TrailStopResponse,
} from '@/types/api';
import { formatTime } from '@/lib/utils';
import { formatDistance } from '@/lib/geo/distance';
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM_LEVEL } from '@/lib/constants';

interface TrailMapProps {
  points: TrailPointResponse[];
  stops: TrailStopResponse[];
  clockIn: AttendanceRecordResponse | null;
  clockOut: AttendanceRecordResponse | null;
  geofence: GeofenceResponse | null;
}

function createEndpointIcon(label: string, modifier: 'start' | 'end') {
  return L.divIcon({
    className: '',
    html: `<div class="geoattend-marker geoattend-marker--${modifier}">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const START_ICON = createEndpointIcon('M', 'start');
const END_ICON = createEndpointIcon('P', 'end');

/**
 * Sesuaikan tampilan peta dengan seluruh rute.
 *
 * MapContainer TIDAK reaktif terhadap prop center/zoom setelah mount, jadi
 * penyesuaian harus lewat komponen anak + useMap. Jeda singkat diperlukan
 * karena peta hidup di dalam dialog beranimasi: tanpa invalidateSize() setelah
 * animasi selesai, sebagian ubin peta tidak pernah dimuat (area abu-abu).
 */
function FitTrail({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
    }, 150);
    return () => clearTimeout(timer);
  }, [map, bounds]);
  return null;
}

/**
 * Peta rute perjalanan karyawan pada satu sesi kerja.
 * Harus di-load dengan next/dynamic { ssr: false }.
 */
export default function TrailMap({
  points,
  stops,
  clockIn,
  clockOut,
  geofence,
}: TrailMapProps) {
  const line = useMemo<[number, number][]>(
    () => points.map((p) => [p.latitude, p.longitude]),
    [points]
  );

  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const all: [number, number][] = [...line];
    if (clockIn) all.push([clockIn.latitude, clockIn.longitude]);
    if (clockOut) all.push([clockOut.latitude, clockOut.longitude]);
    return all.length > 0 ? L.latLngBounds(all) : null;
  }, [line, clockIn, clockOut]);

  const center = useMemo<[number, number]>(() => {
    if (clockIn) return [clockIn.latitude, clockIn.longitude];
    if (line[0]) return line[0];
    if (geofence) return [geofence.latitude, geofence.longitude];
    return DEFAULT_MAP_CENTER;
  }, [clockIn, line, geofence]);

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM_LEVEL}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTrail bounds={bounds} />

      {geofence && (
        <Circle
          center={[geofence.latitude, geofence.longitude]}
          radius={geofence.radiusMeters}
          pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.08 }}
        />
      )}

      {line.length >= 2 && (
        <Polyline
          positions={line}
          pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.85 }}
        />
      )}

      {stops.map((stop) => (
        <CircleMarker
          key={stop.startedAt}
          center={[stop.latitude, stop.longitude]}
          radius={9}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: '#f97316',
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <strong>Berhenti {stop.durationMinutes} menit</strong>
            <br />
            {formatTime(stop.startedAt)} – {formatTime(stop.endedAt)}
          </Popup>
        </CircleMarker>
      ))}

      {clockIn && (
        <Marker position={[clockIn.latitude, clockIn.longitude]} icon={START_ICON}>
          <Popup>
            <strong>Absen masuk</strong>
            <br />
            {formatTime(clockIn.timestamp)}
            <br />
            {formatDistance(clockIn.distanceFromCenter)} dari pusat
          </Popup>
        </Marker>
      )}

      {clockOut && (
        <Marker position={[clockOut.latitude, clockOut.longitude]} icon={END_ICON}>
          <Popup>
            <strong>Absen pulang</strong>
            <br />
            {formatTime(clockOut.timestamp)}
            <br />
            {formatDistance(clockOut.distanceFromCenter)} dari pusat
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
