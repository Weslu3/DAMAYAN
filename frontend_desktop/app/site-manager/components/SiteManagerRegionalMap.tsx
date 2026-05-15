"use client";

import { useEffect, useRef } from "react";
import type { CapacityCenter } from "../../lib/types";

interface SiteManagerRegionalMapProps {
  centers: CapacityCenter[];
  height?: number | string;
}

const PH_CENTER: [number, number] = [12.8797, 121.774];

export default function SiteManagerRegionalMap({
  centers,
  height = 440,
}: SiteManagerRegionalMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geocodeCacheRef = useRef<Record<string, [number, number]>>({});

  useEffect(() => {
    if (typeof window === "undefined" || mapInstanceRef.current) {
      return;
    }

    if (!document.getElementById("lf-css")) {
      const cssLink = document.createElement("link");
      cssLink.id = "lf-css";
      cssLink.rel = "stylesheet";
      cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(cssLink);
    }

    import("leaflet").then((mod) => {
      const L = (mod as any).default || mod;
      if (!mapRef.current || mapInstanceRef.current) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: PH_CENTER,
        zoom: 7,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      leafletRef.current = L;
      drawMarkers();
      void geocodeMissingCenters();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawMarkers();
    void geocodeMissingCenters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers]);

  function fallbackPoint(index: number): [number, number] {
    const row = Math.floor(index / 6);
    const col = index % 6;
    const lat = 12.6 + row * 0.35;
    const lng = 121.1 + col * 0.32;
    return [lat, lng];
  }

  function markerColor(center: CapacityCenter): string {
    if (center.utilizationRate >= 90) return "#ba1a1a";
    if (center.utilizationRate >= 70) return "#FFB300";
    return "#2E7D32";
  }

  function markerHtml(center: CapacityCenter): string {
    const color = markerColor(center);
    return `<div style="position:relative;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`;
  }

  function drawMarkers() {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) {
      return;
    }

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current = [];

    if (centers.length === 0) {
      return;
    }

    const bounds = L.latLngBounds([]);

    centers.forEach((center, index) => {
      const cached = geocodeCacheRef.current[center.id] ?? fallbackPoint(index);
      const marker = L.marker(cached, {
        icon: L.divIcon({
          className: "",
          html: markerHtml(center),
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family:Public Sans,sans-serif;min-width:220px">
          <div style="font-weight:800;font-size:12px;margin-bottom:4px">${center.name}</div>
          <div style="font-size:11px;color:#4b5563;margin-bottom:2px">${center.barangay}, ${center.municipality}</div>
          <div style="font-size:11px;color:#111827">${center.currentOccupancy.toLocaleString()} / ${center.capacity.toLocaleString()} pax</div>
          <div style="font-size:11px;color:#111827">Available: ${center.availableSlots.toLocaleString()}</div>
        </div>`,
      );

      markersRef.current.push(marker);
      bounds.extend(cached);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  }

  async function geocodeMissingCenters() {
    const missing = centers.filter((center) => !geocodeCacheRef.current[center.id]).slice(0, 12);
    if (missing.length === 0) {
      return;
    }

    for (const center of missing) {
      const query = `${center.barangay}, ${center.municipality}, Philippines`;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`,
        );
        const json = (await response.json()) as Array<{ lat: string; lon: string }>;
        if (Array.isArray(json) && json.length > 0) {
          geocodeCacheRef.current[center.id] = [
            Number.parseFloat(json[0].lat),
            Number.parseFloat(json[0].lon),
          ];
        }
      } catch {
        // Ignore geocoding failures; fallback points keep the map usable.
      }
    }

    drawMarkers();
  }

  return (
    <div style={{ width: "100%", height, borderRadius: "1.5rem", overflow: "hidden" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
