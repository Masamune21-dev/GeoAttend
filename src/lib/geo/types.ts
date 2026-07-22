export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeofenceData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface GeofenceCheckResult {
  isInside: boolean;
  distanceMeters: number;
  geofenceId: string | null;
  geofenceName: string | null;
}
