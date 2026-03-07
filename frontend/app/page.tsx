"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [destinations, setDestinations] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/destinations/")
      .then((res) => res.json())
      .then((data) => setDestinations(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "36px", marginBottom: "10px" }}>
        Trust Travel
      </h1>

      <p style={{ marginBottom: "30px", color: "#555" }}>
        Explore destinations
      </p>

      <div style={{ display: "grid", gap: "20px", maxWidth: "500px" }}>
        {destinations.map((d) => (
          <a
            key={d.id}
            href={`/destinations/${d.id}`}
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
              📍 {d.name}
            </div>

            <div style={{ color: "#666" }}>
              {d.city}, {d.country}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}