/**
 * CitizenMaplibreScanner — hardware GPS + draggable pin + backend address resolution.
 *
 * Required installations (run once):
 *   npx expo install react-native-maps expo-location
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl } from '../api';
import { formatCoordinates, resolveReadableAddress } from '../utils/geoUtils';

const API_BASE_URL = getApiBaseUrl();

export interface CitizenLocationPayload {
  latitude: number;
  longitude: number;
  resolved_address: string;
}

interface CitizenMaplibreScannerProps {
  accessToken: string;
  onSubmit: (payload: CitizenLocationPayload) => void;
  onCancel?: () => void;
}

async function resolveAddress(
  coords: { latitude: number; longitude: number },
  accessToken: string,
): Promise<string> {
  const nativeAddress = await resolveReadableAddress(coords);
  const fallback = formatCoordinates(coords);
  if (nativeAddress !== fallback) {
    return nativeAddress;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`${API_BASE_URL}/geo/citizen/resolve-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(coords),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      success: boolean;
      data: { resolved_address: string };
    };
    return json.data?.resolved_address ?? fallback;
  } catch {
    clearTimeout(timeout);
    return fallback;
  }
}

export function CitizenMaplibreScanner({
  accessToken,
  onSubmit,
  onCancel,
}: CitizenMaplibreScannerProps) {
  const mapRef = useRef<MapView>(null);

  const [deviceCoords, setDeviceCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [pinCoords, setPinCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    'pending' | 'granted' | 'denied'
  >('pending');
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Request GPS permission and fetch initial device coordinates on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermission('denied');
        return;
      }
      setLocationPermission('granted');

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setDeviceCoords(coords);
        setPinCoords(coords);

        const region: Region = {
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        // Small delay ensures the map has mounted before animating
        setTimeout(() => mapRef.current?.animateToRegion(region, 800), 300);

        // Pre-resolve the device address
        setResolving(true);
        const address = await resolveAddress(coords, accessToken);
        setResolvedAddress(address);
        setResolving(false);
      } catch {
        Alert.alert(
          'GPS Unavailable',
          'Could not read device location. You can still pin your position manually on the map.',
        );
        setLocationPermission('denied');
      }
    })();
  }, [accessToken]);

  const handlePinMove = async (coords: {
    latitude: number;
    longitude: number;
  }) => {
    setPinCoords(coords);
    setResolvedAddress(null);
    setResolving(true);
    const address = await resolveAddress(coords, accessToken);
    setResolvedAddress(address);
    setResolving(false);
  };

  const handleSubmit = async () => {
    if (!pinCoords) {
      Alert.alert('No Location', 'Tap the map to pin your incident location first.');
      return;
    }
    setSubmitting(true);
    const address =
      resolvedAddress ?? (await resolveAddress(pinCoords, accessToken));
    setSubmitting(false);
    onSubmit({ ...pinCoords, resolved_address: address });
  };

  if (locationPermission === 'pending') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#BA1A1A" />
        <Text style={styles.statusText}>Requesting GPS permission…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: deviceCoords?.latitude ?? 14.5995,
          longitude: deviceCoords?.longitude ?? 120.9842,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={(e) => handlePinMove(e.nativeEvent.coordinate)}
      >
        {/* Blue dot — actual device location */}
        {deviceCoords && (
          <Marker
            coordinate={deviceCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Your Device Location"
          >
            <View style={styles.deviceDot} />
          </Marker>
        )}

        {/* Red pin — chosen incident location (draggable) */}
        {pinCoords && (
          <Marker
            coordinate={pinCoords}
            title="Incident Location"
            draggable
            pinColor="#BA1A1A"
            onDragEnd={(e) => handlePinMove(e.nativeEvent.coordinate)}
          />
        )}
      </MapView>

      {/* HUD overlay */}
      <View style={styles.hud}>
        {locationPermission === 'denied' && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={14} color="#92400E" />
            <Text style={styles.warningText}>
              GPS access denied — pin your location manually
            </Text>
          </View>
        )}

        {pinCoords && (
          <View style={styles.addressBox}>
            {resolving ? (
              <ActivityIndicator size="small" color="#BA1A1A" />
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {resolvedAddress ??
                  `${pinCoords.latitude.toFixed(5)}, ${pinCoords.longitude.toFixed(5)}`}
              </Text>
            )}
          </View>
        )}

        <View style={styles.actions}>
          {onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!pinCoords || resolving || submitting) && styles.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!pinCoords || resolving || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>Submit Incident Location</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  statusText: { color: '#555', fontSize: 14, textAlign: 'center' },
  map: { ...StyleSheet.absoluteFillObject },
  deviceDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563EB',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  hud: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    gap: 10,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningText: { color: '#92400E', fontSize: 12, flex: 1 },
  addressBox: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: { color: '#1A1A1A', fontSize: 13, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: { color: '#444', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    flex: 2,
    backgroundColor: '#BA1A1A',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#999' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
