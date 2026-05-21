import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SystemPhaseProvider } from "./src/context/SystemPhaseContext";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import {
  CitizenBeforeScreen,
  CitizenHouseholdMembersScreen,
  CitizenDuringScreen,
  CitizenHouseholdRegistrationScreen,
  CitizenIndividualRegistrationScreen,
  CitizenSignupScreen,
  CitizenDashboardScreen,
} from "./src/citizen";
import { UnifiedLoginScreen } from "./src/loginportal";
import { SiteManagerBeforeScreen, SiteManagerDuringScreen, SiteManagerSignupScreen, SiteManagerDashboardScreen } from "./src/site-manager";
import type { AppRoute } from "./src/types";
import { AppRole } from "./src/types";

export default function App() {
  const [route, setRoute] = useState<AppRoute>("login");
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync(Ionicons.font);
      } catch (e) {
        console.warn("Error loading fonts", e);
      } finally {
        setFontsReady(true);
      }
    }
    loadFonts();

    // Load Google Fonts for web via dynamic link
    if (typeof document !== "undefined") {
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: "#f8f9f8" }} />;
  }

  return (
    <SystemPhaseProvider>
      <AppContent route={route} setRoute={setRoute} />
    </SystemPhaseProvider>
  );
}

function AppContent({
  route,
  setRoute,
}: {
  route: AppRoute;
  setRoute: React.Dispatch<React.SetStateAction<AppRoute>>;
}) {
  switch (route) {
    case "login":
      return (
        <>
          <StatusBar style="dark" />
          <UnifiedLoginScreen
            onLoginSuccess={(role) => {
              if (role === AppRole.CITIZEN) setRoute("citizen-dashboard");
              else if (role === AppRole.LINE_MANAGER) setRoute("site-manager-before");
            }}
            onCreateAccount={() => setRoute("citizen-signup")}
          />
        </>
      );
    case "site-manager-signup":
      return (
        <>
          <StatusBar style="dark" />
          <SiteManagerSignupScreen
            onBack={() => setRoute("login")}
            onSubmit={() => setRoute("login")}
          />
        </>
      );
    case "site-manager-before":
    case "site-manager-during":
      return (
        <>
          <StatusBar style="dark" />
          <SiteManagerDashboardScreen
            onSignOut={() => setRoute("login")}
          />
        </>
      );
    case "citizen-signup":
      return (
        <>
          <StatusBar style="dark" />
          <CitizenSignupScreen
            onBack={() => setRoute("login")}
            onSubmit={() => setRoute("citizen-dashboard")}
          />
        </>
      );
    case "citizen-dashboard":
      return (
        <>
          <StatusBar style="dark" />
          <CitizenDashboardScreen
            onSignOut={() => setRoute("login")}
          />
        </>
      );
    default:
      return (
        <>
          <StatusBar style="dark" />
          <UnifiedLoginScreen
            onLoginSuccess={(role) => {
              if (role === AppRole.CITIZEN) setRoute("citizen-dashboard");
              else if (role === AppRole.LINE_MANAGER) setRoute("site-manager-before");
            }}
            onCreateAccount={() => setRoute("citizen-signup")}
          />
        </>
      );
  }
}
