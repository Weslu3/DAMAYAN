/**
 * InteractiveGeoMap — tap-to-pin map with backend address resolution.
 *
 * Required installations (run once):
 *   npx expo install react-native-maps
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { getApiBaseUrl } from '../api';
import { formatCoordinates, resolveReadableAddress } from '../utils/geoUtils';

const API_BASE_URL = getApiBaseUrl();

export interface GeoData {
  latitude: number;
  longitude: number;
  resolved_address: string;
}

interface InteractiveGeoMapProps {
  accessToken: string;
  onLocationSelected: (geoData: GeoData) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

export function InteractiveGeoMap({
  accessToken,
  onLocationSelected,
  initialLatitude = 14.5995,
  initialLongitude = 120.9842,
}: InteractiveGeoMapProps) {
  const [markerCoords, setMarkerCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMapPress = (e: MapPressEvent) => {
    setMarkerCoords(e.nativeEvent.coordinate);
  };

  const handleConfirmLocation = async () => {
    if (!markerCoords) {
      Alert.alert('No Pin', 'Tap on the map to drop a pin first.');
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const nativeAddress = await resolveReadableAddress(markerCoords);
      if (nativeAddress !== formatCoordinates(markerCoords)) {
        onLocationSelected({ ...markerCoords, resolved_address: nativeAddress });
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/geo/citizen/resolve-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(markerCoords),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = (await response.json()) as {
        success: boolean;
        data: GeoData;
      };

      if (json.success) {
        onLocationSelected(json.data);
      } else {
        throw new Error('Unexpected server response');
      }
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout =
        err instanceof Error && err.message.toLowerCase().includes('abort');
      Alert.alert(
        isTimeout ? 'Request Timed Out' : 'Error',
        isTimeout
          ? 'Location resolution took too long. Please try again.'
          : 'Could not resolve the pinned location.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: initialLatitude,
          longitude: initialLongitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        onPress={handleMapPress}
      >
        {markerCoords && (
          <Marker
            coordinate={markerCoords}
            title="Incident Location"
            draggable
            onDragEnd={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
            pinColor="#BA1A1A"
          />
        )}
      </MapView>

      <View style={styles.overlay}>
        {!markerCoords && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>Tap the map to pin your location</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.btn, (!markerCoords || loading) && styles.btnDisabled]}
          onPress={handleConfirmLocation}
          disabled={!markerCoords || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Confirm Location</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    gap: 10,
  },
  hint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  hintText: { color: '#fff', fontSize: 13 },
  btn: {
    backgroundColor: '#BA1A1A',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#888' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
