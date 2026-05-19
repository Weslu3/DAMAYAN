import React, { useState, useRef, useEffect } from "react";
import { Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Input, Screen } from "../../components/UI";
import { theme, fonts } from "../../theme";
import { signup, getGovernmentIdUploadUrl, ApiError } from "../../api";
import { saveSession } from "../../session";
import { AppRole } from "../../types";

interface SelectedFile {
  name: string;
  mimeType: string;
  uri: string;
  nativeFile?: File;
}

export function CitizenSignupScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadBoxRef = useRef<View>(null);

  function setFile(name: string, mimeType: string, uri: string, nativeFile?: File) {
    const fileName = name.toLowerCase();
    const isAllowedType = mimeType === "image/jpeg" || mimeType === "image/png";
    const isAllowedExt = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");
    if (isAllowedType || isAllowedExt) {
      setSelectedFile({ name, mimeType: mimeType || "image/jpeg", uri, nativeFile });
    } else {
      setError("Invalid file type. Please upload a JPG or PNG image.");
    }
  }

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png"] });
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setFile(a.name, a.mimeType ?? "", a.uri);
      }
    } catch (err) {
      console.error("Error picking document:", err);
    }
  }

  useEffect(() => {
    const el = uploadBoxRef.current as any;
    if (!el || typeof window === "undefined") return;
    const node = el.getScrollableNode ? el.getScrollableNode() : el;

    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
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

  async function handleSubmit() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

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
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}>
          <TouchableOpacity onPress={onBack} style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.line, marginBottom: 24 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>

          <View style={{ alignSelf: "flex-start", backgroundColor: theme.secondarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ color: theme.secondaryDark, fontSize: 10, ...fonts.black, letterSpacing: 2 }}>REGISTRATION</Text>
          </View>
          <Text style={{ color: theme.text, fontSize: 42, ...fonts.black, letterSpacing: -2, lineHeight: 48 }}>Create An{"\n"}Affected Citizen Account</Text>
          <Text style={{ color: theme.textMuted, fontSize: 16, ...fonts.medium, lineHeight: 26, marginTop: 12 }}>
            Sign up to generate your digital identity, access crisis alerts, and coordinate relief support within our secure sanctuary.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 24 }}>
          <View style={{ gap: 20 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>First Name</Text>
                <Input placeholder="e.g. Samuel" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Last Name</Text>
                <Input placeholder="e.g. Aristha" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Email Address</Text>
              <Input placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Phone Number</Text>
              <Input placeholder="09XX XXX XXXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Secure Password</Text>
              <Input placeholder="••••••••••••" secureTextEntry value={password} onChangeText={setPassword} />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Verify Identity (Government ID)</Text>
              <View
                ref={uploadBoxRef}
                style={[
                  {
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
                  isDragging && { borderColor: "#004D40", backgroundColor: "rgba(0, 77, 64, 0.05)", borderStyle: "solid" },
                ]}
              >
                <TouchableOpacity onPress={handlePickDocument} style={{ alignItems: "center", width: "100%" }}>
                  <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "rgba(0, 77, 64, 0.1)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Ionicons name={selectedFile ? "checkmark-circle" : "cloud-upload"} size={32} color="#004D40" />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 18, ...fonts.black, textAlign: "center" }}>
                    {selectedFile ? "ID ATTACHED" : "UPLOAD ID"}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 13, ...fonts.medium, textAlign: "center", marginTop: 4 }}>
                    {selectedFile ? selectedFile.name : "Drag and drop or tap to browse"}
                  </Text>
                  {!selectedFile && (
                    <View style={{ marginTop: 12, backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.line }}>
                      <Text style={{ color: theme.textLight, fontSize: 10, ...fonts.bold, letterSpacing: 1 }}>JPG, PNG • MAX 5MB</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {error ? (
            <View style={{ backgroundColor: "#FFF0F0", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#FFCCCC" }}>
              <Text style={{ color: "#C0392B", fontSize: 14, ...fonts.medium }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              height: 68,
              backgroundColor: loading ? "#aaa" : "#004D40",
              borderRadius: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              shadowColor: "#004D40",
              shadowOpacity: loading ? 0 : 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
              marginTop: 12,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={{ color: "#fff", fontSize: 18, ...fonts.black, letterSpacing: 1 }}>SUBMIT REGISTRATION</Text>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <Text style={{ color: theme.textMuted, fontSize: 15, ...fonts.medium }}>Already have an account? </Text>
            <TouchableOpacity onPress={onBack}>
              <Text style={{ color: "#004D40", fontSize: 15, ...fonts.black }}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
