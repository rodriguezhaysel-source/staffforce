import { Geolocation, Position } from '@capacitor/geolocation'

export interface GeoResult {
  lat: number
  lng: number
  accuracy: number
}

export interface GeofenceCheck {
  allowed: boolean
  distance: number
  position: GeoResult | null
  error?: string
  error_es?: string
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function getCurrentPosition(): Promise<GeoResult> {
  try {
    // Try Capacitor GPS first (native, more accurate)
    const pos: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }
  } catch {
    // Fallback to browser geolocation (web)
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }
}

export async function checkGeofence(
  locationGeoLat: number,
  locationGeoLng: number,
  locationGeoRadius: number,
  locationName: string
): Promise<GeofenceCheck> {
  let position: GeoResult | null = null
  try {
    position = await getCurrentPosition()
  } catch {
    return {
      allowed: false,
      distance: 0,
      position: null,
      error: 'Location access is required to clock in/out.',
      error_es: 'Se requiere acceso a la ubicación para registrar entrada/salida.',
    }
  }

  const distance = haversine(position.lat, position.lng, locationGeoLat, locationGeoLng)

  if (distance > locationGeoRadius) {
    return {
      allowed: false,
      distance: Math.round(distance),
      position,
      error: `You are ${Math.round(distance)}m away from ${locationName}. You must be within ${locationGeoRadius}m to clock in/out.`,
      error_es: `Estás a ${Math.round(distance)}m de ${locationName}. Debes estar dentro de ${locationGeoRadius}m para registrar entrada/salida.`,
    }
  }

  return { allowed: true, distance: Math.round(distance), position }
}
