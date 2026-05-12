import React, { useState, useEffect, useRef } from "react";
import { Animated, Text, View, StyleSheet, ScrollView, Pressable, Modal, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, fonts, lightTheme, darkTheme } from "../../theme";

export function SiteManagerDuringScreen({
  onBack,
  isDarkMode,
  onEnterRecovery,
}: {
  onBack: () => void;
  isDarkMode?: boolean;
  onEnterRecovery: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const [incidentType, setIncidentType] = useState("Medical Emergency");
  const [severity, setSeverity] = useState<"CRITICAL" | "HIGH" | "MODERATE">("CRITICAL");
  
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const localStyles = getStyles(currentTheme);
  
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120], 
  });

  return (
    <ScrollView 
      style={localStyles.container}
      contentContainerStyle={localStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={localStyles.headerRow}>
        <TouchableOpacity onPress={onBack} style={localStyles.backBtn}>
           <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={localStyles.statusBadge}>
            <View style={localStyles.statusDot} />
            <Text style={localStyles.statusBadgeText}>ACTIVE RESPONSE MODE</Text>
          </View>
          <Text style={localStyles.dashboardTitle}>Live Status Map{"\n"}& Command</Text>
          <Text style={localStyles.dashboardSub}>
            Live operational view of Typhoon 09B impact zone. Resources are being prioritized for Zone A-4 flooding.
          </Text>
        </View>
        <View style={localStyles.scoreCard}>
          <Text style={localStyles.scoreValue}>04:22</Text>
          <Text style={localStyles.scoreLabel}>CRITICAL WINDOW</Text>
        </View>
      </View>

      <View style={localStyles.mainSection}>
        {/* Emergency Operational Guide */}
        <View style={localStyles.checklistSection}>
          <View style={localStyles.sectionHeaderRow}>
            <View>
              <Text style={localStyles.sectionTitle}>Emergency Operational Guide</Text>
              <Text style={localStyles.sectionSub}>This view follows the daily process: evacuee arrival, identity capture, and relief distribution.</Text>
            </View>
            <View style={localStyles.priorityBadge}>
               <Ionicons name="shield-checkmark" size={14} color={currentTheme.warning} />
               <Text style={localStyles.priorityText}>Priority Status</Text>
            </View>
          </View>

          <View style={localStyles.checklistGrid}>
            <View style={localStyles.readinessCheckCard}>
               <View style={localStyles.checkIconWrap}>
                  <Ionicons name="qr-code" size={32} color={currentTheme.warning} />
               </View>
               <Text style={localStyles.checkTitle}>Identity Verification</Text>
               <Text style={localStyles.checkDesc}>Active intake: scan QR codes for rapid shelter entry.</Text>
               
               <View style={localStyles.scannerTabs}>
                  <TouchableOpacity 
                    onPress={() => setActiveTab("scan")}
                    style={activeTab === "scan" ? localStyles.scannerTabActive : localStyles.scannerTab}
                  >
                    <Text style={activeTab === "scan" ? localStyles.scannerTabTextActive : localStyles.scannerTabText}>Scan QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setActiveTab("manual")}
                    style={activeTab === "manual" ? localStyles.scannerTabActive : localStyles.scannerTab}
                  >
                    <Text style={activeTab === "manual" ? localStyles.scannerTabTextActive : localStyles.scannerTabText}>Manual ID</Text>
                  </TouchableOpacity>
               </View>

               {activeTab === "scan" ? (
                 <View style={localStyles.viewfinder}>
                    <View style={localStyles.viewfinderFrame} />
                    <Animated.View style={[localStyles.scannerBeam, { transform: [{ translateY }] }]} />
                    <Text style={localStyles.viewfinderText}>CAMERA VIEWFINDER</Text>
                 </View>
               ) : (
                 <View style={localStyles.manualForm}>
                    <View style={localStyles.inputWrapper}>
                       <Text style={localStyles.manualInputPlaceholder}>Citizen Name or ID...</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                       <View style={[localStyles.inputWrapper, { flex: 1 }]}>
                          <Text style={localStyles.manualInputPlaceholder}>Zone</Text>
                       </View>
                       <View style={[localStyles.inputWrapper, { flex: 1 }]}>
                          <Text style={localStyles.manualInputPlaceholder}>Group Size</Text>
                       </View>
                    </View>
                 </View>
               )}

               <TouchableOpacity style={localStyles.logStatusBtn}>
                  <Text style={localStyles.logStatusText}>Confirm Check-in</Text>
               </TouchableOpacity>
            </View>

            <View style={localStyles.essentialTasksCard}>
               <View style={localStyles.tasksHeader}>
                  <Ionicons name="list" size={20} color={currentTheme.warning} />
                  <Text style={localStyles.tasksTitle}>Essential Tasks</Text>
               </View>
               <View style={localStyles.taskRow}>
                  <Text style={localStyles.taskLabel}>Inventory Validation</Text>
                  <View style={[localStyles.taskPill, { backgroundColor: '#E8F5E9' }]}><Text style={[localStyles.taskPillText, { color: '#2E7D32' }]}>READY</Text></View>
               </View>
               <View style={localStyles.taskRow}>
                  <Text style={localStyles.taskLabel}>Comms Stabilization</Text>
                  <View style={[localStyles.taskPill, { backgroundColor: '#E3F2FD' }]}><Text style={[localStyles.taskPillText, { color: '#1976D2' }]}>ACTIVE</Text></View>
               </View>
               <View style={localStyles.taskRow}>
                  <Text style={localStyles.taskLabel}>Volunteer Briefing</Text>
                  <View style={[localStyles.taskPill, { backgroundColor: '#F1F8E9' }]}><Text style={[localStyles.taskPillText, { color: '#689F38' }]}>COMPLETE</Text></View>
               </View>
               <View style={localStyles.divider} />
               <Text style={localStyles.protocolLabel}>PROTOCOL NOTE</Text>
               <Text style={localStyles.protocolText}>"All resource reallocations must be synced to the central hub within 5 minutes of physical movement."</Text>
            </View>
          </View>
        </View>

        {/* Side Content */}
        <View style={localStyles.sideContent}>
           <View style={localStyles.liveActivityCard}>
              <View style={localStyles.liveHeader}>
                 <Ionicons name="stats-chart" size={18} color={currentTheme.warning} />
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

      {/* Report Site Incident */}
      <View style={localStyles.incidentSection}>
         <View style={localStyles.sectionHeaderRow}>
            <View>
              <Text style={localStyles.sectionTitle}>Report Site Incident</Text>
              <Text style={localStyles.sectionSub}>Log critical events or medical emergencies immediately.</Text>
            </View>
            <View style={localStyles.activeAlertsBadge}>
               <Text style={localStyles.activeAlertsText}>3 ACTIVE ALERTS</Text>
            </View>
         </View>

         <View style={localStyles.incidentFormRow}>
            <View style={localStyles.pickerContainer}>
               <Text style={localStyles.inputLabel}>INCIDENT TYPE</Text>
               <View style={localStyles.pickerBox}>
                  <Text style={localStyles.pickerText}>{incidentType}</Text>
               </View>
            </View>

            <View style={localStyles.severityContainer}>
               <Text style={localStyles.inputLabel}>SEVERITY</Text>
               <View style={localStyles.severityRow}>
                  {["CRITICAL", "HIGH", "MODERATE"].map((s) => {
                    const isActive = severity === s;
                    const color = s === 'CRITICAL' ? '#D32F2F' : s === 'HIGH' ? '#FFB300' : '#2E7D32';
                    return (
                      <TouchableOpacity 
                        key={s} 
                        onPress={() => setSeverity(s as any)}
                        style={[
                          localStyles.severityBtn, 
                          { backgroundColor: isActive ? color : currentTheme.surfaceAlt, borderColor: isActive ? color : currentTheme.line, borderWidth: 1 },
                          isActive && { shadowColor: color, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }
                        ]}
                      >
                         <Text style={[
                           localStyles.severityBtnText, 
                           { color: isActive ? "#fff" : currentTheme.textLight }
                         ]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
               </View>
            </View>
         </View>

         <View style={{ marginTop: 24 }}>
            <Text style={localStyles.inputLabel}>DETAILED DESCRIPTION</Text>
            <View style={localStyles.textArea}>
               <Text style={localStyles.placeholderText}>Describe the situation...</Text>
            </View>
         </View>

         <TouchableOpacity style={[localStyles.submitBtn, { flexDirection: 'row' }]}>
            <Ionicons name="send" size={16} color="#fff" style={{ marginRight: 10 }} />
            <Text style={localStyles.submitBtnText}>Submit Incident Report</Text>
         </TouchableOpacity>

         <TouchableOpacity 
           style={[localStyles.submitBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: currentTheme.line, marginTop: 12, flexDirection: 'row' }]}
           onPress={onEnterRecovery}
         >
            <Ionicons name="arrow-forward" size={16} color={currentTheme.text} style={{ marginRight: 10 }} />
            <Text style={[localStyles.submitBtnText, { color: currentTheme.text }]}>Transition to Recovery Mode</Text>
         </TouchableOpacity>
      </View>

      {/* Supply Checklist */}
      <View style={[localStyles.supplySection, { marginTop: 24 }]}>
        <View style={localStyles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.sectionTitle}>Essential Supply Checklist</Text>
            <Text style={localStyles.sectionSub}>Real-time inventory levels across regional staging areas.</Text>
          </View>
          <TouchableOpacity style={[localStyles.updateInventoryBtn, { backgroundColor: '#FFB300' }]}>
             <Text style={localStyles.updateInventoryText}>Update Inventory</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.supplyScroll}>
           {[
             { label: "P", name: "Potable Water", status: "SECURE", val: "92% AVAIL", progress: 0.92, color: "#FFB300" },
             { label: "T", name: "Trauma Kits", status: "CRITICAL", val: "12% LOW", progress: 0.12, color: "#D32F2F" },
             { label: "M", name: "Mobile Power", status: "SECURE", val: "84% AVAIL", progress: 0.84, color: "#FFB300" },
           ].map((item, idx) => (
             <View key={idx} style={localStyles.supplyCard}>
                <View style={localStyles.supplyCardTop}>
                   <View style={[localStyles.supplyLabelBox, { backgroundColor: item.color }]}>
                      <Text style={localStyles.supplyLabelText}>{item.label}</Text>
                   </View>
                   <View style={[localStyles.supplyStatusBadge, { backgroundColor: item.status === "SECURE" ? "#E8F5E9" : "#FFEBEE" }]}>
                      <Text style={[localStyles.supplyStatusText, { color: item.status === "SECURE" ? "#2E7D32" : "#D32F2F" }]}>{item.status}</Text>
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
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 32 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center", marginTop: 4 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.warning },
  statusBadgeText: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1 },
  dashboardTitle: { fontSize: 36, ...fonts.black, color: theme.text, letterSpacing: -1.5, lineHeight: 42 },
  dashboardSub: { fontSize: 14, ...fonts.medium, color: theme.textMuted, marginTop: 8, lineHeight: 20 },
  scoreCard: { backgroundColor: "#fff", padding: 16, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.line, width: 110 },
  scoreValue: { fontSize: 22, ...fonts.black, color: theme.warning },
  scoreLabel: { fontSize: 8, ...fonts.black, color: theme.textLight, letterSpacing: 1, textAlign: "center" },

  mainSection: { gap: 24, marginBottom: 40 },
  checklistSection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  sectionTitle: { fontSize: 22, ...fonts.black, color: theme.text },
  sectionSub: { fontSize: 13, ...fonts.medium, color: theme.textMuted, marginTop: 4 },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  priorityText: { fontSize: 10, ...fonts.black, color: theme.text, letterSpacing: 0.5 },

  checklistGrid: { flexDirection: "column", gap: 16 },
  readinessCheckCard: { backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, alignItems: "center", gap: 12 },
  checkIconWrap: { width: 64, height: 64, borderRadius: 24, backgroundColor: "rgba(255, 179, 0, 0.05)", alignItems: "center", justifyContent: "center" },
  checkTitle: { fontSize: 18, ...fonts.black, color: theme.text },
  checkDesc: { fontSize: 12, ...fonts.medium, color: theme.textMuted, textAlign: "center", lineHeight: 18 },
  
  scannerTabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 12, padding: 4, width: "100%", marginTop: 8 },
  scannerTabActive: { flex: 1, backgroundColor: "#fff", paddingVertical: 8, borderRadius: 8, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  scannerTab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  scannerTabTextActive: { fontSize: 11, ...fonts.black, color: theme.text },
  scannerTabText: { fontSize: 11, ...fonts.bold, color: theme.textLight },

  viewfinder: { width: "100%", height: 120, backgroundColor: "#000", borderRadius: 16, marginTop: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  viewfinderFrame: { width: "80%", height: "60%", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderStyle: "dashed", borderRadius: 8 },
  scannerBeam: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "red", shadowColor: "red", shadowOpacity: 1, shadowRadius: 10 },
  viewfinderText: { position: "absolute", bottom: 10, fontSize: 8, ...fonts.black, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },

  logStatusBtn: { backgroundColor: "#FFB300", paddingHorizontal: 20, paddingVertical: 18, borderRadius: 16, width: "100%", alignItems: "center", marginTop: 12, shadowColor: "#FFB300", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logStatusText: { color: "#fff", ...fonts.black, fontSize: 14, letterSpacing: 0.5 },

  manualForm: { width: "100%", gap: 12, marginTop: 12 },
  inputWrapper: { height: 56, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: theme.line, justifyContent: "center", paddingHorizontal: 20 },
  manualInputPlaceholder: { fontSize: 14, color: theme.textLight, ...fonts.medium },

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
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.warning, marginTop: 6 },
  activityTime: { fontSize: 12, ...fonts.black, color: "#fff" },
  activityDesc: { fontSize: 13, color: "rgba(255,255,255,0.7)", ...fonts.medium, marginTop: 2 },

  siteMapCard: { borderRadius: 40, overflow: "hidden", height: 200, backgroundColor: theme.surfaceAlt },
  siteMapContent: { position: "absolute", zIndex: 1, top: 24, left: 24, backgroundColor: "rgba(255,255,255,0.9)", padding: 16, borderRadius: 16 },
  siteMapTitle: { fontSize: 15, ...fonts.black, color: theme.text },
  siteMapSub: { fontSize: 9, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginTop: 4 },
  siteMapImage: { width: "100%", height: "100%", opacity: 0.8 },

  incidentSection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  activeAlertsBadge: { backgroundColor: "#FFF3E0", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  activeAlertsText: { fontSize: 10, ...fonts.black, color: "#E65100", letterSpacing: 0.5 },
  incidentFormRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 24 },
  inputLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 8 },
  pickerContainer: { flex: 1.5, minWidth: 200 },
  pickerBox: { height: 56, backgroundColor: theme.surfaceAlt, borderRadius: 16, justifyContent: "center", paddingHorizontal: 20, borderWidth: 1, borderColor: theme.line },
  pickerText: { fontSize: 14, ...fonts.bold, color: theme.text },
  severityContainer: { flex: 1, minWidth: 160 },
  severityRow: { flexDirection: "row", gap: 6 },
  severityBtn: { flex: 1, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  severityBtnText: { fontSize: 8, ...fonts.black, textAlign: "center" },
  textArea: { height: 120, backgroundColor: theme.surfaceAlt, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.line },
  placeholderText: { fontSize: 14, color: theme.textLight, ...fonts.medium },
  submitBtn: { height: 64, backgroundColor: "#1A1C1A", borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 32 },
  submitBtnText: { color: "#fff", fontSize: 14, ...fonts.black, letterSpacing: 1.5 },

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
