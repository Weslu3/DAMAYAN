"use client";

import React, { useState } from "react";
import type { AuthSession, InventoryItem } from "../../../lib/types";
import type { PhaseConfig } from "../utils/siteManagerUtils";
import { buildInventoryTable } from "../utils/siteManagerUtils";
import { getInventory, adjustInventoryItem, createInventoryBatch } from "../../../lib/api";
import CustomSelect from "../CustomSelect";

interface InventoryTabProps {
  phase: "before" | "during" | "after";
  phaseConfig: PhaseConfig;
  session: AuthSession | null;
  overview: import("../../../lib/types").DashboardOverview | null;
  inventoryItems: InventoryItem[];
  loadingData: boolean;
  onInventoryRefreshed: (items: InventoryItem[]) => void;
}

interface NewBatchState {
  name: string;
  itemId: string;
  quantity: string;
}

export default function InventoryTab({
  phase,
  phaseConfig,
  session,
  overview,
  inventoryItems,
  loadingData,
  onInventoryRefreshed,
}: InventoryTabProps) {
  const [newBatchState, setNewBatchState] = useState<NewBatchState>({ name: "", itemId: "", quantity: "" });
  const [inventoryMode, setInventoryMode] = useState<"add" | "distribute">(phase === "before" ? "add" : "distribute");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "high" | "low">("all");
  const [isSubmittingNewBatch, setIsSubmittingNewBatch] = useState(false);
  const [newBatchError, setNewBatchError] = useState<string | null>(null);
  const [newBatchSuccess, setNewBatchSuccess] = useState<string | null>(null);
  const [isRefreshingInventory, setIsRefreshingInventory] = useState(false);
  const [inventoryActionError, setInventoryActionError] = useState<string | null>(null);
  const [inventoryActionSuccess, setInventoryActionSuccess] = useState<string | null>(null);

  const quantities = inventoryItems.map((item) => item.quantity);
  const sortedQuantities = quantities.slice().sort((a, b) => a - b);
  const scaleMax = sortedQuantities.length > 0
    ? Math.max(100, Math.min(2000, sortedQuantities[Math.floor(sortedQuantities.length * 0.75)] || sortedQuantities[sortedQuantities.length - 1]))
    : 1000;

  const inventoryTable = buildInventoryTable(inventoryItems, scaleMax);
  const filteredInventoryTable = inventoryTable.filter((row) => {
    if (inventoryFilter === "high") return row.tone !== "error" && row.tone !== "warning";
    if (inventoryFilter === "low") return row.tone === "error" || row.tone === "warning";
    return true;
  });

  let totalAssetsVal = "N/A";
  let totalAssetsTrend = "No backend data";
  let criticalLowsVal = "N/A";
  if (loadingData) {
    totalAssetsVal = "...";
    totalAssetsTrend = "Loading";
    criticalLowsVal = "...";
  } else if (overview) {
    totalAssetsVal = overview.inventory.itemCount.toLocaleString();
    totalAssetsTrend = `${overview.inventory.totalCategories} categories`;
    criticalLowsVal = String(overview.inventory.lowStockItems);
  }

  const inventoryCards = [
    {
      label: "Total Assets",
      value: totalAssetsVal,
      trend: totalAssetsTrend,
      source: loadingData
        ? "Counting all items in your site inventory..."
        : overview
          ? "Counted from all inventory items currently recorded for this site"
          : "No inventory count was returned for this site",
      color: "#2196F3",
    },
    {
      label: "Critical Lows",
      value: criticalLowsVal,
      trend: "Needs attention",
      source: loadingData
        ? "Checking which supplies are running low..."
        : overview
          ? "Items marked low or critical based on the current recorded stock"
          : "No low-stock count was returned for this site",
      color: "#ba1a1a",
    },
  // 'In Transit' card permanently removed as requested
  ];

  const handleCreateNewBatch = async () => {
    if (!session?.accessToken) {
      setNewBatchError("Session expired. Please login again.");
      setNewBatchSuccess(null);
      return;
    }

    const selectedItemId = newBatchState.itemId;
    const parsedQuantity = Number(newBatchState.quantity);

    if (!selectedItemId) {
      setNewBatchError("Please select an inventory item.");
      setNewBatchSuccess(null);
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setNewBatchError("Please enter a valid batch quantity greater than 0.");
      setNewBatchSuccess(null);
      return;
    }

    setIsSubmittingNewBatch(true);
    setNewBatchError(null);
    setNewBatchSuccess(null);

    try {
      let successMsg = "";
      let refName = "";

      const defaultPrefix = inventoryMode === "add" ? "Add" : "Disp";
      refName = newBatchState.name.trim() || `${defaultPrefix}-${new Date().toISOString().split("T")[0]}-${Math.floor(Math.random() * 1000)}`;

      if (phase === "before" && inventoryMode === "add") {
        // Before + add: stage new supplies via batch
        const submittedBatchName = newBatchState.name.trim() || `Req-${new Date().toISOString().split("T")[0]}-${Math.floor(Math.random() * 1000)}`;
        const batchResult = await createInventoryBatch(session.accessToken, {
          name: submittedBatchName,
          items: [{ itemId: selectedItemId, quantity: parsedQuantity }],
        });
        refName = batchResult?.batchName ?? submittedBatchName;
        successMsg = `Added ${parsedQuantity} units to shelter supplies. (Ref: ${refName})`;
      } else {
        const adjustment = inventoryMode === "add" ? parsedQuantity : -parsedQuantity;
        await adjustInventoryItem(session.accessToken, selectedItemId, adjustment);
        successMsg = inventoryMode === "add"
          ? `Added ${parsedQuantity} units to inventory. (Ref: ${refName})`
          : `Recorded distribution of ${parsedQuantity} units. (Ref: ${refName})`;
      }

      setNewBatchState({ name: "", itemId: "", quantity: "" });
      const freshInventory = await getInventory("site-manager", session.accessToken);
      onInventoryRefreshed(freshInventory);
      setNewBatchSuccess(successMsg);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process inventory update";
      setNewBatchError(message);
      setNewBatchSuccess(null);
      console.error("New batch error:", error);
    } finally {
      setIsSubmittingNewBatch(false);
    }
  };

  const handleRefreshInventory = async () => {
    if (!session?.accessToken) return;
    setIsRefreshingInventory(true);
    setInventoryActionError(null);
    setInventoryActionSuccess(null);
    try {
      const freshInventory = await getInventory("site-manager", session.accessToken);
      onInventoryRefreshed(freshInventory);
      setInventoryActionSuccess("Inventory refreshed successfully.");
    } catch (error) {
      console.error("Refresh inventory error:", error);
      setInventoryActionError(error instanceof Error ? error.message : "Failed to refresh inventory.");
    } finally {
      setIsRefreshingInventory(false);
    }
  };

  const handleExportCSV = () => {
    setInventoryActionError(null);
    setInventoryActionSuccess(null);
    try {
      const headers = ["Category", "Stock Level", "Incoming", "ETA", "Status"];
      const csvRows = inventoryTable.map(
        (row) => `"${row.category}","${row.stock}","${row.incoming}","${row.eta}","${row.status}"`,
      );
      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `damayan_inventory_export_${phase}_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      setInventoryActionSuccess("Inventory CSV exported successfully.");
    } catch (err) {
      console.error("Failed to export CSV:", err);
      setInventoryActionError("Failed to export CSV. Please try again.");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div
        className={`grid grid-cols-1 ${inventoryCards.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"} gap-6`}
      >
        {inventoryCards.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#232622] p-6 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-[#444743] mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h4 className="text-3xl font-black">{stat.value}</h4>
              <span className="text-xs font-bold" style={{ color: stat.color }}>
                {stat.trend}
              </span>
            </div>
            <div className="w-full h-1 bg-[#f4f4ef] dark:bg-[#1a1c19] mt-4 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "70%", background: stat.color }}></div>
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#707a6c] dark:text-[#a0a39f]">
              {stat.source}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black">

        {inventoryActionError && (
          <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
            {inventoryActionError}
          </div>
        )}

        {inventoryActionSuccess && (
          <div className="mb-6 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
            {inventoryActionSuccess}
          </div>
        )}
              {phase === "before" ? "Shelter Supplies" : phase === "during" ? "Relief Goods Movement" : "Inventory Management"}
            </h3>
            <p className="text-[#444743] text-sm mt-1">
              {phase === "before"
                ? "Add new deliveries or record distributions for pre-disaster staging."
                : phase === "during"
                  ? "Record distributions to evacuees or add incoming stock during active operations."
                  : "Add incoming stock or record distributions during recovery operations."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshInventory}
              disabled={isRefreshingInventory}
              className="bg-[#f4f4ef] dark:bg-[#1a1c19] px-4 py-2 rounded-xl text-xs font-bold border border-[#dadad5] hover:bg-[#dadad5] dark:hover:bg-[#3b3b3b] transition-colors active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-xs ${isRefreshingInventory ? "animate-spin" : ""}`}>
                refresh
              </span>
              {isRefreshingInventory ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-[#f4f4ef] dark:bg-[#1a1c19] px-4 py-2 rounded-xl text-xs font-bold border border-[#dadad5] hover:bg-[#dadad5] dark:hover:bg-[#3b3b3b] transition-colors active:scale-95"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="inline-grid grid-cols-2 gap-2 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] p-1 mb-4 border border-[#dadad5] dark:border-[#3b3b3b]">
          <button
            type="button"
            onClick={() => { setInventoryMode("add"); setNewBatchError(null); setNewBatchSuccess(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${inventoryMode === "add" ? "text-white shadow-sm" : "text-[#444743] hover:bg-white/60 dark:hover:bg-white/5"}`}
            style={inventoryMode === "add" ? { background: "#2E7D32" } : {}}
          >
            Add Stock
          </button>
          <button
            type="button"
            onClick={() => { setInventoryMode("distribute"); setNewBatchError(null); setNewBatchSuccess(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${inventoryMode === "distribute" ? "text-white shadow-sm" : "text-[#444743] hover:bg-white/60 dark:hover:bg-white/5"}`}
            style={inventoryMode === "distribute" ? { background: phaseConfig.primaryColor } : {}}
          >
            Distribute
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-xs font-bold"
            placeholder={inventoryMode === "add" ? "Source, supplier, or delivery note (optional)" : "Recipient, location, or distribution note (optional)"}
            value={newBatchState.name}
            onChange={(e) => setNewBatchState({ ...newBatchState, name: e.target.value })}
          />
          <CustomSelect
            value={newBatchState.itemId}
            onChange={(val: any) => setNewBatchState({ ...newBatchState, itemId: val })}
            options={inventoryItems.map((item) => ({ value: item.id, label: item.name }))}
            placeholder={inventoryMode === "add" ? "Select item to add" : "Select item to distribute"}
          />
          <input
            className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-xs font-bold"
            placeholder={inventoryMode === "add" ? "Quantity to add" : "Quantity to give out"}
            type="number"
            min="1"
            value={newBatchState.quantity}
            onChange={(e) => setNewBatchState({ ...newBatchState, quantity: e.target.value })}
          />
          <button
            onClick={handleCreateNewBatch}
            disabled={isSubmittingNewBatch}
            className="w-full text-white px-4 py-3 rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
            style={{ background: phaseConfig.primaryColor }}
          >
            {isSubmittingNewBatch ? "Processing..." : inventoryMode === "add" ? "Add Stock" : "Record Distribution"}
          </button>
        </div>

        {newBatchError && <p className="text-red-600 text-xs mb-2">{newBatchError}</p>}
        {newBatchSuccess && <p className="text-[#2E7D32] text-xs mb-4">{newBatchSuccess}</p>}

        <div className="flex flex-wrap items-center gap-2 mb-4 pt-2 border-t border-[#dadad5] dark:border-[#3b3b3b]">
          {(["all", "high", "low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setInventoryFilter(f)}
              className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all ${
                inventoryFilter === f ? "text-white shadow-sm scale-105" : "bg-[#f4f4ef] dark:bg-[#1a1c19] text-[#444743] hover:bg-[#dadad5]/50"
              }`}
              style={inventoryFilter === f ? { background: f === "low" ? "#ba1a1a" : f === "high" ? "#2E7D32" : phaseConfig.primaryColor } : {}}
            >
              {f === "all" ? "All Items" : f === "high" ? "High Supply" : "Low / Critical Stock"}
            </button>
          ))}
          <span className="text-[10px] text-[#707a6c] ml-auto">{filteredInventoryTable.length} item{filteredInventoryTable.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-4">
          {filteredInventoryTable.map((item) => (
            <div
              key={`receive-audit-item-${item.category}`}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#f4f4ef]/50 dark:bg-white/5 border border-transparent hover:border-[#dadad5] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1a1c19] flex items-center justify-center border border-[#dadad5] dark:border-[#3b3b3b]">
                  <span
                    className="material-symbols-outlined"
                    style={{
                      color:
                        item.tone === "error" ? "#ba1a1a" : item.tone === "warning" ? "#FFB300" : "#2E7D32",
                    }}
                  >
                    package_2
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm">{item.category}</p>
                  <p className="text-[10px] text-[#444743] uppercase tracking-widest">{item.quantity}</p>
                </div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                style={{
                  background:
                    item.tone === "error" ? "#ffdad6" : item.tone === "warning" ? "#fff3e0" : "#e8f5e9",
                  color:
                    item.tone === "error" ? "#ba1a1a" : item.tone === "warning" ? "#FFB300" : "#2E7D32",
                }}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
