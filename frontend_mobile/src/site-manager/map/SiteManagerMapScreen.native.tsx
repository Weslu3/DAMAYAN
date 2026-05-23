import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Callout, Marker, type Region } from "react-native-maps";
import { getCapacity, getDashboard, getIncidentReports, getInventory } from "../../api";
import { useSystemPhase } from "../../context/SystemPhaseContext";
import { loadSession } from "../../session";
import { darkTheme, fonts, lightTheme, type AppTheme } from "../../theme";
import type { AuthSession, CapacityCenter, DashboardOverview, IncidentReport, InventoryItem } from "../../types";

type Phase = "before" | "during" | "after";
type MapFilter = "all" | "critical" | "moderate" | "safe";

const PH_REGION: Region = {
  latitude: 12.8797,
  longitude: 121.774,
  latitudeDelta: 7.6,
  longitudeDelta: 6.8,
};

const FALLBACK_COORDS: Record<string, { latitude: number; longitude: number }> = {
  makati: { latitude: 14.5547, longitude: 121.0244 },
  "quezon city": { latitude: 14.676, longitude: 121.0437 },
  pasig: { latitude: 14.5764, longitude: 121.0851 },
  taguig: { latitude: 14.5176, longitude: 121.0509 },
  manila: { latitude: 14.5995, longitude: 120.9842 },
  marikina: { latitude: 14.6507, longitude: 121.1029 },
  "san juan": { latitude: 14.6042, longitude: 121.03 },
  mandaluyong: { latitude: 14.5794, longitude: 121.0359 },
  pasay: { latitude: 14.5378, longitude: 120.9993 },
  paranaque: { latitude: 14.4793, longitude: 121.0198 },
  "las pinas": { latitude: 14.4445, longitude: 120.9939 },
  muntinlupa: { latitude: 14.4081, longitude: 121.0415 },
  valenzuela: { latitude: 14.7011, longitude: 120.983 },
  malabon: { latitude: 14.6628, longitude: 120.956 },
  navotas: { latitude: 14.6732, longitude: 120.9429 },
  pateros: { latitude: 14.5454, longitude: 121.0687 },
  caloocan: { latitude: 14.6507, longitude: 120.9715 },
  cauayan: { latitude: 16.92, longitude: 121.77 },
  isabela: { latitude: 17, longitude: 122 },
};

function phaseFromSystem(systemPhase: string): Phase {
  if (systemPhase === "DURING") return "during";
  if (systemPhase === "AFTER") return "after";
  return "before";
}

function formatNumber(value: number | undefined): string {
  return Number(value ?? 0).toLocaleString();
}

