"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { API_URL } from "../lib/api";

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDestinations = async () => {
      try {
        const res = await fetch(`${API_URL}/api/destinations/`);

        if (!res.ok) {
          console.error("Failed to load destinations:", res.status);
          return;
        }

        const data = await res.json();

        const sorted = [...data].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setDestinations(sorted);
      } catch (error) {
        console.error("Destinations fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDestinations();
  }, []);

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>
      <h1>Choose a destination</h1>

      <p style={{ color: "#666", marginBottom: "28px", lineHeight: 1.5 }}>
        Select a destination first, then choose a place to share your experience.
      </p>

      {loading ? (
        <p>Loading destinations...</p>
      ) : destinations.length === 0 ? (
        <p style={{ color: "#666" }}>No destinations available yet.</p>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          {destinations.map((destination) => (
            <Link
              key={destination.id}
              href={`/destinations/${destination.id}/places`}
              style={{
                padding: "20px",
                border: "1px solid #eee",
                borderRadius: "16px",
                background: "white",
                textDecoration: "none",
                color: "black",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
                {destination.name}
              </h2>

              <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                {destination.country || destination.city || "Explore places"}
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}