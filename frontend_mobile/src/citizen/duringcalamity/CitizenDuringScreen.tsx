import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme, fonts } from "../../theme";
import { styles } from "./CitizenDuringScreen.styles";
import { submitIncidentReport } from "../../api";

// ─── Types ────────────────────────────────────────────────────────────────────
type DuringStep =
  | "rescue_decision"
  | "report_incident"
  | "self_evacuate"
  | "internet_decision"
  | "upload_photo"
  | "sms_code"
  | "delivery_confirmation"
  | "safe_zone_map"
  | "navigate_evacuation"
  | "arrive_site"
  | "credential_check"
  | "logged_in";

const STEP_ORDER: DuringStep[] = [
  "rescue_decision",
  "report_incident",
  "internet_decision",
  "upload_photo",
  "delivery_confirmation",
  "safe_zone_map",
  "navigate_evacuation",
  "arrive_site",
  "credential_check",
  "logged_in",
];

const QR_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCrX9Nqu19-hAhpO8rM-9DherTik7ptpsbnrQch9rvtbUQAhyhNf6D82iXcimlfey1XA3K9KgtUzbPxxm-S6NOSLrPT2QbRg82ettvfR239M-w2yBxNuNvAzeNmsH8Z9eMuTpCZPxC00vxBqfNGsnYaX-q-X5i8K3GQ5NzGpBF0W3QdP16xUgAAoybfEuVWOiYqtxjrzlKjuijxK_qGRfvSnb2JDR-r7rMdsKlZxORTjU73kQrDnzs5PeBpIPiP-k6oUhY45_7jXYxy";

