"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../../lib/api";
export default function AllPlacesPage() {
  const params = useParams();
  const id = params.id;

  const [places, setPlaces] = useState<any[]>([]);
  const [destination, setDestination] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!id) return;

    fetch(`${API_URL}/api/destinations/${id}/places/`)
      .then((res) => res.json())
      .then((data) => setPlaces(data))
      .catch((err) => console.error(err));

    fetch(`${API_URL}/api/destinations/`)
      .then((res) => res.json())
      .then((data) => {
        const foundDestination = data.find((d: any) => d.id === Number(id));
        setDestination(foundDestination);
      })
      .catch((err) => console.error(err));
  }, [id]);

  const sortedPlaces = [...places].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const filteredPlaces = sortedPlaces.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ textDecoration: "none", color: "#666" }}>
          Home
        </Link>{" "}
        /{" "}
        <Link
          href={`/destinations/${id}`}
          style={{ textDecoration: "none", color: "#666" }}
        >
          {destination?.name}
        </Link>{" "}
        / <span>All places</span>
      </div>

      <h1 style={{ fontSize: "36px", marginBottom: "10px" }}>
        All places in {destination?.name}
      </h1>

      <p style={{ marginBottom: "24px", color: "#666", fontSize: "16px" }}>
        Browse all places alphabetically.
      </p>

      <div style={{ marginBottom: "24px", maxWidth: "420px" }}>
        <input
          type="text"
          placeholder={`Search places in ${destination?.name || "this city"}`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid #ddd",
            borderRadius: "10px",
            fontSize: "14px",
          }}
        />
      </div>

      {filteredPlaces.length === 0 && (
        <div style={{ color: "#777", fontSize: "14px", marginTop: "10px" }}>
          No places found.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
          maxWidth: "900px",
        }}
      >
        {filteredPlaces.map((p) => (
          <Link
            key={p.id}
            href={`/places/${p.id}`}
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
              border: "1px solid #eee",
              borderRadius: "10px",
              padding: "12px",
              textDecoration: "none",
              color: "black",
              background: "white",
            }}
          >
            <img
              src={
                p.image_url ||
                "https://images.unsplash.com/photo-1529260830199-42c24126f198"
              }
              alt={p.name}
              style={{
                width: "90px",
                height: "70px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "18px", fontWeight: "600" }}>
                🏛 {p.name}
              </div>

              <div style={{ marginTop: "6px", fontSize: "13px", color: "#777" }}>
                ⭐ {p.average_rating || "N/A"} ({p.reviews_count || 0} review
                {p.reviews_count === 1 ? "" : "s"})
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
