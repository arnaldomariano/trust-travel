"use client";

import { API_URL } from "../lib/api";
/* ===================== Imports ===================== */
import { useAuth } from "../providers/AuthProvider";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
/* ===================== End Imports ===================== */


/* ===================== Leaflet Icon Fix ===================== */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});
/* ===================== End Leaflet Fix ===================== */

/* ===================== Custom Icons ===================== */
const trustedIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/190/190411.png",
  iconSize: [30, 30],
});

const defaultIcon = new L.Icon.Default();
/* ===================== End Custom Icons ===================== */

export default function MapView({ lat, lng, onSelectPlace }: any) {

  /* ===================== Hooks ===================== */
  const [places, setPlaces] = useState<any[]>([]);
  const markersRef = useRef<Record<string, any>>({});
  const router = useRouter();
  const { username } = useAuth();
  /* ===================== End Hooks ===================== */
/* ===================== Data Fetch ===================== */
useEffect(() => {
  fetch(`${API_URL}/api/places/`)
    .then((res) => res.json())
    .then((data) => {

      // ===================== Add fake trust =====================
      const enriched = data.map((place: any) => ({
        ...place,
        trust_level: Math.floor(Math.random() * 3) + 1,
      }));
      // ===================== End fake trust =====================

      setPlaces(enriched);
    });
}, []);
/* ===================== End Data Fetch ===================== */

/* ===================== Open Correct Popup ===================== */
useEffect(() => {
  if (!lat || !lng) return;

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  const cityCoordinates: Record<string, [number, number]> = {
    Roma: [41.9028, 12.4964],
    Paris: [48.8566, 2.3522],
    Londres: [51.5074, -0.1278],
  };

  let closestCity: string | null = null;
  let minDistance = Infinity;

  Object.entries(cityCoordinates).forEach(([city, coords]) => {
    const distance = Math.sqrt(
      Math.pow(coords[0] - latNum, 2) +
      Math.pow(coords[1] - lngNum, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  });

  if (closestCity && markersRef.current[closestCity]) {
    markersRef.current[closestCity].openPopup();
  }

}, [lat, lng]);
/* ===================== End Popup ===================== */

  /* ===================== Static Coordinates ===================== */
  const cityCoordinates: Record<string, [number, number]> = {
    Roma: [41.9028, 12.4964],
    Paris: [48.8566, 2.3522],
    Londres: [51.5074, -0.1278],
  };
  /* ===================== End Static Coordinates ===================== */


/* ===================== Group Places by City ===================== */
const groupedByCity = Object.values(
  places.reduce((acc: any, place) => {
    if (!acc[place.city]) {
      acc[place.city] = {
        city: place.city,
        count: 0,
        places: [],
        trustedCount: 0,
      };
    }

    acc[place.city].count += 1;
    acc[place.city].places.push(place);

    if (place.trust_level === 1) {
      acc[place.city].trustedCount += 1;
    }

    return acc;
  }, {})
);
/* ===================== End Grouping ===================== */

/* ===================== Render ===================== */
return (
  <div style={{ width: "100%" }}>

    {/* ===================== User Info ===================== */}
    {username && (
      <div style={{ marginBottom: "10px", color: "#666" }}>
        Logged as <strong>{username}</strong>
      </div>
    )}
    {/* ===================== End User Info ===================== */}

    {/* ===================== Map Container ===================== */}
    <div style={{ height: "500px", width: "100%" }}>
      <MapContainer
        center={[41.9028, 12.4964]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {groupedByCity.map((group: any, index) => (
            <Marker
              key={group.city}
              position={cityCoordinates[group.city] || [41.9028, 12.4964]}
              ref={(ref) => {
                  if (ref) {
                    markersRef.current[group.city] = ref;
                  }
                }}

              // ===================== Dynamic Icon =====================
              icon={group.trustedCount > 0 ? trustedIcon : defaultIcon}
              // ===================== End Icon =====================
            >
            <Popup>
              <strong>{group.city}</strong>
              <br />
              📍 {group.count} places

              {/* ===================== Social Signal ===================== */}
              {group.trustedCount > 0 && (
                <div style={{ color: "#2563eb", fontWeight: "600", marginTop: "4px" }}>
                  🔥 {group.trustedCount} from your network
                </div>
              )}
              {/* ===================== End Social Signal ===================== */}

              <hr />

              {group.places.map((p: any) => (
                <div
                  key={p.id}
                    onClick={() => {
                      if (onSelectPlace) {
                        onSelectPlace(p);
                      }
                    }}
                  style={{
                    cursor: "pointer",
                    padding: "6px 0",
                  }}
                >
                  • {p.name} ⭐ {p.average_rating}
                </div>
              ))}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
    {/* ===================== End Map Container ===================== */}

  </div>
);
/* ===================== End Render ===================== */
}
