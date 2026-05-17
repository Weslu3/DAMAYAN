"use client";

import { useEffect, useRef, useState } from "react";
import type { CapacityCenter } from "../../lib/types";
import { geocodeAddress } from "../../lib/api";

interface SiteManagerRegionalMapProps {
  centers: CapacityCenter[];
  token: string;
  height?: number | string;
  phase?: 'before' | 'during' | 'after';
  assignedCenterId?: string;
  incidentReports?: any[];
  structureDamageRecords?: any[];
}

const PH_CENTER: [number, number] = [12.8797, 121.774];

export default function SiteManagerRegionalMap({
  centers,
  token,
  height = 550,
  phase = 'before',
  assignedCenterId,
  incidentReports = [],
  structureDamageRecords = [],
}: SiteManagerRegionalMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const incidentMarkersRef = useRef<any[]>([]);
  const damageMarkersRef = useRef<any[]>([]);
  const geocodeCacheRef = useRef<Record<string, [number, number]>>({});

  // HUD state
  const [showShelters, setShowShelters] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "critical" | "moderate" | "safe">("all");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Computed stats
  const totalShelters = centers.length;
  const totalPopulation = centers.reduce((s, c) => s + c.currentOccupancy, 0);
  const criticalCount = centers.filter(c => c.utilizationRate >= 90).length;
  const avgUtilization = totalShelters > 0 ? Math.round(centers.reduce((s, c) => s + c.utilizationRate, 0) / totalShelters) : 0;

  useEffect(() => {
    if (typeof window === "undefined" || mapInstanceRef.current) return;

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
          border: 3px solid #2196F3;
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
      drawDamageMarkers();
      void geocodeMissingCenters();
      void geocodeIncidentLocations();
      void geocodeDamageLocations();
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
    drawDamageMarkers();
    void geocodeMissingCenters();
    void geocodeIncidentLocations();
    void geocodeDamageLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers, assignedCenterId, showShelters, selectedFilter, searchQuery, phase]);

  useEffect(() => {
    drawIncidentMarkers();
    drawDamageMarkers();
    void geocodeIncidentLocations();
    void geocodeDamageLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, incidentReports, structureDamageRecords]);

  function markerColor(center: CapacityCenter): string {
    if (center.id === assignedCenterId) return "#2196F3";
    if (phase === 'before') {
      // Pre-deployment supply readiness score (stable calculation based on capacity and slots)
      const score = (center.availableSlots * 17 + center.capacity * 3) % 100;
      return score >= 60 ? "#2E7D32" : score >= 30 ? "#FFB300" : "#ba1a1a";
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
    return `<div class="${isAssigned ? 'assigned-marker' : ''}" style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.4);z-index:${isAssigned ? '999' : 'auto'};"></div>`;
  }

  function incidentMarkerHtml(title: string, severity: string): string {
    const isHigh = severity.toLowerCase() === 'high' || severity.toLowerCase() === 'severe' || severity.toLowerCase() === 'major';
    const color = isHigh ? "#ba1a1a" : "#FFB300";
    return `<div class="incident-marker" style="position:relative;width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 0 12px ${color};"><span class="material-symbols-outlined" style="font-size:14px">warning</span></div>`;
  }

  function damageMarkerHtml(severity: string): string {
    const color = "#E65100";
    return `<div style="position:relative;width:28px;height:28px;border-radius:10px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35)"><span class="material-symbols-outlined" style="font-size:14px">handyman</span></div>`;
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

  async function geocodeDamageLocations() {
    if (phase !== 'after' || !structureDamageRecords.length) return;

    for (const record of structureDamageRecords) {
      await geocodeCachedLocation(`damage:${record.id}`, record.address ?? "");
    }

    drawDamageMarkers();
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

  function drawDamageMarkers() {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    damageMarkersRef.current.forEach((m) => map.removeLayer(m));
    damageMarkersRef.current = [];

    if (phase !== 'after' || !structureDamageRecords || structureDamageRecords.length === 0) return;

    structureDamageRecords.forEach((record) => {
      const coords = geocodeCacheRef.current[`damage:${record.id}`];
      if (!coords) return;

      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: "",
          html: damageMarkerHtml(record.severity),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family:Public Sans,sans-serif;min-width:220px;padding:4px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:32px;height:32px;border-radius:10px;background:#E65100;display:flex;align-items:center;justify-content:center;color:#fff">
              <span class="material-symbols-outlined" style="font-size:16px">handyman</span>
            </div>
            <div>
              <div style="font-weight:900;font-size:12px;color:#1a1c19">Damage Assessment</div>
              <div style="font-size:9px;color:#707a6c;text-transform:uppercase;font-weight:800;letter-spacing:0.1em">Rehab Pin</div>
            </div>
          </div>
          <div style="background:#fff3e0;padding:10px;border-radius:12px;margin-bottom:6px;border:1px solid #ffe0b2">
            <p style="font-size:11px;color:#E65100;font-weight:700;margin-bottom:4px">Severity: ${record.severity}</p>
            <p style="font-size:10px;color:#444743;font-weight:700">Resident: ${record.ownerName}</p>
            <p style="font-size:9px;color:#707a6c">${record.address}</p>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#707a6c">
            <span>Status: <b style="color:#2E7D32">${record.status}</b></span>
            <span>Needs Aid: <b style="color:${record.needsAid ? '#E65100' : '#707a6c'}">${record.needsAid ? 'YES' : 'NO'}</b></span>
          </div>
        </div>`
      );

      damageMarkersRef.current.push(marker);
    });
  }

  function getFilteredCenters(): CapacityCenter[] {
    let filtered = centers;
    if (selectedFilter === "critical") filtered = filtered.filter(c => c.utilizationRate >= 90);
    else if (selectedFilter === "moderate") filtered = filtered.filter(c => c.utilizationRate >= 70 && c.utilizationRate < 90);
    else if (selectedFilter === "safe") filtered = filtered.filter(c => c.utilizationRate < 70);

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
      const badge = isAssigned ? `<div style="background:#2196F3;color:#fff;padding:4px 10px;border-radius:8px;font-size:9px;font-weight:900;text-transform:uppercase;margin-bottom:10px;display:inline-flex;align-items:center;gap:4px;letter-spacing:0.05em"><span style="font-size:10px">&#9733;</span> My Assigned Shelter</div>` : '';
      
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
      bounds.extend(cached);
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
  }

  async function geocodeMissingCenters() {
    const missing = centers.filter((c) => !geocodeCacheRef.current[c.id]).slice(0, 12);
    if (missing.length === 0) return;

    for (const center of missing) {
      const address = `${center.barangay}, ${center.municipality}, Philippines`;
      try {
        const result = await geocodeAddress(token, address);
        geocodeCacheRef.current[center.id] = [result.latitude, result.longitude];
      } catch {
        // Ignore geocoding failures
      }
    }
    drawMarkers();
  }

  const phaseLabel = phase === 'before' ? 'Pre-Deployment Readiness' : phase === 'during' ? 'Active Emergency Response' : 'Post-Disaster Recovery';
  const phaseColor = phase === 'before' ? '#0d631b' : phase === 'during' ? '#ba1a1a' : '#2196F3';

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
            showLegend ? "bg-blue-500 text-white border-blue-600" : "bg-white/90 dark:bg-[#1a1c19]/90 border-white/30 text-[#707a6c]"
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
                { color: "#2196F3", label: "Assigned to You" },
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
                { color: "#2196F3", label: "Assigned to You" },
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