function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function centerCoordinate(center: CapacityCenter) {
  const latitude = Number(center.latitude);
  const longitude = Number(center.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  const base = FALLBACK_COORDS[normalizeLocationKey(center.municipality)] ?? {
    latitude: PH_REGION.latitude,
    longitude: PH_REGION.longitude,
  };
  const hash = center.name.length + (center.capacity % 100);
  const latOffset = ((hash % 10) - 5) * 0.005;
  const lngOffset = (((hash * 3) % 10) - 5) * 0.005;

  return {
    latitude: base.latitude + latOffset,
    longitude: base.longitude + lngOffset,
  };
}

function averageUtilization(centers: CapacityCenter[]): string {
  if (centers.length === 0) return "0%";
  const total = centers.reduce((sum, center) => sum + center.utilizationRate, 0);
  return `${Math.round(total / centers.length)}%`;
}

function centerMetric(phase: Phase, center: CapacityCenter) {
  if (phase === "before") {
    const percent = center.capacity > 0 ? Math.round((center.availableSlots / center.capacity) * 100) : 0;
    const color = percent >= 60 ? "#2E7D32" : percent >= 30 ? "#FFB300" : "#BA1A1A";
    return {
      percent,
      color,
      label: "Readiness",
      left: `${formatNumber(center.availableSlots)} Available`,
      right: `${formatNumber(center.capacity)} Capacity`,
    };
  }

  if (phase === "after") {
    const checkedOut = Math.max(0, center.capacity - center.currentOccupancy);
    const percent = center.capacity > 0 ? Math.round((checkedOut / center.capacity) * 100) : 100;
    const color = percent >= 70 ? "#2E7D32" : percent >= 30 ? "#FFB300" : "#BA1A1A";
    return {
      percent,
      color,
      label: "Cleared",
      left: `${formatNumber(center.currentOccupancy)} Remaining`,
      right: `${formatNumber(checkedOut)} Checked Out`,
    };
  }

  const percent = center.utilizationRate;
  const color = percent >= 90 ? "#BA1A1A" : percent >= 70 ? "#FFB300" : "#2E7D32";
  return {
    percent,
    color,
    label: "Occupied",
    left: `${formatNumber(center.currentOccupancy)} Occupied`,
    right: `${formatNumber(center.availableSlots)} Available`,
  };
}

function matchesFilter(phase: Phase, filter: MapFilter, center: CapacityCenter): boolean {
  if (filter === "all") return true;
  const metric = centerMetric(phase, center).percent;

  if (phase === "during") {
    if (filter === "critical") return center.utilizationRate >= 90;
    if (filter === "moderate") return center.utilizationRate >= 70 && center.utilizationRate < 90;
    return center.utilizationRate < 70;
  }

  if (phase === "after") {
    if (filter === "critical") return metric < 30;
    if (filter === "moderate") return metric >= 30 && metric < 70;
    return metric >= 70;
  }

  if (filter === "critical") return metric < 30;
  if (filter === "moderate") return metric >= 30 && metric < 60;
  return metric >= 60;
}

function regionForCenters(centers: CapacityCenter[]): Region {
  if (centers.length === 0) return PH_REGION;

  const coords = centers.map(centerCoordinate);
  const minLat = Math.min(...coords.map((coord) => coord.latitude));
  const maxLat = Math.max(...coords.map((coord) => coord.latitude));
  const minLng = Math.min(...coords.map((coord) => coord.longitude));
  const maxLng = Math.max(...coords.map((coord) => coord.longitude));

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.2, 0.08),
    longitudeDelta: Math.max((maxLng - minLng) * 2.2, 0.08),
  };
}

function normalizeIncidentReports(value: IncidentReport[]): IncidentReport[] {
  return value.filter((report) => report.status?.toLowerCase() !== "invalid");
}

