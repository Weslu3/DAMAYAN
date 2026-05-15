import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { MobileHeader, NavPills } from "../components/MobileShell";
import { Button, Pill, Screen, SectionCard } from "../components/UI";
import {
  type AdminDisasterEventsPayload,
  broadcastAdminWarning,
  ApiError,
  approvePendingUser,
  getDashboard,
  getDisasterEvents,
  getPendingApprovals,
  getSystemHealth,
  rejectPendingUser,
  updateAdminDisasterEvent,
  type AdminApprovalRecord,
  type AdminDisasterEventWithTickets,
  type AdminSystemHealthRecord,
} from "../api";
import { loadSession } from "../session";
import { styles } from "./AdminDashboardScreen.styles";
import { subscribeToLiveAlerts, type LiveAlertRecord } from "../supabase";

type HealthTone = "success" | "warning" | "danger";
type CalamityPhase = "BEFORE" | "DURING" | "AFTER";
type MobileDisasterRecord = {
  id: string;
  name: string;
  type: string;
  severityLevel: string;
  phase: CalamityPhase;
  areas: string;
  ticketCount: number;
};

export function AdminDashboardScreen({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof getDashboard>> | null>(null);
  const [approvals, setApprovals] = useState<AdminApprovalRecord[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealthRecord[]>([]);
  const [disasters, setDisasters] = useState<MobileDisasterRecord[]>([]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [broadcastType, setBroadcastType] = useState("Typhoon");
  const [broadcastSeverity, setBroadcastSeverity] = useState("HIGH");
  const [broadcastAreas, setBroadcastAreas] = useState("Metro Manila, Laguna Basin");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [useSMS, setUseSMS] = useState(true);
  const [usePush, setUsePush] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertRecord[]>([]);

  const mapStatusToPhase = (status: string): CalamityPhase => {
    const normalized = status.toLowerCase();
    if (normalized === "active") {
      return "DURING";
    }
    if (normalized === "resolved" || normalized === "ended") {
      return "AFTER";
    }
    return "BEFORE";
  };

  const mapPhaseToStatus = (phase: CalamityPhase): "monitoring" | "active" | "resolved" => {
    if (phase === "DURING") {
      return "active";
    }
    if (phase === "AFTER") {
      return "resolved";
    }
    return "monitoring";
  };

  const normalizeDisasters = (
    payload: Awaited<ReturnType<typeof getDisasterEvents>>,
  ): MobileDisasterRecord[] => {
    const events = Array.isArray(payload)
      ? payload
      : (payload as AdminDisasterEventsPayload).disasterEvents;

    return events.map((event) => {
      const item = event as AdminDisasterEventWithTickets;
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        severityLevel: item.severityLevel,
        phase: mapStatusToPhase(item.status),
        areas: item.affectedAreas.length > 0 ? item.affectedAreas.join(", ") : item.province,
        ticketCount: item.ticketCount ?? 0,
      };
    });
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError("Please sign in again to load admin data.");
        return;
      }

      const accessToken = session.accessToken.trim();
      setToken(accessToken);

      const [dashboardData, approvalData, healthData] = await Promise.all([
        getDashboard("admin", accessToken),
        getPendingApprovals(accessToken),
        getSystemHealth(accessToken),
      ]);

      const disasterData = await getDisasterEvents("admin", accessToken);

      setDashboard(dashboardData);
      setApprovals(approvalData);
      setSystemHealth(healthData);
      setDisasters(normalizeDisasters(disasterData));
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to load admin dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const unsubscribe = subscribeToLiveAlerts((alert) => {
      setLiveAlerts((current) => [alert, ...current].slice(0, 3));
      Alert.alert(
        alert.title,
        `${alert.message}${alert.target ? `\n\nTarget: ${alert.target}` : ""}`,
      );
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const kpis = useMemo(() => {
    const totalDispatchOrders = dashboard
      ? Object.values(dashboard.dispatchOrders ?? {}).reduce(
          (sum, value) => sum + (typeof value === "number" ? value : 0),
          0,
        )
      : 0;

    return [
      ["Active Disasters", String(dashboard?.disasterEvents.activeEvents ?? 0)],
      ["Relief Tickets", String(dashboard?.incidentReports.totalReports ?? 0)],
      ["Pending Approvals", String(approvals.length)],
      ["Dispatch Orders", String(totalDispatchOrders)],
    ];
  }, [dashboard, approvals.length]);

  const handleApprove = useCallback(async (id: string) => {
    if (!token) {
      Alert.alert("Session expired", "Please log in again.");
      return;
    }

    try {
      setActiveActionId(`approve:${id}`);
      await approvePendingUser(token, id);
      setApprovals((current) => current.filter((entry) => entry.id !== id));
      Alert.alert("Approved", "User access request has been approved.");
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to approve this request.";
      Alert.alert("Approval failed", message);
    } finally {
      setActiveActionId(null);
    }
  }, [token]);

  const handlePhaseUpdate = useCallback(async (id: string, phase: CalamityPhase) => {
    if (!token) {
      Alert.alert("Session expired", "Please log in again.");
      return;
    }

    const previous = disasters;
    setDisasters((current) => current.map((item) => item.id === id ? { ...item, phase } : item));

    try {
      setActiveActionId(`phase:${id}`);
      await updateAdminDisasterEvent(token, id, { status: mapPhaseToStatus(phase) });
      Alert.alert("Phase updated", `Disaster event updated to ${phase}.`);
    } catch (caughtError) {
      setDisasters(previous);
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to sync disaster phase.";
      Alert.alert("Update failed", message);
    } finally {
      setActiveActionId(null);
    }
  }, [disasters, token]);

  const handleSendBroadcast = useCallback(async () => {
    if (!token) {
      Alert.alert("Session expired", "Please log in again.");
      return;
    }

    const areas = broadcastAreas
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!broadcastMessage.trim() || areas.length === 0) {
      Alert.alert("Missing details", "Please provide a warning message and at least one target area.");
      return;
    }

    if (!useSMS && !usePush) {
      Alert.alert("Channel required", "Please enable at least one broadcast channel.");
      return;
    }

    try {
      setBroadcasting(true);
      const result = await broadcastAdminWarning(token, {
        type: broadcastType,
        severity: broadcastSeverity,
        areas,
        message: broadcastMessage,
        useSMS,
        usePush,
      });

      Alert.alert(
        "Broadcast sent",
        `Delivered ${result.delivered} out of ${result.attempted} notifications.`,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to send broadcast right now.";
      Alert.alert("Broadcast failed", message);
    } finally {
      setBroadcasting(false);
    }
  }, [broadcastAreas, broadcastMessage, broadcastSeverity, broadcastType, token, usePush, useSMS]);

  const handleReject = useCallback(async (id: string) => {
    if (!token) {
      Alert.alert("Session expired", "Please log in again.");
      return;
    }

    try {
      setActiveActionId(`reject:${id}`);
      await rejectPendingUser(token, id, "Rejected via mobile admin dashboard.");
      setApprovals((current) => current.filter((entry) => entry.id !== id));
      Alert.alert("Rejected", "User access request has been rejected.");
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to reject this request.";
      Alert.alert("Rejection failed", message);
    } finally {
      setActiveActionId(null);
    }
  }, [token]);

  const approvalRows = approvals.map((entry) => {
    const firstName = entry.firstName ?? entry.first_name ?? "";
    const lastName = entry.lastName ?? entry.last_name ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || entry.email || "Unknown User";
    return {
      id: entry.id,
      name: fullName,
      role: entry.role ?? "Unknown Role",
      area: entry.email ?? "No email",
    };
  });

  const healthRows = systemHealth.map((entry) => {
    const tone: HealthTone =
      entry.status === "OPERATIONAL"
        ? "success"
        : entry.status === "DEGRADED"
          ? "warning"
          : "danger";
    return {
      name: entry.name,
      status: entry.status,
      tone,
    };
  });

  return (
    <Screen>
      <MobileHeader title="DAMAYAN Admin Console" subtitle="Admin dashboard" onBack={onBack} />
      {liveAlerts.length > 0 ? (
        <SectionCard style={styles.liveAlertCard}>
          <View style={styles.liveAlertHeader}>
            <Text style={styles.sectionTitle}>Live Alerts</Text>
            <Pill label={`${liveAlerts.length} new`} tone="danger" />
          </View>
          {liveAlerts.map((alert) => {
            const tone: HealthTone =
              alert.severity.toLowerCase() === "critical" || alert.severity.toLowerCase() === "evacuation"
                ? "danger"
                : alert.severity.toLowerCase() === "warning"
                  ? "warning"
                  : "success";

            return (
              <View key={alert.id} style={styles.liveAlertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{alert.title}</Text>
                  <Text style={styles.rowCopy}>{alert.message}</Text>
                  <Text style={styles.liveAlertMeta}>
                    {(alert.scope || "all").toUpperCase()} • {alert.target || "All areas"} • {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                  </Text>
                </View>
                <Pill label={alert.severity.toUpperCase()} tone={tone} />
              </View>
            );
          })}
        </SectionCard>
      ) : null}
      <NavPills
        items={["Overview", "Approvals", "System Health", "Disasters", "Broadcast"]}
        active={active}
        onSelect={setActive}
      />

      {error ? <Text style={styles.errorCopy}>{error}</Text> : null}

      {(active === "Overview" || active === "Approvals" || active === "System Health") && (
        <View style={styles.kpiGrid}>
          {kpis.map(([label, value]) => (
            <SectionCard key={label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={styles.kpiValue}>{value}</Text>
            </SectionCard>
          ))}
        </View>
      )}

      {(active === "Overview" || active === "Approvals") && (
        <SectionCard>
          <Text style={styles.sectionTitle}>Pending Role Applications</Text>
          {approvalRows.length === 0 ? (
            <Text style={styles.emptyCopy}>
              {loading ? "Loading applications..." : "No pending applications."}
            </Text>
          ) : (
            approvalRows.map(({ id, name, role, area }) => (
              <View key={id} style={styles.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{name}</Text>
                  <Text style={styles.rowCopy}>{role} • {area}</Text>
                </View>
                <View style={styles.actionGroup}>
                  <Button
                    label={activeActionId === `approve:${id}` ? "Approving..." : "Approve"}
                    onPress={() => {
                      if (!activeActionId) {
                        handleApprove(id);
                      }
                    }}
                  />
                  <Button
                    label={activeActionId === `reject:${id}` ? "Rejecting..." : "Reject"}
                    tone="secondary"
                    onPress={() => {
                      if (!activeActionId) {
                        handleReject(id);
                      }
                    }}
                  />
                </View>
              </View>
            ))
          )}
        </SectionCard>
      )}

      {(active === "Overview" || active === "System Health") && (
        <SectionCard>
          <Text style={styles.sectionTitle}>System Health</Text>
          {healthRows.length === 0 ? (
            <Text style={styles.emptyCopy}>
              {loading ? "Loading health status..." : "No system health records available."}
            </Text>
          ) : (
            healthRows.map(({ name, status, tone }) => (
              <View key={name} style={styles.healthRow}>
                <Text style={styles.rowTitle}>{name}</Text>
                <Pill label={status} tone={tone} />
              </View>
            ))
          )}
        </SectionCard>
      )}

      {(active === "Overview" || active === "Disasters") && (
        <SectionCard>
          <Text style={styles.sectionTitle}>Disaster Monitoring</Text>
          {disasters.length === 0 ? (
            <Text style={styles.emptyCopy}>
              {loading ? "Loading disaster events..." : "No disaster events available."}
            </Text>
          ) : (
            disasters.map((disaster) => (
              <View key={disaster.id} style={styles.disasterCard}>
                <View style={styles.disasterHead}>
                  <Text style={styles.rowTitle}>{disaster.name}</Text>
                  <Pill label={disaster.phase} tone={disaster.phase === "DURING" ? "danger" : disaster.phase === "AFTER" ? "success" : "warning"} />
                </View>
                <Text style={styles.rowCopy}>{disaster.type} • {disaster.severityLevel}</Text>
                <Text style={styles.rowCopy}>Areas: {disaster.areas}</Text>
                <Text style={styles.rowCopy}>Tickets: {disaster.ticketCount}</Text>

                <View style={styles.phaseActionRow}>
                  {(["BEFORE", "DURING", "AFTER"] as CalamityPhase[]).map((phase) => (
                    <Button
                      key={`${disaster.id}:${phase}`}
                      label={activeActionId === `phase:${disaster.id}` && disaster.phase === phase ? "Updating..." : phase}
                      tone={disaster.phase === phase ? "primary" : "ghost"}
                      onPress={() => {
                        if (!activeActionId) {
                          handlePhaseUpdate(disaster.id, phase);
                        }
                      }}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </SectionCard>
      )}

      {(active === "Overview" || active === "Broadcast") && (
        <SectionCard>
          <Text style={styles.sectionTitle}>Early Warning Broadcast</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Warning Type</Text>
            <TextInput
              value={broadcastType}
              onChangeText={setBroadcastType}
              placeholder="Typhoon"
              style={styles.formInput}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Severity</Text>
            <TextInput
              value={broadcastSeverity}
              onChangeText={setBroadcastSeverity}
              placeholder="HIGH"
              style={styles.formInput}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Target Areas (comma separated)</Text>
            <TextInput
              value={broadcastAreas}
              onChangeText={setBroadcastAreas}
              placeholder="Metro Manila, Laguna Basin"
              style={styles.formInput}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Warning Message</Text>
            <TextInput
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              placeholder="Early warning alert details..."
              style={styles.formTextarea}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.channelRow}>
            <Button
              label={useSMS ? "SMS On" : "SMS Off"}
              tone={useSMS ? "primary" : "ghost"}
              onPress={() => setUseSMS((current) => !current)}
            />
            <Button
              label={usePush ? "Push On" : "Push Off"}
              tone={usePush ? "primary" : "ghost"}
              onPress={() => setUsePush((current) => !current)}
            />
          </View>

          <Button
            label={broadcasting ? "Sending..." : "Send Warning Broadcast"}
            tone="danger"
            onPress={() => {
              if (!broadcasting && !activeActionId) {
                handleSendBroadcast();
              }
            }}
          />
        </SectionCard>
      )}

      <Button
        label={loading ? "Refreshing..." : "Refresh Admin Data"}
        tone="ghost"
        onPress={() => {
          if (!loading && !activeActionId) {
            fetchDashboardData();
          }
        }}
      />
    </Screen>
  );
}


