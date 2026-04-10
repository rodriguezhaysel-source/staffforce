export interface GeoResult {
  allowed: boolean
  distance: number   // -1 = permission denied, >0 = meters from target
  coords: { lat: number; lng: number } | null
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  })
}

export async function checkGeofence(locationConfig: {
  lat: number
  lng: number
  radius_meters: number
}): Promise<GeoResult> {
  const coords = await getCurrentPosition()
  if (!coords) return { allowed: false, distance: -1, coords: null }
  const dist = haversineDistance(coords.lat, coords.lng, locationConfig.lat, locationConfig.lng)
  return { allowed: dist <= locationConfig.radius_meters, distance: Math.round(dist), coords }
}
