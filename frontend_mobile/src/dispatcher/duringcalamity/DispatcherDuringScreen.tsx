import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { MobileHeader, NavPills } from "../../components/MobileShell";
import { Button, Pill, Screen, SectionCard } from "../../components/UI";
import { NotificationBell } from "../../components/NotificationBell";
import { useNotifications } from "../../hooks/useNotifications";
import { loadSession } from "../../session";
import { dispatcherStyles } from "../shared";

export function DispatcherDuringScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const [active, setActive] = useState("Tickets");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadSession().then((s) => {
      if (s) {
        setToken(s.accessToken);
        setUserId(s.user.authUserId ?? s.user.id);
      }
    });
  }, []);

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, token);

  return (
    <Screen>
      <MobileHeader
        title="Damayan Portal"
        subtitle="Dispatcher Active Ops"
        onBack={onBack}
        rightSlot={
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        }
      />
      <NavPills
        items={["Dashboard", "Tickets", "Resources", "Broadcast"]}
        active={active}
        onSelect={setActive}
      />

      <SectionCard>
        <Pill label="Phase 2: Active Response" tone="danger" />
        <Text style={dispatcherStyles.title}>Active Dispatch Operations</Text>
        <Text style={dispatcherStyles.copy}>
          Assign tickets, coordinate relief sites, and track live field activity.
        </Text>
      </SectionCard>

      <SectionCard>
        <Text style={dispatcherStyles.sectionTitle}>Relief Ticket Queue</Text>
        {[
          ["TKT-2201", "Medical", "Unassigned"],
          ["TKT-2202", "Food Relief", "Assigned"],
          ["TKT-2203", "Evacuation", "In Progress"],
        ].map(([id, type, status]) => (
          <View key={id} style={dispatcherStyles.ticketRow}>
            <View style={{ flex: 1 }}>
              <Text style={dispatcherStyles.rowTitle}>{type}</Text>
              <Text style={dispatcherStyles.rowCopy}>{id}</Text>
            </View>
            <Pill
              label={status}
              tone={
                status === "Unassigned"
                  ? "danger"
                  : status === "Assigned"
                    ? "info"
                    : "warning"
              }
            />
          </View>
        ))}
        <Button label="Broadcast Alert To All" tone="danger" onPress={() => {}} />
      </SectionCard>
    </Screen>
  );
}
