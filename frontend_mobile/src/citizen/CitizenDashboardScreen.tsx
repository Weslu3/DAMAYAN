import React, { useState, useEffect } from "react";
import { loadSession } from "../session";
import { getProfile, getCitizenProfile, ApiError } from "../api";
import { View, StyleSheet, ScrollView, SafeAreaView, Dimensions, Pressable, Text, Modal, Platform, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme, darkTheme, fonts } from "../theme";
import { CitizenBeforeScreen } from "./beforecalamity/screens/CitizenBeforeScreen";
import { CitizenDuringScreen } from "./duringcalamity/CitizenDuringScreen";
import CitizenAfterScreen from "./aftercalamity/CitizenAfterScreen";
import { CitizenIndividualRegistrationScreen } from "./beforecalamity/screens/CitizenIndividualRegistrationScreen";
import { CitizenHouseholdRegistrationScreen } from "./beforecalamity/screens/CitizenHouseholdRegistrationScreen";
import { CitizenProfileEditScreen } from "./CitizenProfileEditScreen";

export type Phase = "before" | "during" | "after";
export type NavDestination = "Overview" | "Family & ID" | "Safety Map" | "Relief Status";

interface CitizenDashboardScreenProps {
  onSignOut: () => void;
}

export default function CitizenDashboardScreen({ onSignOut }: CitizenDashboardScreenProps) {
  const [phase, setPhase] = useState<Phase>("before");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [session, setSession] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [citizenProfile, setCitizenProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadUserData() {
    try {
      setLoading(true);
      const activeSession = await loadSession();
      if (!activeSession) {
        onSignOut();
        return;
      }

      setSession(activeSession);
      setAuthUser(activeSession.user);

      // Fetch latest details from `/auth/me`
      try {
        const latestProfile = await getProfile(activeSession.accessToken);
        if (latestProfile?.user) {
          setAuthUser(latestProfile.user);
        }
      } catch (err) {
        console.warn("Failed to fetch fresh user profile:", err);
      }

      // Fetch citizen profile details
      try {
        const profile = await getCitizenProfile(activeSession.accessToken);
        setCitizenProfile(profile);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          console.log("Citizen registration profile not found. User is unregistered.");
          setCitizenProfile(null);
        } else {
          console.error("Failed to fetch citizen profile:", err);
        }
      }
    } catch (err) {
      console.error("Error loading citizen session:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserData();
  }, []);

  const theme = isDarkMode ? darkTheme : lightTheme;

  const [activeNav, setActiveNav] = useState<NavDestination>("Overview");
  const [targetStep, setTargetStep] = useState<string | null>(null);

  const phaseConfig = {
    before: { label: "Preparedness", color: theme.primary, icon: "shield-checkmark" as const },
    during: { label: "Emergency", color: theme.warning, icon: "warning" as const },
    after: { label: "Recovery", color: theme.primary, icon: "heart" as const },
  }[phase];

  const handleNavigate = (dest: NavDestination) => {
    setActiveNav(dest);
    setIsDrawerOpen(false);
    
    switch (dest) {
      case "Overview":
        setTargetStep("dashboard");
        break;
      case "Family & ID":
        setPhase("before");
        setTargetStep("registration");
        break;
      case "Safety Map":
        setPhase("during");
        setTargetStep("map");
        break;
      case "Relief Status":
        setPhase("after");
        setTargetStep("relief_claim");
        break;
    }
  };

  const isEditingProfile = targetStep === "edit_profile";

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      {/* Background Decoration */}
      <View style={[styles.orb, styles.orb1, { backgroundColor: phase === 'before' ? theme.primary : phase === 'during' ? theme.warning : theme.info }]} />
      <View style={[styles.orb, styles.orb2]} />

      {/* Header - Hidden when editing profile */}
      {!isEditingProfile && (
        <SafeAreaView style={styles.headerSafe}>
          <View style={styles.headerInner}>
            {/* Logo / Brand Centered */}
            <View style={styles.headerCenter}>
              <Text style={styles.brandText}>DAMAYAN</Text>
              <View style={[
                styles.phaseIndicator, 
                { backgroundColor: phase === 'before' ? (isDarkMode ? theme.surfaceAlt : '#eef1ea') : phase === 'during' ? (isDarkMode ? theme.surfaceAlt : '#fff4e5') : (isDarkMode ? theme.surfaceAlt : '#eef2ff') }
              ]}>
                 <Ionicons 
                   name={phase === 'before' ? 'shield-checkmark' : phase === 'during' ? 'warning' : 'checkmark-done-circle'} 
                   size={10} 
                   color={phase === 'before' ? theme.primary : phase === 'during' ? theme.warning : theme.info} 
                 />
                 <Text style={[
                   styles.phaseText, 
                   { color: phase === 'before' ? theme.primary : phase === 'during' ? theme.warning : theme.info }
                 ]}>
                   {phase === 'before' ? 'PREPAREDNESS' : phase === 'during' ? 'RESPONSE MODE' : 'RECOVERY PHASE'}
                 </Text>
              </View>
            </View>

            {/* Profile on the Right */}
            <Pressable onPress={() => setIsProfileOpen(true)} style={styles.avatarContainer}>
              <View style={styles.profileTextContainer}>
                <Text style={styles.headerProfileName}>{citizenProfile?.fullName || (authUser ? `${authUser.firstName} ${authUser.lastName}` : "Elena Villacruz")}</Text>
                <Text style={styles.headerProfileSub}>{citizenProfile?.address || authUser?.barangay || "BRGY. 102, DIST 4"}</Text>
              </View>
              <View style={styles.avatar}>
                 <Image 
                   source={{ uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" }} 
                   style={styles.avatarImage} 
                 />
              </View>
            </Pressable>
          </View>
        </SafeAreaView>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {isEditingProfile ? (
          <CitizenProfileEditScreen 
            onBack={() => setTargetStep("dashboard")} 
            onSave={(data) => {
              console.log("Profile saved:", data);
              setTargetStep("dashboard");
            }}
          />
        ) : (
          <>
            {phase === "before" && (
              <View style={{ flex: 1 }}>
                {targetStep === "individual_registration" ? (
                  <CitizenIndividualRegistrationScreen 
                    onBack={() => setTargetStep("dashboard")} 
                    onContinue={() => setTargetStep("dashboard")}
                    session={session}
                    authUser={authUser}
                    onRefreshProfile={loadUserData}
                  />
                ) : targetStep === "household_registration" ? (
                  <CitizenHouseholdRegistrationScreen 
                    onBack={() => setTargetStep("dashboard")} 
                    onContinue={() => setTargetStep("dashboard")}
                    session={session}
                    authUser={authUser}
                    citizenProfile={citizenProfile}
                    onRefreshProfile={loadUserData}
                  />
                ) : (
                  <CitizenBeforeScreen 
                    onBack={onSignOut} 
                    onOpenResponse={() => setPhase("during")} 
                    onRegisterIndividual={() => setTargetStep("individual_registration")}
                    onRegisterHousehold={() => setTargetStep("household_registration")}
                    initialStep={targetStep === "registration" ? "registration" : "dashboard"}
                    citizenProfile={citizenProfile}
                    authUser={authUser}
                  />
                )}
              </View>
            )}
            {phase === "during" && (
              <CitizenDuringScreen 
                onBack={() => setPhase("before")} 
                initialStep={targetStep === "map" ? "map" : "decision"}
                session={session}
                authUser={authUser}
              />
            )}
            {phase === "after" && (
              <CitizenAfterScreen 
                onBack={() => {
                  setPhase("before");
                  setActiveNav("Overview");
                  setTargetStep("dashboard");
                }}
              />
            )}
          </>
        )}
      </View>

      {/* Premium Bottom Navigation - Hidden when editing profile */}
      {!isEditingProfile && (
        <View style={styles.bottomNavWrapper}>
          <View style={styles.bottomNavInner}>
            {[
              { id: "Overview", icon: "grid", label: "OVERVIEW" },
              { id: "Family & ID", icon: "people", label: "FAMILY & ID" },
              { id: "Safety Map", icon: "map", label: "SAFETY MAP" },
              { id: "Relief Status", icon: "cube", label: "RELIEF STATUS" },
            ].map((item) => {
              const isActive = activeNav === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setActiveNav(item.id as NavDestination);
                    if (item.id === "Family & ID") { setPhase("before"); setTargetStep("registration"); }
                    else if (item.id === "Safety Map") { setPhase("during"); setTargetStep("map"); }
                    else if (item.id === "Relief Status") { setPhase("after"); setTargetStep("relief_claim"); }
                    else { setPhase("before"); setTargetStep("dashboard"); }
                  }}
                  style={styles.navTab}
                >
                  <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                    <Ionicons 
                      name={(isActive ? item.icon : item.icon + "-outline") as any} 
                      size={24} 
                      color={isActive ? theme.primary : theme.textLight} 
                    />
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Profile Modal (Dropdown equivalent) */}
      <Modal visible={isProfileOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsProfileOpen(false)}>
          <View style={styles.profileDropdown}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>{citizenProfile?.fullName || (authUser ? `${authUser.firstName} ${authUser.lastName}` : "Elena Villacruz")}</Text>
              <Text style={styles.profileSub}>{citizenProfile?.address || authUser?.barangay || "Brgy. 102, Dist 4"}</Text>
            </View>
            <View style={styles.profileActions}>
              <Pressable style={styles.profileActionItem} onPress={() => setIsDarkMode(!isDarkMode)}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDarkMode ? '#2196F3' + '15' : '#FFB300' + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={20} color={isDarkMode ? '#2196F3' : '#FFB300'} />
                </View>
                <Text style={styles.profileActionText}>{isDarkMode ? "Light Mode" : "Dark Mode"}</Text>
              </Pressable>
              
              <Pressable style={styles.profileActionItem} onPress={() => {
                setIsProfileOpen(false);
                setPhase("before");
                setActiveNav("Overview");
                setTargetStep("dashboard");
              }}>
                <Ionicons name="arrow-back-outline" size={20} color={theme.primary} />
                <Text style={styles.profileActionText}>Back to Dashboard</Text>
              </Pressable>
              <Pressable style={styles.profileActionItem} onPress={() => {
                setIsProfileOpen(false);
                setTargetStep("edit_profile");
              }}>
                <Ionicons name="create-outline" size={20} color={theme.warning} />
                <Text style={styles.profileActionText}>Edit Profile</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.profileActionItem} onPress={() => { setIsProfileOpen(false); onSignOut(); }}>
                <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                <Text style={[styles.profileActionText, { color: theme.danger }]}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    ...Platform.select({
      web: {
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      } as any,
    }),
  },
  headerSafe: {
    backgroundColor: theme.surface + "CC", // 80% opacity
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  headerInner: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingLeft: 40,
  },
  brandText: {
    ...fonts.black,
    fontSize: 22,
    color: theme.text,
    letterSpacing: -1.2,
  },
  phaseIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  phaseText: {
    ...fonts.black,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.08,
  },
  orb1: {
    width: 350,
    height: 350,
    top: -100,
    right: -100,
  },
  orb2: {
    width: 250,
    height: 250,
    bottom: 100,
    left: -100,
    backgroundColor: theme.secondary,
  },
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 12,
  },
  profileTextContainer: {
    alignItems: "flex-end",
  },
  headerProfileName: {
    ...fonts.black,
    fontSize: 16,
    color: theme.text,
  },
  headerProfileSub: {
    ...fonts.black,
    fontSize: 10,
    color: theme.textLight,
    letterSpacing: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.line,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    ...Platform.select({
      web: {
        height: "100%",
        minHeight: 0,
      } as any,
    }),
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 24,
  },
  profileDropdown: {
    width: 260,
    backgroundColor: theme.surface,
    borderRadius: 32,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 12,
    borderWidth: 1,
    borderColor: theme.line,
  },
  profileHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  profileName: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
    letterSpacing: -0.5,
  },
  profileSub: {
    ...fonts.bold,
    fontSize: 11,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  profileActions: {
    padding: 12,
  },
  profileActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
  },
  profileActionText: {
    ...fonts.bold,
    fontSize: 15,
    color: theme.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: theme.line,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  // Premium Bottom Nav Styles
  bottomNavWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 10,
  },
  bottomNavInner: {
    flexDirection: "row",
    backgroundColor: theme.surface + "F2", // 95% opacity
    borderRadius: 36,
    height: 84,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 15,
  },
  navTab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
  },
  tabIconWrap: {
    width: 52,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: theme.primarySoft,
  },
  tabLabel: {
    fontSize: 11,
    ...fonts.bold,
    color: theme.textLight,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: theme.primary,
  },
});

