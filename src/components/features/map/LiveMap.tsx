'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AttendanceRecordResponse, GeofenceResponse } from '@/types/api';
import { getInitials, formatTime } from '@/lib/utils';
import { formatDistance } from '@/lib/geo/distance';
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM_LEVEL } from '@/lib/constants';

export interface LiveMarkerData extends AttendanceRecordResponse {
  /** true bila posisi berasal dari pelacakan live yang masih segar */
  isLive?: boolean;
  /** waktu update posisi live terakhir (ISO) */
  lastUpdate?: string;
}

interface LiveMapProps {
  records: LiveMarkerData[];
  geofence: GeofenceResponse | null;
  showGeofence?: boolean;
}

function createMarkerIcon(name: string, isWithinGeofence: boolean, isLive: boolean) {
  const modifiers = [
    isLive ? ' geoattend-marker--live' : '',
    !isLive && !isWithinGeofence ? ' geoattend-marker--outside' : '',
  ].join('');
  return L.divIcon({
    className: '',
    html: `<div class="geoattend-marker${modifiers}">${getInitials(name)}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

/**
 * Peta live absensi + pelacakan posisi karyawan di lapangan.
 * Harus di-load dengan next/dynamic { ssr: false }.
 */
export default function LiveMap({ records, geofence, showGeofence = true }: LiveMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (geofence) return [geofence.latitude, geofence.longitude];
    if (records[0]) return [records[0].latitude, records[0].longitude];
    return DEFAULT_MAP_CENTER;
  }, [geofence, records]);

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

      {showGeofence && geofence && (
        <Circle
          center={[geofence.latitude, geofence.longitude]}
          radius={geofence.radiusMeters}
          pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.1 }}
        />
      )}

      {records.map((record) => (
        <Marker
          key={record.userId}
          position={[record.latitude, record.longitude]}
          icon={createMarkerIcon(
            record.userName,
            record.isWithinGeofence,
            record.isLive ?? false
          )}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={record.photoUrl}
                alt={`Foto ${record.userName}`}
                style={{ width: '100%', borderRadius: 8, marginBottom: 6 }}
              />
              <strong>{record.userName}</strong>
              <br />
              Masuk · {formatTime(record.timestamp)}
              <br />
              {record.isLive && record.lastUpdate ? (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  ● LIVE · update {formatTime(record.lastUpdate)}
                </span>
              ) : (
                <span style={{ color: '#64748b' }}>
                  Posisi saat absen · {formatDistance(record.distanceFromCenter)} dari pusat
                </span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
