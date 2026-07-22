import { create } from 'zustand';
import type { GeoCoordinates } from '@/lib/geo/types';

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

interface LocationState {
  coords: GeoCoordinates | null;
  error: string | null;
  permission: LocationPermission;
  isTracking: boolean;
  setCoords: (coords: GeoCoordinates) => void;
  setError: (error: string | null) => void;
  setPermission: (permission: LocationPermission) => void;
  setTracking: (isTracking: boolean) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  coords: null,
  error: null,
  permission: 'unknown',
  isTracking: false,
  setCoords: (coords) => set({ coords, error: null }),
  setError: (error) => set({ error }),
  setPermission: (permission) => set({ permission }),
  setTracking: (isTracking) => set({ isTracking }),
  reset: () => set({ coords: null, error: null, isTracking: false }),
}));
