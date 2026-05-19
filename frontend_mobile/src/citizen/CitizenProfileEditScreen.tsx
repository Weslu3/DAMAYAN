import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, SafeAreaView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, fonts } from "../theme";
import type { CitizenProfile } from "../api";
import type { AuthSession } from "../types";

interface CitizenProfileEditScreenProps {
  onBack: () => void;
  onSave: (data: any) => void;
  citizenProfile?: CitizenProfile | null;
  session?: AuthSession | null;
}

export function CitizenProfileEditScreen({ onBack, onSave, citizenProfile, session }: CitizenProfileEditScreenProps) {
  const resolvedFullName =
    citizenProfile?.fullName ||
    (citizenProfile?.firstName && citizenProfile?.lastName
      ? `${citizenProfile.firstName} ${citizenProfile.lastName}`
      : session?.user ? `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() : "");

  const [profile, setProfile] = useState({
    fullName: resolvedFullName || "",
    email: session?.user?.email || "",
    phone: citizenProfile?.phone || session?.user?.phone || "",
    address: "",
    emergencyContact: "",
  });

  const handleSave = () => {
    onSave(profile);
    onBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable onPress={handleSave} style={styles.saveHeaderButton}>
          <Text style={styles.saveHeaderText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {/* Profile Image Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
               <Ionicons name="person" size={50} color={theme.primary} />
            </View>
            <Pressable style={styles.editAvatarButton}>
              <Ionicons name="camera" size={18} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.avatarHint}>Change Profile Picture</Text>
        </View>

        {/* Form Fields */}
        <View style={{ gap: 24 }}>
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput 
              style={styles.input}
              value={profile.fullName}
              onChangeText={(text) => setProfile({ ...profile, fullName: text })}
              placeholder="Full Name"
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput 
              style={styles.input}
              value={profile.email}
              onChangeText={(text) => setProfile({ ...profile, email: text })}
              placeholder="Email Address"
              keyboardType="email-address"
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput 
              style={styles.input}
              value={profile.phone}
              onChangeText={(text) => setProfile({ ...profile, phone: text })}
              placeholder="Phone Number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Residential Address</Text>
            <TextInput 
              style={[styles.input, styles.textArea]}
              value={profile.address}
              onChangeText={(text) => setProfile({ ...profile, address: text })}
              placeholder="Address"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Emergency Contact</Text>
            <TextInput 
              style={styles.input}
              value={profile.emergencyContact}
              onChangeText={(text) => setProfile({ ...profile, emergencyContact: text })}
              placeholder="Emergency Contact"
            />
          </View>
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Confirm Changes</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
  },
  headerTitle: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
  },
  saveHeaderButton: {
    paddingHorizontal: 12,
  },
  saveHeaderText: {
    ...fonts.black,
    fontSize: 16,
    color: theme.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 24,
    paddingBottom: 60,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 45,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 4,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.bg,
  },
  avatarHint: {
    ...fonts.bold,
    fontSize: 12,
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  label: {
    ...fonts.bold,
    fontSize: 11,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 60,
    ...fonts.bold,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.line,
  },
  textArea: {
    height: 100,
    paddingTop: 18,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: theme.primary,
    height: 68,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 48,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  saveButtonText: {
    ...fonts.black,
    fontSize: 16,
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
