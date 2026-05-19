import React, { useState } from "react";
import {
  ImageBackground,
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/UI";
import { roleColors, theme, fonts } from "../../theme";
import { styles } from "./CitizenLoginScreen.styles";
import { login, ApiError } from "../../api";
import { saveSession } from "../../session";
import { AppRole } from "../../types";

export function CitizenLoginScreen({
  onBack,
  onSubmit,
  onSecondary,
  secondaryLabel = "Create An Account",
}: {
  onBack: () => void;
  onSubmit: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
}) {
  const accent = roleColors.citizen;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      const result = await login({
        email: username.trim(),
        password: password.trim(),
        requiredRole: AppRole.CITIZEN,
      });

      if (result.user.role !== AppRole.CITIZEN) {
        setError("This account does not have citizen access.");
        return;
      }

      const accessToken = result.access_token?.trim();
      if (!accessToken) {
        setError("Login succeeded but no access token was returned.");
        return;
      }

      await saveSession({
        accessToken,
        expiresIn: result.expiresIn,
        user: { ...result.user, authUserId: result.user.id },
      });

      onSubmit();
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to sign in. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.citizenShell}>
          {/* Background Blobs */}
          <View style={[styles.orb, styles.orb1, { backgroundColor: accent }]} />
          <View style={[styles.orb, styles.orb2]} />

          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <TouchableOpacity onPress={onBack} style={styles.menuButton}>
                <Ionicons name="arrow-back" size={24} color={theme.primary} />
              </TouchableOpacity>
              <Text style={styles.brandText}>DAMAYAN</Text>
            </View>

            <View style={styles.roleBadgeRow}>
              <Text style={styles.roleTag}>AFFECTED CITIZEN</Text>
              <View style={styles.avatarIcon}>
                <Ionicons name="person" size={22} color={accent} />
              </View>
            </View>
          </View>

          <View style={styles.editorialPanel}>
            <Text style={[styles.gatewayLabel, { color: accent }]}>SECURE ACCESS GATEWAY</Text>
            <Text style={styles.editorialTitle}>
              The Resilient{"\n"}
              <Text style={[styles.editorialAccent, { color: accent }]}>Sanctuary</Text>
            </Text>
            <Text style={styles.editorialText}>
              Access humanitarian relief protocols, emergency status updates, and personal identification records within our secure environment.
            </Text>

            <View style={styles.imageCardContainer}>
              <ImageBackground
                source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDUeDgaq6XCJNBqX0uYoHRejovD-YsgRj9XE5F62qvcrVmANmWRhPjGJdgTgag5gYg96TXaegniq89lq04L0wXvg92nzJmruiEnOyI5oGwyTJzc1503PTnFrS3awvyIO9d95iNTsSSrhrgEqGFrBrR-FuVdXiiqR3Nam6VzDypJIhvd4WOqXhGk_AJtsZpPol5lAkW0P5xFhTUrrykrvIrbQq5cSzalGjM0TO7Y_or_zzhXBQ-9zEQWV2QatioCFDhS4cotqpRETjxM" }}
                imageStyle={{ borderRadius: 32 }}
                style={styles.imageCard}
              >
                <View style={styles.imageOverlay} />
              </ImageBackground>
            </View>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginIntro}>
              <Text style={styles.loginTitle}>Welcome back</Text>
              <Text style={styles.loginSubtitle}>
                Authenticate your credentials to enter the affected citizen dashboard.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.fieldWrap}>
                <Ionicons name="mail-outline" size={20} color={theme.textLight} style={{ marginRight: 12 }} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. samuel.aristha"
                  placeholderTextColor="#a0a7a0"
                  style={styles.fieldInput}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity>
                  <Text style={[styles.helpLink, { color: accent }]}>Forgot?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textLight} style={{ marginRight: 12 }} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="#a0a7a0"
                  style={styles.fieldInput}
                  secureTextEntry={!passwordVisible}
                />
                <TouchableOpacity onPress={() => setPasswordVisible((v) => !v)}>
                  <Ionicons 
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.textLight} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={{ backgroundColor: "#FFF0F0", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#FFCCCC" }}>
                <Text style={{ color: "#C0392B", fontSize: 14, ...fonts.medium }}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.actionStack}>
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={[styles.primaryAction, { backgroundColor: accent, opacity: loading ? 0.6 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryActionText}>ACCESS MY PORTAL</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {onSecondary && secondaryLabel ? (
                <TouchableOpacity onPress={onSecondary} style={[styles.secondaryAction, { borderColor: accent + "40" }]}>
                  <Text style={[styles.secondaryActionText, { color: accent }]}>{secondaryLabel.toUpperCase()}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Portal Control</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              <TouchableOpacity onPress={onBack} style={styles.tertiaryAction}>
                <Text style={styles.tertiaryActionText}>SWITCH PORTAL ACCESS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLinks}>
              {["Privacy", "Support", "Terms"].map(link => (
                <TouchableOpacity key={link}>
                  <Text style={styles.footerLink}>{link}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.footerNote}>
              © 2024 DAMAYAN Platform. Crisis response and humanitarian coordination systems.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
