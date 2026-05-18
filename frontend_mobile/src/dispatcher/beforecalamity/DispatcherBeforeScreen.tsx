import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { MobileHeader, NavPills } from "../../components/MobileShell";
import { Button, Pill, Screen, SectionCard } from "../../components/UI";
import { NotificationBell } from "../../components/NotificationBell";
import { useNotifications } from "../../hooks/useNotifications";
import { loadSession } from "../../session";
import { dispatcherStyles } from "../shared";

export function DispatcherBeforeScreen({
  onBack,
  onOpenDuring,
}: {
  onBack: () => void;
  onOpenDuring: () => void;
}) {
  const [active, setActive] = useState("Incidents");
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
        subtitle="Dispatcher"
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
        items={["Dashboard", "Incidents", "Resources", "Sites"]}
        active={active}
        onSelect={setActive}
      />

      <SectionCard>
        <Pill label="Phase 1" tone="warning" />
        <Text style={dispatcherStyles.title}>Dispatch Command Center</Text>
        <Text style={dispatcherStyles.copy}>
          Monitor incidents, pre-position resources, and coordinate teams ahead of
          response escalation.
        </Text>
        <Button label="Open Active Dispatch" onPress={onOpenDuring} />
      </SectionCard>

      <SectionCard>
        <Text style={dispatcherStyles.sectionTitle}>Incoming Incidents</Text>
        {[
          ["Flood Warning", "Brgy. 102, District 4", "High"],
          ["Medical Emergency", "North Elementary", "Critical"],
        ].map(([type, area, severity]) => (
          <View key={type} style={dispatcherStyles.ticketRow}>
            <View style={{ flex: 1 }}>
              <Text style={dispatcherStyles.rowTitle}>{type}</Text>
              <Text style={dispatcherStyles.rowCopy}>{area}</Text>
            </View>
            <Pill label={severity} tone={severity === "Critical" ? "danger" : "warning"} />
          </View>
        ))}
      </SectionCard>
    </Screen>
  );
}