export function SiteManagerMapScreen({ isDarkMode }: { isDarkMode?: boolean }) {
  const { systemPhase } = useSystemPhase();
  const phase = phaseFromSystem(systemPhase);
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = getStyles(theme);
  const mapRef = useRef<MapView>(null);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [centers, setCenters] = useState<CapacityCenter[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<MapFilter>("all");
  const [showShelters, setShowShelters] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState<Region>(PH_REGION);

  useEffect(() => {
    let cancelled = false;

    async function loadMapData() {
      try {
        const stored = await loadSession();
        if (cancelled) return;
        setSession(stored);

        if (!stored?.accessToken) {
          setLoading(false);
          return;
        }

        const [capacity, dashboard, inventory, reports] = await Promise.all([
          getCapacity(stored.accessToken),
          getDashboard("site-manager", stored.accessToken),
          getInventory("site-manager", stored.accessToken),
          getIncidentReports(stored.accessToken),
        ]);

        if (cancelled) return;
        setCenters(capacity);
        setOverview(dashboard);
        setInventoryItems(inventory);
        setIncidentReports(normalizeIncidentReports(reports));
        const nextRegion = regionForCenters(capacity);
        setMapRegion(nextRegion);
        requestAnimationFrame(() => mapRef.current?.animateToRegion(nextRegion, 500));
      } catch {
        if (!cancelled) {
          setCenters([]);
          setOverview(null);
          setInventoryItems([]);
          setIncidentReports([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMapData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCenters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return centers.filter((center) => {
      const matchesSearch =
        !query ||
        [center.name, center.barangay, center.municipality, center.address]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesSearch && matchesFilter(phase, selectedFilter, center);
    });
  }, [centers, phase, searchQuery, selectedFilter]);

  const highUtilizationCount = overview?.capacity.highUtilizationCenters ?? centers.filter((center) => center.utilizationRate >= 90).length;
  const displayedPopulation = overview?.capacity.totalOccupancy ?? centers.reduce((sum, center) => sum + center.currentOccupancy, 0);
  const phaseLabel = phase === "before" ? "Pre-Deployment Readiness" : phase === "during" ? "Active Emergency Response" : "Post-Disaster Recovery";
  const phaseColor = phase === "during" ? "#FFB300" : "#2E7D32";

  const recenterMap = useCallback(() => {
    const nextRegion = regionForCenters(filteredCenters.length ? filteredCenters : centers);
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 500);
  }, [centers, filteredCenters]);

  const zoomMap = useCallback((factor: number) => {
    setMapRegion((current) => {
      const next = {
        ...current,
        latitudeDelta: Math.min(Math.max(current.latitudeDelta * factor, 0.01), 12),
        longitudeDelta: Math.min(Math.max(current.longitudeDelta * factor, 0.01), 12),
      };
      mapRef.current?.animateToRegion(next, 250);
      return next;
    });
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.phaseBadge, { backgroundColor: phase === "during" ? "#FFF3E0" : "#E8F5E9" }]}>
          <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
          <Text style={[styles.phaseBadgeText, { color: phaseColor }]}>
            {phase === "before" ? "PRE-DISASTER PHASE" : phase === "during" ? "ACTIVE RESPONSE PHASE" : "RECOVERY PHASE"}
          </Text>
        </View>
        <Text style={styles.title}>Regional Site Map</Text>
        <Text style={styles.subtitle}>Live monitoring of active shelters and supply routes.</Text>
      </View>

      <View style={styles.statsRail}>
        {[
          ["Shelters", loading ? "..." : String(overview?.capacity.totalCenters ?? centers.length)],
          ["Population", loading ? "..." : formatNumber(displayedPopulation)],
          ["Critical", loading ? "..." : String(highUtilizationCount), "#BA1A1A"],
          ["Avg Util.", loading ? "..." : averageUtilization(centers), "#2E7D32"],
          ["Resources", loading ? "..." : String(overview?.inventory.totalCategories ?? inventoryItems.length)],
        ].map(([label, value, color]) => (
          <View key={label} style={styles.statItem}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.statLabel}>
              {label}
            </Text>
            <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.mapCard}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsCompass
          rotateEnabled={false}
          pitchEnabled={false}
          zoomEnabled
          scrollEnabled
        >
          {showShelters &&
            filteredCenters.map((center) => {
              const metric = centerMetric(phase, center);
              const coord = centerCoordinate(center);
              return (
                <Marker key={center.id} coordinate={coord} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.markerDot, { backgroundColor: metric.color }]}>
                    <Ionicons name="home" size={13} color="#fff" />
                  </View>
                  <Callout>
                    <View style={styles.callout}>
                      <Text style={styles.calloutTitle}>{center.name}</Text>
                      <Text style={styles.calloutSub}>{center.barangay}, {center.municipality}</Text>
                      <View style={styles.calloutMetric}>
                        <Text style={styles.calloutMetricLabel}>{metric.label}</Text>
                        <Text style={[styles.calloutMetricValue, { color: metric.color }]}>{metric.percent}%</Text>
                      </View>
                      <Text style={styles.calloutLine}>{metric.left}</Text>
                      <Text style={styles.calloutLine}>{metric.right}</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
        </MapView>

        <View style={styles.mapOverlay}>
          <View style={styles.mapPhaseCard}>
            <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mapPhaseLabel}>MAP PHASE</Text>
              <Text numberOfLines={1} style={styles.mapPhaseText}>{phaseLabel}</Text>
            </View>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#707A6C" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search shelters..."
              placeholderTextColor="#707A6C"
              style={styles.searchInput}
            />
          </View>
          <View style={styles.filterRow}>
            {([
              ["all", "All"],
              ["critical", "Critical"],
              ["moderate", "Moderate"],
              ["safe", "Safe"],
            ] as const).map(([key, label]) => {
              const selected = selectedFilter === key;
              return (
                <TouchableOpacity key={key} onPress={() => setSelectedFilter(key)} style={[styles.filterPill, selected && styles.filterPillActive]}>
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => zoomMap(0.55)}>
            <Ionicons name="add" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => zoomMap(1.8)}>
            <Ionicons name="remove" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, showShelters && styles.controlBtnActive]} onPress={() => setShowShelters((value) => !value)}>
            <Ionicons name="home" size={18} color={showShelters ? "#fff" : theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={recenterMap}>
            <Ionicons name="locate" size={18} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, showLegend && styles.controlBtnDark]} onPress={() => setShowLegend((value) => !value)}>
            <Ionicons name="information-circle" size={19} color={showLegend ? "#fff" : theme.text} />
          </TouchableOpacity>
        </View>

        {showLegend && (
          <View style={styles.legendCard}>
            <View style={styles.legendHeader}>
              <Text style={styles.legendTitle}>MAP LEGEND</Text>
              <TouchableOpacity onPress={() => setShowLegend(false)}>
                <Ionicons name="close" size={18} color="#707A6C" />
              </TouchableOpacity>
            </View>
            <Text style={styles.legendSection}>SHELTER STATUS</Text>
            {[
              { color: "#2E7D32", label: phase === "before" ? "Safe Readiness" : phase === "after" ? "Cleared" : "Safe" },
              { color: "#FFB300", label: phase === "before" ? "Moderate Readiness" : phase === "after" ? "In Progress" : "Moderate" },
              { color: "#BA1A1A", label: phase === "before" ? "Critical Readiness" : phase === "after" ? "Delayed" : "Critical" },
            ].map((item) => (
              <View key={item.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#2E7D32" />
            <Text style={styles.loadingText}>Loading map data</Text>
          </View>
        )}
      </View>

      {phase === "during" && incidentReports.length > 0 ? (
        <View style={styles.alertStrip}>
          <Ionicons name="warning" size={16} color="#BA1A1A" />
          <Text style={styles.alertStripText}>
            {incidentReports.length} live incident {incidentReports.length === 1 ? "report" : "reports"} linked to this response.
          </Text>
        </View>
      ) : null}

      <View style={styles.directoryCard}>
        <Text style={styles.directoryTitle}>Shelter Directory</Text>
        {filteredCenters.length === 0 ? (
          <Text style={styles.emptyText}>No shelter records available for your zone.</Text>
        ) : (
          filteredCenters.map((center) => {
            const metric = centerMetric(phase, center);
            return (
              <TouchableOpacity
                key={`directory-${center.id}`}
                style={styles.directoryItem}
                onPress={() => {
                  const coordinate = centerCoordinate(center);
                  const nextRegion = { ...coordinate, latitudeDelta: 0.035, longitudeDelta: 0.035 };
                  setMapRegion(nextRegion);
                  mapRef.current?.animateToRegion(nextRegion, 450);
                }}
              >
                <View style={styles.directoryHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.directoryName}>{center.name}</Text>
                    <Text numberOfLines={1} style={styles.directoryLocation}>{center.barangay}, {center.municipality}</Text>
                  </View>
                  <View style={[styles.metricBadge, { backgroundColor: `${metric.color}18` }]}>
                    <Text style={[styles.metricBadgeText, { color: metric.color }]}>{metric.percent}%</Text>
                  </View>
                </View>
                <View style={styles.directoryMetaRow}>
                  <Text style={styles.directoryMeta}>{metric.left}</Text>
                  <Text style={styles.directoryMeta}>{metric.right}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 20, paddingBottom: 150 },
  header: { marginBottom: 18 },
  phaseBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseBadgeText: { fontSize: 10, ...fonts.black, letterSpacing: 1.4 },
  title: { marginTop: 14, fontSize: 31, lineHeight: 36, ...fonts.black, color: theme.text },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 19, ...fonts.medium, color: theme.textMuted },
  statsRail: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.line,
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: theme.line },
  statLabel: { fontSize: 8, ...fonts.black, letterSpacing: 0.7, color: theme.textLight, textTransform: "uppercase", textAlign: "center" },
  statValue: { marginTop: 5, fontSize: 18, ...fonts.black, color: theme.text },
  mapCard: {
    height: 540,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.line,
  },
  map: { flex: 1 },
  mapOverlay: { position: "absolute", top: 14, left: 14, right: 70, gap: 10 },
  mapPhaseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  mapPhaseLabel: { fontSize: 8, ...fonts.black, letterSpacing: 1.2, color: "#707A6C" },
  mapPhaseText: { marginTop: 2, fontSize: 10, ...fonts.black, color: "#1A1C1A" },
  searchBox: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 12, ...fonts.bold, color: "#1A1C1A", paddingVertical: 0 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterPill: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  filterPillActive: { backgroundColor: "#1A1C1A" },
  filterText: { fontSize: 9, ...fonts.black, color: "#444743", textTransform: "uppercase", letterSpacing: 0.6 },
  filterTextActive: { color: "#fff" },
  mapControls: { position: "absolute", top: 14, right: 14, gap: 8 },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  controlBtnActive: { backgroundColor: "#2E7D32", borderColor: "#1B5E20" },
  controlBtnDark: { backgroundColor: "#1A1C1A", borderColor: "#1A1C1A" },
  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 7,
    elevation: 5,
  },
  callout: { width: 230, padding: 8 },
  calloutTitle: { fontSize: 13, ...fonts.black, color: "#1A1C1A" },
  calloutSub: { marginTop: 2, fontSize: 10, ...fonts.medium, color: "#707A6C" },
  calloutMetric: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F4F4EF", borderRadius: 10, padding: 10 },
  calloutMetricLabel: { fontSize: 9, ...fonts.black, color: "#707A6C", textTransform: "uppercase" },
  calloutMetricValue: { fontSize: 14, ...fonts.black },
  calloutLine: { marginTop: 6, fontSize: 10, ...fonts.bold, color: "#444743" },
  legendCard: {
    position: "absolute",
    right: 14,
    bottom: 16,
    width: 190,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  legendHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#DADAD5" },
  legendTitle: { fontSize: 9, ...fonts.black, letterSpacing: 1.2, color: "#707A6C" },
  legendSection: { marginTop: 10, marginBottom: 8, fontSize: 8, ...fonts.black, letterSpacing: 1, color: "#707A6C" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: "#fff" },
  legendText: { fontSize: 10, ...fonts.bold, color: "#444743" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { fontSize: 11, ...fonts.black, color: "#2E7D32", textTransform: "uppercase", letterSpacing: 1 },
  alertStrip: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF3E0",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  alertStripText: { flex: 1, fontSize: 12, ...fonts.bold, color: "#7A2E00" },
  directoryCard: {
    marginTop: 18,
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.line,
  },
  directoryTitle: { fontSize: 13, ...fonts.black, color: theme.text, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 },
  emptyText: { fontSize: 13, ...fonts.medium, color: theme.textMuted, lineHeight: 19 },
  directoryItem: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.line,
    marginBottom: 10,
  },
  directoryHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  directoryName: { fontSize: 14, ...fonts.black, color: theme.text },
  directoryLocation: { marginTop: 3, fontSize: 10, ...fonts.black, color: theme.textLight, textTransform: "uppercase", letterSpacing: 0.8 },
  metricBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  metricBadgeText: { fontSize: 11, ...fonts.black },
  directoryMetaRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  directoryMeta: { flex: 1, fontSize: 10, ...fonts.bold, color: theme.textMuted },
});