// ─── Pulsating Dot ────────────────────────────────────────────────────────────
function PulsatingDot({ color = theme.danger }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 4, duration: 1600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[styles.radarRing, { backgroundColor: color, transform: [{ scale }], opacity }]}
      />
      <View style={[styles.coreDot, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  const progress = Math.min((step / (STEP_ORDER.length - 1)) * 100, 100);
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressLabel}>Response Progress — {Math.round(progress)}%</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function CitizenDuringScreen({ 
  onBack,
  initialStep = "rescue_decision",
  session,
  authUser,
}: { 
  onBack: () => void;
  initialStep?: string;
  session: any;
  authUser: any;
}) {
  const [step, setStep] = useState<DuringStep>("rescue_decision");
  const [rescueNeeded, setRescueNeeded] = useState<boolean | null>(null);
  const [internetAvailable, setInternetAvailable] = useState<boolean | null>(null);
  const [isIndividual, setIsIndividual] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUploadAndSend = async () => {
    if (!session?.accessToken) {
      Alert.alert("Authentication Error", "You must be logged in to submit a report.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        title: "Citizen SOS Report",
        content: "Citizen needs immediate rescue. Location details: Brgy. 102, District 4 - Zone Red. Affected: 4 persons.",
        severity: "high",
        location: "Brgy. 102, District 4 - Zone Red",
      };

      await submitIncidentReport(session.accessToken, payload);
      go("delivery_confirmation");
    } catch (err: any) {
      console.error("Failed to submit incident report:", err);
      Alert.alert("Submission Failed", err?.message || "Something went wrong while uploading your report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (initialStep === "map") setStep("safe_zone_map");
    else if (initialStep === "decision") setStep("rescue_decision");
    else if (initialStep) setStep(initialStep as DuringStep);
  }, [initialStep]);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  function go(next: DuringStep) {
    setStep(next);
  }

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Response Center</Text>
          <Text style={styles.topBarPhase}>Calamity Mode Active</Text>
        </View>
        <View style={styles.alertBadge}>
          <Ionicons name="alert" size={24} color={theme.danger} />
        </View>
      </View>

      <ProgressBar step={stepIndex} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── STEP 0: Rescue Decision ───────────────────────────────────────── */}
        {step === "rescue_decision" && (
          <View style={styles.decisionCard}>
            <View style={[styles.decisionIconWrap, { backgroundColor: "rgba(186, 26, 26, 0.08)" }]}>
              <Ionicons name="alert-circle" size={40} color={theme.danger} />
            </View>
            <View>
              <Text style={[styles.decisionLabel, { color: theme.danger }]}>Situation Assessment</Text>
              <Text style={styles.decisionTitle}>Are you in need of{"\n"}Immediate Rescue?</Text>
            </View>
            <Text style={styles.decisionCopy}>
              Select your current situation so we can route you to the correct emergency protocol immediately.
            </Text>
            <View style={styles.decisionOptions}>
              <Pressable
                style={[styles.optionButtonYes, { backgroundColor: theme.danger }]}
                onPress={() => { setRescueNeeded(true); go("report_incident"); }}
              >
                <Ionicons name="hand-left" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>YES — I need rescue</Text>
              </Pressable>
              <Pressable
                style={styles.optionButtonNo}
                onPress={() => { setRescueNeeded(false); go("self_evacuate"); }}
              >
                <Ionicons name="walk" size={24} color={theme.text} />
                <Text style={styles.optionButtonTextDark}>NO — Self Evacuate</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 1a: Report Incident ──────────────────────────────────────── */}
        {step === "report_incident" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(186, 26, 26, 0.08)" }]}>
              <Ionicons name="megaphone" size={36} color={theme.danger} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.danger }]}>Rescue Requested</Text>
              <Text style={styles.stepTitle}>Report Incident</Text>
            </View>
            <Text style={styles.stepCopy}>
              Provide your current situation so dispatchers can prioritize and route a rescue team to you.
            </Text>

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons name="location" size={24} color={theme.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Location Detected</Text>
                <Text style={styles.infoRowSub}>Brgy. 102, District 4 — Zone Red</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.warning }]}>
              <Ionicons name="people" size={24} color={theme.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Persons Affected: 4</Text>
                <Text style={styles.infoRowSub}>2 adults, 1 child, 1 senior</Text>
              </View>
            </View>

            <View style={styles.uploadBox}>
              {photoUri ? (
                <View style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden" }}>
                   <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} />
                   <Pressable onPress={() => setPhotoUri(null)} style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 12 }}>
                      <Ionicons name="close" size={20} color="#fff" />
                   </Pressable>
                </View>
              ) : (
                <>
                  <Ionicons name="camera" size={40} color={theme.primary} />
                  <Text style={styles.uploadBoxTitle}>Attach Photo Evidence</Text>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity onPress={handleTakePhoto} style={styles.ghostButton}>
                      <Text style={styles.ghostButtonText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePickPhoto} style={styles.ghostButton}>
                      <Text style={styles.ghostButtonText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.danger }]}
              onPress={() => go("internet_decision")}
            >
              <Text style={styles.ctaButtonText}>Submit Incident Report</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* ── STEP 1b: Self Evacuate ────────────────────────────────────────── */}
        {step === "self_evacuate" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
              <Ionicons name="walk" size={36} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.primary }]}>Self Evacuation</Text>
              <Text style={styles.stepTitle}>Evacuate to Safety</Text>
            </View>
            <Text style={styles.stepCopy}>
              Follow the evacuation route to the nearest designated safe zone. Bring your Digital ID for check-in.
            </Text>

            <View style={styles.mapMock}>
              <PulsatingDot color={theme.primary} />
              <View style={styles.mapEtaBadge}>
                <Ionicons name="footsteps" size={16} color={theme.primary} />
                <Text style={styles.mapEtaText}>1.2 km away</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="navigate" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Nearest Safe Zone</Text>
                <Text style={styles.infoRowSub}>Brgy. Hall — 1.2 km northeast</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("internet_decision")}
            >
              <Text style={styles.ctaButtonText}>Begin Evacuation</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* ── STEP 2: Internet Decision ─────────────────────────────────────── */}
        {step === "internet_decision" && (
          <View style={styles.decisionCard}>
            <View style={[styles.decisionIconWrap, { backgroundColor: "rgba(0, 97, 164, 0.08)" }]}>
              <Ionicons name="wifi" size={40} color={theme.info} />
            </View>
            <View>
              <Text style={[styles.decisionLabel, { color: theme.info }]}>Connectivity Check</Text>
              <Text style={styles.decisionTitle}>Is Internet{"\n"}Available?</Text>
            </View>
            <Text style={styles.decisionCopy}>
              Choose your current connectivity. If offline, we'll generate an SMS fallback code for you.
            </Text>
            <View style={styles.decisionOptions}>
              <Pressable
                style={[styles.optionButtonYes, { backgroundColor: theme.info }]}
                onPress={() => { setInternetAvailable(true); go("upload_photo"); }}
              >
                <Ionicons name="wifi" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>YES — Online Mode</Text>
              </Pressable>
              <Pressable
                style={styles.optionButtonNo}
                onPress={() => { setInternetAvailable(false); go("sms_code"); }}
              >
                <Ionicons name="cellular" size={24} color={theme.text} />
                <Text style={styles.optionButtonTextDark}>NO — SMS Fallback</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 3a: Upload Photo & Location ─────────────────────────────── */}
        {step === "upload_photo" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(0, 97, 164, 0.08)" }]}>
              <Ionicons name="cloud-upload" size={36} color={theme.info} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.info }]}>Online Mode</Text>
              <Text style={styles.stepTitle}>Final Report</Text>
            </View>
            <Text style={styles.stepCopy}>
              Upload your situation data and confirm GPS. This ensures rapid dispatcher allocation.
            </Text>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="location" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>GPS Location Locked</Text>
                <Text style={styles.infoRowSub}>14.5991° N, 120.9842° E</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.info }]}
              onPress={handleUploadAndSend}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color="#fff" />
                  <Text style={styles.ctaButtonText}>Upload & Send Report</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ── STEP 3b: SMS Code ─────────────────────────────────────────────── */}
        {step === "sms_code" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(255, 179, 0, 0.15)" }]}>
              <Ionicons name="chatbubble-ellipses" size={36} color={theme.warning} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.warning }]}>Offline Mode</Text>
              <Text style={styles.stepTitle}>SMS Fallback</Text>
            </View>
            <Text style={styles.stepCopy}>
              Send this code to the emergency hotline. Valid for 30 minutes.
            </Text>

            <View style={styles.smsCodeBox}>
              <Text style={styles.smsCodeLabel}>Emergency Code</Text>
              <Text style={styles.smsCode}>DAM-7821</Text>
              <Text style={styles.smsCodeHint}>Send to 143 via SMS</Text>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.warning }]}
              onPress={() => go("delivery_confirmation")}
            >
              <Ionicons name="send" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>I've Sent the SMS</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 4: Delivery Confirmation ────────────────────────────────── */}
        {step === "delivery_confirmation" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
                <Ionicons name="checkmark-circle" size={60} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Report Delivered!</Text>
              <Text style={styles.confirmCopy}>
                Your incident report has been received. A dispatcher is reviewing your case.
              </Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="person" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Dispatcher Assigned</Text>
                <Text style={styles.infoRowSub}>Officer Reyes — Response Unit 4</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("safe_zone_map")}
            >
              <Ionicons name="map" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>View Safe Zone Map</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 5: Safe Zone Map ─────────────────────────────────────────── */}
        {step === "safe_zone_map" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
              <Ionicons name="map" size={36} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.primary }]}>Safe Zone Map</Text>
              <Text style={styles.stepTitle}>Nearby Shelters</Text>
            </View>
            <View style={styles.mapMock}>
              <PulsatingDot color={theme.primary} />
              <View style={styles.mapEtaBadge}>
                <Ionicons name="shield-checkmark" size={16} color={theme.primary} />
                <Text style={styles.mapEtaText}>Zone A: ACTIVE</Text>
              </View>
            </View>

            {[
              { name: "Brgy. Hall Safe Zone", distance: "1.2 km", status: "Open" },
              { name: "San Miguel Elementary", distance: "2.4 km", status: "Open" },
            ].map((zone) => (
              <View key={zone.name} style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
                <Ionicons name="home" size={24} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowText}>{zone.name}</Text>
                  <Text style={styles.infoRowSub}>{zone.distance} · {zone.status}</Text>
                </View>
              </View>
            ))}

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("navigate_evacuation")}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>Navigate Now</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 6: Navigate to Evacuation Site ──────────────────────────── */}
        {step === "navigate_evacuation" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(0, 97, 164, 0.08)" }]}>
              <Ionicons name="navigate" size={36} color={theme.info} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.info }]}>Navigation</Text>
              <Text style={styles.stepTitle}>En Route</Text>
            </View>
            <View style={styles.mapMock}>
              <PulsatingDot color={theme.info} />
              <View style={styles.mapEtaBadge}>
                <Ionicons name="car" size={16} color={theme.info} />
                <Text style={[styles.mapEtaText, { color: theme.info }]}>ETA 12 min</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.info }]}
              onPress={() => go("arrive_site")}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>I've Arrived</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 7: Arrive at Site ────────────────────────────────────────── */}
        {step === "arrive_site" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
                <Ionicons name="qr-code" size={48} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Check-in Required</Text>
              <Text style={styles.confirmCopy}>Present your QR ID to the staff.</Text>
            </View>

            <View style={styles.qrWrap}>
              <View style={styles.qrFrame}>
                <Image source={{ uri: QR_URI }} style={styles.qrImage} />
              </View>
              <View style={styles.qrIdBadge}>
                <Text style={styles.qrIdText}>284-991-001</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("credential_check")}
            >
              <Text style={styles.ctaButtonText}>Verify Identity</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 8: Credential Check ──────────────────────────────────────── */}
        {step === "credential_check" && (
          <View style={styles.decisionCard}>
            <View style={[styles.decisionIconWrap, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
              <Ionicons name="people" size={40} color={theme.primary} />
            </View>
            <Text style={styles.decisionTitle}>Confirm Group Type</Text>
            <View style={styles.decisionOptions}>
              <Pressable
                style={[styles.optionButtonYes, { backgroundColor: theme.primary }]}
                onPress={() => { setIsIndividual(true); go("logged_in"); }}
              >
                <Text style={styles.optionButtonText}>Individual</Text>
              </Pressable>
              <Pressable
                style={styles.optionButtonNo}
                onPress={() => { setIsIndividual(false); go("logged_in"); }}
              >
                <Text style={styles.optionButtonTextDark}>Household Cluster</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 9: Logged In ─────────────────────────────────────────────── */}
        {step === "logged_in" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
                <Ionicons name="shield-checkmark" size={60} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Checked In!</Text>
              <Text style={styles.confirmCopy}>
                You are successfully registered at the shelter.
              </Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="bed" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Assigned Shelter</Text>
                <Text style={styles.infoRowSub}>Bay 4B — Building A</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={onBack}
            >
              <Text style={styles.ctaButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
