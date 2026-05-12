import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MobileHeader, NavPills } from "../components/MobileShell";
import { Button, Pill, Screen, SectionCard } from "../components/UI";
import { theme, fonts } from "../theme";
import { styles } from "./AdminDashboardScreen.styles";

export function AdminDashboardScreen({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState("Overview");

  return (
    <Screen>
      <MobileHeader title="DAMAYAN Admin Console" subtitle="Admin dashboard" onBack={onBack} />
      <NavPills
        items={["Overview", "Approvals", "System Health"]}
        active={active}
        onSelect={setActive}
      />

      <View style={styles.kpiGrid}>
        {[
          ["Active Disasters", "2"],
          ["Relief Tickets", "241"],
          ["Pending Approvals", "3"],
          ["Dispatchers", "5"],
        ].map(([label, value]) => (
          <SectionCard key={label} style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{label}</Text>
            <Text style={styles.kpiValue}>{value}</Text>
          </SectionCard>
        ))}
      </View>

      <SectionCard>
        <Text style={styles.sectionTitle}>Pending Role Applications</Text>
        {[
          ["Ana Torres", "Site Manager", "District 2"],
          ["Renz Villanueva", "Dispatcher", "Metro Cluster 5"],
        ].map(([name, role, area]) => (
          <View key={name} style={styles.listCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{name}</Text>
              <Text style={styles.rowCopy}>{role} • {area}</Text>
            </View>
            <View style={styles.actionGroup}>
              <Button label="Approve" onPress={() => {}} />
              <Button label="Reject" tone="secondary" onPress={() => {}} />
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>System Health</Text>
        {[
          ["API Gateway", "Operational", "success"],
          ["Notification Service", "Degraded", "warning"],
          ["GIS / Mapping", "Operational", "success"],
        ].map(([name, status, tone]) => (
          <View key={name} style={styles.healthRow}>
            <Text style={styles.rowTitle}>{name}</Text>
            <Pill label={status} tone={tone === "success" ? "success" : "warning"} />
          </View>
        ))}
      </SectionCard>
    </Screen>
  );
}


