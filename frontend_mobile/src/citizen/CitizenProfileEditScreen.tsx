import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { theme, fonts } from "../theme";
import { updateProfile, updateMedical, getProfilePhotoUploadUrl, type CitizenProfile } from "../api";
import { loadSession } from "../session";
import type { AuthSession } from "../types";

interface CitizenProfileEditScreenProps {
  onBack: () => void;
  onSave: (data: any) => void;
  onPhotoUpdated?: (uri: string) => void;
  citizenProfile?: CitizenProfile | null;
  session?: AuthSession | null;
  latestProfile?: any;
  initialPhotoUrl?: string | null;
}

const GENDERS = ["Male", "Female", "Prefer not to say"];
const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Unknown"];

export function CitizenProfileEditScreen({
  onBack,
  onSave,
  onPhotoUpdated,
  citizenProfile,
  session,
  latestProfile,
  initialPhotoUrl,
}: CitizenProfileEditScreenProps) {
  // latestProfile is the freshly fetched /auth/me result (has address fields)
  // session.user is the stored session (may lack address fields)
  const userProfile = latestProfile ?? (session?.user as any);

  const [firstName, setFirstName] = useState(
    citizenProfile?.firstName ?? userProfile?.firstName ?? "",
  );
  const [lastName, setLastName] = useState(
    citizenProfile?.lastName ?? userProfile?.lastName ?? "",
  );
  const [email, setEmail] = useState(userProfile?.email ?? "");
  const [phone, setPhone] = useState(
    citizenProfile?.phone ?? userProfile?.phone ?? "",
  );

  // Address (from user_profiles)
  const [address, setAddress] = useState(userProfile?.address ?? "");
  const [barangay, setBarangay] = useState(userProfile?.barangay ?? "");
  const [municipality, setMunicipality] = useState(userProfile?.municipality ?? "");
  const [province, setProvince] = useState(userProfile?.province ?? "");

  // Personal (from user_profiles + register_citizens)
  const [gender, setGender] = useState(
    citizenProfile?.gender ?? userProfile?.gender ?? "",
  );
  const [bloodType, setBloodType] = useState(citizenProfile?.bloodType ?? "");
  const [medicalConditions, setMedicalConditions] = useState(
    citizenProfile?.medicalConditions ?? "",
  );

  // Current saved photo URL (passed from parent)
  const [savedPhotoUri, setSavedPhotoUri] = useState<string | null>(initialPhotoUrl ?? null);
  // Locally selected photo waiting for confirmation
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoAsset, setPendingPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [activeSection, setActiveSection] = useState<"account" | "address" | "health">("account");

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets.length) return;
    setPendingPhotoAsset(result.assets[0]);
    setPendingPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const s = await loadSession();
      if (!s?.accessToken) throw new Error("Session expired. Please sign in again.");

      // Upload pending photo — non-fatal so gender/address always save
      let newPhotoUri: string | null = null;
      if (pendingPhotoAsset) {
        try {
          const asset = pendingPhotoAsset;
          const fileName = asset.uri.split("/").pop() ?? "profile.jpg";
          const { signedUrl, objectPath } = await getProfilePhotoUploadUrl(s.accessToken, fileName);
          const fileResponse = await fetch(asset.uri);
          const blob = await fileResponse.blob();
          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
            body: blob,
          });
          if (!uploadRes.ok) throw new Error(`Upload returned ${uploadRes.status}`);
          await updateProfile(s.accessToken, { profilePhotoKey: objectPath });
          newPhotoUri = asset.uri;
        } catch (photoErr) {
          console.warn("Profile photo upload failed:", photoErr);
          // Don't block the rest of the save
        }
      }

      const updated = await updateProfile(s.accessToken, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
        barangay: barangay.trim() || undefined,
        municipality: municipality.trim() || undefined,
        province: province.trim() || undefined,
      });

      // Medical update is non-fatal — blood type & conditions live in register_citizens
      try {
        await updateMedical(s.accessToken, {
          bloodType: bloodType || undefined,
          medicalConditions: medicalConditions.trim() || undefined,
        });
      } catch {
        // Silently skip if citizen registration record doesn't exist yet
      }

      if (newPhotoUri) {
        setSavedPhotoUri(newPhotoUri);
        setPendingPhotoUri(null);
        setPendingPhotoAsset(null);
        onPhotoUpdated?.(newPhotoUri);
      }

      setSuccess(true);
      onSave({
        firstName,
        lastName,
        email,
        phone,
        address,
        barangay,
        municipality,
        province,
        gender,
        bloodType,
        medicalConditions,
        updatedUser: updated?.user,
      });

      setTimeout(() => {
        onBack();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  const sections = [
    { id: "account" as const, label: "Account", icon: "person-outline" },
    { id: "address" as const, label: "Address", icon: "location-outline" },
    { id: "health" as const, label: "Health", icon: "heart-outline" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable onPress={handleSave} style={styles.saveHeaderButton} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.saveHeaderText, success && { color: "#2E7D32" }]}>
              {success ? "Saved!" : "Save"}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Section tabs */}
      <View style={styles.tabRow}>
        {sections.map((sec) => (
          <Pressable
            key={sec.id}
            style={[styles.tab, activeSection === sec.id && styles.tabActive]}
            onPress={() => setActiveSection(sec.id)}
          >
            <Ionicons
              name={sec.icon as any}
              size={18}
              color={activeSection === sec.id ? theme.primary : theme.textLight}
            />
            <Text style={[styles.tabLabel, activeSection === sec.id && styles.tabLabelActive]}>
              {sec.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Account ── */}
        {activeSection === "account" && (
          <View style={styles.section}>
            {/* Profile Photo */}
            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
                <View style={styles.avatarCircle}>
                  {pendingPhotoUri ? (
                    <Image source={{ uri: pendingPhotoUri }} style={styles.avatarImage} />
                  ) : savedPhotoUri ? (
                    <Image source={{ uri: savedPhotoUri }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={44} color={theme.textLight} />
                  )}
                </View>
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </TouchableOpacity>

              {pendingPhotoUri ? (
                <View style={styles.avatarActions}>
                  <Text style={[styles.avatarHint, { color: theme.primary }]}>
                    New photo selected — tap Save to apply
                  </Text>
                  <TouchableOpacity
                    style={styles.avatarCancelBtn}
                    onPress={() => { setPendingPhotoUri(null); setPendingPhotoAsset(null); }}
                  >
                    <Text style={styles.avatarCancelText}>✕ Discard</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.avatarHint}>Tap to change photo</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Personal Information</Text>

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={theme.textLight}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={theme.textLight}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={email}
                editable={false}
                placeholder="Email"
                placeholderTextColor={theme.textLight}
              />
              <Text style={styles.fieldHint}>Email cannot be changed here. Contact support.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="09XX XXX XXXX"
                placeholderTextColor={theme.textLight}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.chipRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, gender === g && styles.chipActive]}
                    onPress={() => setGender(g === gender ? "" : g)}
                  >
                    <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Address ── */}
        {activeSection === "address" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Residential Address</Text>
            <Text style={styles.sectionDesc}>
              Your address is used to direct relief operations and locate your household during emergencies.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Street / House No. / Sitio</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. 123 Sampaguita St."
                placeholderTextColor={theme.textLight}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Barangay</Text>
              <TextInput
                style={styles.input}
                value={barangay}
                onChangeText={setBarangay}
                placeholder="e.g. Barangay San Jose"
                placeholderTextColor={theme.textLight}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Municipality / City</Text>
              <TextInput
                style={styles.input}
                value={municipality}
                onChangeText={setMunicipality}
                placeholder="e.g. Legazpi City"
                placeholderTextColor={theme.textLight}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Province</Text>
              <TextInput
                style={styles.input}
                value={province}
                onChangeText={setProvince}
                placeholder="e.g. Albay"
                placeholderTextColor={theme.textLight}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        {/* ── Health ── */}
        {activeSection === "health" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Information</Text>
            <Text style={styles.sectionDesc}>
              This information helps site managers provide appropriate medical assistance during emergencies.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Blood Type</Text>
              <View style={styles.chipRow}>
                {BLOOD_TYPES.map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.chip, bloodType === bt && styles.chipActive]}
                    onPress={() => setBloodType(bt === bloodType ? "" : bt)}
                  >
                    <Text style={[styles.chipText, bloodType === bt && styles.chipTextActive]}>
                      {bt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Medical Conditions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={medicalConditions}
                onChangeText={setMedicalConditions}
                placeholder="e.g. Diabetes, Hypertension, Asthma..."
                placeholderTextColor={theme.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={18} color="#C0392B" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginRight: 8 }} />
            <Text style={styles.successText}>Profile saved successfully!</Text>
          </View>
        )}

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>CONFIRM CHANGES</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === "android" ? 40 : 0,
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
    minWidth: 52,
    alignItems: "center",
  },
  saveHeaderText: {
    ...fonts.black,
    fontSize: 16,
    color: theme.primary,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.primary,
  },
  tabLabel: {
    ...fonts.bold,
    fontSize: 13,
    color: theme.textLight,
  },
  tabLabelActive: {
    color: theme.primary,
  },
  content: { flex: 1 },
  contentInner: {
    padding: 24,
    paddingBottom: 60,
  },
  section: {
    gap: 20,
  },
  sectionTitle: {
    ...fonts.black,
    fontSize: 22,
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sectionDesc: {
    ...fonts.medium,
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 20,
    marginBottom: 8,
  },
  field: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    ...fonts.bold,
    fontSize: 11,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1.5,
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
  disabledInput: {
    opacity: 0.5,
  },
  textArea: {
    height: 110,
    paddingTop: 18,
    textAlignVertical: "top",
  },
  fieldHint: {
    ...fonts.medium,
    fontSize: 11,
    color: theme.textLight,
    marginLeft: 4,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  chipActive: {
    backgroundColor: "#E8F5E9",
    borderColor: "#004D40",
  },
  chipText: {
    ...fonts.bold,
    fontSize: 14,
    color: theme.textMuted,
  },
  chipTextActive: {
    color: "#004D40",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0F0",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FFCCCC",
    marginTop: 8,
  },
  errorText: {
    ...fonts.bold,
    fontSize: 14,
    color: "#C0392B",
    flex: 1,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F8E9",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    marginTop: 8,
  },
  successText: {
    ...fonts.bold,
    fontSize: 14,
    color: "#2E7D32",
    flex: 1,
  },
  saveButton: {
    backgroundColor: theme.primary,
    height: 68,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 36,
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
  avatarRow: {
    alignItems: "center",
    paddingBottom: 8,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarHint: {
    ...fonts.medium,
    fontSize: 12,
    color: theme.textLight,
    marginTop: 8,
  },
  avatarActions: {
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  avatarCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
  },
  avatarCancelText: {
    ...fonts.bold,
    fontSize: 12,
    color: theme.textMuted,
  },
});
