#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

type PsgcRegion = { code: string; name: string };
type PsgcProvince = { code: string; name: string; regionCode?: string | null; region_code?: string | null };
type PsgcCityMunicipality = {
  code: string;
  name: string;
  provinceCode?: string | null;
  province_code?: string | null;
  regionCode?: string | null;
  region_code?: string | null;
};

type GeocodePoint = { lat: number; lng: number };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEOCODE_MISSING = String(process.env.GEOCODE_MISSING ?? 'true').toLowerCase() === 'true';
const CREATE_REGIONS = String(process.env.CREATE_REGIONS ?? 'true').toLowerCase() === 'true';
const RATE_MS = Number(process.env.GEOCODE_RATE_MS ?? 1200);
const CITY_RADIUS_KM = Number(process.env.CITY_REGION_RADIUS_KM ?? 7);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(urls: string[]): Promise<T> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DamayanRegionSeeder/1.0 (local)' },
      });
      if (!res.ok) {
        lastError = new Error(`${url} returned ${res.status}`);
        continue;
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Failed to fetch JSON from all candidate URLs.');
}

function provinceCodeOf(item: PsgcCityMunicipality): string | null {
  return item.provinceCode ?? item.province_code ?? null;
}

function regionCodeOfProvince(item: PsgcProvince): string | null {
  return item.regionCode ?? item.region_code ?? null;
}

function regionCodeOfCity(item: PsgcCityMunicipality): string | null {
  return item.regionCode ?? item.region_code ?? null;
}

async function geocodeCity(city: string, province: string | null, regionName: string | null): Promise<GeocodePoint | null> {
  const query = [city, province, regionName, 'Philippines'].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'DamayanRegionSeeder/1.0 (local)' } });
    if (!res.ok) return null;
    const body = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(body) || body.length === 0) return null;
    const lat = Number(body[0].lat);
    const lng = Number(body[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function upsertCatalogRow(input: {
  psgcCode: string;
  cityName: string;
  provinceName: string | null;
  regionName: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  const { error } = await supabase.from('ph_city_catalog').upsert(
    {
      psgc_code: input.psgcCode,
      city_name: input.cityName,
      province_name: input.provinceName,
      region_name: input.regionName,
      latitude: input.latitude,
      longitude: input.longitude,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'psgc_code' },
  );

  if (error) {
    throw new Error(`Catalog upsert failed for ${input.cityName}: ${error.message}`);
  }
}

async function ensureCityRegion(input: {
  psgcCode: string;
  cityName: string;
  provinceName: string | null;
  regionName: string | null;
  latitude: number;
  longitude: number;
}) {
  const { error } = await supabase.rpc('ensure_city_region', {
    p_psgc_code: input.psgcCode,
    p_city_name: input.cityName,
    p_province_name: input.provinceName,
    p_region_name: input.regionName,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_radius_km: CITY_RADIUS_KM,
  });

  if (error) {
    throw new Error(`ensure_city_region failed for ${input.cityName}: ${error.message}`);
  }
}

async function run() {
  console.log('Fetching PSGC regions/provinces/cities-municipalities...');

  const [regions, provinces, citiesMunicipalities] = await Promise.all([
    fetchJson<PsgcRegion[]>([
      'https://psgc.gitlab.io/api/regions/',
      'https://psgc.gitlab.io/api/regions',
    ]),
    fetchJson<PsgcProvince[]>([
      'https://psgc.gitlab.io/api/provinces/',
      'https://psgc.gitlab.io/api/provinces',
    ]),
    fetchJson<PsgcCityMunicipality[]>([
      'https://psgc.gitlab.io/api/cities-municipalities/',
      'https://psgc.gitlab.io/api/cities-municipalities',
    ]),
  ]);

  const regionByCode = new Map<string, string>();
  for (const r of regions) {
    if (r.code && r.name) regionByCode.set(r.code, r.name);
  }

  const provinceByCode = new Map<string, { name: string; regionCode: string | null }>();
  for (const p of provinces) {
    if (p.code && p.name) {
      provinceByCode.set(p.code, {
        name: p.name,
        regionCode: regionCodeOfProvince(p),
      });
    }
  }

  console.log(`Found ${citiesMunicipalities.length} cities/municipalities in PSGC.`);

  let processed = 0;
  let geocoded = 0;
  let regioned = 0;
  let failed = 0;

  for (const city of citiesMunicipalities) {
    processed += 1;

    const pCode = provinceCodeOf(city);
    const province = pCode ? provinceByCode.get(pCode)?.name ?? null : null;
    const directRegionCode = regionCodeOfCity(city);
    const provinceRegionCode = pCode ? provinceByCode.get(pCode)?.regionCode ?? null : null;
    const resolvedRegionCode = directRegionCode ?? provinceRegionCode;
    const regionName = resolvedRegionCode ? regionByCode.get(resolvedRegionCode) ?? null : null;

    let point: GeocodePoint | null = null;
    if (GEOCODE_MISSING) {
      point = await geocodeCity(city.name, province, regionName);
      await sleep(RATE_MS);
      if (point) geocoded += 1;
    }

    try {
      await upsertCatalogRow({
        psgcCode: city.code,
        cityName: city.name,
        provinceName: province,
        regionName,
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
      });

      if (CREATE_REGIONS && point) {
        await ensureCityRegion({
          psgcCode: city.code,
          cityName: city.name,
          provinceName: province,
          regionName,
          latitude: point.lat,
          longitude: point.lng,
        });
        regioned += 1;
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Failed for ${city.name} (${city.code}): ${message}`);
    }

    if (processed % 25 === 0) {
      console.log(`Progress: ${processed}/${citiesMunicipalities.length} processed | geocoded=${geocoded} | regions=${regioned} | failed=${failed}`);
    }
  }

  const { data: backfillCount, error: backfillError } = await supabase.rpc('backfill_user_profile_regions_from_city_catalog');
  if (backfillError) {
    console.warn(`Backfill warning: ${backfillError.message}`);
  }

  console.log('Done seeding PH city catalog.');
  console.log({
    processed,
    geocoded,
    regioned,
    failed,
    usersBackfilled: backfillCount ?? null,
    geocodeEnabled: GEOCODE_MISSING,
    createRegionsEnabled: CREATE_REGIONS,
  });
}

void run();
