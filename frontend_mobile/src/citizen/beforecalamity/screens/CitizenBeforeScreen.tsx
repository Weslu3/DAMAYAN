import React, { useState, useEffect } from "react";
import { Pressable, Text, View, Modal, TouchableOpacity, StyleSheet, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
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
  citizenName,
  qrCodeId,
  registrationType,
  profilePhotoUrl,
}: {
  onBack: () => void;
  onOpenResponse: () => void;
  onRegisterIndividual?: () => void;
  onRegisterHousehold?: () => void;
  initialStep?: string;
  isDarkMode?: boolean;
  citizenName?: string;
  qrCodeId?: string;
  registrationType?: string;
  profilePhotoUrl?: string;
}) {
  const [step, setStep] = React.useState(initialStep);
  
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
                  onPress={() => {
                    setAuditItems(auditItems.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
                  }}
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
                 <View style={localStyles.qrBox}>
                    {qrCodeId ? (
                      <QRCode value={qrCodeId} size={52} backgroundColor="transparent" />
                    ) : (
                      <Ionicons name="qr-code" size={24} color="#000" />
                    )}
                 </View>
                 <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={localStyles.idNumber} numberOfLines={1}>{qrCodeId ?? '—'}</Text>
                    <Text style={localStyles.idName} numberOfLines={1}>{citizenName ? citizenName.toUpperCase() : 'NOT REGISTERED'}</Text>
                    {citizenName ? (
                      <View style={localStyles.verifiedBadge}>
                         <View style={localStyles.smallGreenDot} />
                         <Text style={localStyles.verifiedText}>{registrationType?.toUpperCase() ?? 'VERIFIED'}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={onRegisterIndividual} style={[localStyles.verifiedBadge, { backgroundColor: '#FFF3E0' }]}>
                         <Text style={[localStyles.verifiedText, { color: '#E65100' }]}>REGISTER NOW</Text>
                      </TouchableOpacity>
                    )}
                 </View>
              </View>
           </View>

           <View style={localStyles.alertCard}>
              <Ionicons name="warning" size={24} color="#fff" style={{ marginBottom: 12 }} />
              <Text style={localStyles.alertTitle}>Typhoon Amang</Text>
              <Text style={localStyles.alertMeta}>LEVEL 2 ALERT • 72H ETA</Text>
              <Text style={localStyles.alertDesc}>Expected landfall in northern sector. Review evacuation routes now.</Text>
              <TouchableOpacity style={localStyles.viewPlanBtn}>
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
  identityContent: { flexDirection: "row", alignItems: "center" },
  qrBox: { width: 60, height: 60, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  idNumber: { fontSize: 12, ...fonts.black, color: theme.text },
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
