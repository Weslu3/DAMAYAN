import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adjustInventoryItem, createInventoryBatch, getDashboard, getInventory } from "../../api";
import { useSystemPhase } from "../../context/SystemPhaseContext";
import { loadSession } from "../../session";
import { darkTheme, fonts, lightTheme } from "../../theme";
import type { AuthSession, DashboardOverview, InventoryItem as ApiInventoryItem } from "../../types";

type InventoryMode = "add" | "distribute";
type InventoryFilter = "all" | "high" | "low";
type CalamityPhase = "before" | "during" | "after";

interface DisplayInventoryItem {
  id: string;
  name: string;
  units: string;
  quantity: number;
  status: "SECURE" | "LOW STOCK" | "CRITICALLY LOW";
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  raw?: ApiInventoryItem;
}

const MOCK_INVENTORY: DisplayInventoryItem[] = [
  { id: "1", name: "Family Relief Pack A", units: "450 UNITS", quantity: 450, status: "SECURE", icon: "cube", color: "#81C784" },
  { id: "2", name: "Medical Kit - Level 2", units: "12 UNITS", quantity: 12, status: "CRITICALLY LOW", icon: "medical", color: "#EF9A9A" },
  { id: "3", name: "Sanitary Bundles", units: "1,200 UNITS", quantity: 1200, status: "SECURE", icon: "water", color: "#81C784" },
  { id: "4", name: "Portable Generators", units: "5 UNITS", quantity: 5, status: "LOW STOCK", icon: "flash", color: "#FFE082" },
];

function phaseFromSystem(systemPhase: string): CalamityPhase {
  if (systemPhase === "DURING") return "during";
  if (systemPhase === "AFTER") return "after";
  return "before";
}

function classifyInventoryItem(item: ApiInventoryItem): DisplayInventoryItem["status"] {
  const status = item.status.toLowerCase();
  if (status.includes("critical")) return "CRITICALLY LOW";
  if (status.includes("low") || item.quantity <= 10) return "LOW STOCK";
  return "SECURE";
}

function toDisplayItem(item: ApiInventoryItem): DisplayInventoryItem {
  const status = classifyInventoryItem(item);
  const isLow = status !== "SECURE";
  return {
    id: item.id,
    name: item.name,
    units: `${item.quantity.toLocaleString()} ${item.unit}`,
    quantity: item.quantity,
    status,
    icon: item.category?.toLowerCase().includes("medical") ? "medical" : "cube",
    color: status === "CRITICALLY LOW" ? "#EF9A9A" : isLow ? "#FFB300" : "#81C784",
    raw: item,
  };
}

function getDefaultMode(phase: CalamityPhase): InventoryMode {
  return phase === "before" ? "add" : "distribute";
}

