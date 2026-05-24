import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { theme, fonts } from "../../theme";
import {
  getFamilyGroup,
  createFamilyGroup,
  addFamilyGroupMember,
  removeFamilyGroupMember,
  deleteFamilyGroup,
  registerCitizen,
  type CitizenProfile,
  type FamilyGroup,
} from "../../api";
import { loadSession } from "../../session";
import { CitizenFamilyGroupScannerScreen } from "./CitizenFamilyGroupScannerScreen";

interface CitizenFamilyGroupScreenProps {
  onBack: () => void;
  personalQrCodeId?: string;
  citizenDisplayName?: string;
  citizenProfile?: CitizenProfile | null;
  onRefreshProfile?: () => Promise<void>;
}

export function CitizenFamilyGroupScreen({
  onBack,
  personalQrCodeId,
  citizenDisplayName,
  citizenProfile,
  onRefreshProfile,
}: CitizenFamilyGroupScreenProps) {
  const [token, setToken] = useState<string | null>(null);
  const [group, setGroup] = useState<FamilyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [generatingPersonalQr, setGeneratingPersonalQr] = useState(false);
  const [generatedPersonalQrCodeId, setGeneratedPersonalQrCodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"family" | "personal">("family");
  const effectivePersonalQrCodeId = generatedPersonalQrCodeId ?? personalQrCodeId;

  const loadGroup = useCallback(async (tok: string) => {
    try {
      const g = await getFamilyGroup(tok);
      setGroup(g);
    } catch {
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession().then((s) => {
      if (!s) return;
      setToken(s.accessToken);
      loadGroup(s.accessToken);
    });
  }, []);

  useEffect(() => {
    if (!token || activeTab !== "family") return;

    // Keep family membership in sync across multiple devices/sessions.
    const intervalId = setInterval(() => {
      loadGroup(token);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [token, activeTab, loadGroup]);

  const handleCreate = async () => {
    if (!token) return;
    try {
      setCreating(true);
      setError(null);
      const g = await createFamilyGroup(token, familyName.trim() || undefined);
      setGroup(g);
      setShowCreateModal(false);
      setFamilyName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create family group.");
    } finally {
      setCreating(false);
    }
  };

  const handleMemberScanned = async (qrCode: string, fullName: string) => {
    if (!token || !group) return;
    setShowScanner(false);
    setAddingMember(true);
    setError(null);
    try {
      await addFamilyGroupMember(token, { citizenQrCodeId: qrCode });
      await loadGroup(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add member.";
      setError(msg);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = (qrCodeId: string, name: string) => {
    Alert.alert(
      "Remove Member",
      `Remove ${name} from the family group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!token || !group) return;
            try {
              await removeFamilyGroupMember(token, qrCodeId);
              setGroup((prev) =>
                prev ? { ...prev, members: prev.members.filter((m) => m.citizenQrCodeId !== qrCodeId) } : prev,
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove member.");
            }
          },
        },
      ],
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete Family Group",
      "This will permanently delete the shared QR code. All members must re-register individually at evacuation centers.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await deleteFamilyGroup(token);
              setGroup(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not delete group.");
            }
          },
        },
      ],
    );
  };

  const handleGeneratePersonalQr = async () => {
    if (!token) return;

    try {
      setGeneratingPersonalQr(true);
      setError(null);

      const fullName =
        citizenProfile?.fullName
        || [citizenProfile?.firstName, citizenProfile?.lastName].filter(Boolean).join(" ")
        || citizenDisplayName
        || "Citizen";

      const result = await registerCitizen(token, {
        fullName,
        birthDate: citizenProfile?.birthDate,
        gender: citizenProfile?.gender,
        bloodType: citizenProfile?.bloodType,
        medicalConditions: citizenProfile?.medicalConditions,
        registrationType: (citizenProfile?.registrationType as "Individual" | "Family") || "Individual",
      });

      if (result?.qrCodeId) {
        setGeneratedPersonalQrCodeId(result.qrCodeId);
      }
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
      Alert.alert("QR ID Generated", "Your personal QR ID is now ready for check-in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate personal QR ID.");
    } finally {
      setGeneratingPersonalQr(false);
    }
  };

  if (showScanner) {
    return (
      <CitizenFamilyGroupScannerScreen
        onBack={() => setShowScanner(false)}
        onScanned={handleMemberScanned}
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family & ID</Text>
        {activeTab === "family" && group ? (
          <TouchableOpacity onPress={handleDeleteGroup} style={styles.deleteHeaderBtn}>
            <Ionicons name="trash-outline" size={20} color={theme.danger ?? "#C0392B"} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "family" && styles.tabBtnActive]}
          onPress={() => setActiveTab("family")}
        >
          <Ionicons name={activeTab === "family" ? "people" : "people-outline"} size={16} color={activeTab === "family" ? "#fff" : theme.textLight} />
          <Text style={[styles.tabBtnText, activeTab === "family" && styles.tabBtnTextActive]}>FAMILY QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "personal" && styles.tabBtnActive]}
          onPress={() => setActiveTab("personal")}
        >
          <Ionicons name={activeTab === "personal" ? "qr-code" : "qr-code-outline"} size={16} color={activeTab === "personal" ? "#fff" : theme.textLight} />
          <Text style={[styles.tabBtnText, activeTab === "personal" && styles.tabBtnTextActive]}>MY QR</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#C0392B" />
          </TouchableOpacity>
        </View>
      ) : null}

      {addingMember && (
        <View style={styles.addingBanner}>
          <ActivityIndicator size="small" color="#2E7D32" />
          <Text style={styles.addingText}>Adding member...</Text>
        </View>
      )}

      {/* Personal QR Tab */}
      {activeTab === "personal" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {effectivePersonalQrCodeId ? (
            <View style={styles.personalQrCard}>
              <View style={styles.qrCardBadge}>
                <View style={styles.qrBadgeDot} />
                <Text style={styles.qrBadgeText}>YOUR DIGITAL ID</Text>
              </View>
              {citizenDisplayName && (
                <Text style={styles.familyNameText}>{citizenDisplayName}</Text>
              )}
              <Text style={styles.qrSubtitle}>Show this QR at evacuation centers for personal check-in</Text>
              <View style={styles.qrWrapper}>
                <QRCode value={effectivePersonalQrCodeId} size={200} backgroundColor="#fff" color="#000" />
              </View>
              <Text style={styles.qrCodeId}>{effectivePersonalQrCodeId}</Text>
              <Text style={styles.qrHint}>Keep this accessible during emergencies</Text>
            </View>
          ) : (
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Ionicons name="qr-code-outline" size={48} color={theme.primary} />
              </View>
              <Text style={styles.emptyTitle}>No QR ID Yet</Text>
              <Text style={styles.emptyDesc}>
                Complete your registration to receive a personal Digital ID QR code for evacuation check-in.
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, generatingPersonalQr && { opacity: 0.7 }]}
                onPress={handleGeneratePersonalQr}
                disabled={generatingPersonalQr}
              >
                {generatingPersonalQr ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="qr-code-outline" size={22} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.createBtnText}>GENERATE MY QR ID</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {activeTab === "family" && !group && (
        /* ── No group yet ── */
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people" size={56} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Family Group Yet</Text>
          <Text style={styles.emptyDesc}>
            Create a shared QR code for your family. Then scan each family member's individual QR
            to add them. One scan at the evacuation center checks everyone in together.
          </Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.createBtnText}>CREATE FAMILY GROUP</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === "family" && !!group && (
        /* ── Group exists ── */
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Shared QR Card */}
          <View style={styles.qrCard}>
            <View style={styles.qrCardBadge}>
              <View style={styles.qrBadgeDot} />
              <Text style={styles.qrBadgeText}>SHARED FAMILY QR CODE</Text>
            </View>
            <Text style={styles.familyNameText}>{group.familyName ?? "Family Group"}</Text>
            <Text style={styles.qrSubtitle}>Show this code at the evacuation center to check in all {group.members.length + 1} member{group.members.length !== 0 ? "s" : ""}</Text>

            <View style={styles.qrWrapper}>
              <QRCode
                value={group.familyQrCodeId}
                size={200}
                backgroundColor="#fff"
                color="#000"
              />
            </View>

            <Text style={styles.qrCodeId}>{group.familyQrCodeId}</Text>
            <Text style={styles.qrHint}>
              {group.members.length === 0
                ? "Add family members below to include them in group check-in"
                : `Covers ${group.members.length} family member${group.members.length > 1 ? "s" : ""}`}
            </Text>
          </View>

          {/* How it works */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How it works</Text>
            {[
              { icon: "qr-code-outline", text: "Scan each family member's individual QR code below to add them to the group" },
              { icon: "people-outline", text: "At an evacuation center, show this shared QR once to the site manager" },
              { icon: "checkmark-circle-outline", text: "All members are checked in together — no need to scan one by one" },
            ].map((step, i) => (
              <View key={i} style={styles.infoStep}>
                <View style={styles.infoStepIcon}>
                  <Ionicons name={step.icon as any} size={20} color={theme.primary} />
                </View>
                <Text style={styles.infoStepText}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* Members list */}
          <View style={styles.membersSection}>
            <View style={styles.membersSectionHeader}>
              <Text style={styles.membersSectionTitle}>
                Members ({group.members.length})
              </Text>
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => setShowScanner(true)}
                disabled={addingMember}
              >
                <Ionicons name="scan" size={18} color="#fff" />
                <Text style={styles.addMemberBtnText}>SCAN & ADD</Text>
              </TouchableOpacity>
            </View>

            {group.members.length === 0 ? (
              <View style={styles.emptyMembersCard}>
                <Ionicons name="person-add-outline" size={32} color={theme.textLight} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyMembersText}>
                  No members added yet. Tap "SCAN & ADD" to scan a family member's QR code.
                </Text>
              </View>
            ) : (
              group.members.map((member, index) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {(member.memberFullName ?? "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.memberFullName ?? "Unknown"}</Text>
                    <Text style={styles.memberQr}>{member.citizenQrCodeId}</Text>
                    {member.relationship && (
                      <View style={styles.relBadge}>
                        <Text style={styles.relBadgeText}>{member.relationship.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member.citizenQrCodeId, member.memberFullName ?? "this member")}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close-circle" size={24} color={theme.textLight} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* Create Family Group Modal */}

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Family Group</Text>
            <Text style={styles.modalDesc}>
              A shared QR code will be generated for your family. You can name the group for easy identification.
            </Text>
            <Text style={styles.inputLabel}>FAMILY NAME (optional)</Text>
            <TextInput
              style={styles.nameInput}
              value={familyName}
              onChangeText={setFamilyName}
              placeholder="e.g. Santos Family"
              placeholderTextColor={theme.textLight}
            />
            {error && <Text style={styles.modalError}>{error}</Text>}
            <TouchableOpacity
              style={[styles.modalCreateBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalCreateBtnText}>CREATE GROUP</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
  },
  deleteHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF0F0",
    borderBottomWidth: 1,
    borderBottomColor: "#FFCCCC",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorBannerText: {
    ...fonts.bold,
    fontSize: 13,
    color: "#C0392B",
    flex: 1,
    marginRight: 12,
  },
  addingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#C8E6C9",
  },
  addingText: {
    ...fonts.bold,
    fontSize: 13,
    color: "#2E7D32",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    ...fonts.black,
    fontSize: 26,
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: "center",
  },
  emptyDesc: {
    ...fonts.medium,
    fontSize: 15,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#004D40",
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: "#004D40",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  createBtnText: {
    ...fonts.black,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 1,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.line,
  },
  tabBtnActive: {
    backgroundColor: "#004D40",
    borderColor: "#004D40",
  },
  tabBtnText: {
    ...fonts.black,
    fontSize: 11,
    color: theme.textLight,
    letterSpacing: 1,
  },
  tabBtnTextActive: {
    color: "#fff",
  },
  personalQrCard: {
    backgroundColor: "#fff",
    borderRadius: 36,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 24,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 36,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 24,
  },
  qrCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  qrBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2E7D32",
  },
  qrBadgeText: {
    ...fonts.black,
    fontSize: 9,
    color: "#2E7D32",
    letterSpacing: 1.5,
  },
  familyNameText: {
    ...fonts.black,
    fontSize: 26,
    color: theme.text,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 6,
  },
  qrSubtitle: {
    ...fonts.medium,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
  },
  qrWrapper: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 16,
  },
  qrCodeId: {
    ...fonts.black,
    fontSize: 14,
    color: theme.text,
    letterSpacing: 1,
    marginBottom: 8,
  },
  qrHint: {
    ...fonts.medium,
    fontSize: 12,
    color: theme.textLight,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#F1F8E9",
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  infoTitle: {
    ...fonts.black,
    fontSize: 16,
    color: "#2E7D32",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  infoStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14,
  },
  infoStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoStepText: {
    ...fonts.medium,
    fontSize: 13,
    color: "#2E7D32",
    lineHeight: 20,
    flex: 1,
    paddingTop: 8,
  },
  membersSection: {
    gap: 12,
  },
  membersSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  membersSectionTitle: {
    ...fonts.black,
    fontSize: 20,
    color: theme.text,
    letterSpacing: -0.3,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#004D40",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addMemberBtnText: {
    ...fonts.black,
    fontSize: 11,
    color: "#fff",
    letterSpacing: 1,
  },
  emptyMembersCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.line,
    borderStyle: "dashed",
  },
  emptyMembersText: {
    ...fonts.medium,
    fontSize: 14,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 14,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    ...fonts.black,
    fontSize: 20,
    color: "#2E7D32",
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    ...fonts.black,
    fontSize: 16,
    color: theme.text,
  },
  memberQr: {
    ...fonts.bold,
    fontSize: 11,
    color: theme.textLight,
  },
  relBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  relBadgeText: {
    ...fonts.black,
    fontSize: 9,
    color: "#2E7D32",
    letterSpacing: 0.8,
  },
  removeBtn: {
    padding: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 36,
    paddingBottom: 48,
  },
  modalTitle: {
    ...fonts.black,
    fontSize: 26,
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  modalDesc: {
    ...fonts.medium,
    fontSize: 14,
    color: theme.textMuted,
    lineHeight: 20,
    marginBottom: 28,
  },
  inputLabel: {
    ...fonts.black,
    fontSize: 10,
    color: theme.textLight,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 58,
    ...fonts.bold,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.line,
    marginBottom: 20,
  },
  modalError: {
    ...fonts.bold,
    fontSize: 13,
    color: "#C0392B",
    marginBottom: 16,
  },
  modalCreateBtn: {
    height: 64,
    backgroundColor: "#004D40",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#004D40",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 12,
  },
  modalCreateBtnText: {
    ...fonts.black,
    fontSize: 16,
    color: "#fff",
    letterSpacing: 1,
  },
  modalCancelBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    ...fonts.bold,
    fontSize: 15,
    color: theme.textMuted,
  },
});
