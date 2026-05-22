import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import { theme, fonts } from "../../theme";
import { styles } from "./CitizenDuringScreen.styles";
import { submitIncidentReport, getIncidentPhotoUploadUrl } from "../../api";
import { CitizenLiveMap, type EvacCenter } from "./CitizenLiveMap";

// ─── Types ────────────────────────────────────────────────────────────────────
type DuringStep =
  | "rescue_decision"
  | "report_incident"
  | "self_evacuate"
  | "delivery_confirmation"
  | "safe_zone_map"
  | "navigate_evacuation"
  | "arrive_site"
  | "logged_in";

const STEP_PROGRESS: Record<DuringStep, number> = {
  rescue_decision: 0,
  report_incident: 15,
  self_evacuate: 20,
  delivery_confirmation: 35,
  safe_zone_map: 50,
  navigate_evacuation: 65,
  arrive_site: 80,
  logged_in: 100,
};

// ─── Static Evacuation Centers ────────────────────────────────────────────────
const EVAC_CENTERS: EvacCenter[] = [
  { id: "1", name: "Brgy. 102 Barangay Hall", latitude: 14.6020, longitude: 120.9850, status: "Open" },
  { id: "2", name: "San Miguel Elementary School", latitude: 14.5975, longitude: 120.9870, status: "Open" },
  { id: "3", name: "Manila City Hall Evac Center", latitude: 14.5942, longitude: 120.9770, status: "Open" },
];

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
      ]),
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
function ProgressBar({ step }: { step: DuringStep }) {
  const progress = STEP_PROGRESS[step] ?? 0;
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
  qrCodeId,
}: {
  onBack: () => void;
  initialStep?: string;
  session: any;
  authUser: any;
  qrCodeId?: string | null;
}) {
  const [step, setStep] = useState<DuringStep>("rescue_decision");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real GPS state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);

  // Selected evacuation center (chosen on safe_zone_map, used in navigate_evacuation)
  const [selectedCenter, setSelectedCenter] = useState<EvacCenter>(EVAC_CENTERS[0]);

  // ── Fetch device GPS on mount ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationDenied(true);
        setLocationLoading(false);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        setLocationDenied(true);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (initialStep === "decision") setStep("rescue_decision");
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

  const handleSubmitReport = async () => {
    if (!session?.accessToken) {
      Alert.alert("Authentication Error", "You must be logged in to submit a report.");
      return;
    }
    try {
      setIsSubmitting(true);
      const locationStr = userLocation
        ? `${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
        : "Location unavailable";

      const attachmentKeys: string[] = [];
      if (photoUri) {
        try {
          const fileName = photoUri.split("/").pop() ?? "incident.jpg";
          const { signedUrl, objectPath } = await getIncidentPhotoUploadUrl(session.accessToken, fileName);
          const fileResponse = await fetch(photoUri);
          const blob = await fileResponse.blob();
          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });
          if (uploadRes.ok) {
            attachmentKeys.push(objectPath);
          }
        } catch (photoErr) {
          console.warn("Incident photo upload failed:", photoErr);
        }
      }

      await submitIncidentReport(session.accessToken, {
        title: "Citizen SOS Report",
        content: `Citizen needs immediate rescue. GPS: ${locationStr}.`,
        severity: "high",
        location: locationStr,
        attachmentKeys,
      });
      go("delivery_confirmation");
    } catch (err: any) {
      Alert.alert("Submission Failed", err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  function go(next: DuringStep) {
    setStep(next);
  }

  const locationLabel = locationLoading
    ? "Detecting location…"
    : locationDenied
    ? "GPS unavailable"
    : userLocation
    ? `${userLocation.latitude.toFixed(4)}° N, ${userLocation.longitude.toFixed(4)}° E`
    : "Location unavailable";

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

      <ProgressBar step={step} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── STEP 0: Rescue Decision ──────────────────────────────────────── */}
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
                onPress={() => go("report_incident")}
              >
                <Ionicons name="hand-left" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>YES — I need rescue</Text>
              </Pressable>
              <Pressable
                style={styles.optionButtonNo}
                onPress={() => go("self_evacuate")}
              >
                <Ionicons name="walk" size={24} color={theme.text} />
                <Text style={styles.optionButtonTextDark}>NO — Self Evacuate</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 1a: Report Incident ─────────────────────────────────────── */}
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
              Your GPS location and situation details will be sent directly to dispatch.
            </Text>

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons
                name={locationLoading ? "time" : locationDenied ? "warning" : "location"}
                size={24}
                color={locationDenied ? theme.warning : theme.danger}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>
                  {locationLoading ? "Detecting Location…" : "GPS Location"}
                </Text>
                <Text style={styles.infoRowSub}>{locationLabel}</Text>
              </View>
              {!locationLoading && !locationDenied && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
              {locationLoading && (
                <ActivityIndicator size="small" color={theme.danger} />
              )}
            </View>

            {/* Optional photo attachment */}
            <View style={styles.uploadBox}>
              {photoUri ? (
                <View style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden" }}>
                  <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} />
                  <Pressable
                    onPress={() => setPhotoUri(null)}
                    style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 12 }}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Ionicons name="camera" size={40} color={theme.primary} />
                  <Text style={styles.uploadBoxTitle}>Attach Photo (Optional)</Text>
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
              style={[styles.ctaButton, { backgroundColor: theme.danger }, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSubmitReport}
              disabled={isSubmitting || locationLoading}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.ctaButtonText}>Send SOS Report</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ── STEP 1b: Self Evacuate ───────────────────────────────────────── */}
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

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons
                name={locationLoading ? "time" : locationDenied ? "warning" : "location"}
                size={24}
                color={locationDenied ? theme.warning : theme.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Your Current Location</Text>
                <Text style={styles.infoRowSub}>{locationLabel}</Text>
              </View>
              {locationLoading && <ActivityIndicator size="small" color={theme.primary} />}
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("safe_zone_map")}
            >
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.ctaButtonText}>Find Safe Zones</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 2: Delivery Confirmation ────────────────────────────────── */}
        {step === "delivery_confirmation" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
                <Ionicons name="checkmark-circle" size={60} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Report Delivered!</Text>
              <Text style={styles.confirmCopy}>
                Your SOS has been received. A dispatcher is reviewing your case now.
              </Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="person" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Dispatcher Assigned</Text>
                <Text style={styles.infoRowSub}>Response Unit — monitoring your location</Text>
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

        {/* ── STEP 3: Safe Zone Map (LIVE) ─────────────────────────────────── */}
        {step === "safe_zone_map" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
              <Ionicons name="map" size={36} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.primary }]}>Live Map</Text>
              <Text style={styles.stepTitle}>Nearby Shelters</Text>
            </View>

            {/* Live MapView */}
            {locationLoading ? (
              <View style={styles.mapLoadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.mapLoadingText}>Acquiring GPS…</Text>
              </View>
            ) : (
              <CitizenLiveMap
                mode="shelter_select"
                userLocation={userLocation}
                evacCenters={EVAC_CENTERS}
                selectedCenter={selectedCenter}
                onCenterSelect={setSelectedCenter}
              />
            )}

            {locationDenied && (
              <View style={[styles.infoRow, { borderLeftColor: theme.warning }]}>
                <Ionicons name="warning" size={20} color={theme.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowText}>GPS access denied</Text>
                  <Text style={styles.infoRowSub}>Map shows approximate area — enable location for precision</Text>
                </View>
              </View>
            )}

            {/* Evacuation centers list */}
            {EVAC_CENTERS.map((center) => {
              const dist = userLocation
                ? haversineKm(userLocation.latitude, userLocation.longitude, center.latitude, center.longitude)
                : null;
              const isSelected = selectedCenter.id === center.id;
              return (
                <Pressable
                  key={center.id}
                  onPress={() => setSelectedCenter(center)}
                  style={[
                    styles.infoRow,
                    { borderLeftColor: isSelected ? theme.primary : theme.line },
                    isSelected && { backgroundColor: "rgba(46,125,50,0.06)" },
                  ]}
                >
                  <Ionicons
                    name="home"
                    size={24}
                    color={isSelected ? theme.primary : theme.textLight}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoRowText, isSelected && { color: theme.primary }]}>
                      {center.name}
                    </Text>
                    <Text style={styles.infoRowSub}>
                      {dist !== null ? `${dist.toFixed(1)} km away` : "Calculating…"} · {center.status}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </Pressable>
              );
            })}

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("navigate_evacuation")}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>Navigate to {selectedCenter.name.split(" ").slice(0, 2).join(" ")}</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 4: Navigate to Evacuation Site (LIVE) ───────────────────── */}
        {step === "navigate_evacuation" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(0, 97, 164, 0.08)" }]}>
              <Ionicons name="navigate" size={36} color={theme.info} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.info }]}>Navigation</Text>
              <Text style={styles.stepTitle}>En Route</Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.info }]}>
              <Ionicons name="home" size={24} color={theme.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>{selectedCenter.name}</Text>
                <Text style={styles.infoRowSub}>
                  {userLocation
                    ? `${haversineKm(userLocation.latitude, userLocation.longitude, selectedCenter.latitude, selectedCenter.longitude).toFixed(1)} km away`
                    : "Calculating distance…"}
                </Text>
              </View>
            </View>

            {/* Live navigation map */}
            {locationLoading ? (
              <View style={styles.mapLoadingBox}>
                <ActivityIndicator size="large" color={theme.info} />
              </View>
            ) : (
              <CitizenLiveMap
                mode="navigate"
                userLocation={userLocation}
                evacCenters={EVAC_CENTERS}
                selectedCenter={selectedCenter}
              />
            )}

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.info }]}
              onPress={() => go("arrive_site")}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>I've Arrived</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 5: Arrive at Site ───────────────────────────────────────── */}
        {step === "arrive_site" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
                <Ionicons name="qr-code" size={48} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Check-in Required</Text>
              <Text style={styles.confirmCopy}>Present your QR ID to shelter staff.</Text>
            </View>

            <View style={styles.qrWrap}>
              <View style={styles.qrFrame}>
                <QRCode value={qrCodeId ?? "DAMAYAN-ID"} size={120} color="#0F6E56" backgroundColor="#fff" />
              </View>
              <View style={styles.qrIdBadge}>
                <Text style={styles.qrIdText}>{qrCodeId ?? "—"}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() => go("logged_in")}
            >
              <Text style={styles.ctaButtonText}>Confirm Check-In</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 6: Logged In / Checked In ──────────────────────────────── */}
        {step === "logged_in" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46, 125, 50, 0.08)" }]}>
                <Ionicons name="shield-checkmark" size={60} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Checked In!</Text>
              <Text style={styles.confirmCopy}>
                You are registered at {selectedCenter.name}. Stay with shelter staff for further instructions.
              </Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="home" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Your Shelter</Text>
                <Text style={styles.infoRowSub}>{selectedCenter.name}</Text>
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
