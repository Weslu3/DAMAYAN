import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

export interface EvacCenter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: "Open" | "Full" | "Closed";
}

export interface CitizenLiveMapProps {
  mode: "shelter_select" | "navigate";
  userLocation: { latitude: number; longitude: number } | null;
  evacCenters: EvacCenter[];
  selectedCenter: EvacCenter;
  onCenterSelect?: (center: EvacCenter) => void;
  routeCoords?: Array<{ latitude: number; longitude: number }>;
}

function midpointRegion(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const latDelta = Math.max(Math.abs(a.latitude - b.latitude) * 3, 0.015);
  const lngDelta = Math.max(Math.abs(a.longitude - b.longitude) * 3, 0.015);
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export function CitizenLiveMap({
  mode,
  userLocation,
  evacCenters,
  selectedCenter,
  onCenterSelect,
  routeCoords,
}: CitizenLiveMapProps) {
  const fallbackCoord = { latitude: 14.5995, longitude: 120.9842 };

  const region =
    mode === "navigate" && userLocation
      ? midpointRegion(userLocation, {
          latitude: selectedCenter.latitude,
          longitude: selectedCenter.longitude,
        })
      : {
          latitude: userLocation?.latitude ?? fallbackCoord.latitude,
          longitude: userLocation?.longitude ?? fallbackCoord.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        };

  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton={mode === "shelter_select"}
      pitchEnabled={false}
      scrollEnabled
    >
      {/* Blue device dot */}
      {userLocation && (
        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} title="You">
          <View style={styles.deviceDot} />
        </Marker>
      )}

      {mode === "shelter_select" &&
        evacCenters.map((center) => (
          <Marker
            key={center.id}
            coordinate={{ latitude: center.latitude, longitude: center.longitude }}
            title={center.name}
            description={center.status}
            pinColor={selectedCenter.id === center.id ? "#2E7D32" : "#81C784"}
            onPress={() => onCenterSelect?.(center)}
          />
        ))}

      {mode === "navigate" && (
        <>
          <Marker
            coordinate={{ latitude: selectedCenter.latitude, longitude: selectedCenter.longitude }}
            title={selectedCenter.name}
            pinColor="#2E7D32"
          />
          {userLocation && (
            <Polyline
              coordinates={
                routeCoords && routeCoords.length > 1
                  ? routeCoords
                  : [userLocation, { latitude: selectedCenter.latitude, longitude: selectedCenter.longitude }]
              }
              strokeColor="#0061A4"
              strokeWidth={3}
              lineDashPattern={routeCoords && routeCoords.length > 1 ? undefined : [8, 4]}
            />
          )}
        </>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  deviceDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
});
