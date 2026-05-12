import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import {
  CitizenBeforeScreen,
  CitizenHouseholdMembersScreen,
  CitizenDuringScreen,
  CitizenHouseholdRegistrationScreen,
  CitizenIndividualRegistrationScreen,
  CitizenSignupScreen,
  CitizenDashboardScreen,
  CitizenLoginScreen,
} from "./src/citizen";
import { DispatcherBeforeScreen, DispatcherDuringScreen, DispatcherLoginScreen } from "./src/dispatcher";
import { RoleSelectorScreen } from "./src/loginportal";
import { SiteManagerBeforeScreen, SiteManagerDuringScreen, SiteManagerSignupScreen, SiteManagerLoginScreen, SiteManagerDashboardScreen } from "./src/site-manager";
import { AdminDashboardScreen, AdminLoginScreen } from "./src/admin";
import type { AppRoute } from "./src/types";

export default function App() {
  const [route, setRoute] = useState<AppRoute>("role-selector");
  const [fontsReady, setFontsReady] = useState(true);

  useEffect(() => {
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

  switch (route) {
    case "admin-login":
      return (
        <>
          <StatusBar style="dark" />
          <AdminLoginScreen
            onBack={() => setRoute("role-selector")}
            onSubmit={() => setRoute("admin-dashboard")}
          />
        </>
      );
    case "admin-dashboard":
      return (
        <>
          <StatusBar style="dark" />
          <AdminDashboardScreen onBack={() => setRoute("role-selector")} />
        </>
      );
    case "dispatcher-login":
      return (
        <>
          <StatusBar style="dark" />
          <DispatcherLoginScreen
            onBack={() => setRoute("role-selector")}
            onSubmit={() => setRoute("dispatcher-before")}
          />
        </>
      );
    case "dispatcher-before":
      return (
        <>
          <StatusBar style="dark" />
          <DispatcherBeforeScreen
            onBack={() => setRoute("role-selector")}
            onOpenDuring={() => setRoute("dispatcher-during")}
          />
        </>
      );
    case "dispatcher-during":
      return (
        <>
          <StatusBar style="dark" />
          <DispatcherDuringScreen onBack={() => setRoute("dispatcher-before")} />
        </>
      );
    case "site-manager-login":
      return (
        <>
          <StatusBar style="dark" />
          <SiteManagerLoginScreen
            onBack={() => setRoute("role-selector")}
            onSubmit={() => setRoute("site-manager-before")}
            onSecondary={() => setRoute("site-manager-signup")}
            secondaryLabel="Create An Account"
          />
        </>
      );
    case "site-manager-signup":
      return (
        <>
          <StatusBar style="dark" />
          <SiteManagerSignupScreen
            onBack={() => setRoute("site-manager-login")}
            onSubmit={() => setRoute("site-manager-login")}
          />
        </>
      );
    case "site-manager-before":
    case "site-manager-during":
      return (
        <>
          <StatusBar style="dark" />
          <SiteManagerDashboardScreen
            onSignOut={() => setRoute("site-manager-login")}
          />
        </>
      );
    case "citizen-login":
      return (
        <>
          <StatusBar style="dark" />
          <CitizenLoginScreen
            onBack={() => setRoute("role-selector")}
            onSubmit={() => setRoute("citizen-dashboard")}
            onSecondary={() => setRoute("citizen-signup")}
            secondaryLabel="Create An Account"
          />
        </>
      );
    case "citizen-signup":
      return (
        <>
          <StatusBar style="dark" />
          <CitizenSignupScreen
            onBack={() => setRoute("citizen-login")}
            onSubmit={() => setRoute("citizen-dashboard")}
          />
        </>
      );
    case "citizen-dashboard":
      return (
        <>
          <StatusBar style="dark" />
          <CitizenDashboardScreen
            onSignOut={() => setRoute("citizen-login")}
          />
        </>
      );
    case "role-selector":
    default:
      return (
        <>
          <StatusBar style="dark" />
          <RoleSelectorScreen onNavigate={setRoute} />
        </>
      );
  }
}
