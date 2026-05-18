import React, { useState } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Button, Screen } from "../../../components/UI";
import { theme, fonts } from "../../../theme";
import { styles } from "../styles/CitizenIndividualRegistrationScreen.styles";

const avatarUri =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDmjENrAB5IQ3c2Xo9CHxLTG1Zx_wgP7ExXJmB7Kmj71CYaOiI0t7iQF9ibo6i1cY9WmMIHjRJCv_OhCLyiUH5Eml5d2lTOImfkIKJHeLVUIWIuVb1csgOiXIcvCezQF77Cfu-HJg4eUnCjMQMvjZhbUia0NTelqhZTDjEUY992V_wxjgsl2rHbXTQPkDG1lQEyRLoDyAJNLCd2J0550CN_KivV_VtOiFchDlvQLlJ9PgN6a7lsmlgO--ZHDGsz_hJfyQ7qJyk9GGoV";



export function CitizenIndividualRegistrationScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const [alertsEnabled, setAlertsEnabled] = useState(true);

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
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
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
            <Text style={styles.idHeaderMark}>SH</Text>
          </View>

          <View style={styles.idContent}>
            <View style={styles.qrSection}>
              <View style={styles.qrFrame}>
                <QRCode value="DMY-284-991-001" size={100} color="#0F6E56" backgroundColor="#fff" />
              </View>
              <View style={styles.idCodeBadge}>
                <Text style={styles.idCodeText}>284-991-001</Text>
              </View>
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>Elena S. Villacruz</Text>
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
                  <Text style={styles.detailSmallValue}>12 / 2025</Text>
                </View>
              </View>

              <View style={styles.regionBlock}>
                <View style={styles.regionIconWrap}>
                  <Ionicons name="location" size={18} color="#7e5700" />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Registered Region</Text>
                  <Text style={styles.regionText}>Bicol Region, District 2</Text>
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
