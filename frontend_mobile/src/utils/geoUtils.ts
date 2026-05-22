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
