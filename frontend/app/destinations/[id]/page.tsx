"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function DestinationPage() {
  const params = useParams();
  const id = params.id;

  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    fetch(`http://127.0.0.1:8000/api/destinations/${id}/places/`)
      .then((res) => res.json())
      .then((data) => setPlaces(data))
      .catch((err) => console.error(err));
  }, [id]);

  return (
    <main style={{ padding: "40px" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <a href="/" style={{ textDecoration: "none", color: "#666" }}>
          Home
        </a>{" "}
        / <span>Roma</span>
      </div>

      <h1 style={{ fontSize: "36px", marginBottom: "10px" }}>Roma</h1>

      <p style={{ marginBottom: "30px", color: "#666" }}>
        Explore places in this destination
      </p>

      <h2>Places</h2>

      <div style={{ display: "grid", gap: "20px", maxWidth: "700px" }}>
        {places.map((p) => (
          <a
            key={p.id}
            href={`/places/${p.id}`}
            style={{
              padding: "20px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              textDecoration: "none",
              color: "black",
              display: "block",
            }}
          >
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>
              🏛 {p.name}
            </div>

            <div style={{ marginTop: "8px", color: "#555" }}>
              {p.description}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}