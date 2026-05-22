"use client";

import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Home, TriangleAlert } from "lucide-react";
import type { CapacityCenter } from "../../lib/types";
import { geocodeAddress } from "../../lib/api";

interface SiteManagerRegionalMapProps {
  centers: CapacityCenter[];
  token: string;
  height?: number | string;
  phase?: 'before' | 'during' | 'after';
  assignedCenterId?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
  incidentReports?: any[];
}

const PH_CENTER: [number, number] = [12.8797, 121.774];

const FALLBACK_COORDS: Record<string, [number, number]> = {
  "makati": [14.5547, 121.0244],
  "quezon city": [14.676, 121.0437],
  "pasig": [14.5764, 121.0851],
  "taguig": [14.5176, 121.0509],
  "manila": [14.5995, 120.9842],
  "marikina": [14.6507, 121.1029],
  "san juan": [14.6042, 121.03],
  "mandaluyong": [14.5794, 121.0359],
  "pasay": [14.5378, 120.9993],
  "parañaque": [14.4793, 121.0198],
  "las piñas": [14.4445, 120.9939],
  "muntinlupa": [14.4081, 121.0415],
  "valenzuela": [14.7011, 120.983],
  "malabon": [14.6628, 120.956],
  "navotas": [14.6732, 120.9429],
  "pateros": [14.5454, 121.0687],
  "caloocan": [14.6507, 120.9715],
  "cauayan": [16.92, 121.77],
  "isabela": [17, 122],
};

