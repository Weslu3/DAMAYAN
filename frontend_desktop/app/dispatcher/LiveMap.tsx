"use client";
import { useEffect, useRef } from "react";
import { Incident, Unit, unitStatusColor, unitTypeColor, situationColor, shortenId, priorityColor } from "./data";

export type MapMode = "monitoring" | "dispatch" | "rescue";

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
}

const PH: [number,number] = [14.604, 120.997];

export default function LiveMap({ mode, incidents, units, filterType="All", selectedIncident, assignedUnits=[], onUnitAssign, onIncidentClick, height=400 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapR = useRef<any>(null);
  const LR   = useRef<any>(null);
  const mks  = useRef<any[]>([]);
  const prevMode = useRef<string>("");
  const prevSelId = useRef<string>("");

  useEffect(() => {
    if (typeof window==="undefined" || mapR.current) return;
    if (!document.getElementById("lf-css")) {
      const l = document.createElement("link");
      l.id="lf-css"; l.rel="stylesheet";
      l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    import("leaflet").then(mod => {
      const L = (mod as any).default || mod;
      if (!ref.current || mapR.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const map = L.map(ref.current!, { center: PH, zoom: 14 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{ attribution:"© OpenStreetMap contributors", maxZoom:19 }).addTo(map);

      // ── Search bar ──
      const wrap = L.DomUtil.create("div","");
      wrap.style.cssText = "display:flex;align-items:center;gap:6px;background:#fff;border:1px solid rgba(191,182,162,0.6);border-radius:8px;padding:5px 10px;box-shadow:0 2px 10px rgba(28,22,17,0.1);font-family:'Public Sans',sans-serif";
      const inp = document.createElement("input");
      inp.placeholder = "Search Philippines...";
      inp.style.cssText = "border:none;outline:none;font:inherit;font-size:12px;color:#1c1a17;background:transparent;width:185px";
      const ico = document.createElement("span");
      ico.textContent="S"; ico.style.fontSize="11px"; ico.style.fontWeight="900"; ico.style.color="var(--d-text-sub)";
      wrap.appendChild(ico); wrap.appendChild(inp);
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);
      inp.addEventListener("keydown", async (e:any) => {
        if (e.key!=="Enter") return;
        const q = inp.value.trim(); if (!q) return;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+", Philippines")}&format=json&limit=1&countrycodes=ph`);
          const d = await r.json();
          if (d.length) {
            map.setView([parseFloat(d[0].lat), parseFloat(d[0].lon)], 15);
            const m = L.marker([parseFloat(d[0].lat),parseFloat(d[0].lon)]).addTo(map).bindPopup(`<b>${q}</b><br/><small style="color:#5a5245">${d[0].display_name.substring(0,80)}</small>`).openPopup();
            setTimeout(()=>map.removeLayer(m),7000);
          } else { alert(`"${q}" not found in the Philippines.`); }
        } catch { alert("Search failed. Check your connection."); }
      });
      const SC = L.Control.extend({ options:{position:"topright"}, onAdd:()=>wrap });
      new SC().addTo(map);

      mapR.current=map; LR.current=L;
      draw(L, map);
    });
    return () => { if (mapR.current){ mapR.current.remove(); mapR.current=null; } };
  }, []);

  useEffect(() => { if (mapR.current&&LR.current) draw(LR.current,mapR.current); });

  function dot(color:string, size=12, pulse=false) {
    const p = pulse ? `<span style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.25;animation:lf-pulse 1.5s ease-out infinite"></span>` : "";
    return `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 5px rgba(0,0,0,0.3)">${p}</div>`;
  }

  function getJitter(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return { lat: ((hash % 100) - 50) * 0.00008, lng: (((hash >> 2) % 100) - 50) * 0.00008 };
  }

  function draw(L:any, map:any) {
    mks.current.forEach(m=>map.removeLayer(m)); mks.current=[];

    if (mode==="monitoring") {
      const vis = filterType==="All" ? units : units.filter(u=>u.type===filterType);
      vis.forEach(u => {
        const c = unitStatusColor(u.status);
        const icon = L.divIcon({className:"",html:dot(c,u.status==="Available"?13:11),iconSize:[13,13],iconAnchor:[6,6]});
        mks.current.push(L.marker([u.lat,u.lng],{icon}).addTo(map).bindTooltip(`<b>${u.name}</b> — ${u.status}<br/>${u.station}`,{direction:"top"}));
      });
      incidents.filter(i=>i.status!=="Resolved"&&i.status!=="Invalid").forEach(i => {
        const isPulse = ["Dispatched", "In Progress"].includes(i.status);
        const color = priorityColor(i.priority) || "#c62828";
        const iconHtml = dot(color, 14, isPulse);
        const icon = L.divIcon({className:"",html:iconHtml,iconSize:[14,14],iconAnchor:[7,7]});
        const j = getJitter(i.id);
        mks.current.push(L.marker([i.lat + j.lat, i.lng + j.lng],{icon}).addTo(map).bindTooltip(shortenId(i.id)));
      });
    }

    if (mode==="dispatch" && selectedIncident) {
      if (prevMode.current !== mode || prevSelId.current !== selectedIncident.id) {
        map.setView([selectedIncident.lat,selectedIncident.lng],15);
        prevMode.current = mode;
        prevSelId.current = selectedIncident.id;
      }
      const pin = `<svg width="26" height="38" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="#c2440a"/><circle cx="14" cy="14" r="6" fill="white"/></svg>`;
      const pinIcon = L.divIcon({className:"",html:pin,iconSize:[26,38],iconAnchor:[13,38]});
      mks.current.push(L.marker([selectedIncident.lat,selectedIncident.lng],{icon:pinIcon}).addTo(map).bindTooltip(`<b>${shortenId(selectedIncident.id)}</b><br/>${selectedIncident.address}`,{permanent:true,direction:"top"}).openTooltip());

      const vis = filterType==="All" ? units.filter(u=>u.status==="Available") : units.filter(u=>u.type===filterType&&u.status==="Available");
      vis.forEach(u => {
        const c = unitTypeColor(u.type);
        const assigned = assignedUnits.includes(u.id);
        const size=18;
        const icon = L.divIcon({className:"",html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${c};border:${assigned?"3px solid #fff":"2px solid rgba(255,255,255,0.9)"};box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer${assigned?`;outline:2px solid ${c};outline-offset:2px`:""}"></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
        const pop = L.popup({offset:[0,-9]}).setContent(`<div class="dp-map-popup"><div class="dp-map-popup-name">${u.name}</div><div class="dp-map-popup-row">Station: <b>${u.station}</b></div><div class="dp-map-popup-row">Status: <span class="dp-map-popup-status" style="color:#2e7d32">Available ●</span></div><div class="dp-map-popup-row">Distance: <b>${u.distance}</b></div><div class="dp-map-popup-row">ETA: <b>${u.eta}</b></div><div class="dp-map-popup-row">Crew: <b>${u.personnel}</b></div><div class="dp-map-popup-row">Leader: <b>${u.teamLeader}</b></div><div class="dp-map-popup-btns"><button onclick="window.__dpMsg('${u.id}')" class="dp-map-popup-btn">Message</button><button onclick="window.__dpAssign('${u.id}')" class="dp-map-popup-btn assign">${assigned?"✓ Assigned":"Assign"}</button></div></div>`);
        const m = L.marker([u.lat,u.lng],{icon}).addTo(map).bindPopup(pop);
        m.on("click",()=>{ if (onUnitAssign) onUnitAssign(u.id); });
        mks.current.push(m);
      });
    }

    if (mode==="rescue") {
      // Zoom in tight to selected incident, otherwise show overview
      if (selectedIncident) {
        if (prevMode.current !== mode || prevSelId.current !== selectedIncident.id) {
          map.flyTo([selectedIncident.lat, selectedIncident.lng], 17, { animate: true, duration: 1.2 });
          prevMode.current = mode;
          prevSelId.current = selectedIncident.id;
        }
      } else if (prevMode.current !== mode) {
        map.setView(PH, 13);
        prevMode.current = mode;
        prevSelId.current = "";
      }
      incidents.filter(i=>["Dispatched","In Progress"].includes(i.status)).forEach(i => {
        const sc = situationColor(i.situationType);
        const html=`<div style="background:${sc};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;font-family:'Public Sans',sans-serif">${shortenId(i.id)}</div>`;
        const icon = L.divIcon({className:"",html,iconSize:[90,22],iconAnchor:[45,11]});
        const names = i.assignedUnits.map(uid=>{ const u=units.find(u=>u.id===uid); return u?`${u.type}-${u.id.split("-")[1]}`:uid; }).join(", ")||"None";
        const pop = L.popup().setContent(`<div class="dp-map-popup"><div class="dp-map-popup-name">${shortenId(i.id)} — ${i.type}</div><div class="dp-map-popup-row">Loc: ${i.address}</div><div class="dp-map-popup-row">Situation: <span style="color:${sc};font-weight:700">${i.situationType}</span></div><div class="dp-map-popup-row">Units: <b>${names}</b></div><div class="dp-map-popup-row">Active: <b>${i.timeActive} mins</b></div><div class="dp-map-popup-btns"><button onclick="window.__dpBackup('${i.id}')" class="dp-map-popup-btn" style="background:#c77700;color:#fff;border-color:transparent">Backup</button><button onclick="window.__dpEscalate('${i.id}')" class="dp-map-popup-btn" style="background:#c62828;color:#fff;border-color:transparent">High-Level</button></div></div>`);

        const j = getJitter(i.id);
        const m = L.marker([i.lat + j.lat, i.lng + j.lng],{icon}).addTo(map).bindPopup(pop);
        m.on("click",()=>{ if (onIncidentClick) onIncidentClick(i); });
        mks.current.push(m);
      });
      units.forEach(u => {
        const c=unitStatusColor(u.status);
        const icon=L.divIcon({className:"",html:dot(c,10),iconSize:[10,10],iconAnchor:[5,5]});
        mks.current.push(L.marker([u.lat,u.lng],{icon}).addTo(map));
      });
    }
  }

  return (
    <div style={{width:"100%",height,position:"relative"}}>
      <style>{`@keyframes lf-pulse{0%{transform:scale(1);opacity:.25}70%{transform:scale(2.2);opacity:0}100%{opacity:0}}`}</style>
      <div ref={ref} style={{width:"100%",height:"100%"}}/>
    </div>
  );
}
