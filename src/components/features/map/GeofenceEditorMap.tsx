'use client';

import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_ZOOM_LEVEL } from '@/lib/constants';

interface GeofenceEditorMapProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onPositionChange: (lat: number, lng: number) => void;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="geoattend-marker" style="cursor:grab">📍</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function ClickHandler({ onPositionChange }: { onPositionChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Editor geofence interaktif: seret pin atau klik peta untuk memindahkan pusat.
 * Harus di-load dengan next/dynamic { ssr: false }.
 */
export default function GeofenceEditorMap({
  latitude,
  longitude,
  radiusMeters,
  onPositionChange,
}: GeofenceEditorMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={DEFAULT_ZOOM_LEVEL}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPositionChange={onPositionChange} />
      <Circle
        center={[latitude, longitude]}
        radius={radiusMeters}
        pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.15 }}
      />
      <Marker
        position={[latitude, longitude]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const pos = (e.target as L.Marker).getLatLng();
            onPositionChange(pos.lat, pos.lng);
          },
        }}
      />
    </MapContainer>
  );
}