export default function SiteManagerRegionalMap({
  centers,
  token,
  height = 550,
  phase = 'before',
  assignedCenterId,
  assignedMunicipality,
  assignedBarangay,
  incidentReports = [],
}: {
  readonly centers: CapacityCenter[];
  readonly token: string;
  readonly height?: number | string;
  readonly phase?: 'before' | 'during' | 'after';
  readonly assignedCenterId?: string;
  readonly assignedMunicipality?: string;
  readonly assignedBarangay?: string;
  readonly incidentReports?: any[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const incidentMarkersRef = useRef<any[]>([]);
  const geocodeCacheRef = useRef<Record<string, [number, number]>>({});

  // HUD state
  const [showShelters, setShowShelters] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "critical" | "moderate" | "safe">("all");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Computed stats
  const totalShelters = centers.length;

  useEffect(() => {
    if (globalThis.window === undefined || mapInstanceRef.current) return;

    if (!document.getElementById("lf-css")) {
      const cssLink = document.createElement("link");
      cssLink.id = "lf-css";
      cssLink.rel = "stylesheet";
      cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(cssLink);
      
      const style = document.createElement("style");
      style.innerHTML = `
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes alarm-pulse {
          0% { box-shadow: 0 0 0 0 rgba(186, 26, 26, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(186, 26, 26, 0); }
          100% { box-shadow: 0 0 0 0 rgba(186, 26, 26, 0); }
        }
        .assigned-marker::after {
          content: '';
          position: absolute;
          left: -4px; top: -4px; right: -4px; bottom: -4px;
          border-radius: 50%;
          border: 3px solid #81C784;
          animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .incident-marker {
          animation: alarm-pulse 1.5s infinite;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 12px 40px -8px rgba(0,0,0,0.2) !important;
        }
        .leaflet-popup-tip { display: none !important; }
      `;
      document.head.appendChild(style);
    }

    import("leaflet").then((mod) => {
      const L = (mod as any).default || mod;
      if (!mapRef.current || mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, { center: PH_CENTER, zoom: 7, zoomControl: false });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
      leafletRef.current = L;
      drawMarkers();
      drawIncidentMarkers();
      void geocodeMissingCenters();
      void geocodeIncidentLocations();
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
    drawIncidentMarkers();
    void geocodeMissingCenters();
    void geocodeIncidentLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers, assignedCenterId, assignedMunicipality, assignedBarangay, showShelters, selectedFilter, searchQuery, phase, token]);

  useEffect(() => {
    drawIncidentMarkers();
    void geocodeIncidentLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, incidentReports, token]);

  // Auto-center the map to the assigned location whenever it changes
  useEffect(() => {
    if (!assignedMunicipality || !token) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    const locationKey = `assigned-location:${assignedMunicipality}:${assignedBarangay ?? ''}`;
    const cached = geocodeCacheRef.current[locationKey];
    if (cached) {
      map.flyTo(cached, 14, { animate: true, duration: 1.5 });
      return;
    }

    const query = assignedBarangay
      ? `${assignedBarangay}, ${assignedMunicipality}, Philippines`
      : `${assignedMunicipality}, Philippines`;

    geocodeAddress(token, query)
      .then((result) => {
        const coords: [number, number] = [result.latitude, result.longitude];
        geocodeCacheRef.current[locationKey] = coords;
        map.flyTo(coords, 14, { animate: true, duration: 1.5 });
      })
      .catch(() => {
        // Fallback if SDK fails
        const muniKey = assignedMunicipality.toLowerCase().trim();
        const fallback = FALLBACK_COORDS[muniKey] || PH_CENTER;
        geocodeCacheRef.current[locationKey] = fallback;
        map.flyTo(fallback, 13, { animate: true, duration: 1.5 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedMunicipality, assignedBarangay, token]);

  // Refit bounds when filter or search changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L || markersRef.current.length === 0) return;

    const bounds = L.latLngBounds([]);
    let hasValidMarker = false;
    markersRef.current.forEach((marker: any) => {
      bounds.extend(marker.getLatLng());
      hasValidMarker = true;
    });

    if (hasValidMarker && bounds.isValid()) {
      map.flyToBounds(bounds.pad(0.2), { duration: 1 });
    }
  }, [selectedFilter, searchQuery, phase]);

  function markerColor(center: CapacityCenter): string {
    if (center.id === assignedCenterId) return "#81C784";
    if (phase === 'before') {
      // Readiness based on available slots vs capacity
      const readinessPercent = center.capacity > 0 ? Math.round((center.availableSlots / center.capacity) * 100) : 0;
      return readinessPercent >= 60 ? "#2E7D32" : readinessPercent >= 30 ? "#FFB300" : "#ba1a1a";
    }
    if (phase === 'after') {
      return center.currentOccupancy === 0 ? "#2E7D32" : "#FFB300";
    }
    if (center.utilizationRate >= 90) return "#ba1a1a";
    if (center.utilizationRate >= 70) return "#FFB300";
    return "#2E7D32";
  }

  function markerHtml(center: CapacityCenter): string {
    const color = markerColor(center);
    const isAssigned = center.id === assignedCenterId;
    const size = isAssigned ? 22 : 16;
    const iconMarkup = renderToStaticMarkup(
      <Home size={Math.round(size * 0.72)} color="#fff" strokeWidth={2.4} />,
    );

    return `<div class="${isAssigned ? 'assigned-marker' : ''}" style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.4);z-index:${isAssigned ? '999' : 'auto'};display:flex;align-items:center;justify-content:center;">${iconMarkup}</div>`;
  }

  function incidentMarkerHtml(title: string, severity: string): string {
    const isHigh = severity.toLowerCase() === 'high' || severity.toLowerCase() === 'severe' || severity.toLowerCase() === 'major';
    const color = isHigh ? "#ba1a1a" : "#FFB300";
    const iconMarkup = renderToStaticMarkup(
      <TriangleAlert size={14} color="#fff" strokeWidth={2.4} />,
    );
    return `<div class="incident-marker" style="position:relative;width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 0 12px ${color};">${iconMarkup}</div>`;
  }

  function getLocationQuery(rawLocation: string): string {
    const location = rawLocation.trim();
    if (!location) return "";
    if (/philippines/i.test(location)) return location;

    const fallbackContext = centers[0]
      ? `${centers[0].barangay}, ${centers[0].municipality}, Philippines`
      : "Philippines";

    return `${location}, ${fallbackContext}`;
  }

  async function geocodeCachedLocation(cacheKey: string, rawLocation: string): Promise<void> {
    if (geocodeCacheRef.current[cacheKey] || !token) return;

    const query = getLocationQuery(rawLocation);
    if (!query) return;

    try {
      const result = await geocodeAddress(token, query);
      geocodeCacheRef.current[cacheKey] = [result.latitude, result.longitude];
    } catch {
      // Ignore geocoding failures
    }
  }

  async function geocodeIncidentLocations() {
    if (phase !== 'during' || !incidentReports.length) return;

    for (const incident of incidentReports) {
      await geocodeCachedLocation(`incident:${incident.id}`, incident.location ?? "");
    }

    drawIncidentMarkers();
  }

  function drawIncidentMarkers() {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    incidentMarkersRef.current.forEach((m) => map.removeLayer(m));
    incidentMarkersRef.current = [];

    if (phase !== 'during' || !incidentReports || incidentReports.length === 0) return;

    incidentReports.forEach((incident) => {
      const coords = geocodeCacheRef.current[`incident:${incident.id}`];
      if (!coords) return;

      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: "",
          html: incidentMarkerHtml(incident.title || incident.type, incident.severity),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family:Public Sans,sans-serif;min-width:220px;padding:4px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:32px;height:32px;border-radius:50%;background:#ba1a1a;display:flex;align-items:center;justify-content:center;color:#fff">
              <span class="material-symbols-outlined" style="font-size:16px">warning</span>
            </div>
            <div>
              <div style="font-weight:900;font-size:12px;color:#1a1c19">${incident.title || incident.type}</div>
              <div style="font-size:9px;color:#707a6c;text-transform:uppercase;font-weight:800;letter-spacing:0.1em">Live Alert Pin</div>
            </div>
          </div>
          <div style="background:#fdf2f2;padding:10px;border-radius:12px;margin-bottom:6px;border:1px solid #fde2e2">
            <p style="font-size:11px;color:#ba1a1a;font-weight:700;margin-bottom:4px">Severity: ${incident.severity}</p>
            <p style="font-size:10px;color:#444743;font-weight:500;line-height:1.4">${incident.content || incident.description}</p>
          </div>
          <div style="font-size:8px;color:#707a6c;text-align:right">Location: ${incident.location}</div>
        </div>`
      );

      incidentMarkersRef.current.push(marker);
    });
  }

  function getFilteredCenters(): CapacityCenter[] {
    let filtered = centers;

    // Scope to assigned municipality (and optionally barangay) so the user only
    // sees shelters within their assigned area
    if (assignedMunicipality) {
      const muni = assignedMunicipality.toLowerCase().trim();
      filtered = filtered.filter(c => c.municipality.toLowerCase().trim() === muni);
    }

    if (selectedFilter !== "all") {
      filtered = filtered.filter(c => {
        if (phase === 'before') {
          const readinessPercent = c.capacity > 0 ? Math.round((c.availableSlots / c.capacity) * 100) : 0;
          if (selectedFilter === "critical") return readinessPercent < 30;
          if (selectedFilter === "moderate") return readinessPercent >= 30 && readinessPercent < 60;
          if (selectedFilter === "safe") return readinessPercent >= 60;
        } else if (phase === 'after') {
          const checkedOut = Math.max(0, c.capacity - c.currentOccupancy);
          const progressWidth = c.capacity > 0 ? Math.round((checkedOut / c.capacity) * 100) : 100;
          if (selectedFilter === "critical") return progressWidth < 30;
          if (selectedFilter === "moderate") return progressWidth >= 30 && progressWidth < 70;
          if (selectedFilter === "safe") return progressWidth >= 70;
        } else {
          // During phase
          if (selectedFilter === "critical") return c.utilizationRate >= 90;
          if (selectedFilter === "moderate") return c.utilizationRate >= 70 && c.utilizationRate < 90;
          if (selectedFilter === "safe") return c.utilizationRate < 70;
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.barangay.toLowerCase().includes(q) ||
        c.municipality.toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  function drawMarkers() {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (!showShelters) return;

    const filtered = getFilteredCenters();
    if (filtered.length === 0) return;

    const bounds = L.latLngBounds([]);

    filtered.forEach((center) => {
      const cached = geocodeCacheRef.current[center.id];
      if (!cached) return;

      const marker = L.marker(cached, {
        icon: L.divIcon({
          className: "",
          html: markerHtml(center),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(map);

      const isAssigned = center.id === assignedCenterId;
      const badge = isAssigned ? `<div style="background:#81C784;color:#1a1c19;padding:4px 10px;border-radius:8px;font-size:9px;font-weight:900;text-transform:uppercase;margin-bottom:10px;display:inline-flex;align-items:center;gap:4px;letter-spacing:0.05em"><span style="font-size:10px">&#9733;</span> My Assigned Shelter</div>` : '';
      
      let utilColor = center.utilizationRate >= 90 ? "#ba1a1a" : center.utilizationRate >= 70 ? "#FFB300" : "#2E7D32";
      let utilLabel = "Utilization";
      let utilValue = `${Math.round(center.utilizationRate)}%`;
      let progressWidth = Math.min(100, center.utilizationRate);
      let detailsRow = `<div style="display:flex;justify-content:space-between;font-size:10px;color:#444743;font-weight:700">
            <span>Capacity: <b style="color:#1a1c19">${center.capacity.toLocaleString()}</b></span>
            <span>Available: <b style="color:#2E7D32">${center.availableSlots.toLocaleString()}</b></span>
          </div>`;

      if (phase === 'before') {
        const readinessPercent = center.capacity > 0
          ? Math.round((center.availableSlots / center.capacity) * 100)
          : 0;
        utilColor = readinessPercent >= 60 ? "#2E7D32" : readinessPercent >= 30 ? "#FFB300" : "#ba1a1a";
        utilLabel = "Available Capacity";
        utilValue = `${center.availableSlots.toLocaleString()} slots`;
        progressWidth = readinessPercent;
        detailsRow = `<div style="display:flex;justify-content:space-between;font-size:10px;color:#444743;font-weight:700">
            <span>Occupancy: <b style="color:#1a1c19">${center.currentOccupancy.toLocaleString()}</b></span>
            <span>Status: <b style="color:${utilColor}">${center.status.toUpperCase()}</b></span>
          </div>`;
      } else if (phase === 'after') {
        const isDeactivated = center.currentOccupancy === 0;
        utilColor = isDeactivated ? "#2E7D32" : "#FFB300";
        utilLabel = "De-escalation Status";
        utilValue = isDeactivated ? "Deactivated (100% Done)" : "Active Checking Out";
        
        // Progress of checkouts
        const checkedOut = Math.max(0, center.capacity - center.currentOccupancy);
        progressWidth = center.capacity > 0 ? Math.round((checkedOut / center.capacity) * 100) : 100;
        
        detailsRow = `<div style="display:flex;justify-content:space-between;font-size:10px;color:#444743;font-weight:700">
            <span>Remaining: <b style="color:#ba1a1a">${center.currentOccupancy.toLocaleString()}</b></span>
            <span>Checked Out: <b style="color:#2E7D32">${checkedOut.toLocaleString()}</b></span>
          </div>`;
      }

      marker.bindPopup(
        `<div style="font-family:Public Sans,sans-serif;min-width:240px;padding:4px">
          ${badge}
          <div style="font-weight:900;font-size:13px;margin-bottom:2px;color:#1a1c19">${center.name}</div>
          <div style="font-size:10px;color:#707a6c;margin-bottom:10px;font-weight:600">${center.barangay}, ${center.municipality}</div>
          <div style="background:#f4f4ef;padding:10px 12px;border-radius:12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:9px;color:#707a6c;font-weight:800;text-transform:uppercase">${utilLabel}</span>
              <span style="font-size:11px;font-weight:900;color:${utilColor}">${utilValue}</span>
            </div>
            <div style="background:#dadad5;border-radius:4px;height:6px;overflow:hidden">
              <div style="height:100%;border-radius:4px;background:${utilColor};width:${progressWidth}%"></div>
            </div>
          </div>
          ${detailsRow}
        </div>`,
      );

      markersRef.current.push(marker);
    });
  }

  async function geocodeMissingCenters() {
    if (!token) return;

    const missing = centers.filter((c) => !geocodeCacheRef.current[c.id]).slice(0, 12);
    if (missing.length === 0) return;

    for (const center of missing) {
      const address = [center.address, center.barangay, center.municipality, "Philippines"]
        .filter(Boolean)
        .join(", ");
      try {
        const result = await geocodeAddress(token, address);
        geocodeCacheRef.current[center.id] = [result.latitude, result.longitude];
      } catch {
        // Fallback geocoding if the API fails so markers are still drawn
        const muniKey = center.municipality.toLowerCase().trim();
        const base = FALLBACK_COORDS[muniKey] || PH_CENTER;
        // Use a tiny deterministic offset (0.01 deg is ~1km) so markers in the same city don't completely overlap
        const hash = center.name.length + (center.capacity % 100);
        const latOffset = (hash % 10 - 5) * 0.005;
        const lngOffset = ((hash * 3) % 10 - 5) * 0.005;
        geocodeCacheRef.current[center.id] = [base[0] + latOffset, base[1] + lngOffset];
      }
    }
    drawMarkers();
  }

  const phaseLabel = phase === 'before' ? 'Pre-Deployment Readiness' : phase === 'during' ? 'Active Emergency Response' : 'Post-Disaster Recovery';
  const phaseColor = phase === 'before' ? '#2E7D32' : phase === 'during' ? '#FFB300' : '#2E7D32';

  return (
    <div className={`flex flex-col gap-4 w-full ${isFullscreen ? 'fixed inset-0 z-[200] p-6 bg-white dark:bg-[#1a1c19]' : ''}`} style={isFullscreen ? {} : { height: typeof height === 'number' ? `${height}px` : height }}>
      <div className="relative flex-grow w-full border border-[#dadad5] dark:border-[#3b3b3b]" style={{ borderRadius: isFullscreen ? "2rem" : "1.5rem", overflow: "hidden" }}>
        {/* Map Container */}
        <div ref={mapRef} style={{ width: "100%", height: "100%", zIndex: 0 }} />

      {/* Top-Left: Phase Badge + Search */}
      <div className="absolute top-4 left-4 z-[10] flex flex-col gap-3 max-w-[280px]">
        {/* Phase indicator */}
        <div className="bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/30 shadow-xl flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: phaseColor }} />
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#707a6c]">Map Phase</p>
            <p className="text-[10px] font-black text-[#1a1c19] dark:text-white">{phaseLabel}</p>
          </div>
        </div>

        {/* Your Zone badge */}
        {assignedMunicipality && (
          <div className="bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-[#81C784]/50 shadow-xl flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#81C784" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#2E7D32]">Your Zone</p>
              <p className="text-[10px] font-black text-[#1a1c19] dark:text-white truncate">
                {assignedBarangay ? `${assignedBarangay}, ` : ""}{assignedMunicipality}
              </p>
            </div>
            <button
              title="Re-center to your zone"
              onClick={() => {
                const map = mapInstanceRef.current;
                if (!map || !token) return;
                const locationKey = `assigned-location:${assignedMunicipality}:${assignedBarangay ?? ''}`;
                const cached = geocodeCacheRef.current[locationKey];
                if (cached) { map.flyTo(cached, 14, { animate: true, duration: 1 }); return; }
                const query = assignedBarangay
                  ? `${assignedBarangay}, ${assignedMunicipality}, Philippines`
                  : `${assignedMunicipality}, Philippines`;
                geocodeAddress(token, query)
                  .then(r => { 
                    geocodeCacheRef.current[locationKey] = [r.latitude, r.longitude];
                    map.flyTo([r.latitude, r.longitude], 14, { animate: true, duration: 1 }); 
                  })
                  .catch(() => {
                    const muniKey = assignedMunicipality.toLowerCase().trim();
                    const fallback = FALLBACK_COORDS[muniKey] || PH_CENTER;
                    geocodeCacheRef.current[locationKey] = fallback;
                    map.flyTo(fallback, 13, { animate: true, duration: 1 });
                  });
              }}
              className="w-6 h-6 rounded-lg bg-[#81C784]/25 hover:bg-[#81C784]/40 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[#2E7D32]" style={{ fontSize: 14 }}>my_location</span>
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shelters..."
            className="w-full bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-xl rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold border border-white/30 shadow-lg outline-none focus:ring-2 focus:ring-green-500/30 text-[#1a1c19] dark:text-white placeholder:text-[#707a6c]"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-sm text-[#707a6c]">search</span>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {([["all", "All"], ["critical", "Critical"], ["moderate", "Moderate"], ["safe", "Safe"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                selectedFilter === key
                  ? "bg-[#1a1c19] text-white shadow-md"
                  : "bg-white/80 dark:bg-white/10 text-[#444743] dark:text-[#a0a39f] hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Top-Right: Controls */}
      <div className="absolute top-4 right-4 z-[10] flex flex-col gap-2">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="w-10 h-10 bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-xl rounded-xl border border-white/30 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-[#1a1c19] dark:text-white"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          <span className="material-symbols-outlined text-lg">{isFullscreen ? "fullscreen_exit" : "fullscreen"}</span>
        </button>
        <button
          onClick={() => setShowShelters(!showShelters)}
          className={`w-10 h-10 backdrop-blur-xl rounded-xl border shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all ${
            showShelters ? "bg-green-500 text-white border-green-600" : "bg-white/90 dark:bg-[#1a1c19]/90 border-white/30 text-[#707a6c]"
          }`}
          title="Toggle Shelters"
        >
          <span className="material-symbols-outlined text-lg">home</span>
        </button>
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`w-10 h-10 backdrop-blur-xl rounded-xl border shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all ${
            showLegend ? "bg-[#2E7D32] text-white border-[#1B5E20]" : "bg-white/90 dark:bg-[#1a1c19]/90 border-white/30 text-[#707a6c]"
          }`}
          title="Toggle Legend"
        >
          <span className="material-symbols-outlined text-lg">info</span>
        </button>
      </div>

      {/* Legend Panel */}
      {showLegend && (
        <div className="absolute bottom-20 right-4 z-[10] bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-xl rounded-2xl p-4 border border-white/30 shadow-xl min-w-[180px] animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#dadad5]/50">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#707a6c]">Map Legend</p>
            <button onClick={() => setShowLegend(false)} className="text-[#707a6c] hover:text-[#1a1c19] dark:hover:text-white">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="space-y-2.5">
            <p className="text-[8px] font-black uppercase tracking-widest text-[#707a6c] mb-1">Shelter Status</p>
            {phase === 'after' ? (
              [
                { color: "#2E7D32", label: "Deactivated / Closed" },
                { color: "#FFB300", label: "Active Checking Out" },
                { color: "#81C784", label: "Assigned to You" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: item.color }} />
                  <span className="text-[10px] font-bold text-[#444743] dark:text-[#a0a39f]">{item.label}</span>
                </div>
              ))
            ) : phase === 'before' ? (
              [
                { color: "#2E7D32", label: "Safe Readiness (>= 60%)" },
                { color: "#FFB300", label: "Moderate Readiness (30-59%)" },
                { color: "#ba1a1a", label: "Critical Readiness (< 30%)" },
                { color: "#81C784", label: "Assigned to You" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: item.color }} />
                  <span className="text-[10px] font-bold text-[#444743] dark:text-[#a0a39f]">{item.label}</span>
                </div>
              ))
            ) : (
              [
                { color: "#2E7D32", label: "Safe (< 70%)" },
                { color: "#FFB300", label: "Moderate (70-89%)" },
                { color: "#ba1a1a", label: "Critical (90%+)" },
                { color: "#81C784", label: "Assigned to You" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: item.color }} />
                  <span className="text-[10px] font-bold text-[#444743] dark:text-[#a0a39f]">{item.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
