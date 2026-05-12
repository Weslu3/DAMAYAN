import React, { useState, useEffect } from "react";
import { Pressable, Text, View, ScrollView, TouchableOpacity, Animated, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, fonts, lightTheme, darkTheme } from "../../theme";

export function SiteManagerBeforeScreen({
  onBack,
  onOpenResponse,
  isDarkMode,
}: {
  onBack: () => void;
  onOpenResponse: () => void;
  isDarkMode?: boolean;
}) {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const theme = isDarkMode ? darkTheme : lightTheme;
  const localStyles = getStyles(theme);

  return (
    <ScrollView 
      style={localStyles.container}
      contentContainerStyle={localStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={localStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={localStyles.statusBadge}>
            <View style={localStyles.statusDot} />
            <Text style={localStyles.statusBadgeText}>STAGING & READINESS MODE</Text>
          </View>
          <Text style={localStyles.dashboardTitle}>Regional Logistics{"\n"}& Staging Hub</Text>
          <Text style={localStyles.dashboardSub}>
            Monitoring regional readiness, resource pre-positioning, and personnel staging. Site is currently 88% ready.
          </Text>
        </View>
        <TouchableOpacity style={localStyles.scoreCard} onPress={onBack}>
          <Text style={localStyles.scoreValue}>88%</Text>
          <Text style={localStyles.scoreLabel}>STAGING SCORE</Text>
        </TouchableOpacity>
      </View>

      <View style={localStyles.mainSection}>
        {/* Before Calamity Checklist */}
        <View style={localStyles.checklistSection}>
          <View style={localStyles.sectionHeaderRow}>
            <View>
              <Text style={localStyles.sectionTitle}>Before Calamity Checklist</Text>
              <Text style={localStyles.sectionSub}>Core readiness actions aligned to your swimlane before the response phase begins.</Text>
            </View>
            <View style={localStyles.priorityBadge}>
               <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
               <Text style={localStyles.priorityText}>Priority Status</Text>
            </View>
          </View>

          <View style={localStyles.checklistGrid}>
            <View style={localStyles.readinessCheckCard}>
               <View style={localStyles.checkIconWrap}>
                  <Ionicons name="shield-checkmark" size={32} color={theme.primary} />
               </View>
               <Text style={localStyles.checkTitle}>Readiness Check</Text>
               <Text style={localStyles.checkDesc}>Verify all staging protocols and personnel presence.</Text>
               <TouchableOpacity style={localStyles.logStatusBtn} onPress={onOpenResponse}>
                  <Text style={localStyles.logStatusText}>Activate Site Response</Text>
               </TouchableOpacity>
            </View>

            <View style={localStyles.essentialTasksCard}>
               <View style={localStyles.tasksHeader}>
                  <Ionicons name="cube" size={20} color={theme.primary} />
                  <Text style={localStyles.tasksTitle}>Staging Tracker</Text>
               </View>
               
               <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                     <Text style={localStyles.taskLabel}>Resource Staging</Text>
                     <Text style={[localStyles.taskLabel, { ...fonts.black }]}>42 / 48</Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: theme.line, borderRadius: 4, overflow: 'hidden' }}>
                     <View style={{ height: '100%', width: '87%', backgroundColor: '#81C784' }} />
                  </View>
               </View>

               <View style={localStyles.taskRow}>
                  <Text style={localStyles.taskLabel}>Comms Check</Text>
                  <View style={[localStyles.taskPill, { backgroundColor: '#E8F5E9' }]}><Text style={[localStyles.taskPillText, { color: '#2E7D32' }]}>COMPLETE</Text></View>
               </View>
               <View style={localStyles.taskRow}>
                  <Text style={localStyles.taskLabel}>Vehicle Staging</Text>
                  <View style={[localStyles.taskPill, { backgroundColor: '#FFF3E0' }]}><Text style={[localStyles.taskPillText, { color: '#E65100' }]}>PENDING</Text></View>
               </View>

               <View style={localStyles.divider} />
               <Text style={localStyles.protocolLabel}>PROTOCOL NOTE</Text>
               <Text style={localStyles.protocolText}>"Ensure all regional relief kits are pre-sealed and assigned to a transport sector before the response window."</Text>
            </View>
          </View>
        </View>

        {/* Side Content */}
        <View style={localStyles.sideContent}>
           <View style={localStyles.liveActivityCard}>
              <View style={localStyles.liveHeader}>
                 <Ionicons name="stats-chart" size={18} color="#81C784" />
                 <Text style={localStyles.liveTitle}>Live Activity</Text>
              </View>
              <View style={localStyles.activityItem}>
                 <View style={localStyles.activityDot} />
                 <View style={{ flex: 1 }}>
                    <Text style={localStyles.activityTime}>08:45 AM</Text>
                    <Text style={localStyles.activityDesc}>Convoy Gamma arrived at Northern Staging.</Text>
                 </View>
              </View>
              <View style={localStyles.activityItem}>
                 <View style={localStyles.activityDot} />
                 <View style={{ flex: 1 }}>
                    <Text style={localStyles.activityTime}>07:12 AM</Text>
                    <Text style={localStyles.activityDesc}>Satellite uplink stabilized at Sector 4.</Text>
                 </View>
              </View>
              <View style={localStyles.activityItem}>
                 <View style={[localStyles.activityDot, { backgroundColor: '#7D867B' }]} />
                 <View style={{ flex: 1 }}>
                    <Text style={localStyles.activityTime}>YESTERDAY</Text>
                    <Text style={localStyles.activityDesc}>Evacuation initiated for Cluster B.</Text>
                 </View>
              </View>
           </View>

           <View style={localStyles.siteMapCard}>
              <View style={localStyles.siteMapContent}>
                 <Text style={localStyles.siteMapTitle}>Interactive Site Map</Text>
                 <Text style={localStyles.siteMapSub}>REAL-TIME ZONE ACTIVITY MONITOR</Text>
              </View>
              <Image 
                source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB3K_4K9H0L_9E_9N_K7L9B8v8V-p_H_p7h-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v" }} 
                style={localStyles.siteMapImage} 
                resizeMode="cover"
              />
           </View>
        </View>
      </View>

      {/* Supply Checklist */}
      <View style={localStyles.supplySection}>
        <View style={localStyles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.sectionTitle}>Essential Supply Checklist</Text>
            <Text style={localStyles.sectionSub}>Real-time inventory levels across regional staging areas.</Text>
          </View>
          <TouchableOpacity style={localStyles.updateInventoryBtn}>
             <Text style={localStyles.updateInventoryText}>Update Inventory</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.supplyScroll}>
           {[
             { label: "P", name: "Potable Water", status: "SECURE", val: "15,000 Liters", progress: 0.9, color: "#FFB300" },
             { label: "M", name: "Medical Kits", status: "SECURE", val: "450 Units", progress: 0.8, color: "#81C784" },
             { label: "B", name: "Blankets & Shelter", status: "LOW STOCK", val: "800 Kits", progress: 0.4, color: "#E65100" },
             { label: "D", name: "Dry Rations", status: "SECURE", val: "2,500 Boxes", progress: 0.95, color: "#2E7D32" },
           ].map((item, idx) => (
             <View key={idx} style={localStyles.supplyCard}>
                <View style={localStyles.supplyCardTop}>
                   <View style={[localStyles.supplyLabelBox, { backgroundColor: item.color }]}>
                      <Text style={localStyles.supplyLabelText}>{item.label}</Text>
                   </View>
                   <View style={[localStyles.supplyStatusBadge, { backgroundColor: item.status === "SECURE" ? "#E8F5E9" : "#FFF3E0" }]}>
                      <Text style={[localStyles.supplyStatusText, { color: item.status === "SECURE" ? "#2E7D32" : "#E65100" }]}>{item.status}</Text>
                   </View>
                </View>
                <Text style={localStyles.supplyCardName}>{item.name}</Text>
                <Text style={localStyles.supplyCardVal}>{item.val}</Text>
                <View style={localStyles.supplyProgressTrack}>
                   <View style={[localStyles.supplyProgressFill, { width: `${item.progress * 100}%`, backgroundColor: item.color }]} />
                </View>
             </View>
           ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 24, paddingBottom: 160 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary },
  statusBadgeText: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1 },
  dashboardTitle: { fontSize: 36, ...fonts.black, color: theme.text, letterSpacing: -1.5, lineHeight: 42 },
  dashboardSub: { fontSize: 14, ...fonts.medium, color: theme.textMuted, marginTop: 8, lineHeight: 20 },
  scoreCard: { backgroundColor: "#fff", padding: 16, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.line, width: 110 },
  scoreValue: { fontSize: 28, ...fonts.black, color: theme.primary },
  scoreLabel: { fontSize: 8, ...fonts.black, color: theme.textLight, letterSpacing: 1, textAlign: "center" },

  mainSection: { gap: 24, marginBottom: 40 },
  checklistSection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  sectionTitle: { fontSize: 22, ...fonts.black, color: theme.text },
  sectionSub: { fontSize: 13, ...fonts.medium, color: theme.textMuted, marginTop: 4 },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  priorityText: { fontSize: 10, ...fonts.black, color: theme.text, letterSpacing: 0.5 },

  checklistGrid: { flexDirection: "column", gap: 16 },
  readinessCheckCard: { backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, alignItems: "center", justifyContent: "center", gap: 12 },
  checkIconWrap: { width: 64, height: 64, borderRadius: 24, backgroundColor: "rgba(46, 125, 50, 0.05)", alignItems: "center", justifyContent: "center" },
  checkTitle: { fontSize: 18, ...fonts.black, color: theme.text },
  checkDesc: { fontSize: 12, ...fonts.medium, color: theme.textMuted, textAlign: "center", lineHeight: 18 },
  logStatusBtn: { backgroundColor: "#81C784", paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, width: "100%", alignItems: "center", marginTop: 12 },
  logStatusText: { color: "#fff", ...fonts.black, fontSize: 12, letterSpacing: 0.5 },

  essentialTasksCard: { backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, marginTop: 12 },
  tasksHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  tasksTitle: { fontSize: 16, ...fonts.black, color: theme.text },
  taskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 },
  taskLabel: { fontSize: 13, ...fonts.medium, color: theme.text, flex: 1 },
  taskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  taskPillText: { fontSize: 9, ...fonts.black },
  divider: { height: 1, backgroundColor: theme.line, marginVertical: 16 },
  protocolLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 8 },
  protocolText: { fontSize: 11, ...fonts.medium, color: theme.textMuted, fontStyle: "italic", lineHeight: 16 },

  sideContent: { gap: 24 },
  liveActivityCard: { backgroundColor: "#1A1C1A", borderRadius: 40, padding: 32 },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  liveTitle: { fontSize: 18, ...fonts.black, color: "#fff" },
  activityItem: { flexDirection: "row", gap: 16, marginBottom: 20 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#81C784", marginTop: 6 },
  activityTime: { fontSize: 12, ...fonts.black, color: "#fff" },
  activityDesc: { fontSize: 13, color: "rgba(255,255,255,0.7)", ...fonts.medium, marginTop: 2 },

  siteMapCard: { borderRadius: 40, overflow: "hidden", height: 200, backgroundColor: theme.surfaceAlt },
  siteMapContent: { position: "absolute", zIndex: 1, top: 24, left: 24, backgroundColor: "rgba(255,255,255,0.9)", padding: 16, borderRadius: 16 },
  siteMapTitle: { fontSize: 15, ...fonts.black, color: theme.text },
  siteMapSub: { fontSize: 9, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginTop: 4 },
  siteMapImage: { width: "100%", height: "100%", opacity: 0.8 },

  supplySection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  updateInventoryBtn: { backgroundColor: "#81C784", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  updateInventoryText: { color: "#fff", ...fonts.black, fontSize: 11 },
  supplyScroll: { marginTop: 24, marginHorizontal: -12 },
  supplyCard: { width: 220, backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, marginHorizontal: 12 },
  supplyCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  supplyLabelBox: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  supplyLabelText: { color: "#fff", fontSize: 18, ...fonts.black },
  supplyStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  supplyStatusText: { fontSize: 9, ...fonts.black },
  supplyCardName: { fontSize: 15, ...fonts.black, color: theme.text, marginBottom: 4 },
  supplyCardVal: { fontSize: 12, ...fonts.medium, color: theme.textMuted, marginBottom: 16 },
  supplyProgressTrack: { height: 6, backgroundColor: theme.line, borderRadius: 3, overflow: "hidden" },
  supplyProgressFill: { height: "100%", borderRadius: 3 },
});
