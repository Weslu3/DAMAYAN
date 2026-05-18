import React, { useState } from "react";
import { Pressable, Text, View, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/UI";
import { roleColors, theme, fonts } from "../theme";
import { AppRoute, PortalRole } from "../types";
import { styles } from "./RoleSelectorScreen.styles";

const roles: { 
  id: PortalRole; 
  label: string; 
  sub: string; 
  desc: string; 
  color: string;
  image: string;
}[] = [
  { 
    id: "citizen", 
    label: "Affected Citizen", 
    sub: "PUBLIC PORTAL",
    desc: "Register for relief, receive critical alerts, access your Digital ID, and track recovery aid status.",
    color: roleColors.citizen,
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
  },
  { 
    id: "site_manager", 
    label: "Site Manager", 
    sub: "OPERATIONS PORTAL",
    desc: "Manage shelter intake, track resource inventory, and oversee local distribution logs.",
    color: roleColors.site_manager,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=150&q=80",
  },
  { 
    id: "dispatcher", 
    label: "Dispatcher", 
    sub: "COMMAND PORTAL",
    desc: "Coordinate emergency rescue teams, prioritize incident tickets, and manage field assets.",
    color: roleColors.dispatcher,
    image: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=150&q=80",
  },
  { 
    id: "admin", 
    label: "Administrator", 
    sub: "SYSTEM PORTAL",
    desc: "System-wide governance, user verification, platform health monitoring, and analytics reporting.",
    color: roleColors.admin,
    image: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=150&q=80",
  },
];

const routeMap: Record<PortalRole, AppRoute> = {
  admin: "admin-login",
  dispatcher: "dispatcher-login",
  site_manager: "site-manager-login",
  citizen: "citizen-login",
};

function RoleCard({ role, onNavigate }: { role: typeof roles[0], onNavigate: (route: AppRoute) => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={() => onNavigate(routeMap[role.id])}
      // @ts-ignore - onMouseEnter/Leave for Web
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={[
        styles.roleCard,
        isHovered && { borderColor: role.color, transform: [{ scale: 1.01 }] }
      ]}
    >
      {isHovered && <View style={[styles.statusDot, { backgroundColor: role.color }]} />}
      
      <View style={[styles.roleIconWrap, { backgroundColor: isHovered ? role.color + "15" : theme.surfaceAlt, overflow: 'hidden' }]}>
        <Image source={{ uri: role.image }} style={{ width: '100%', height: '100%' }} />
      </View>
      
      <View style={styles.roleCopy}>
        <Text style={[styles.roleSub, { color: isHovered ? role.color : theme.textLight }]}>{role.sub}</Text>
        <Text style={styles.roleLabel}>{role.label}</Text>
        <Text style={styles.roleDesc} numberOfLines={2}>{role.desc}</Text>
      </View>
      
      <View style={[styles.roleActionIcon, isHovered && { backgroundColor: role.color + "15" }]}>
        <Text style={{ fontSize: 18, color: isHovered ? role.color : theme.textLight }}>→</Text>
      </View>
    </Pressable>
  );
}

export function RoleSelectorScreen({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGradient} />
          
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
          
          <View style={{ paddingHorizontal: 32, zIndex: 2 }}>
            <View style={styles.mark}>
              <Text style={styles.markText}>D</Text>
            </View>
            <Text style={styles.brand}>DAMAYAN</Text>
            <Text style={styles.headline}>
              One Platform.{"\n"}
              Every Role.{"\n"}
              <Text style={{color: theme.secondary}}>Zero Delay.</Text>
            </Text>
            <Text style={styles.copy}>
              The unified Philippines Disaster Response ecosystem connecting responders and citizens in real-time.
            </Text>

            <View style={styles.statsRow}>
              {[
                { val: "4", lab: "Portals" },
                { val: "24/7", lab: "Active" },
                { val: "Sync", lab: "Real-time" },
              ].map((stat, i) => (
                <React.Fragment key={stat.lab}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stat.val}</Text>
                    <Text style={styles.statLabel}>{stat.lab}</Text>
                  </View>
                  {i < 2 && <View style={styles.statDivider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 60 }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.selectorHeadText}>IDENTIFY YOUR PORTAL TO CONTINUE</Text>
          </View>
          
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} onNavigate={onNavigate} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
