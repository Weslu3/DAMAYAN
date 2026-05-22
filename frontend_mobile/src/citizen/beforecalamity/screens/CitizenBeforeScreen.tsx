import React, { useState, useEffect } from "react";
import { Pressable, Text, View, Modal, TouchableOpacity, StyleSheet, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { Screen, Pill, SectionCard } from "../../../components/UI";
import { theme, fonts, lightTheme, darkTheme } from "../../../theme";
import {
  CitizenPreparednessTopBar,
  citizenStyles,
} from "../../shared";

type AuditItem = { id: string; title: string; icon: string; shortDesc: string; details: string; steps: string[]; completed: boolean };

const DEFAULT_AUDIT_ITEMS: AuditItem[] = [
  {
    id: "1",
    title: "Register Your Emergency ID",
    icon: "qr-code-outline",
    shortDesc: "Get your Damayan Digital ID for shelter check-in",
    details: "Your Damayan Digital ID is your lifeline during a disaster. It enables rapid shelter check-in, medical tracking, and direct relief claims without paperwork or queues.",
    steps: [
      "Tap 'Register' on your dashboard",
      "Fill in your personal details accurately",
      "Receive your unique QR code instantly",
      "Screenshot or print it for offline access",
    ],
    completed: false,
  },
  {
    id: "2",
    title: "Pack Your 72-Hour Go-Bag",
    icon: "bag-handle-outline",
    shortDesc: "Water, food, medicine, flashlight, power bank, documents",
    details: "A 72-hour go-bag keeps you self-sufficient for the first 3 days of a disaster, when outside help may not yet be available. Prepare it now and store it near your exit.",
    steps: [
      "1 gallon of water per person per day (3-day supply)",
      "Non-perishable food: canned goods, energy bars, biscuits",
      "7-day supply of prescription medications",
      "Flashlight + extra batteries + fully charged power bank",
      "Copies of IDs, birth certificates, and insurance papers",
    ],
    completed: false,
  },
  {
    id: "3",
    title: "Know Your Evacuation Route",
    icon: "navigate-outline",
    shortDesc: "Find your nearest shelter and plan 2 routes",
    details: "Knowing your route before disaster strikes can save precious time. Roads may be blocked, so always have a primary and backup path to your designated evacuation center.",
    steps: [
      "Ask your barangay hall for the designated shelter",
      "Plan a primary route and a backup route",
      "Walk or drive both routes at least once",
      "Note major landmarks, bridges, and flood-prone areas",
      "Ensure all household members know the route",
    ],
    completed: false,
  },
  {
    id: "4",
    title: "Save Emergency Hotlines",
    icon: "call-outline",
    shortDesc: "Red Cross 143, Police 117, Fire 911, NDRRMC",
    details: "Cell calls often work even when internet is down. Save these numbers to your phone contacts now so you can call for help immediately when it matters most.",
    steps: [
      "Barangay Emergency Hotline (get from local hall)",
      "Philippine Red Cross: 143",
      "National Police Emergency: 117",
      "Bureau of Fire Protection: 911",
      "NDRRMC Operations Center: (02) 8911-5061",
    ],
    completed: false,
  },
  {
    id: "5",
    title: "Brief Your Household",
    icon: "people-outline",
    shortDesc: "Set a meeting point if you get separated",
    details: "Everyone in your household should know the plan. Agree on meeting points and a communication strategy before disaster strikes, not during it.",
    steps: [
      "Choose a meeting point near your home (e.g., a neighbor's gate)",
      "Choose a second meeting point farther away (e.g., a barangay hall)",
      "Designate one out-of-area contact everyone can reach",
      "Make sure children know the plan and the shelter address",
      "Practice the plan with the whole household at least once",
    ],
    completed: false,
  },
];

export function CitizenBeforeScreen({
  onBack,
  onOpenResponse,
  onRegisterIndividual,
  onRegisterHousehold,
  onReportIncident,
  initialStep = "dashboard",
  isDarkMode,
  citizenProfile,
  authUser,
  citizenName,
  qrCodeId,
  registrationType,
  profilePhotoUrl,
}: {
  onBack: () => void;
  onOpenResponse: () => void;
  onRegisterIndividual?: () => void;
  onRegisterHousehold?: () => void;
  onReportIncident?: () => void;
  initialStep?: string;
  isDarkMode?: boolean;
  citizenProfile?: any;
  authUser?: any;
  citizenName?: string;
  qrCodeId?: string;
  registrationType?: string;
  profilePhotoUrl?: string;
}) {
  const [step, setStep] = React.useState(initialStep);
  const [safetyPlanOpen, setSafetyPlanOpen] = useState(false);
  
  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const localStyles = getStyles(currentTheme);

  // ── Ready-Check Audit ──────────────────────────────────────────────────────
  const [auditItems, setAuditItems] = useState<AuditItem[]>(DEFAULT_AUDIT_ITEMS);
  const [auditDismissed, setAuditDismissed] = useState(false);
  const [selectedAuditItem, setSelectedAuditItem] = useState<AuditItem | null>(null);

  const auditKey = (suffix: string) =>
    authUser?.id ? `damayan.citizen.${suffix}.${authUser.id}` : `damayan.citizen.${suffix}`;

  useEffect(() => {
    const load = async () => {
      try {
        const [storedItems, storedDismissed] = await Promise.all([
          AsyncStorage.getItem(auditKey("audit_items")),
          AsyncStorage.getItem(auditKey("audit_dismissed")),
        ]);
        if (storedDismissed === "true") { setAuditDismissed(true); return; }
        if (storedItems) {
          // Merge stored completion state into current DEFAULT structure so stale/old
          // format data (missing steps/icon fields) can never corrupt the modal render.
          const stored: Array<{ id: string; completed?: boolean }> = JSON.parse(storedItems);
          const completionMap = new Map(stored.map(i => [i.id, !!i.completed]));
          setAuditItems(DEFAULT_AUDIT_ITEMS.map(item => ({
            ...item,
            completed: completionMap.has(item.id) ? completionMap.get(item.id)! : item.completed,
          })));
        }
      } catch (e) {
        console.error("Failed to load audit state:", e);
      }
    };
    load();
  }, [authUser?.id]);

  const markItemDone = async (itemId: string) => {
    const updated = auditItems.map(i => i.id === itemId ? { ...i, completed: true } : i);
    setAuditItems(updated);
    setSelectedAuditItem(null);
    try {
      await AsyncStorage.setItem(auditKey("audit_items"), JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save audit item:", e);
    }
  };

  const dismissAudit = async () => {
    setAuditDismissed(true);
    try {
      await AsyncStorage.setItem(auditKey("audit_dismissed"), "true");
    } catch (e) {
      console.error("Failed to save audit dismissed:", e);
    }
  };

  const completedCount = auditItems.filter(i => i.completed).length;
  const progressPercent = Math.round((completedCount / auditItems.length) * 100);
  const allDone = completedCount === auditItems.length;

  const renderDashboard = () => (
    <ScrollView style={localStyles.container} contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top Safety Banner */}
      <View style={localStyles.heroBanner}>
        <View style={localStyles.heroBadge}>
          <View style={localStyles.pulseDot} />
          <Text style={localStyles.heroBadgeText}>
            {auditDismissed ? "FULLY PREPARED" : `PREPARED • ${completedCount}/${auditItems.length} DONE`}
          </Text>
        </View>
        <Text style={localStyles.heroTitle}>Safety Dashboard</Text>
        <Text style={localStyles.heroSub}>Complete your audit before the next advisory.</Text>
      </View>

      {/* Report Incident Quick-Action */}
      <TouchableOpacity style={localStyles.sosButton} onPress={onReportIncident} activeOpacity={0.85}>
        <View style={localStyles.sosIconWrap}>
          <Ionicons name="megaphone" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={localStyles.sosTitle}>Report an Incident</Text>
          <Text style={localStyles.sosSub}>Request rescue or flag an emergency in your area</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <View style={localStyles.mainRow}>
        {/* Ready-Check Audit Section */}
        {!auditDismissed && (
          <View style={localStyles.auditSection}>
            {allDone ? (
              /* All tasks complete — show dismiss card */
              <View style={localStyles.auditCompleteCard}>
                <View style={localStyles.auditCompleteIconWrap}>
                  <Ionicons name="shield-checkmark" size={40} color="#2E7D32" />
                </View>
                <Text style={localStyles.auditCompleteTitle}>You're Prepared!</Text>
                <Text style={localStyles.auditCompleteSub}>
                  All {auditItems.length} preparedness tasks are done. You're ready for an emergency.
                </Text>
                <TouchableOpacity style={localStyles.auditDismissBtn} onPress={dismissAudit}>
                  <Text style={localStyles.auditDismissBtnText}>Dismiss Checklist</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={localStyles.sectionHeaderRow}>
                  <Text style={localStyles.sectionTitle}>Ready-Check Audit</Text>
                  <Text style={localStyles.progressText}>{progressPercent}% DONE</Text>
                </View>
                <View style={localStyles.progressTrack}>
                  <View style={[localStyles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
                <View style={localStyles.auditGrid}>
                  {auditItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[localStyles.auditCard, item.completed && localStyles.auditCardCompleted]}
                      onPress={() => !item.completed && setSelectedAuditItem(item)}
                    >
                      <View style={[localStyles.checkbox, item.completed && localStyles.checkboxChecked]}>
                        {item.completed
                          ? <Ionicons name="checkmark" size={16} color="#fff" />
                          : <Ionicons name={item.icon as any} size={16} color="#2E7D32" />
                        }
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[localStyles.auditItemTitle, item.completed && localStyles.auditItemTitleCompleted]}>
                          {item.title}
                        </Text>
                        {!item.completed && (
                          <Text style={localStyles.auditItemSub} numberOfLines={1}>{item.shortDesc}</Text>
                        )}
                      </View>
                      {!item.completed && (
                        <Ionicons name="chevron-forward" size={16} color="#81C784" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

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

      {/* Audit Item Detail Modal */}
      <Modal visible={selectedAuditItem !== null} transparent animationType="slide" onRequestClose={() => setSelectedAuditItem(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={localStyles.auditModal}>
            {selectedAuditItem != null && (
              <>
                {/* Fixed header — never scrolls away */}
                <View style={localStyles.auditModalHeader}>
                  <View style={localStyles.auditModalIconWrap}>
                    <Ionicons name={(selectedAuditItem.icon ?? "checkmark-circle-outline") as any} size={28} color="#2E7D32" />
                  </View>
                  <TouchableOpacity onPress={() => setSelectedAuditItem(null)} style={localStyles.auditModalClose}>
                    <Ionicons name="close" size={20} color={currentTheme.textLight || "#7e887e"} />
                  </TouchableOpacity>
                </View>

                {/* Scrollable body */}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <Text style={localStyles.auditModalTitle}>{selectedAuditItem.title}</Text>
                  <Text style={localStyles.auditModalDetails}>{selectedAuditItem.details}</Text>
                  <Text style={localStyles.auditModalStepsLabel}>WHAT TO DO</Text>
                  {(selectedAuditItem.steps ?? []).map((s, i) => (
                    <View key={i} style={localStyles.auditModalStep}>
                      <View style={localStyles.auditModalStepNum}>
                        <Text style={localStyles.auditModalStepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={localStyles.auditModalStepText}>{s}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={localStyles.auditModalDoneBtn}
                    onPress={() => markItemDone(selectedAuditItem.id)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={localStyles.auditModalDoneBtnText}>Mark as Complete</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Premium Typhoon Safety Plan Modal */}
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
                  <Ionicons name="shield-half-outline" size={32} color="#E65100" />
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
                  72-Hour Evacuation Go-Bag Checklist
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
                  Designated Evacuation Shelters
                </Text>
                
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: currentTheme.surface || "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" }}>
                    <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A" }}>Primary: Bicol Sector Central HS</Text>
                    <Text style={{ fontSize: 11, ...fonts.medium, color: currentTheme.textLight || "#7e887e", marginTop: 4 }}>Evacuation route: Main Highway North → Sector 2 Exit</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#E8F5E9", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#2E7D32" }} />
                      <Text style={{ fontSize: 9, ...fonts.black, color: "#2E7D32" }}>CAPACITY: 85% AVAILABLE</Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: currentTheme.surface || "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" }}>
                    <Text style={{ fontSize: 14, ...fonts.black, color: currentTheme.text || "#1A1C1A" }}>Secondary: Barangay 102 Dome</Text>
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
                  Critical Rescue Hotlines
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
  scrollContent: { padding: 20, paddingBottom: 140 },
  
  // Dashboard Styles
  heroBanner: { backgroundColor: "#2E7D32", borderRadius: 24, padding: 22, marginBottom: 16 },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 14 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#81C784", marginRight: 8 },
  heroBadgeText: { color: "#fff", fontSize: 10, ...fonts.black, letterSpacing: 1 },
  heroTitle: { fontSize: 30, ...fonts.black, color: "#fff", letterSpacing: -1 },
  heroSub: { fontSize: 14, ...fonts.medium, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  sosButton: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#BA1A1A", borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: "#BA1A1A", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  sosIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  sosTitle: { fontSize: 16, ...fonts.black, color: "#fff", letterSpacing: -0.3 },
  sosSub: { fontSize: 12, ...fonts.medium, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  mainRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  auditSection: { flex: 2, minWidth: 280, backgroundColor: "#fff", borderRadius: 32, padding: 20, borderWidth: 1, borderColor: theme.line },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sectionTitle: { fontSize: 22, ...fonts.black, color: theme.text, letterSpacing: -0.5 },
  progressText: { fontSize: 12, ...fonts.black, color: "#2E7D32", letterSpacing: 1 },
  progressTrack: { height: 8, backgroundColor: "#E8F5E9", borderRadius: 6, marginBottom: 20, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#81C784", borderRadius: 6 },
  auditGrid: { gap: 10 },
  auditCard: { backgroundColor: theme.surfaceAlt, padding: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: theme.line },
  auditCardCompleted: { backgroundColor: "#F1F8E9", borderColor: "#C8E6C9" },
  checkbox: { width: 36, height: 36, borderRadius: 12, borderWidth: 1.5, borderColor: "#C8E6C9", backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxChecked: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  auditItemTitle: { fontSize: 14, ...fonts.bold, color: theme.text },
  auditItemTitleCompleted: { color: theme.textLight, textDecorationLine: "line-through" },
  auditItemSub: { fontSize: 11, ...fonts.medium, color: theme.textLight, marginTop: 2 },
  // All-done dismiss card
  auditCompleteCard: { alignItems: "center", paddingVertical: 32, gap: 12 },
  auditCompleteIconWrap: { width: 80, height: 80, borderRadius: 28, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  auditCompleteTitle: { fontSize: 22, ...fonts.black, color: theme.text, letterSpacing: -0.5 },
  auditCompleteSub: { fontSize: 14, ...fonts.medium, color: theme.textMuted, textAlign: "center", lineHeight: 20, paddingHorizontal: 8 },
  auditDismissBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20, backgroundColor: "#2E7D32", shadowColor: "#2E7D32", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  auditDismissBtnText: { fontSize: 14, ...fonts.black, color: "#fff", letterSpacing: 0.5 },
  // Audit item modal
  auditModal: { backgroundColor: theme.bg || "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 44, maxHeight: "80%", borderTopWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  auditModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  auditModalIconWrap: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  auditModalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.04)", alignItems: "center", justifyContent: "center" },
  auditModalTitle: { fontSize: 22, ...fonts.black, color: theme.text || "#1A1C1A", letterSpacing: -0.5, marginBottom: 10 },
  auditModalDetails: { fontSize: 14, ...fonts.medium, color: theme.textMuted || "#4d544d", lineHeight: 21, marginBottom: 20 },
  auditModalStepsLabel: { fontSize: 10, ...fonts.black, color: theme.textLight || "#7e887e", letterSpacing: 1.5, marginBottom: 12 },
  auditModalStep: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  auditModalStepNum: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  auditModalStepNumText: { fontSize: 12, ...fonts.black, color: "#2E7D32" },
  auditModalStepText: { flex: 1, fontSize: 14, ...fonts.bold, color: theme.textMuted || "#4d544d", lineHeight: 21 },
  auditModalDoneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24, height: 58, borderRadius: 20, backgroundColor: "#2E7D32", shadowColor: "#2E7D32", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  auditModalDoneBtnText: { fontSize: 15, ...fonts.black, color: "#fff", letterSpacing: 0.5 },
  sideColumn: { flex: 1, minWidth: 280, gap: 16 },
  identityCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.line },
  sideLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1.5, marginBottom: 20 },
  identityContent: { flexDirection: "row", alignItems: "center" },
  qrBox: { width: 60, height: 60, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  idNumber: { fontSize: 12, ...fonts.black, color: theme.text },
  idName: { fontSize: 12, ...fonts.bold, color: theme.textMuted, marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F5E9", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  smallGreenDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#2E7D32", marginRight: 6 },
  verifiedText: { fontSize: 9, ...fonts.black, color: "#2E7D32", letterSpacing: 0.5 },
  alertCard: { backgroundColor: "#E65100", borderRadius: 24, padding: 20 },
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
