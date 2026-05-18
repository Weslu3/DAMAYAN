import React, { useState, useRef, useEffect } from "react";
import { Text, View, Pressable, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Button, Input, Pill, Screen, SectionCard } from "../../components/UI";
import { theme, fonts } from "../../theme";
import { citizenStyles } from "../shared";
import { signup, login, getProfile, ApiError } from "../../api";
import { saveSession } from "../../session";

export function CitizenSignupScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadBoxRef = useRef<View>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validateAndSetFile = (file: { name: string; type?: string }) => {
    const fileName = file.name.toLowerCase();
    const isAllowedType = file.type === "image/jpeg" || file.type === "image/png";
    const isAllowedExt = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");
    
    if (isAllowedType || isAllowedExt) {
      setSelectedFileName(file.name);
      return true;
    } else {
      alert("Invalid file type. Please upload a JPG or PNG image.");
      return false;
    }
  };

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png"],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        validateAndSetFile(result.assets[0]);
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
      if (e.dataTransfer?.files) validateAndSetFile(e.dataTransfer.files[0]);
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

  const handleRegister = async () => {
    if (!fullName.trim() || !username.trim() || !phone.trim() || !password.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "Citizen";
      const email = username.includes("@") ? username.trim().toLowerCase() : `${username.trim().toLowerCase()}@damayan.org`;

      // 1. Signup the user via gateway
      await signup({
        firstName,
        lastName,
        email,
        phone,
        password,
        role: "citizen",
      });

      // 2. Perform automatic login to fetch access token
      const result = await login({
        email,
        password,
        requiredRole: "citizen",
      });

      const accessToken = result.access_token?.trim();
      if (!accessToken) {
        throw new Error("No access token returned after auto-login.");
      }

      // 3. Fetch profile and store session
      const profile = await getProfile(accessToken);
      await saveSession({
        accessToken,
        expiresIn: result.expiresIn,
        user: profile.user,
      });

      // 4. Redirect
      onSubmit();
    } catch (err: any) {
      console.error("Signup registration failed:", err);
      const msg = err instanceof ApiError ? err.message : "Unable to complete registration. Check your network or details.";
      alert("Registration Failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

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
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Full Legal Name</Text>
              <Input 
                placeholder="e.g. Samuel Aristha" 
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Create Username</Text>
              <Input 
                placeholder="citizen.unique.id" 
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Phone Number</Text>
              <Input 
                placeholder="e.g. 09171234567" 
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textLight, fontSize: 11, ...fonts.bold, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 4 }}>Secure Password</Text>
              <Input 
                placeholder="••••••••••••" 
                value={password}
                onChangeText={setPassword}
                secureTextEntry 
              />
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
                    padding: 24
                  },
                  isDragging && { borderColor: "#004D40", backgroundColor: "rgba(0, 77, 64, 0.05)", borderStyle: "solid" }
                ]}
              >
                <TouchableOpacity onPress={handlePickDocument} style={{ alignItems: "center", width: "100%" }}>
                  <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "rgba(0, 77, 64, 0.1)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Ionicons name={selectedFileName ? "checkmark-circle" : "cloud-upload"} size={32} color="#004D40" />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 18, ...fonts.black, textAlign: "center" }}>
                    {selectedFileName ? "ID ATTACHED" : "UPLOAD ID"}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 13, ...fonts.medium, textAlign: "center", marginTop: 4 }}>
                    {selectedFileName ? selectedFileName : "Drag and drop or tap to browse"}
                  </Text>
                  {!selectedFileName && (
                     <View style={{ marginTop: 12, backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.line }}>
                        <Text style={{ color: theme.textLight, fontSize: 10, ...fonts.bold, letterSpacing: 1 }}>JPG, PNG • MAX 5MB</Text>
                     </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={handleRegister} 
            disabled={loading}
            style={{ 
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
              marginTop: 12,
              opacity: loading ? 0.6 : 1
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
