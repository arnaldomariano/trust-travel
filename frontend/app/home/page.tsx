"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MapView = dynamic(() => import("../components/MapView"), {
  ssr: false,
});

export default function HomePage() {

  // ✅ AGORA CORRETO: dentro do componente
  const searchParams = useSearchParams();

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (lat && lng) {
      console.log("Center map at:", lat, lng);
    }
  }, [lat, lng]);

  return (
    <main style={{ padding: "40px" }}>
      <h1>Trust Travel</h1>

      <p style={{ color: "#666" }}>
        What is happening near you
      </p>

                <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr", // 👈 também ajustamos proporção
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {/* PAINEL (AGORA À ESQUERDA) */}
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: "12px",
              padding: "15px",
              height: "500px",
            }}
          >
            <h3>👥 Your network</h3>

            {selectedPlace ? (
              <>
                <div style={{ marginBottom: "10px" }}>
                  📍 <strong>{selectedPlace.name}</strong>
                </div>

                {/* GOING */}
                <h4>👥 Going</h4>
                <div>🧔 João ✔</div>

                {/* COMMENTS */}
                <h4>💬 Comments</h4>
                <div>👩 Maria</div>

                {/* ALERTS */}
                <h4>⚠ Alerts</h4>
                <div>🧑 Carlos</div>
              </>
            ) : (
              <p style={{ color: "#777" }}>
                Select a place on the map
              </p>
            )}
          </div>

          {/* MAPA (AGORA À DIREITA) */}
          <div>
            <MapView lat={lat} lng={lng} onSelectPlace={setSelectedPlace} />
          </div>
        </div>
    </main>
  );
}