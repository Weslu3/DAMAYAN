import React, { useState, useEffect } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Button, Screen } from "../../../components/UI";
import { theme, fonts } from "../../../theme";
import { styles } from "../styles/CitizenIndividualRegistrationScreen.styles";
import { registerCitizen, type CitizenProfile } from "../../../api";

export function CitizenIndividualRegistrationScreen({
  onBack,
  onContinue,
  session,
  authUser,
  onRefreshProfile,
  citizenProfile,
  profilePhotoUrl,
  initials = "C",
}: {
  onBack: () => void;
  onContinue: () => void;
  session?: any;
  authUser?: any;
  onRefreshProfile?: () => void;
  citizenProfile?: CitizenProfile | null;
  profilePhotoUrl?: string | null;
  initials?: string;
}) {
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  useEffect(() => {
    async function performRegistration() {
      if (!session || !authUser) return;
      try {
        console.log("Automatically registering citizen individual ID on backend...");
        const randomCode = "IND-" + Math.floor(1000 + Math.random() * 9000);
        await registerCitizen(session.accessToken, {
          fullName: authUser.name || (authUser.firstName + " " + authUser.lastName),
          birthDate: authUser.birthDate || "1990-01-01",
          gender: authUser.gender || "Female",
          bloodType: authUser.bloodType || "O+",
          medicalConditions: authUser.medicalConditions || "None",
          registrationType: "Individual",
          qrCodeId: randomCode,
        });
        if (onRefreshProfile) {
          onRefreshProfile();
        }
      } catch (err) {
        console.error("Backend citizen individual registration failed/already exists:", err);
      }
    }

    performRegistration();
  }, [session, authUser]);

  const fullName =
    citizenProfile?.fullName ||
    (citizenProfile?.firstName && citizenProfile?.lastName
      ? `${citizenProfile.firstName} ${citizenProfile.lastName}`
      : "—");

  const qrValue = citizenProfile?.qrCodeId ?? "DAMAYAN-ID";
  const qrDisplay = citizenProfile?.qrCodeId ?? "—";

  const expiryLabel = (() => {
    const raw = citizenProfile?.createdAt;
    if (!raw) return "—";
    const d = new Date(raw);
    d.setFullYear(d.getFullYear() + 1);
    return `${String(d.getMonth() + 1).padStart(2, "0")} / ${d.getFullYear()}`;
  })();

  return (
    <Screen>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable onPress={onBack} style={styles.topButton}>
            <Ionicons name="arrow-back" size={22} color={theme.primary} />
          </Pressable>
          <Text style={styles.topBarTitle}>Digital ID</Text>
        </View>
        <View style={styles.avatarWrap}>
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarImage, { backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{initials}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Success Hero */}
      <View style={styles.heroSection}>
        <View style={styles.successBadge}>
          <Ionicons name="checkmark" size={32} color={theme.primary} />
        </View>
        <Text style={styles.heroTitle}>Your Personal{"  \n"}ID is Ready</Text>
        <Text style={styles.heroCopy}>
          Registration complete. This QR ID serves as your digital key for relief
          goods, medical assistance, and emergency shelter access.
        </Text>
      </View>

      {/* ID Card */}
      <View style={styles.cardShell}>
        <View style={styles.cardGlow} />
        <View style={styles.idCard}>
          <View style={styles.idHeader}>
            <View>
              <Text style={styles.idHeaderLabel}>Damayan Relief Network</Text>
              <Text style={styles.idHeaderTitle}>OFFICIAL CITIZEN ID</Text>
            </View>
            <Text style={styles.idHeaderMark}>{initials.slice(0, 2)}</Text>
          </View>

          <View style={styles.idContent}>
            <View style={styles.qrSection}>
              <View style={styles.qrFrame}>
                <QRCode value={qrValue} size={100} color="#0F6E56" backgroundColor="#fff" />
              </View>
              <View style={styles.idCodeBadge}>
                <Text style={styles.idCodeText}>{qrDisplay}</Text>
              </View>
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>{fullName}</Text>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailMiniBlock}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={styles.verifiedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.detailMiniBlock}>
                  <Text style={styles.detailLabel}>Expiry</Text>
                  <Text style={styles.detailSmallValue}>{expiryLabel}</Text>
                </View>
              </View>

              <View style={styles.regionBlock}>
                <View style={styles.regionIconWrap}>
                  <Ionicons name="location" size={18} color="#7e5700" />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Registration Type</Text>
                  <Text style={styles.regionText}>{citizenProfile?.registrationType ?? "—"}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={styles.toggleIconWrap}>
              <Ionicons name="notifications" size={22} color="#7e5700" />
            </View>
            <View>
              <Text style={styles.toggleTitle}>Enable Alerts</Text>
              <Text style={styles.toggleCopy}>Real-time SMS and push updates</Text>
            </View>
          </View>

          <Switch
            value={alertsEnabled}
            onValueChange={setAlertsEnabled}
            trackColor={{ false: "#e2e3de", true: theme.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <Pressable style={styles.primaryAction}>
          <Ionicons name="download" size={20} color="#ffffff" />
          <Text style={styles.primaryActionText}>Save to Device</Text>
        </Pressable>

      </View>
    </Screen>
  );
}
