'use client';

/**
 * MapLibreDashboard — 2D interactive incident map.
 *
 * Uses Leaflet (already installed) with OpenStreetMap tiles.
 * Adapts its view and data scope based on user role and active calamity phase.
 *
 * Role behaviour:
 *  - dispatcher / admin + DURING phase → city-wide view, all active incident pins, 30s auto-refresh
 *  - line_manager → restricted to ~500m radius around their shelter boundary, own incidents only
 *
 * Leaflet CSS must be loaded at the page/layout level:
 *   import 'leaflet/dist/leaflet.css';
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCalamityContext } from '../hooks/useCalamityContext';
import { reverseGeocodeNominatim } from '../lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export interface IncidentPin {
  id: string;
  latitude: number | null;
  longitude: number | null;
  resolved_address: string | null;
  severity: string;
  status: string;
}

export interface ShelterBoundary {
  latitude: number;
  longitude: number;
}

export interface MapLibreDashboardProps {
  userRole: 'dispatcher' | 'line_manager' | 'admin';
  accessToken: string;
  /** Required for line_manager — centres and restricts the map to this location */
  shelterBoundary?: ShelterBoundary;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#DC2626',
  high: '#DC2626',
  moderate: '#D97706',
  low: '#16A34A',
};

function severityColor(severity: string): string {
  return SEVERITY_COLOR[severity?.toLowerCase()] ?? '#6B7280';
}

export function MapLibreDashboard({
  userRole,
  accessToken,
  shelterBoundary,
}: {
  readonly userRole: 'dispatcher' | 'line_manager' | 'admin';
  readonly accessToken: string;
  readonly shelterBoundary?: ShelterBoundary;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);

  const [incidents, setIncidents] = useState<IncidentPin[]>([]);
  const [incidentAddressMap, setIncidentAddressMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { currentPhase, shouldTrackCityGPS } = useCalamityContext();

  const defaultCenter: [number, number] = shelterBoundary
    ? [shelterBoundary.latitude, shelterBoundary.longitude]
    : [14.5995, 120.9842];

  const defaultZoom = userRole === 'line_manager' ? 16 : 12;

  // ── Initialise Leaflet map (client-side only) ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // Patch default icon paths broken by Next.js bundling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      mapRef.current = L.map(containerRef.current).setView(
        defaultCenter,
        defaultZoom,
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Draw jurisdiction circle for site managers
      if (userRole === 'line_manager' && shelterBoundary) {
        L.circle(
          [shelterBoundary.latitude, shelterBoundary.longitude],
          {
            radius: 500,
            color: '#2563EB',
            fillColor: '#DBEAFE',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '6 4',
          },
        ).addTo(mapRef.current);
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch incident pins ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchIncidents = async () => {
      setFetchError(null);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch(`${API_BASE_URL}/incident-reports`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const body = (await res.json()) as {
          data?: IncidentPin[];
          incidents?: IncidentPin[];
        };
        if (!cancelled) {
          setIncidents(body.data ?? body.incidents ?? []);
        }
      } catch (error) {
        clearTimeout(timeout);
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : 'Could not load incident data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchIncidents();

    // Auto-refresh every 30 s while in active DURING phase
    const interval = shouldTrackCityGPS
      ? setInterval(fetchIncidents, 30_000)
      : null;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [accessToken, shouldTrackCityGPS]);

  // ── Resolve readable incident addresses for map popups ───────────────────
  useEffect(() => {
    let cancelled = false;

    const resolveAddresses = async () => {
      const nextAddressMap: Record<string, string> = {};

      await Promise.all(
        incidents.map(async (incident) => {
          if (incident.latitude == null || incident.longitude == null) {
            return;
          }

          if (incident.resolved_address) {
            nextAddressMap[incident.id] = incident.resolved_address;
            return;
          }

          nextAddressMap[incident.id] = await reverseGeocodeNominatim(
            incident.latitude,
            incident.longitude,
          );
        }),
      );

      if (!cancelled) {
        setIncidentAddressMap(nextAddressMap);
      }
    };

    if (incidents.length > 0) {
      void resolveAddresses();
    } else {
      setIncidentAddressMap({});
    }

    return () => {
      cancelled = true;
    };
  }, [incidents]);

  // ── Plot markers whenever incidents or the map change ─────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const pinnable = incidents.filter(
        (inc): inc is IncidentPin & { latitude: number; longitude: number } =>
          inc.latitude != null && inc.longitude != null,
      );

      // Site managers only see pins within ~2 km of their shelter
      const visible =
        userRole === 'line_manager' && shelterBoundary
          ? pinnable.filter((inc) => {
              const dlat = inc.latitude - shelterBoundary.latitude;
              const dlng = inc.longitude - shelterBoundary.longitude;
              return Math.hypot(dlat, dlng) < 0.018;
            })
          : pinnable;

      visible.forEach((inc) => {
        const color = severityColor(inc.severity);

        const icon = L.divIcon({
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>`,
          className: '',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([inc.latitude, inc.longitude], { icon })
          .bindPopup(
            `<div style="font-size:12px;line-height:1.6;min-width:160px">
              <strong>${(inc.severity ?? 'INCIDENT').toUpperCase()}</strong><br/>
              ${incidentAddressMap[inc.id] ?? inc.resolved_address ?? `${inc.latitude.toFixed(5)}, ${inc.longitude.toFixed(5)}`}<br/>
              <span style="color:#6B7280">Status: ${inc.status ?? '—'}</span>
            </div>`,
            { maxWidth: 240 },
          )
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    });

  }, [incidents, userRole, shelterBoundary, incidentAddressMap]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Status bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              currentPhase === 'DURING'
                ? 'bg-red-500 animate-pulse'
                : 'bg-green-500'
            }`}
          />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {currentPhase} Phase
          </span>
          {userRole === 'line_manager' && (
            <span className="text-xs text-gray-400 italic">
              · Jurisdiction view
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {incidents.filter((i) => i.latitude && i.longitude).length} plotted
        </span>
      </div>

      {/* Map container */}
      <div className="relative flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: 420 }}
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 z-[1000]">
            <p className="text-sm text-gray-500">Loading map data…</p>
          </div>
        )}

        {fetchError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg z-[1000] shadow">
            {fetchError}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-600" />{" "}
          High / Critical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />{" "}
          Moderate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-600" />{" "}
          Low
        </span>
        {userRole === 'line_manager' && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-blue-400 bg-blue-100" />{" "}
            Shelter radius (500 m)
          </span>
        )}
      </div>
    </div>
  );
}