function getExportRows(items: DisplayInventoryItem[]): string {
  const headers = ["Item", "Quantity", "Status", "Category", "Source"];
  const rows = items.map((item) => {
    const raw = item.raw;
    return [
      item.name,
      item.units,
      item.status,
      raw?.category ?? "",
      raw?.source ?? "",
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export function SiteManagerInventoryScreen({ isDarkMode }: { isDarkMode?: boolean }) {
  const { systemPhase } = useSystemPhase();
  const phase = phaseFromSystem(systemPhase);
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = getStyles(theme);

  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [inventoryItems, setInventoryItems] = React.useState<ApiInventoryItem[]>([]);
  const [inventoryMode, setInventoryMode] = React.useState<InventoryMode>(getDefaultMode(phase));
  const [inventoryFilter, setInventoryFilter] = React.useState<InventoryFilter>("all");
  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [referenceNote, setReferenceNote] = React.useState("");
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadInventory = React.useCallback(async () => {
    const stored = await loadSession();
    setSession(stored);

    if (!stored?.accessToken) {
      setInventoryItems([]);
      setOverview(null);
      return;
    }

    const [items, dashboard] = await Promise.all([
      getInventory("site-manager", stored.accessToken),
      getDashboard("site-manager", stored.accessToken),
    ]);

    setInventoryItems(items);
    setOverview(dashboard);
    setSelectedItemId((current) => current || items[0]?.id || "");
  }, []);

  React.useEffect(() => {
    setIsLoading(true);
    loadInventory()
      .catch((error) => {
        setSession(null);
        setInventoryItems([]);
        setOverview(null);
        Alert.alert("Inventory unavailable", error instanceof Error ? error.message : "Failed to load inventory.");
      })
      .finally(() => setIsLoading(false));
  }, [loadInventory]);

  React.useEffect(() => {
    setInventoryMode(getDefaultMode(phase));
  }, [phase]);

  const displayItems = React.useMemo<DisplayInventoryItem[]>(
    () => (inventoryItems.length > 0 ? inventoryItems.map(toDisplayItem) : MOCK_INVENTORY),
    [inventoryItems],
  );

  const filteredItems = React.useMemo(() => {
    return displayItems.filter((item) => {
      if (inventoryFilter === "high") return item.status === "SECURE";
      if (inventoryFilter === "low") return item.status !== "SECURE";
      return true;
    });
  }, [displayItems, inventoryFilter]);

  const selectedItem = inventoryItems.find((item) => item.id === selectedItemId);
  const totalQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowCount = displayItems.filter((item) => item.status !== "SECURE").length;
  const submitLabel = isSubmitting ? "Processing..." : inventoryMode === "add" ? "Add Stock" : "Record Distribution";

  const handleRefreshInventory = async () => {
    setIsRefreshing(true);
    try {
      await loadInventory();
      Alert.alert("Inventory refreshed", "Latest site-manager inventory is now loaded.");
    } catch (error) {
      Alert.alert("Refresh failed", error instanceof Error ? error.message : "Failed to refresh inventory.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmitInventoryUpdate = async () => {
    if (!session?.accessToken) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }

    if (!selectedItem) {
      Alert.alert("Select item", "Please select an inventory item first.");
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert("Invalid quantity", "Please enter a quantity greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const defaultPrefix = inventoryMode === "add" ? "Add" : "Dist";
      const refName = referenceNote.trim() || `${defaultPrefix}-${new Date().toISOString().split("T")[0]}`;

      if (phase === "before" && inventoryMode === "add") {
        await createInventoryBatch(session.accessToken, {
          name: refName,
          items: [{ itemId: selectedItem.id, quantity: parsedQuantity }],
        });
      } else {
        await adjustInventoryItem(
          session.accessToken,
          selectedItem.id,
          inventoryMode === "add" ? parsedQuantity : -parsedQuantity,
        );
      }

      setQuantity("");
      setReferenceNote("");
      await loadInventory();
      Alert.alert(
        "Inventory updated",
        inventoryMode === "add"
          ? `Added ${parsedQuantity} ${selectedItem.unit} to ${selectedItem.name}.`
          : `Recorded distribution of ${parsedQuantity} ${selectedItem.unit} from ${selectedItem.name}.`,
      );
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Failed to update inventory.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    const csv = getExportRows(displayItems);
    if (Platform.OS === "web") {
      try {
        const web = globalThis as unknown as {
          Blob: typeof Blob;
          URL: typeof URL;
          document: Document;
        };
        const blob = new web.Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = web.URL.createObjectURL(blob);
        const link = web.document.createElement("a");
        link.href = url;
        link.download = `damayan_inventory_export_${phase}_${new Date().toISOString().split("T")[0]}.csv`;
        web.document.body.appendChild(link);
        link.click();
        link.remove();
        web.URL.revokeObjectURL(url);
        return;
      } catch {
        Alert.alert("Export failed", "Could not export the CSV in this browser.");
        return;
      }
    }

    await Share.share({
      title: "DAMAYAN Inventory CSV",
      message: csv,
    });
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Logistics & Inventory</Text>
          <Text style={styles.subtitle}>Manage incoming and outgoing relief assets.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricsContainer} contentContainerStyle={styles.metricsContent}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>TOTAL ASSETS</Text>
              <Text style={[styles.metricTrend, { color: "#81C784" }]}>{overview?.inventory.totalCategories ?? inventoryItems.length} categories</Text>
            </View>
            <Text style={styles.metricValue}>{isLoading ? "..." : (overview?.inventory.itemCount ?? totalQuantity).toLocaleString()}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: "70%", backgroundColor: "#2196F3" }]} />
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>CRITICAL LOWS</Text>
              <Text style={[styles.metricTrend, { color: "#EF9A9A" }]}>Needs attention</Text>
            </View>
            <Text style={styles.metricValue}>{isLoading ? "..." : overview?.inventory.lowStockItems ?? lowCount}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: lowCount > 0 ? "45%" : "10%", backgroundColor: "#D32F2F" }]} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerTitle}>Stock Ledger</Text>
            <View style={styles.ledgerActions}>
              <TouchableOpacity style={styles.actionBtnGhost} onPress={handleRefreshInventory} disabled={isRefreshing}>
                {isRefreshing ? <ActivityIndicator color={theme.textLight} size="small" /> : <Text style={styles.actionBtnTextGhost}>Refresh</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnGhost} onPress={handleExportCsv}>
                <Text style={styles.actionBtnTextGhost}>Export CSV</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modeRow}>
            {([
              ["add", "Add Stock"],
              ["distribute", "Distribute"],
            ] as const).map(([mode, label]) => {
              const selected = inventoryMode === mode;
              return (
                <TouchableOpacity key={mode} style={[styles.modeButton, selected && styles.modeButtonActive]} onPress={() => setInventoryMode(mode)}>
                  <Text style={[styles.modeButtonText, selected && styles.modeButtonTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>{inventoryMode === "add" ? "SOURCE / DELIVERY NOTE" : "RECIPIENT / DISTRIBUTION NOTE"}</Text>
            <TextInput
              value={referenceNote}
              onChangeText={setReferenceNote}
              placeholder={inventoryMode === "add" ? "Supplier or delivery ref" : "Recipient, zone, or note"}
              placeholderTextColor={theme.textLight}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>ITEM</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setIsPickerOpen(true)}>
              <Text numberOfLines={1} style={[styles.selectorText, !selectedItem && { color: theme.textLight }]}>
                {selectedItem?.name ?? "Select inventory item"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.textLight} />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>QUANTITY</Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder={inventoryMode === "add" ? "Quantity to add" : "Quantity to distribute"}
              placeholderTextColor={theme.textLight}
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleSubmitInventoryUpdate} disabled={isSubmitting}>
              <Text style={styles.submitButtonText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            {([
              ["all", "All Items"],
              ["high", "High Supply"],
              ["low", "Low / Critical"],
            ] as const).map(([filter, label]) => {
              const selected = inventoryFilter === filter;
              return (
                <TouchableOpacity key={filter} style={[styles.filterPill, selected && styles.filterPillActive]} onPress={() => setInventoryFilter(filter)}>
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.ledgerList}>
            {filteredItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.inventoryCard} onPress={() => item.raw && setSelectedItemId(item.raw.id)}>
                <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.itemInfo}>
                  <Text numberOfLines={1} style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemUnits}>{item.units}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.status === "SECURE" ? "#E8F5E9" : item.status === "CRITICALLY LOW" ? "#FFEBEE" : "#FFF8E1" },
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: item.status === "SECURE" ? "#2E7D32" : item.status === "CRITICALLY LOW" ? "#D32F2F" : "#FFB300" },
                  ]}>{item.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={isPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Inventory Item</Text>
            {inventoryItems.length === 0 ? (
              <Text style={styles.emptyText}>No backend inventory items available.</Text>
            ) : (
              inventoryItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.pickerOption, selectedItemId === item.id && styles.pickerOptionActive]}
                  onPress={() => {
                    setSelectedItemId(item.id);
                    setIsPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionName}>{item.name}</Text>
                  <Text style={styles.pickerOptionMeta}>{item.quantity.toLocaleString()} {item.unit}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 24, paddingBottom: 140 },
  header: { marginBottom: 28 },
  title: { fontSize: 32, ...fonts.black, color: theme.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, ...fonts.medium, color: theme.textMuted, marginTop: 4 },
  metricsContainer: { marginBottom: 24, marginHorizontal: -24 },
  metricsContent: { paddingHorizontal: 24, gap: 16 },
  metricCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.line, width: 220 },
  metricHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 },
  metricLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1 },
  metricTrend: { flexShrink: 1, fontSize: 10, ...fonts.black, textAlign: "right" },
  metricValue: { fontSize: 32, ...fonts.black, color: theme.text, marginBottom: 12 },
  progressTrack: { height: 6, backgroundColor: theme.line, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  ledgerSection: { backgroundColor: theme.surface, borderRadius: 32, padding: 22, borderWidth: 1, borderColor: theme.line },
  ledgerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  ledgerTitle: { fontSize: 22, ...fonts.black, color: theme.text },
  ledgerActions: { flexDirection: "row", gap: 8 },
  actionBtnGhost: { minHeight: 40, minWidth: 76, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center" },
  actionBtnTextGhost: { fontSize: 11, ...fonts.black, color: theme.textLight },
  modeRow: { flexDirection: "row", backgroundColor: theme.surfaceAlt, borderRadius: 16, padding: 4, marginBottom: 16 },
  modeButton: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12 },
  modeButtonActive: { backgroundColor: "#2E7D32" },
  modeButtonText: { fontSize: 11, ...fonts.black, color: theme.textLight, textTransform: "uppercase", letterSpacing: 0.8 },
  modeButtonTextActive: { color: "#fff" },
  formCard: { backgroundColor: theme.surfaceAlt, borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.line },
  inputLabel: { fontSize: 9, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 7, marginTop: 10 },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, paddingHorizontal: 14, color: theme.text, ...fonts.bold },
  selector: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  selectorText: { flex: 1, minWidth: 0, color: theme.text, ...fonts.bold, fontSize: 13 },
  submitButton: { marginTop: 18, height: 52, borderRadius: 16, backgroundColor: "#2E7D32", alignItems: "center", justifyContent: "center" },
  submitButtonText: { color: "#fff", fontSize: 12, ...fonts.black, textTransform: "uppercase", letterSpacing: 1 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.surfaceAlt },
  filterPillActive: { backgroundColor: "#1A1C1A" },
  filterText: { fontSize: 10, ...fonts.black, color: theme.textLight },
  filterTextActive: { color: "#fff" },
  ledgerList: { gap: 12 },
  inventoryCard: { backgroundColor: theme.surfaceAlt, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: theme.line },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 15, ...fonts.black, color: theme.text },
  itemUnits: { fontSize: 11, ...fonts.medium, color: theme.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 8, ...fonts.black },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 24 },
  pickerCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: theme.line, maxHeight: "75%" },
  pickerTitle: { fontSize: 16, ...fonts.black, color: theme.text, marginBottom: 12 },
  pickerOption: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.line, marginBottom: 10, backgroundColor: theme.surfaceAlt },
  pickerOptionActive: { borderColor: "#2E7D32", backgroundColor: "#E8F5E9" },
  pickerOptionName: { fontSize: 14, ...fonts.black, color: theme.text },
  pickerOptionMeta: { fontSize: 11, ...fonts.medium, color: theme.textMuted, marginTop: 3 },
  emptyText: { fontSize: 13, ...fonts.medium, color: theme.textMuted, lineHeight: 19 },
});
