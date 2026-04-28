"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../../lib/api";
export default function AllPlacesPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

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
      (a.name || "").localeCompare(b.name || "")
    );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredPlaces = sortedPlaces.filter((p) =>
      (p.name || "").toLowerCase().includes(normalizedSearch)
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
          Choose a place in {destination?.name}
        </h1>

        <p style={{ marginBottom: "30px", color: "#666", fontSize: "16px" }}>
          Select the place you want to review or share an experience about.
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

        <div
          style={{
            marginBottom: "24px",
            color: "#666",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          Can’t find the place? Place creation will be available soon.
        </div>

      {filteredPlaces.length === 0 && (
          <div
            style={{
              marginTop: "10px",
              marginBottom: "24px",
              padding: "18px",
              border: "1px solid #eee",
              borderRadius: "12px",
              background: "white",
              color: "#555",
              maxWidth: "520px",
              lineHeight: 1.5,
            }}
          >
            {searchTerm.trim() ? (
              <>
                <strong>No places found for “{searchTerm.trim()}”.</strong>
                <p style={{ margin: "8px 0 14px 0" }}>
                  Soon you’ll be able to create this place and share your experience.
                </p>

                <button
                  disabled
                  style={{
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1px solid #ddd",
                    background: "#f5f5f5",
                    color: "#777",
                    cursor: "not-allowed",
                  }}
                >
                  Create this place soon
                </button>
              </>
            ) : (
              <>
                <strong>No places available yet.</strong>
                <p style={{ margin: "8px 0 0 0" }}>
                  Place creation will be available soon.
                </p>
              </>
            )}
          </div>
        )}

        {filteredPlaces.length > 0 && (
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
        )}
    </main>
  );
}
