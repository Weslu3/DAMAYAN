#!/usr/bin/env tsx
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

/**
 * Script: geocode_evacuation_centers
 * - Finds evacuation_centers without lat/lng
 * - Calls Nominatim forward geocoding with address+barangay+municipality
 * - Updates rows with lat/lng
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL = 'https://...';
 *   $env:SUPABASE_KEY = 'service_role_or_anon_key';
 *   npx tsx backend/scripts/geocode_evacuation_centers.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'DamayanGeocoder/1.0 (contact@local)' } });
    if (!res.ok) return null;
    const body = await res.json();
    if (!Array.isArray(body) || body.length === 0) return null;
    const item = body[0];
    return { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log('Fetching evacuation centers missing coordinates...');
  const { data: centers, error } = await supabase
    .from('evacuation_centers')
    .select('id, name, address, barangay, municipality')
    .or('lat.is.null,lng.is.null')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!centers || centers.length === 0) {
    console.log('No centers need geocoding.');
    return;
  }

  console.log(`Found ${centers.length} centers to geocode.`);

  for (const c of centers) {
    const parts = [c.name, c.address, c.barangay, c.municipality].filter(Boolean).join(', ');
    console.log(`Geocoding ${c.id} -> ${parts}`);
    const coords = await geocode(parts);
    if (coords) {
      const { error: upErr } = await supabase
        .from('evacuation_centers')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', c.id);
      if (upErr) {
        console.warn('Update failed for', c.id, upErr.message);
      } else {
        console.log(`Updated ${c.id} => ${coords.lat}, ${coords.lng}`);
      }
    } else {
      console.warn('No geocode result for', c.id);
    }
    // Nominatim rate-limit: be polite
    await sleep(1200);
  }

  console.log('Done.');
}

void run();
