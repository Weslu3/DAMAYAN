import React, { useState, useEffect } from "react";
import { View, StyleSheet, SafeAreaView, Pressable, Text, Modal, Platform, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme, darkTheme, fonts } from "../theme";
import { NotificationBell } from "../components/NotificationBell";
import { useNotifications } from "../hooks/useNotifications";
import { loadSession } from "../session";
import { getProfile, getCitizenProfile, getFileViewUrl, ApiError, type CitizenProfile } from "../api";
import { CitizenBeforeScreen } from "./beforecalamity/screens/CitizenBeforeScreen";
import { CitizenDuringScreen } from "./duringcalamity/CitizenDuringScreen";
import CitizenAfterScreen from "./aftercalamity/CitizenAfterScreen";
import { CitizenIndividualRegistrationScreen } from "./beforecalamity/screens/CitizenIndividualRegistrationScreen";
import { CitizenHouseholdRegistrationScreen } from "./beforecalamity/screens/CitizenHouseholdRegistrationScreen";
import { CitizenProfileEditScreen } from "./CitizenProfileEditScreen";
import { CitizenFamilyGroupScreen } from "./familygroup/CitizenFamilyGroupScreen";
import { useSystemPhase } from "../context/SystemPhaseContext";
import type { AuthSession } from "../types";

export type Phase = "before" | "during" | "after";
export type NavDestination = "Overview" | "Family & ID" | "Safety Map";

interface CitizenDashboardScreenProps {
  onSignOut: () => void;
}

export default function CitizenDashboardScreen({ onSignOut }: CitizenDashboardScreenProps) {
  // Phase is driven by the global system state, but can be locally overridden via bottom tabs
  const { citizenPhase: systemPhase } = useSystemPhase();
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null);
  const phase = phaseOverride || systemPhase;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

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
      setToken(activeSession.accessToken);
      setUserId(activeSession.user.authUserId ?? activeSession.user.id);

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
        if (profile?.profilePhotoKey) {
          try {
            const url = await getFileViewUrl(activeSession.accessToken, "government-ids", profile.profilePhotoKey);
            setProfilePhotoUrl(url);
          } catch (photoErr) {
            console.warn("Failed to fetch profile photo url:", photoErr);
          }
        }
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

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, token);

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
        setPhaseOverride(null);
        break;
      case "Family & ID":
        setTargetStep("family_group");
        break;
      case "Safety Map":
        setTargetStep("map");
        setPhaseOverride("during");
        break;
    }
  };

  const isEditingProfile = targetStep === "edit_profile";
  const isViewingFamilyGroup = targetStep === "family_group";

  const styles = getStyles(theme);

  const displayName = citizenProfile?.fullName
    || (citizenProfile?.firstName && citizenProfile?.lastName ? `${citizenProfile.firstName} ${citizenProfile.lastName}` : null)
    || (session?.user ? `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || null : null)
    || session?.user?.email
    || 'Citizen';
  const initials = displayName.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'C';

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      {/* Background Decoration */}
      <View style={[styles.orb, styles.orb1, { backgroundColor: phase === 'before' ? theme.primary : phase === 'during' ? theme.warning : theme.info }]} />
      <View style={[styles.orb, styles.orb2]} />

      {/* Header - Hidden when editing profile or viewing family group */}
      {!isEditingProfile && !isViewingFamilyGroup && (
        <SafeAreaView style={styles.headerSafe}>
          <View style={styles.headerInner}>
            {/* Logo / Brand Left */}
            <View style={styles.headerLeft}>
              <Image
                source={require("../../assets/damayan-logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View>
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
            </View>

            {/* Right: Notification Bell + Avatar */}
            <View style={styles.headerRight}>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
              />
              <Pressable onPress={() => setIsProfileOpen(true)} style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  {profilePhotoUrl ? (
                    <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarInitials}>
                      <Text style={styles.avatarInitialsText}>{initials}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {isEditingProfile ? (
          <CitizenProfileEditScreen
            onBack={() => setTargetStep("dashboard")}
            onSave={(data) => {
              setTargetStep("dashboard");
              if (data.updatedUser) setAuthUser(data.updatedUser);
            }}
            onPhotoUpdated={(uri) => setProfilePhotoUrl(uri)}
            citizenProfile={citizenProfile}
            session={session}
            latestProfile={authUser}
            initialPhotoUrl={profilePhotoUrl}
          />
        ) : isViewingFamilyGroup ? (
          <CitizenFamilyGroupScreen
            onBack={() => { setTargetStep("dashboard"); setActiveNav("Overview"); }}
            personalQrCodeId={citizenProfile?.qrCodeId}
            citizenDisplayName={displayName !== 'Citizen' ? displayName : undefined}
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
                    citizenProfile={citizenProfile}
                    profilePhotoUrl={profilePhotoUrl}
                    initials={initials}
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
                    onOpenResponse={() => { setPhaseOverride("during"); setActiveNav("Safety Map"); setTargetStep("decision"); }}
                    onRegisterIndividual={() => setTargetStep("individual_registration")}
                    onRegisterHousehold={() => setTargetStep("household_registration")}
                    onReportIncident={() => { setPhaseOverride("during"); setTargetStep("report_incident"); }}
                    initialStep={targetStep === "registration" ? "registration" : "dashboard"}
                    citizenProfile={citizenProfile}
                    authUser={authUser}
                    citizenName={displayName !== 'Citizen' ? displayName : undefined}
                    qrCodeId={citizenProfile?.qrCodeId}
                    registrationType={citizenProfile?.registrationType}
                    profilePhotoUrl={profilePhotoUrl ?? undefined}
                  />
                )}
              </View>
            )}
            {phase === "during" && (
              <CitizenDuringScreen
                onBack={() => { setPhaseOverride(null); setTargetStep("dashboard"); }}
                initialStep={targetStep === "report_incident" ? "report_incident" : "decision"}
                session={session}
                authUser={authUser}
                qrCodeId={citizenProfile?.qrCodeId}
              />
            )}
            {phase === "after" && (
              <CitizenAfterScreen
                onBack={() => {
                  setActiveNav("Overview");
                  setTargetStep("dashboard");
                  setPhaseOverride(null);
                }}
              />
            )}
          </>
        )}
      </View>

      {/* Premium Bottom Navigation - Hidden when editing profile or family group */}
      {!isEditingProfile && !isViewingFamilyGroup && (
        <View style={styles.bottomNavWrapper}>
          <View style={styles.bottomNavInner}>
            {[
              { id: "Overview", icon: "grid", label: "OVERVIEW" },
              { id: "Family & ID", icon: "people", label: "FAMILY & ID" },
              { id: "Safety Map", icon: "map", label: "SAFETY MAP" },
            ].map((item) => {
              const isActive = activeNav === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setActiveNav(item.id as NavDestination);
                    if (item.id === "Family & ID") { setTargetStep("family_group"); }
                    else if (item.id === "Safety Map") { setPhaseOverride("during"); setTargetStep("decision"); }
                    else { setPhaseOverride(null); setTargetStep("dashboard"); }
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
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileSub}>{session?.user?.email ?? 'Citizen'}</Text>
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
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
    letterSpacing: -1,
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
  avatarInitials: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  content: {
    flex: 1,
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

