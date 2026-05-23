import * as Location from 'expo-location';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

const METERS_PER_DEGREE_LATITUDE = 111_132;

export function manhattanDistanceMeters(a: GeoCoordinates, b: GeoCoordinates): number {
  const latitudeMeters = Math.abs(a.latitude - b.latitude) * METERS_PER_DEGREE_LATITUDE;
  const averageLatitude = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.cos(averageLatitude);
  const longitudeMeters = Math.abs(a.longitude - b.longitude) * Math.max(metersPerDegreeLongitude, 1);

  return latitudeMeters + longitudeMeters;
}

/**
 * Builds an L-shaped route following the Manhattan grid model.
 * Travels along one axis first (latitude), then the other (longitude),
 * creating a path that hugs a grid like real city streets rather than
 * cutting diagonally through buildings.
 */
export function manhattanRouteCoords(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
  stepsPerLeg = 24,
): GeoCoordinates[] {
  const latDiff = destination.latitude - origin.latitude;
  const lngDiff = destination.longitude - origin.longitude;

  const coords: GeoCoordinates[] = [];

  // Leg 1 – travel along latitude (N/S) from origin to corner
  for (let i = 0; i <= stepsPerLeg; i++) {
    coords.push({
      latitude: origin.latitude + (latDiff * i) / stepsPerLeg,
      longitude: origin.longitude,
    });
  }

  // Leg 2 – travel along longitude (E/W) from corner to destination
  for (let i = 1; i <= stepsPerLeg; i++) {
    coords.push({
      latitude: destination.latitude,
      longitude: origin.longitude + (lngDiff * i) / stepsPerLeg,
    });
  }

  return coords;
}

export function sortByManhattanDistance<T extends GeoCoordinates>(origin: GeoCoordinates, items: T[]): T[] {
  return [...items].sort((left, right) => manhattanDistanceMeters(origin, left) - manhattanDistanceMeters(origin, right));
}

export function formatCoordinates(coords: GeoCoordinates): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

function formatAddressParts(address: Location.LocationGeocodedAddress): string | null {
  const parts = [
    address.name,
    address.street,
    address.city,
    address.subregion,
    address.region,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return null;
  }

  const uniqueParts = Array.from(new Set(parts));
  return uniqueParts.join(', ');
}

export async function resolveReadableAddress(coords: GeoCoordinates): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    const formatted = results
      .map((result) => formatAddressParts(result))
      .find((value): value is string => Boolean(value));

    return formatted ?? formatCoordinates(coords);
  } catch {
    return formatCoordinates(coords);
  }
}
