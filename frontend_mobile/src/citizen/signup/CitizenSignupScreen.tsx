import React, { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { theme, fonts } from "../../theme";
import { signup, getGovernmentIdUploadUrl, getRegions, ApiError } from "../../api";
import { saveSession } from "../../session";
import { AppRole } from "../../types";

interface SelectedFile {
  name: string;
  mimeType: string;
  uri: string;
  nativeFile?: File;
}

const GENDERS = ["Male", "Female", "Prefer not to say"];

export function CitizenSignupScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  // Step 1 – account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 – location
  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [province, setProvince] = useState("");
  const [regionId, setRegionId] = useState("");
  const [regionName, setRegionName] = useState("");
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [regionModalVisible, setRegionModalVisible] = useState(false);

  // Step 3 – personal details
  const [gender, setGender] = useState("");

  // Government ID upload
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadBoxRef = useRef<View>(null);

  function setFile(name: string, mimeType: string, uri: string, nativeFile?: File) {
    const fileName = name.toLowerCase();
    const isAllowed =
      mimeType === "image/jpeg" ||
      mimeType === "image/png" ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".png");
    if (isAllowed) {
      setSelectedFile({ name, mimeType: mimeType || "image/jpeg", uri, nativeFile });
    } else {
      setError("Invalid file type. Please upload a JPG or PNG image.");
    }
  }

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png"],
      });
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setFile(a.name, a.mimeType ?? "", a.uri);
      }
    } catch (err) {
      console.error("Error picking document:", err);
    }
  }

  useEffect(() => {
    getRegions()
      .then(setRegions)
      .catch((err) => {
        console.error("[Regions] fetch failed:", err);
        setError("Could not load regions: " + (err?.message ?? "unknown error"));
      });
  }, []);

  useEffect(() => {
    const el = uploadBoxRef.current as any;
    if (!el || typeof window === "undefined") return;
    const node = el.getScrollableNode ? el.getScrollableNode() : el;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) setFile(f.name, f.type, URL.createObjectURL(f), f);
    };
    node.addEventListener("dragover", onDragOver);
    node.addEventListener("dragenter", onDragOver);
    node.addEventListener("dragleave", onDragLeave);
    node.addEventListener("drop", onDrop);
    return () => {
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragenter", onDragOver);
      node.removeEventListener("dragleave", onDragLeave);
      node.removeEventListener("drop", onDrop);
    };
  }, []);

  function validateStep1() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return false;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return false;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  }

  function validateStep2() {
    if (!address.trim() || !barangay.trim() || !province.trim()) {
      setError("Please fill in all address fields.");
      return false;
    }
    if (!regionId) {
      setError("Please select a region.");
      return false;
    }
    return true;
  }

  function handleNextStep() {
    setError(null);
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step < 3) setStep(step + 1);
  }

  async function handleSubmit() {
    setError(null);

    try {
      setLoading(true);

      let governmentIdKey: string | undefined;
      let governmentIdFileName: string | undefined;

      if (selectedFile) {
        governmentIdFileName = selectedFile.name;
        const uploadInfo = await getGovernmentIdUploadUrl({
          applicantRole: "citizen",
          applicantEmail: email.trim().toLowerCase(),
          fileName: governmentIdFileName,
        });

        let body: Blob;
        if (selectedFile.nativeFile) {
          body = selectedFile.nativeFile;
        } else {
          const r = await fetch(selectedFile.uri);
          body = await r.blob();
        }

        const uploadRes = await fetch(uploadInfo.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.mimeType },
          body,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload government ID image.");
        }

        governmentIdKey = uploadInfo.objectPath;
      }

      const result = await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role: AppRole.CITIZEN,
        governmentIdKey,
        governmentIdFileName,
        gender: gender || undefined,
        address: address.trim() || undefined,
        barangay: barangay.trim() || undefined,
        province: province.trim() || undefined,
        regionId: regionId || undefined,
      });

      const accessToken = result.access_token?.trim();
      if (!accessToken) throw new Error("Signup succeeded but no access token was returned.");

      await saveSession({
        accessToken,
        user: {
          ...result.user,
          authUserId: result.user.id,
        },
      });

      onSubmit();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const stepTitles = ["Account", "Location", "Details"];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Region picker modal */}
      <Modal visible={regionModalVisible} animationType="slide" transparent onRequestClose={() => setRegionModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: theme.line }}>
              <Text style={{ fontSize: 16, ...fonts.black, color: theme.text }}>Select Region</Text>
              <TouchableOpacity onPress={() => setRegionModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={regions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                  onPress={() => { setRegionId(item.id); setRegionName(item.name); setRegionModalVisible(false); }}
                >
                  <Text style={{ fontSize: 15, color: theme.text, ...fonts.medium }}>{item.name}</Text>
                  {regionId === item.id && <Ionicons name="checkmark" size={20} color="#004D40" />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: "center", padding: 24, color: theme.textMuted }}>No regions available</Text>}
            />
          </View>
        </View>
      </Modal>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button + header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 }}>
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: theme.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: theme.line,
              marginBottom: 24,
            }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>

          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: theme.secondarySoft,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: theme.secondaryDark,
                fontSize: 10,
                ...fonts.black,
                letterSpacing: 2,
              }}
            >
              REGISTRATION
            </Text>
          </View>
          <Text
            style={{
              color: theme.text,
              fontSize: 38,
              ...fonts.black,
              letterSpacing: -2,
              lineHeight: 44,
            }}
          >
            Create An{"\n"}Affected Citizen{"\n"}Account
          </Text>
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 15,
              ...fonts.medium,
              lineHeight: 24,
              marginTop: 10,
            }}
          >
            Sign up to generate your digital identity, access crisis alerts, and coordinate relief
            support.
          </Text>
        </View>

        {/* Step indicator */}
        <View style={s.stepRow}>
          {stepTitles.map((title, i) => {
            const idx = i + 1;
            const active = step === idx;
            const done = step > idx;
            return (
              <View key={title} style={s.stepItem}>
                <View
                  style={[
                    s.stepCircle,
                    active && s.stepCircleActive,
                    done && s.stepCircleDone,
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[s.stepNum, (active || done) && s.stepNumActive]}>{idx}</Text>
                  )}
                </View>
                <Text style={[s.stepLabel, (active || done) && s.stepLabelActive]}>{title}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: 24, gap: 20 }}>
          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <>
              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>First Name</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Maria"
                    placeholderTextColor={theme.textLight}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Last Name</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Santos"
                    placeholderTextColor={theme.textLight}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View>
                <Text style={s.label}>Email Address</Text>
                <TextInput
                  style={s.input}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View>
                <Text style={s.label}>Phone Number</Text>
                <TextInput
                  style={s.input}
                  placeholder="09XX XXX XXXX"
                  placeholderTextColor={theme.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View>
                <Text style={s.label}>Secure Password</Text>
                <TextInput
                  style={s.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={theme.textLight}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View>
                <Text style={s.label}>Confirm Password</Text>
                <TextInput
                  style={s.input}
                  placeholder="Repeat password"
                  placeholderTextColor={theme.textLight}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <>
              <View style={s.sectionBanner}>
                <Ionicons name="location" size={18} color="#2E7D32" style={{ marginRight: 10 }} />
                <Text style={s.sectionBannerText}>
                  Your address helps responders locate and prioritize your area during disasters.
                </Text>
              </View>

              <View>
                <Text style={s.label}>Street / House No. / Sitio</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 123 Sampaguita St."
                  placeholderTextColor={theme.textLight}
                  value={address}
                  onChangeText={setAddress}
                  autoCapitalize="words"
                />
              </View>

              <View>
                <Text style={s.label}>Barangay</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Barangay San Jose"
                  placeholderTextColor={theme.textLight}
                  value={barangay}
                  onChangeText={setBarangay}
                  autoCapitalize="words"
                />
              </View>

              <View>
                <Text style={s.label}>Region</Text>
                <TouchableOpacity
                  style={[s.input, { justifyContent: "center" }]}
                  onPress={() => setRegionModalVisible(true)}
                >
                  <Text style={{ color: regionName ? theme.text : theme.textLight, fontSize: 15 }}>
                    {regionName || "Select your region"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={s.label}>Province</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Albay"
                  placeholderTextColor={theme.textLight}
                  value={province}
                  onChangeText={setProvince}
                  autoCapitalize="words"
                />
              </View>
            </>
          )}

          {/* ── Step 3: Personal + ID Upload ── */}
          {step === 3 && (
            <>
              <View>
                <Text style={s.label}>Gender</Text>
                <View style={s.genderRow}>
                  {GENDERS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[s.genderChip, gender === g && s.genderChipActive]}
                      onPress={() => setGender(g === gender ? "" : g)}
                    >
                      <Text
                        style={[s.genderChipText, gender === g && s.genderChipTextActive]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={s.label}>Verify Identity (Government ID)</Text>
                <View
                  ref={uploadBoxRef}
                  style={[
                    s.uploadBox,
                    isDragging && s.uploadBoxDragging,
                  ]}
                >
                  <TouchableOpacity onPress={handlePickDocument} style={{ alignItems: "center", width: "100%" }}>
                    <View style={s.uploadIconBox}>
                      <Ionicons
                        name={selectedFile ? "checkmark-circle" : "cloud-upload"}
                        size={32}
                        color="#004D40"
                      />
                    </View>
                    <Text style={s.uploadTitle}>
                      {selectedFile ? "ID ATTACHED" : "UPLOAD ID"}
                    </Text>
                    <Text style={s.uploadSub}>
                      {selectedFile ? selectedFile.name : "Drag and drop or tap to browse"}
                    </Text>
                    {!selectedFile && (
                      <View style={s.uploadBadge}>
                        <Text style={s.uploadBadgeText}>JPG, PNG • MAX 5MB</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={s.uploadOptional}>Optional — you can upload this later in your profile</Text>
              </View>
            </>
          )}

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Navigation buttons */}
          {step < 3 ? (
            <TouchableOpacity style={s.nextBtn} onPress={handleNextStep}>
              <Text style={s.nextBtnText}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.nextBtn, loading && { backgroundColor: "#aaa" }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.nextBtnText}>SUBMIT REGISTRATION</Text>
                  <Ionicons name="arrow-forward" size={22} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          )}

          {step > 1 && (
            <TouchableOpacity
              style={s.backStepBtn}
              onPress={() => {
                setError(null);
                setStep(step - 1);
              }}
            >
              <Text style={s.backStepText}>Back to {stepTitles[step - 2]}</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <Text style={{ color: theme.textMuted, fontSize: 15, ...fonts.medium }}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={onBack}>
              <Text style={{ color: "#004D40", fontSize: 15, ...fonts.black }}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 0,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    borderColor: "#004D40",
    backgroundColor: "#004D40",
  },
  stepCircleDone: {
    borderColor: "#2E7D32",
    backgroundColor: "#2E7D32",
  },
  stepNum: {
    ...fonts.black,
    fontSize: 13,
    color: theme.textLight,
  },
  stepNumActive: {
    color: "#fff",
  },
  stepLabel: {
    ...fonts.bold,
    fontSize: 10,
    color: theme.textLight,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  stepLabelActive: {
    color: "#004D40",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    color: theme.textLight,
    fontSize: 11,
    ...fonts.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
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
  sectionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F1F8E9",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  sectionBannerText: {
    ...fonts.medium,
    fontSize: 13,
    color: "#2E7D32",
    lineHeight: 20,
    flex: 1,
  },
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  genderChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  genderChipActive: {
    backgroundColor: "#E8F5E9",
    borderColor: "#004D40",
  },
  genderChipText: {
    ...fonts.bold,
    fontSize: 14,
    color: theme.textMuted,
  },
  genderChipTextActive: {
    color: "#004D40",
  },
  uploadBox: {
    minHeight: 180,
    borderRadius: 32,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.lineMedium,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  uploadBoxDragging: {
    borderColor: "#004D40",
    backgroundColor: "rgba(0,77,64,0.05)",
    borderStyle: "solid",
  },
  uploadIconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(0,77,64,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  uploadTitle: {
    color: theme.text,
    fontSize: 18,
    ...fonts.black,
    textAlign: "center",
  },
  uploadSub: {
    color: theme.textMuted,
    fontSize: 13,
    ...fonts.medium,
    textAlign: "center",
    marginTop: 4,
  },
  uploadBadge: {
    marginTop: 12,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
  },
  uploadBadgeText: {
    color: theme.textLight,
    fontSize: 10,
    ...fonts.bold,
    letterSpacing: 1,
  },
  uploadOptional: {
    ...fonts.medium,
    fontSize: 11,
    color: theme.textLight,
    marginTop: 8,
    marginLeft: 4,
  },
  errorBox: {
    backgroundColor: "#FFF0F0",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FFCCCC",
  },
  errorText: {
    color: "#C0392B",
    fontSize: 14,
    ...fonts.medium,
  },
  nextBtn: {
    height: 68,
    backgroundColor: "#004D40",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#004D40",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    marginTop: 8,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 17,
    ...fonts.black,
    letterSpacing: 1,
  },
  backStepBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  backStepText: {
    ...fonts.bold,
    fontSize: 14,
    color: theme.textMuted,
  },
});
