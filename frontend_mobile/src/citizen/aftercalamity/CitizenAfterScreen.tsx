import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, SectionCard, Pill } from "../../components/UI";
import { theme, fonts } from "../../theme";
import { citizenStyles } from "../shared";

type AfterStep = "relief_claim" | "all_clear" | "exit_decision" | "final_credentials" | "end";

export default function CitizenAfterScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<AfterStep>("relief_claim");
  const [leaving, setLeaving] = useState<boolean | null>(null);

  const renderStep = () => {
    switch (step) {
      case "relief_claim":
        return (
          <View style={styles.stepContainer}>
            <SectionCard style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="gift" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Claim Relief Pack</Text>
              <Text style={styles.desc}>Present your unique Digital ID at the distribution point to claim your allocated relief resources.</Text>
              
              <View style={styles.statusList}>
                <View style={styles.statusItem}>
                   <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                   <Text style={styles.statusText}>Digital ID Verified</Text>
                </View>
                <View style={styles.statusItem}>
                   <Ionicons name="time" size={24} color={theme.warning} />
                   <Text style={styles.statusText}>Awaiting QR Scan</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("all_clear")}>
                <Ionicons name="qr-code" size={22} color="#fff" />
                <Text style={styles.btnText}>OPEN DIGITAL ID</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        );

      case "all_clear":
        return (
          <View style={styles.stepContainer}>
            <SectionCard style={[styles.card, { borderColor: theme.success }]}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(46, 125, 50, 0.1)" }]}>
                <Ionicons name="notifications-circle" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>All Clear Issued</Text>
              <Text style={styles.desc}>Authorities have declared your sector safe. You may now prepare to return to your residence.</Text>
              
              <View style={styles.infoBox}>
                 <Text style={styles.infoText}>⚠️ Utilities (Power/Water) are still being stabilized in some blocks.</Text>
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={() => setStep("exit_decision")}>
                <Text style={styles.btnText}>ACKNOWLEDGE & CONTINUE</Text>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </SectionCard>
          </View>
        );

      case "exit_decision":
        return (
          <View style={styles.stepContainer}>
            <SectionCard style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="help-circle" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Leaving Center?</Text>
              <Text style={styles.desc}>Are you planning to check out from the evacuation facility now that the All-Clear has been issued?</Text>
              
              <View style={styles.btnRow}>
                <Pressable 
                  style={[styles.choiceBtn, leaving === false && styles.choiceBtnActive]} 
                  onPress={() => setLeaving(false)}
                >
                  <Ionicons name="home" size={32} color={leaving === false ? "#fff" : theme.textMuted} />
                  <Text style={[styles.choiceText, leaving === false && { color: "#fff" }]}>STAY{"\n"}LONGER</Text>
                </Pressable>

                <Pressable 
                  style={[styles.choiceBtn, leaving === true && styles.choiceBtnActive]} 
                  onPress={() => setLeaving(true)}
                >
                  <Ionicons name="exit" size={32} color={leaving === true ? "#fff" : theme.textMuted} />
                  <Text style={[styles.choiceText, leaving === true && { color: "#fff" }]}>LEAVE{"\n"}NOW</Text>
                </Pressable>
              </View>

              <TouchableOpacity 
                disabled={leaving === null}
                style={[styles.primaryBtn, leaving === null && { opacity: 0.5 }]} 
                onPress={() => leaving ? setStep("final_credentials") : setStep("end")}
              >
                <Text style={styles.btnText}>CONFIRM DECISION</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        );

      case "final_credentials":
        return (
          <View style={styles.stepContainer}>
            <SectionCard style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="id-card" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Final Exit Check</Text>
              <Text style={styles.desc}>Please present your Digital ID to the gate coordinator to finalize your check-out process.</Text>
              
              <View style={styles.qrPlaceholder}>
                 <Ionicons name="qr-code" size={160} color={theme.text} />
                 <Text style={styles.qrLabel}>ELENA VILLACRUZ</Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("end")}>
                <Text style={styles.btnText}>FINALIZE CHECKOUT</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        );

      case "end":
        return (
          <View style={styles.stepContainer}>
            <SectionCard style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="heart" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Safe Travels</Text>
              <Text style={styles.desc}>Your records have been updated. We wish you a safe return to your home. Stay vigilant!</Text>
              
              <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
                <Text style={styles.secondaryBtnText}>BACK TO DASHBOARD</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recovery Flow</Text>
          <Text style={styles.headerSub}>Follow the steps to ensure a safe transition.</Text>
        </View>
        {renderStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 24, paddingBottom: 160 },
  header: { marginBottom: 32, paddingHorizontal: 8 },
  headerTitle: { ...fonts.black, fontSize: 32, color: theme.text, letterSpacing: -1.5 },
  headerSub: { ...fonts.medium, fontSize: 16, color: theme.textLight, marginTop: 4, lineHeight: 24 },
  stepContainer: { flex: 1 },
  card: { padding: 32, alignItems: "center", borderRadius: 40, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.line, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 28, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { ...fonts.black, fontSize: 28, color: theme.text, textAlign: "center", marginBottom: 12, letterSpacing: -1 },
  desc: { ...fonts.medium, fontSize: 16, color: theme.textMuted, textAlign: "center", lineHeight: 26, marginBottom: 32 },
  statusList: { width: "100%", gap: 16, marginBottom: 32 },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: theme.surfaceAlt, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: theme.line },
  statusText: { ...fonts.bold, fontSize: 16, color: theme.text },
  primaryBtn: { width: "100%", height: 68, backgroundColor: theme.primary, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  btnText: { ...fonts.black, fontSize: 16, color: "#fff", letterSpacing: 2 },
  infoBox: { backgroundColor: "rgba(255, 179, 0, 0.08)", padding: 20, borderRadius: 20, marginBottom: 32, borderWidth: 1, borderColor: "rgba(255, 179, 0, 0.2)" },
  infoText: { ...fonts.bold, fontSize: 13, color: "#8f5d00", textAlign: "center", lineHeight: 20 },
  btnRow: { 
    flexDirection: "row", 
    gap: 20, 
    marginBottom: 40,
    width: "100%",
  },
  choiceBtn: { 
    flex: 1, 
    minHeight: 140, 
    borderRadius: 32, 
    backgroundColor: theme.surface, 
    borderWidth: 1.5, 
    borderColor: theme.line, 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 20,
    gap: 16,
  },
  choiceBtnActive: { 
    backgroundColor: theme.primary, 
    borderColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  choiceText: { 
    ...fonts.black, 
    fontSize: 14, 
    color: theme.textMuted,
    textAlign: "center",
    letterSpacing: 1,
  },
  qrPlaceholder: { padding: 40, backgroundColor: "#fff", borderRadius: 32, marginBottom: 32, alignItems: "center", borderWidth: 1.5, borderColor: theme.line, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20 },
  qrLabel: { ...fonts.black, fontSize: 14, color: theme.textMuted, marginTop: 24, letterSpacing: 2 },
  secondaryBtn: { marginTop: 12, padding: 20, width: "100%", alignItems: "center", backgroundColor: theme.surfaceAlt, borderRadius: 24, borderWidth: 1, borderColor: theme.line },
  secondaryBtnText: { ...fonts.black, fontSize: 14, color: theme.primary, letterSpacing: 1.5 },
});
