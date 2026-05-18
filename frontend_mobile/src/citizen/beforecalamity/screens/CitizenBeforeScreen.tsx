import React, { useState, useEffect } from "react";
import { Pressable, Text, View, Modal, TouchableOpacity, StyleSheet, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen, Pill, SectionCard } from "../../../components/UI";
import { theme, fonts, lightTheme, darkTheme } from "../../../theme";
import {
  CitizenPreparednessTopBar,
  citizenStyles,
} from "../../shared";

export function CitizenBeforeScreen({
  onBack,
  onOpenResponse,
  onRegisterIndividual,
  onRegisterHousehold,
  initialStep = "dashboard",
  isDarkMode,
  citizenProfile,
  authUser,
}: {
  onBack: () => void;
  onOpenResponse: () => void;
  onRegisterIndividual?: () => void;
  onRegisterHousehold?: () => void;
  initialStep?: string;
  isDarkMode?: boolean;
  citizenProfile?: any;
  authUser?: any;
}) {
  const [step, setStep] = React.useState(initialStep);
  const [safetyPlanOpen, setSafetyPlanOpen] = useState(false);
  
  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const localStyles = getStyles(currentTheme);

  // Ready-Check State
  const [auditItems, setAuditItems] = useState([
    { id: "1", title: "Update Emergency Contact List", completed: true },
    { id: "2", title: "Restock 72-Hour Survival Kit", completed: true },
    { id: "3", title: "Verify Evacuation Route", completed: false },
    { id: "4", title: "Register Household Members", completed: false },
  ]);

  // Load persistent audit checklist state from AsyncStorage
  useEffect(() => {
    const loadAuditItems = async () => {
      try {
        const key = authUser?.id 
          ? `damayan.citizen.audit_items.${authUser.id}` 
          : "damayan.citizen.audit_items";
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          setAuditItems(JSON.parse(stored));
        } else {
          // If no custom stored checklist yet, fallback to default checklist
          setAuditItems([
            { id: "1", title: "Update Emergency Contact List", completed: true },
            { id: "2", title: "Restock 72-Hour Survival Kit", completed: true },
            { id: "3", title: "Verify Evacuation Route", completed: false },
            { id: "4", title: "Register Household Members", completed: false },
          ]);
        }
      } catch (e) {
        console.error("Failed to load audit items:", e);
      }
    };
    loadAuditItems();
  }, [authUser?.id]);

  // Save persistent audit checklist state to AsyncStorage
  const toggleAuditItem = async (itemId: string) => {
    const updated = auditItems.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
    setAuditItems(updated);
    try {
      const key = authUser?.id 
        ? `damayan.citizen.audit_items.${authUser.id}` 
        : "damayan.citizen.audit_items";
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save audit items:", e);
    }
  };

  const completedCount = auditItems.filter(i => i.completed).length;
  const progressPercent = (completedCount / auditItems.length) * 100;

  const renderDashboard = () => (
    <ScrollView style={localStyles.container} contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top Safety Banner */}
      <View style={localStyles.heroBanner}>
        <View style={localStyles.heroContent}>
           <View style={localStyles.heroBadge}>
              <View style={localStyles.pulseDot} />
              <Text style={localStyles.heroBadgeText}>PREPARED • {completedCount}/{auditItems.length} READY</Text>
           </View>
           <Text style={localStyles.heroTitle}>Safety Dashboard</Text>
           <Text style={localStyles.heroSub}>Complete your audit before the next advisory.</Text>
        </View>
        <TouchableOpacity 
          style={localStyles.simulateBtn}
          onPress={onOpenResponse}
        >
           <Ionicons name="warning" size={16} color="#D32F2F" style={{ marginRight: 8 }} />
           <Text style={localStyles.simulateBtnText}>SIMULATE EMERGENCY</Text>
        </TouchableOpacity>
      </View>

      <View style={localStyles.mainRow}>
        {/* Ready-Check Audit Section */}
        <View style={localStyles.auditSection}>
           <View style={localStyles.sectionHeaderRow}>
              <Text style={localStyles.sectionTitle}>Ready-Check Audit</Text>
              <Text style={localStyles.progressText}>{progressPercent}% COMPLETE</Text>
           </View>

           <View style={localStyles.progressTrack}>
              <View style={[localStyles.progressFill, { width: `${progressPercent}%` }]} />
           </View>

           <View style={localStyles.auditGrid}>
              {auditItems.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[localStyles.auditCard, item.completed && localStyles.auditCardCompleted]}
                  onPress={() => toggleAuditItem(item.id)}
                >
                   <View style={[localStyles.checkbox, item.completed && localStyles.checkboxChecked]}>
                      {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                   </View>
                   <Text style={[localStyles.auditItemTitle, item.completed && localStyles.auditItemTitleCompleted]}>
                     {item.title}
                   </Text>
                </TouchableOpacity>
              ))}
           </View>
        </View>

        {/* Side Column */}
        <View style={localStyles.sideColumn}>
            <View style={localStyles.identityCard}>
               <Text style={localStyles.sideLabel}>DIGITAL IDENTITY</Text>
               <View style={localStyles.identityContent}>
                  <View style={[localStyles.qrBox, { backgroundColor: citizenProfile ? "#1A1C1A" : "#ECEFF1" }]}>
                     <Ionicons name="qr-code" size={24} color={citizenProfile ? "#fff" : "#78909C"} />
                  </View>
                  <View>
                     <Text style={localStyles.idNumber}>{citizenProfile?.qrCodeId || "NOT REGISTERED"}</Text>
                     <Text style={localStyles.idName}>{(citizenProfile?.fullName || authUser?.name || "Elena Villacruz").toUpperCase()}</Text>
                     {citizenProfile ? (
                       <View style={localStyles.verifiedBadge}>
                          <View style={localStyles.smallGreenDot} />
                          <Text style={localStyles.verifiedText}>VERIFIED</Text>
                       </View>
                     ) : (
                       <View style={[localStyles.verifiedBadge, { backgroundColor: "#FFEBEE" }]}>
                          <View style={[localStyles.smallGreenDot, { backgroundColor: "#D32F2F" }]} />
                          <Text style={[localStyles.verifiedText, { color: "#D32F2F" }]}>UNREGISTERED</Text>
                       </View>
                     )}
                  </View>
               </View>
            </View>

           <View style={localStyles.alertCard}>
              <Ionicons name="warning" size={24} color="#fff" style={{ marginBottom: 12 }} />
              <Text style={localStyles.alertTitle}>Typhoon Amang</Text>
              <Text style={localStyles.alertMeta}>LEVEL 2 ALERT • 72H ETA</Text>
              <Text style={localStyles.alertDesc}>Expected landfall in northern sector. Review evacuation routes now.</Text>
              <TouchableOpacity style={localStyles.viewPlanBtn} onPress={() => setSafetyPlanOpen(true)}>
                 <Text style={localStyles.viewPlanText}>VIEW SAFETY PLAN</Text>
              </TouchableOpacity>
           </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderRegistration = () => (
    <ScrollView style={localStyles.container} contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={localStyles.returnBtn} onPress={() => setStep("dashboard")}>
         <Ionicons name="arrow-back" size={20} color={currentTheme.textLight} />
         <Text style={localStyles.returnBtnText}>Return to Dashboard</Text>
      </TouchableOpacity>

      <View style={localStyles.regHeroBanner}>
        <View style={localStyles.regHeroBadge}>
           <Text style={localStyles.regHeroBadgeText}>IDENTITY MANAGEMENT</Text>
        </View>
        <Text style={localStyles.regHeroTitle}>Register your{"\n"}Emergency Identity</Text>
        <Text style={localStyles.regHeroSub}>
          Your identity is your lifeline. A verified QR code enables rapid shelter entry and direct relief support.
        </Text>
      </View>

      <Text style={localStyles.selectionLabel}>SELECT YOUR REGISTRATION TYPE</Text>

      <View style={localStyles.registrationGrid}>
         <Pressable 
           onPress={onRegisterIndividual}
           style={({ pressed }) => [
             localStyles.regTypeCard,
             pressed && { borderColor: "#2E7D32", borderWidth: 2, shadowColor: "#2E7D32", shadowOpacity: 0.25, shadowRadius: 20, transform: [{ scale: 1.02 }], elevation: 10 }
           ]}
         >
            <View style={localStyles.regIconBox}>
               <Ionicons name="person" size={24} color="#2E7D32" />
            </View>
            <Text style={localStyles.regTypeMeta}>SINGLE PERSON</Text>
            <Text style={localStyles.regTypeTitle}>Individual</Text>
            <Text style={localStyles.regTypeDesc}>
              Register yourself for rapid check-in, medical tracking, and personal relief claims.
            </Text>
            <View style={localStyles.regFooter}>
               <Text style={localStyles.regFooterText}>START REGISTRATION</Text>
               <Ionicons name="arrow-forward" size={16} color="#2E7D32" />
            </View>
         </Pressable>

         <Pressable 
           onPress={onRegisterHousehold}
           style={({ pressed }) => [
             localStyles.regTypeCard,
             pressed && { borderColor: "#2E7D32", borderWidth: 2, shadowColor: "#2E7D32", shadowOpacity: 0.25, shadowRadius: 20, transform: [{ scale: 1.02 }], elevation: 10 }
           ]}
         >
            <View style={localStyles.regIconBox}>
               <Ionicons name="people" size={24} color="#2E7D32" />
            </View>
            <Text style={localStyles.regTypeMeta}>2+ MEMBERS</Text>
            <Text style={localStyles.regTypeTitle}>Family Household</Text>
            <Text style={localStyles.regTypeDesc}>
              Register your whole household for unified aid distribution and family tracking.
            </Text>
            <View style={localStyles.regFooter}>
               <Text style={localStyles.regFooterText}>START REGISTRATION</Text>
               <Ionicons name="arrow-forward" size={16} color="#2E7D32" />
            </View>
         </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1 }}>
      {step === "registration" ? renderRegistration() : renderDashboard()}

      {/* 🛡️ Premium Typhoon Safety Plan Modal */}
      <Modal visible={safetyPlanOpen} transparent animationType="slide" onRequestClose={() => setSafetyPlanOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: currentTheme.bg || "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 40, height: "85%", borderTopWidth: 1, borderColor: "rgba(0,0,0,0.05)" }}>
            
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E65100" }} />
                  <Text style={{ fontSize: 10, ...fonts.black, color: "#E65100", letterSpacing: 1.5 }}>TYPHOON AMANG PROTOCOL</Text>
                </View>
                <Text style={{ fontSize: 24, ...fonts.black, color: currentTheme.text || "#1A1C1A" }}>Crisis Safety Plan</Text>
              </View>
              <TouchableOpacity onPress={() => setSafetyPlanOpen(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.03)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color={currentTheme.textLight || "#7e887e"} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              
              {/* Emergency Status Card */}
              <View style={{ backgroundColor: "#FFF3E0", borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "#FFE0B2", flexDirection: "row", gap: 14, alignItems: "center" }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FFE0B2", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="shield-alert-outline" size={24} color="#E65100" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, ...fonts.black, color: "#E65100" }}>Level 2 Alert Active</Text>
                  <Text style={{ fontSize: 12, ...fonts.medium, color: "#B78103", marginTop: 2, lineHeight: 16 }}>
                    Northern sector expects landfall in 72 hours. Evacuation lines are active.
                  </Text>
                </View>
              </View>

              {/* Section 1: Evacuation Go-Bag checklist */}
              <View style={{ marginBottom: 28 }}>
                <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A", marginBottom: 16, letterSpacing: -0.2 }}>
                  🎒 72-Hour Evacuation Go-Bag Checklist
                </Text>
                
                {[
                  { icon: "water-outline", label: "3-day supply of water (1 gallon per person/day)" },
                  { icon: "fast-food-outline", label: "Non-perishable food (easy-to-open canned goods)" },
                  { icon: "bandage-outline", label: "First-aid kit & critical daily prescription medicines" },
                  { icon: "flashlight-outline", label: "Battery-operated flashlight & emergency radio" },
                  { icon: "battery-charging-outline", label: "Fully-charged power banks & charger cables" },
                  { icon: "qr-code-outline", label: "Damayan Digital QR ID & physical identification documents" }
                ].map((item, idx) => (
                  <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.03)" }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.02)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={item.icon as any} size={16} color="#7e887e" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, ...fonts.bold, color: currentTheme.textMuted || "#4d544d", lineHeight: 18 }}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Section 2: Evacuation Shelters */}
              <View style={{ marginBottom: 28 }}>
                <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A", marginBottom: 16, letterSpacing: -0.2 }}>
                  🏫 Designated Evacuation Shelters
                </Text>
                
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: currentTheme.surface || "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" }}>
                    <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A" }}>🏫 Primary: Bicol Sector Central HS</Text>
                    <Text style={{ fontSize: 11, ...fonts.medium, color: currentTheme.textLight || "#7e887e", marginTop: 4 }}>Evacuation route: Main Highway North → Sector 2 Exit</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#E8F5E9", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#2E7D32" }} />
                      <Text style={{ fontSize: 9, ...fonts.black, color: "#2E7D32" }}>CAPACITY: 85% AVAILABLE</Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: currentTheme.surface || "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" }}>
                    <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A" }}>🏟️ Secondary: Barangay 102 Dome</Text>
                    <Text style={{ fontSize: 11, ...fonts.medium, color: currentTheme.textLight || "#7e887e", marginTop: 4 }}>Evacuation route: Rizal Ave East → District 4 Dome Link</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#E8F5E9", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#2E7D32" }} />
                      <Text style={{ fontSize: 9, ...fonts.black, color: "#2E7D32" }}>CAPACITY: 95% AVAILABLE</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Section 3: Critical Hotlines */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A", marginBottom: 16, letterSpacing: -0.2 }}>
                  🚨 Critical Rescue Hotlines
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {[
                    { title: "Barangay HQ", num: "+63 2 8123 4567" },
                    { title: "Red Cross Rescue", num: "143" },
                    { title: "Fire Station", num: "911" },
                    { title: "Police Hotline", num: "117" }
                  ].map((hotline, idx) => (
                    <View key={idx} style={{ flex: 1, minWidth: 140, backgroundColor: currentTheme.surfaceAlt || "#fbfbfb", padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" }}>
                      <Text style={{ fontSize: 11, ...fonts.black, color: currentTheme.textLight || "#7e887e", textTransform: "uppercase" }}>{hotline.title}</Text>
                      <Text style={{ fontSize: 13, ...fonts.black, color: "#E65100", marginTop: 4 }}>{hotline.num}</Text>
                    </View>
                  ))}
                </View>
              </View>

            </ScrollView>

            {/* Acknowledge Button */}
            <TouchableOpacity 
              onPress={() => setSafetyPlanOpen(false)}
              style={{ backgroundColor: "#E65100", height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 8 }}
            >
              <Text style={{ color: "#fff", fontSize: 13, ...fonts.black, letterSpacing: 1.5 }}>ACKNOWLEDGE SAFETY PLAN</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 24, paddingBottom: 120 },
  
  // Dashboard Styles
  heroBanner: { backgroundColor: "#2E7D32", borderRadius: 40, padding: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  heroContent: { flex: 1 },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#81C784", marginRight: 8 },
  heroBadgeText: { color: "#fff", fontSize: 10, ...fonts.black, letterSpacing: 1 },
  heroTitle: { fontSize: 36, ...fonts.black, color: "#fff", letterSpacing: -1.5 },
  heroSub: { fontSize: 16, ...fonts.medium, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  simulateBtn: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
  simulateBtnText: { fontSize: 12, ...fonts.black, color: "#1A1C1A", letterSpacing: 0.5 },
  mainRow: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  auditSection: { flex: 2, minWidth: 350, backgroundColor: "#fff", borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sectionTitle: { fontSize: 28, ...fonts.black, color: theme.text, letterSpacing: -0.5 },
  progressText: { fontSize: 12, ...fonts.black, color: "#2E7D32", letterSpacing: 1 },
  progressTrack: { height: 12, backgroundColor: "#E8F5E9", borderRadius: 6, marginBottom: 32, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#81C784", borderRadius: 6 },
  auditGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  auditCard: { width: "48%", minWidth: 160, backgroundColor: theme.surfaceAlt, padding: 20, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "transparent" },
  auditCardCompleted: { backgroundColor: "#F1F8E9" },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: theme.line, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  auditItemTitle: { flex: 1, fontSize: 14, ...fonts.bold, color: theme.textMuted },
  auditItemTitleCompleted: { color: theme.textLight, textDecorationLine: "line-through" },
  sideColumn: { flex: 1, minWidth: 300, gap: 24 },
  identityCard: { backgroundColor: "#fff", borderRadius: 32, padding: 24, borderWidth: 1, borderColor: theme.line },
  sideLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1.5, marginBottom: 20 },
  identityContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  qrBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#1A1C1A", alignItems: "center", justifyContent: "center" },
  idNumber: { fontSize: 16, ...fonts.black, color: theme.text },
  idName: { fontSize: 12, ...fonts.bold, color: theme.textMuted, marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F5E9", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  smallGreenDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#2E7D32", marginRight: 6 },
  verifiedText: { fontSize: 9, ...fonts.black, color: "#2E7D32", letterSpacing: 0.5 },
  alertCard: { backgroundColor: "#E65100", borderRadius: 32, padding: 32 },
  alertTitle: { fontSize: 24, ...fonts.black, color: "#fff" },
  alertMeta: { fontSize: 10, ...fonts.black, color: "rgba(255,255,255,0.7)", letterSpacing: 1, marginTop: 4, marginBottom: 12 },
  alertDesc: { fontSize: 14, ...fonts.medium, color: "rgba(255,255,255,0.9)", lineHeight: 20, marginBottom: 24 },
  viewPlanBtn: { backgroundColor: "#fff", height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  viewPlanText: { fontSize: 13, ...fonts.black, color: "#E65100", letterSpacing: 1 },

  // Registration Styles
  returnBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 },
  returnBtnText: { fontSize: 14, ...fonts.bold, color: theme.textLight },
  regHeroBanner: { backgroundColor: "#2E7D32", borderRadius: 40, padding: 40, marginBottom: 40 },
  regHeroBadge: { backgroundColor: "rgba(0,0,0,0.15)", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  regHeroBadgeText: { color: "#fff", fontSize: 10, ...fonts.black, letterSpacing: 1.5 },
  regHeroTitle: { fontSize: 32, ...fonts.black, color: "#fff", letterSpacing: -1, lineHeight: 40 },
  regHeroSub: { fontSize: 15, ...fonts.medium, color: "rgba(255,255,255,0.8)", marginTop: 16, lineHeight: 22 },
  selectionLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 2, marginBottom: 24 },
  registrationGrid: { flexDirection: "row", gap: 16, marginTop: 8 },
  regTypeCard: { flex: 1, backgroundColor: "#fff", borderRadius: 32, padding: 24, borderWidth: 1, borderColor: theme.line, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  regIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#F1F8E9", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  regTypeMeta: { fontSize: 8, ...fonts.black, color: "#81C784", letterSpacing: 1.2, marginBottom: 6 },
  regTypeTitle: { fontSize: 18, ...fonts.black, color: theme.text, marginBottom: 8 },
  regTypeDesc: { fontSize: 11, ...fonts.medium, color: theme.textMuted, lineHeight: 18, marginBottom: 20 },
  regFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" },
  regFooterText: { fontSize: 9, ...fonts.black, color: "#2E7D32", letterSpacing: 0.8 },
});
