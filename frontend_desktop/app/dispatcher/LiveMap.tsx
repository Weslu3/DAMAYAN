"use client";
import { useEffect, useRef } from "react";
import { Incident, Unit, unitStatusColor, unitTypeColor, situationColor, shortenId, priorityColor, BarangayDemographics } from "./data";

export type MapMode = "monitoring" | "dispatch" | "rescue" | "risk-profile";

interface Props {
  mode: MapMode;
  incidents: Incident[];
  units: Unit[];
  filterType?: string;
  selectedIncident?: Incident | null;
  assignedUnits?: string[];
  onUnitAssign?: (id: string) => void;
  onIncidentClick?: (i: Incident) => void;
  height?: number | string;
  districtFilter?: string | null;
  showVulnerabilityHeatmap?: boolean;
  showPopulationDensity?: boolean;
  onBarangayClick?: (b: BarangayDemographics) => void;
  barangayData?: BarangayDemographics[];
}

const PH: [number, number] = [14.604, 120.997];

export default function LiveMap({
  mode,
  incidents,
  units,
  filterType = "All",
  selectedIncident,
  assignedUnits = [],
  onUnitAssign,
  onIncidentClick,
  height = 400,
  districtFilter = null,
  showVulnerabilityHeatmap = false,
  showPopulationDensity = false,
  onBarangayClick,
  barangayData = [],
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapR = useRef<any>(null);
  const LR = useRef<any>(null);
  const mks = useRef<any[]>([]);
  const prevMode = useRef<string>("");
  const prevSelId = useRef<string>("");
  const prevBoundsKey = useRef<string>("");
  const assignedKey = assignedUnits.join("|");

  useEffect(() => {
    if (typeof window === "undefined" || mapR.current) return;
    if (!document.getElementById("lf-css")) {
      const l = document.createElement("link");
      l.id = "lf-css";
      l.rel = "stylesheet";
      l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    import("leaflet").then((mod) => {
      const L = (mod as any).default || mod;
      if (!ref.current || mapR.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const map = L.map(ref.current!, { center: PH, zoom: 14 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapR.current = map;
      LR.current = L;
      draw(L, map);
    });
    return () => {
      if (mapR.current) {
        mapR.current.remove();
        mapR.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapR.current && LR.current) {
      draw(LR.current, mapR.current);
      setTimeout(() => {
        try {
          mapR.current?.invalidateSize();
        } catch {
          // no-op
        }
      }, 0);
    }
  }, [
    mode,
    incidents,
    units,
    filterType,
    selectedIncident?.id,
    assignedKey,
    districtFilter,
    showVulnerabilityHeatmap,
    showPopulationDensity,
    onBarangayClick,
    barangayData,
  ]);

  function dot(color: string, size = 12, pulse = false) {
    const p = pulse
      ? `<span style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.25;animation:lf-pulse 1.5s ease-out infinite"></span>`
      : "";
    return `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 5px rgba(0,0,0,0.3)">${p}</div>`;
  }

  function incidentDot(color: string, pulse = false) {
    const p = pulse
      ? `<span style="position:absolute;inset:-5px;border-radius:50%;background:${color};opacity:0.25;animation:lf-pulse 1.5s ease-out infinite"></span>`
      : "";
    return `<div class="dp-map-incident-dot" style="background:${color}">${p}<span>!</span></div>`;
  }

  function esc(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function incidentPopup(i: Incident) {
    const priority = esc(i.priority);
    const status = esc(i.status);
    const situation = esc(i.situationType);
    const place = esc(i.address || `${i.location}, ${i.city}`);
    const reported = esc(`${i.dateReported} - ${i.timeReported}`);
    const reporter = esc(i.reporter || "Unknown reporter");
    const description = esc(i.description || "No description provided.");

    return `
      <div class="dp-map-popup dp-map-popup-incident">
        <div class="dp-map-popup-kicker">Incident Report</div>
        <div class="dp-map-popup-name">${esc(shortenId(i.id))} - ${esc(i.type)}</div>
        <div class="dp-map-popup-badges">
          <span class="dp-map-popup-badge" style="border-color:${priorityColor(i.priority)};color:${priorityColor(i.priority)}">${priority}</span>
          <span class="dp-map-popup-badge">${status}</span>
          <span class="dp-map-popup-badge">${situation}</span>
        </div>
        <div class="dp-map-popup-row">Location: <b>${place}</b></div>
        <div class="dp-map-popup-row">Reported: <b>${reported}</b></div>
        <div class="dp-map-popup-row">Reporter: <b>${reporter}</b></div>
        <div class="dp-map-popup-desc">${description}</div>
      </div>
    `;
  }

  function incidentTooltip(i: Incident) {
    return `
      <div class="dp-map-incident-tooltip">
        <div class="dp-map-incident-tooltip-title">${esc(i.type)}</div>
        <div class="dp-map-incident-tooltip-id">${esc(shortenId(i.id))}</div>
        <div class="dp-map-incident-tooltip-meta">${esc(i.priority)} priority - ${esc(i.status)}</div>
        <div class="dp-map-incident-tooltip-action">Click for full details</div>
      </div>
    `;
  }

  function getJitter(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return { lat: ((hash % 100) - 50) * 0.00008, lng: (((hash >> 2) % 100) - 50) * 0.00008 };
  }

  function draw(L: any, map: any) {
    if (!mks.current) mks.current = [];
    mks.current.forEach((m) => map.removeLayer(m));
    mks.current = [];

    const filteredIncidents = districtFilter
      ? incidents.filter((i) => i.city === districtFilter || i.barangay === districtFilter)
      : incidents;
    const visibleBarangays = districtFilter
      ? barangayData.filter((b) => b.name === districtFilter || b.province === districtFilter)
      : barangayData;

    // Vulnerability Heatmap
    if (showVulnerabilityHeatmap) {
      visibleBarangays.forEach((b) => {
        const intensity = (b.elderly ?? 0) + (b.infants ?? 0);
        const radius = Math.max(Math.sqrt(intensity) * 15, 200);
        const circle = L.circle(b.coordinates, {
          color: "red",
          fillColor: "#f03",
          fillOpacity: 0.4,
          radius: radius,
          weight: 1,
        }).addTo(map);
        mks.current.push(circle);
      });
    }

    // Population Density Layer
    if (showPopulationDensity) {
      visibleBarangays.forEach((b) => {
        const density = b.density ?? 0;
        const color = density > 40000 ? "#800026" : density > 30000 ? "#BD0026" : "#E31A1C";
        const rectSize = 0.005;
        const bounds: [[number, number], [number, number]] = [
          [b.coordinates[0] - rectSize / 2, b.coordinates[1] - rectSize / 2],
          [b.coordinates[0] + rectSize / 2, b.coordinates[1] + rectSize / 2],
        ];
        const rect = L.rectangle(bounds, {
          color: color,
          weight: 1,
          fillOpacity: 0.5,
        }).addTo(map);
        rect.bindTooltip(`<b>${b.name}</b><br/>Density: ${(b.density ?? 0).toLocaleString()}/km²`);
        mks.current.push(rect);
      });
    }

    // Risk Profiling Mode
    if (mode === "risk-profile") {
      visibleBarangays.forEach((b) => {
        const color = b.riskLevel === "High" ? "#c62828" : b.riskLevel === "Medium" ? "#c77700" : "#2e7d32";
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${b.name.split(" ")[1] || b.name[0]}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker(b.coordinates, { icon }).addTo(map);
        marker.bindPopup(`
          <div class="dp-map-popup">
            <div class="dp-map-popup-name">${b.name}</div>
            ${b.province ? `<div class="dp-map-popup-row">Province: <b>${b.province}</b></div>` : ""}
            ${b.region ? `<div class="dp-map-popup-row">Region: <b>${b.region}</b></div>` : ""}
            <div class="dp-map-popup-row">Risk Level: <span style="color:${color};font-weight:bold">${b.riskLevel}</span></div>
          </div>
        `);
        marker.on("click", () => onBarangayClick?.(b));
        mks.current.push(marker);
      });
    }

    if (mode === "monitoring") {
      const vis = filterType === "All" ? units : units.filter((u) => u.type === filterType);
      vis.forEach((u) => {
        const c = unitStatusColor(u.status);
        const icon = L.divIcon({
          className: "",
          html: dot(c, u.status === "Available" ? 13 : 11),
          iconSize: [13, 13],
          iconAnchor: [6, 6],
        });
        mks.current.push(
          L.marker([u.lat, u.lng], { icon })
            .addTo(map)
            .bindTooltip(`<b>${u.name}</b> — ${u.status}<br/>${u.station}`, { direction: "top" }),
        );
      });
      filteredIncidents
        .filter((i) => i.status !== "Resolved" && i.status !== "Invalid")
        .forEach((i) => {
          const isPulse = ["Dispatched", "In Progress"].includes(i.status);
          const color = priorityColor(i.priority) || "#c62828";
          const iconHtml = incidentDot(color, isPulse);
          const icon = L.divIcon({ className: "", html: iconHtml, iconSize: [20, 20], iconAnchor: [10, 10] });
          const j = getJitter(i.id);
          const marker = L.marker([i.lat + j.lat, i.lng + j.lng], { icon })
            .addTo(map)
            .bindTooltip(incidentTooltip(i), {
              direction: "top",
              offset: [0, -10],
              className: "dp-map-incident-tooltip-shell",
            })
            .bindPopup(L.popup({ offset: [0, -8], maxWidth: 320 }).setContent(incidentPopup(i)));
          mks.current.push(marker);
        });
    }

    if (mode === "dispatch" && selectedIncident) {
      if (prevMode.current !== mode || prevSelId.current !== selectedIncident.id) {
        map.setView([selectedIncident.lat, selectedIncident.lng], 15);
        prevMode.current = mode;
        prevSelId.current = selectedIncident.id;
      }
      const pin = `<svg width="26" height="38" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="#c2440a"/><circle cx="14" cy="14" r="6" fill="white"/></svg>`;
      const pinIcon = L.divIcon({ className: "", html: pin, iconSize: [26, 38], iconAnchor: [13, 38] });
      mks.current.push(
        L.marker([selectedIncident.lat, selectedIncident.lng], { icon: pinIcon })
          .addTo(map)
          .bindTooltip(`<b>${shortenId(selectedIncident.id)}</b><br/>${selectedIncident.address}`, {
            permanent: true,
            direction: "top",
          })
          .openTooltip(),
      );

      const vis =
        filterType === "All"
          ? units.filter((u) => u.status === "Available")
          : units.filter((u) => u.type === filterType && u.status === "Available");
      vis.forEach((u) => {
        const c = unitTypeColor(u.type);
        const assigned = assignedUnits.includes(u.id);
        const size = 18;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${c};border:${assigned ? "3px solid #fff" : "2px solid rgba(255,255,255,0.9)"};box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer${assigned ? `;outline:2px solid ${c};outline-offset:2px` : ""}"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const pop = L.popup({ offset: [0, -9] }).setContent(
          `<div class="dp-map-popup"><div class="dp-map-popup-name">${u.name}</div><div class="dp-map-popup-row">Station: <b>${u.station}</b></div><div class="dp-map-popup-row">Status: <span class="dp-map-popup-status" style="color:#2e7d32">Available ●</span></div><div class="dp-map-popup-row">Distance: <b>${u.distance}</b></div><div class="dp-map-popup-row">ETA: <b>${u.eta}</b></div><div class="dp-map-popup-row">Crew: <b>${u.personnel}</b></div><div class="dp-map-popup-row">Leader: <b>${u.teamLeader}</b></div><div class="dp-map-popup-btns"><button onclick="window.__dpMsg('${u.id}')" class="dp-map-popup-btn">Message</button><button onclick="window.__dpAssign('${u.id}')" class="dp-map-popup-btn assign">${assigned ? "✓ Assigned" : "Assign"}</button></div></div>`,
        );
        const m = L.marker([u.lat, u.lng], { icon }).addTo(map).bindPopup(pop);
        m.on("click", () => {
          if (onUnitAssign) onUnitAssign(u.id);
        });
        mks.current.push(m);
      });
    }

    if (mode === "rescue") {
      const rescueIncidents = filteredIncidents.filter((i) => i.status !== "Invalid");
      // Zoom in tight to selected incident, otherwise show overview
      if (selectedIncident) {
        if (prevMode.current !== mode || prevSelId.current !== selectedIncident.id) {
          map.flyTo([selectedIncident.lat, selectedIncident.lng], 17, { animate: true, duration: 1.2 });
          prevMode.current = mode;
          prevSelId.current = selectedIncident.id;
        }
      } else {
        const boundsKey = rescueIncidents.map((i) => `${i.id}:${i.lat.toFixed(5)},${i.lng.toFixed(5)}`).join("|");
        if (rescueIncidents.length && (prevMode.current !== mode || prevBoundsKey.current !== boundsKey)) {
          const bounds = L.latLngBounds(rescueIncidents.map((i) => [i.lat, i.lng]));
          map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
          prevBoundsKey.current = boundsKey;
        } else if (prevMode.current !== mode) {
          map.setView(PH, 13);
        }
        prevMode.current = mode;
        prevSelId.current = "";
      }
      rescueIncidents
        .forEach((i) => {
          const sc = situationColor(i.situationType);
          const html = `<div style="background:${sc};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;font-family: 'Public Sans',sans-serif">${shortenId(i.id)}</div>`;
          const icon = L.divIcon({ className: "", html, iconSize: [90, 22], iconAnchor: [45, 11] });
          const names =
            i.assignedUnits
              .map((uid) => {
                const u = units.find((u) => u.id === uid);
                return u ? `${u.type}-${u.id.split("-")[1]}` : uid;
              })
              .join(", ") || "None";
          const pop = L.popup().setContent(
            `<div class="dp-map-popup"><div class="dp-map-popup-name">${shortenId(i.id)} — ${i.type}</div><div class="dp-map-popup-row">Loc: ${i.address}</div><div class="dp-map-popup-row">Situation: <span style="color:${sc};font-weight:700">${i.situationType}</span></div><div class="dp-map-popup-row">Units: <b>${names}</b></div><div class="dp-map-popup-row">Active: <b>${i.timeActive} mins</b></div><div class="dp-map-popup-btns"><button onclick="window.__dpBackup('${i.id}')" class="dp-map-popup-btn" style="background:#c77700;color:#fff;border-color:transparent">Backup</button><button onclick="window.__dpEscalate('${i.id}')" class="dp-map-popup-btn" style="background:#c62828;color:#fff;border-color:transparent">High-Level</button></div></div>`,
          );

          const j = getJitter(i.id);
          const m = L.marker([i.lat + j.lat, i.lng + j.lng], { icon }).addTo(map).bindPopup(pop);
          m.on("click", () => {
            if (onIncidentClick) onIncidentClick(i);
          });
          mks.current.push(m);
        });
      units.forEach((u) => {
        const c = unitStatusColor(u.status);
        const icon = L.divIcon({ className: "", html: dot(c, 10), iconSize: [10, 10], iconAnchor: [5, 5] });
        mks.current.push(L.marker([u.lat, u.lng], { icon }).addTo(map));
      });
    }
  }

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <style>{`@keyframes lf-pulse{0%{transform:scale(1);opacity:.25}70%{transform:scale(2.2);opacity:0}100%{opacity:0}}`}</style>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
