"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

type TripPlanMapPoint = {
  place_id: number;
  name: string;
  latitude: number;
  longitude: number;
  context?: string;
  sources?: string[];
};

type TripPlanMapProps = {
  points: TripPlanMapPoint[];
};

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitMapToPoints({
  points,
}: {
  points: TripPlanMapPoint[];
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(
        [points[0].latitude, points[0].longitude],
        13
      );
      return;
    }

    const bounds = L.latLngBounds(
      points.map((point) => [
        point.latitude,
        point.longitude,
      ])
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
    });
  }, [map, points]);

  return null;
}

export default function TripPlanMap({
  points,
}: TripPlanMapProps) {
  if (points.length === 0) {
    return null;
  }

  const firstPoint = points[0];

  return (
    <div
      style={{
        width: "100%",
        height: "420px",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={[
          firstPoint.latitude,
          firstPoint.longitude,
        ]}
        zoom={11}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <FitMapToPoints points={points} />

        {points.map((point) => (
          <Marker
            key={point.place_id}
            position={[
              point.latitude,
              point.longitude,
            ]}
          >
            <Popup>
              <div
                style={{
                  display: "grid",
                  gap: "6px",
                  minWidth: "160px",
                }}
              >
                <strong>{point.name}</strong>

                {point.context && (
                  <span>{point.context}</span>
                )}

                {point.sources && point.sources.length > 0 && (
                  <span>
                    In this trip: {point.sources.join(", ")}
                  </span>
                )}

                <Link href={`/places/${point.place_id}`}>
                  View place
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}