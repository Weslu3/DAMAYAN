import React, { useState } from "react";
import { View, StyleSheet, ScrollView, SafeAreaView, Dimensions, Pressable, Text, Modal, Platform, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme, darkTheme, fonts, roleColors } from "../theme";
import { SiteManagerBeforeScreen } from "./beforecalamity/SiteManagerBeforeScreen";
import { SiteManagerDuringScreen } from "./duringcalamity/SiteManagerDuringScreen";
import { SiteManagerAfterScreen } from "./aftercalamity/SiteManagerAfterScreen";
import { SiteManagerInventoryScreen } from "./inventory/SiteManagerInventoryScreen";
import { SiteManagerMapScreen } from "./map/SiteManagerMapScreen";
import { useSystemPhase } from "../context/SystemPhaseContext";

export type OperationalStage = "STAGING" | "RESPONSE" | "RECOVERY";
export type NavDestination = "Overview" | "Operations" | "Resources" | "Reporting";

interface SiteManagerDashboardScreenProps {
  onSignOut: () => void;
}

export default function SiteManagerDashboardScreen({ onSignOut }: SiteManagerDashboardScreenProps) {
  // Stage is driven by the global system phase set by admin, with offline caching
  const { operationalStage: stage } = useSystemPhase();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeNav, setActiveNav] = useState<NavDestination>("Overview");
  const [targetStep, setTargetStep] = useState<string | null>(null);

  const theme = isDarkMode ? darkTheme : lightTheme;
  const accent = "#81C784"; // Updated to green per screenshot
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      {/* Background Decoration */}
      <View style={[styles.orb, styles.orb1, { backgroundColor: accent }]} />
      <View style={[styles.orb, styles.orb2]} />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
             <Text style={[styles.brandText, { color: theme.text }]}>DAMAYAN</Text>
             <View style={[
                 styles.stageBadge, 
                 { backgroundColor: stage === 'STAGING' ? (isDarkMode ? theme.surfaceAlt : '#E8F5E9') : stage === 'RESPONSE' ? (isDarkMode ? theme.surfaceAlt : '#FFF3E0') : (isDarkMode ? theme.surfaceAlt : '#E3F2FD') }
               ]}>
                  <View style={[styles.statusDot, { backgroundColor: stage === 'STAGING' ? theme.primary : stage === 'RESPONSE' ? theme.warning : theme.info }]} />
                  <Text style={[
                    styles.stageText, 
                    { color: stage === 'STAGING' ? theme.primary : stage === 'RESPONSE' ? theme.warning : theme.info }
                  ]}>
                    {stage === 'STAGING' ? 'STAGING' : stage === 'RESPONSE' ? 'RESPONSE' : 'RECOVERY'}
                  </Text>
             </View>
          </View>

          <Pressable onPress={() => setIsProfileOpen(true)} style={styles.avatarContainer}>
            <View style={[styles.avatar, { borderColor: theme.line, backgroundColor: theme.surfaceAlt }]}>
               <Ionicons name="business" size={20} color={theme.text} />
            </View>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Main Content */}
      <View style={styles.content}>
        {activeNav === "Resources" ? (
          <SiteManagerInventoryScreen isDarkMode={isDarkMode} />
        ) : activeNav === "Operations" ? (
          <SiteManagerMapScreen isDarkMode={isDarkMode} />
        ) : (
          <>
            {stage === "STAGING" && (
               <SiteManagerBeforeScreen
                 onBack={onSignOut}
                 onOpenResponse={() => {}}
                 isDarkMode={isDarkMode}
               />
            )}
            {stage === "RESPONSE" && (
               <SiteManagerDuringScreen
                 onBack={() => {}}
                 isDarkMode={isDarkMode}
                 onEnterRecovery={() => {}}
               />
            )}
            {stage === "RECOVERY" && (
               <SiteManagerAfterScreen
                 onBack={() => {}}
                 onBackToResponse={() => {}}
                 isDarkMode={isDarkMode}
                 onFinalize={() => {}}
               />
            )}
          </>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavWrapper}>
        <View style={styles.bottomNavInner}>
          {[
            { id: "Overview", icon: "grid", label: "DASHBOARD" },
            { id: "Resources", icon: "cube", label: "INVENTORY" },
            { id: "Operations", icon: "map", label: "SITE MAP" },
          ].map((item) => {
            const isActive = activeNav === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setActiveNav(item.id as NavDestination)}
                style={[styles.navTab, isActive && styles.navTabActive]}
              >
                <Ionicons 
                  name={(isActive ? item.icon : item.icon + "-outline") as any} 
                  size={22} 
                  color={isActive ? "#fff" : theme.textLight} 
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Profile Modal */}
      <Modal visible={isProfileOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsProfileOpen(false)}>
          <View style={styles.profileDropdown}>
            <View style={styles.profileHeader}>
              <Text style={[styles.profileName, { color: theme.text }]}>Director Marcus</Text>
              <Text style={styles.profileSub}>Regional Operations Lead</Text>
            </View>
            <View style={styles.profileActions}>
              <Pressable style={styles.profileActionItem} onPress={() => setIsDarkMode(!isDarkMode)}>
                <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#E3F2FD20' : '#E3F2FD' }]}>
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="#2196F3" />
                </View>
                <Text style={styles.profileActionText}>{isDarkMode ? "Light Mode" : "Dark Mode"}</Text>
              </Pressable>

              <Pressable style={styles.profileActionItem} onPress={() => setIsProfileOpen(false)}>
                <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="person" size={22} color="#2E7D32" />
                </View>
                <Text style={styles.profileActionText}>View Profile</Text>
              </Pressable>

              <Pressable style={styles.profileActionItem} onPress={() => setIsProfileOpen(false)}>
                <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}>
                  <Ionicons name="pencil" size={22} color="#FFB300" />
                </View>
                <Text style={styles.profileActionText}>Edit Profile</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable style={styles.profileActionItem} onPress={() => { setIsProfileOpen(false); onSignOut(); }}>
                <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="log-out" size={22} color="#D32F2F" />
                </View>
                <Text style={[styles.profileActionText, { color: "#D32F2F" }]}>Sign Out</Text>
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
    backgroundColor: theme.surface + "CC",
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  headerInner: {
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  brandText: {
    ...fonts.black,
    fontSize: 20,
    letterSpacing: -1,
  },
  stageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stageText: {
    ...fonts.black,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
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
    backgroundColor: "#FFB300",
  },
  avatarContainer: {
    paddingLeft: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
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
    backgroundColor: theme.surface + "F2",
    borderRadius: 32,
    height: 80,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  navTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  navTabActive: {
    backgroundColor: "#81C784",
    shadowColor: "#81C784",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tabLabel: {
    fontSize: 12,
    ...fonts.black,
    color: theme.textLight,
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: "#fff",
  },
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
    ...fonts.black,
    fontSize: 16,
    color: theme.text,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: theme.line,
    marginVertical: 12,
    marginHorizontal: 16,
  },
});
