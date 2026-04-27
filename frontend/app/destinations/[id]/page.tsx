"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function DestinationPage() {
  const params = useParams();
  const id = params.id;

  const [places, setPlaces] = useState<any[]>([]);
  const [destination, setDestination] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");


  useEffect(() => {
    if (!id) return;

    fetch(`http://127.0.0.1:8000/api/destinations/${id}/places/`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const ratingA = a.average_rating || 0;
          const ratingB = b.average_rating || 0;
          return ratingB - ratingA;
        });
        setPlaces(sorted);
      })
      .catch((err) => console.error(err));

    fetch("http://127.0.0.1:8000/api/destinations/")
      .then((res) => res.json())
      .then((data) => {
        const foundDestination = data.find((d: any) => d.id === Number(id));
        setDestination(foundDestination);
      })
      .catch((err) => console.error(err));
  }, [id]);

  const topPlaces = places.slice(0, 3);
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
        / <span>{destination?.name}</span>
      </div>

      {destination?.image_url && (
        <img
          src={destination.image_url}
          alt={destination.name}
          style={{
            width: "100%",
            height: "320px",
            objectFit: "cover",
            borderRadius: "12px",
            marginBottom: "20px",
          }}
        />
      )}

      <h1 style={{ fontSize: "36px", marginBottom: "10px" }}>
        {destination?.name}
      </h1>

      <p style={{ marginBottom: "30px", color: "#666", fontSize: "16px" }}>
        Discover places and shared experiences in {destination?.name}.
      </p>

      {topPlaces.length > 0 && (
        <div style={{ marginBottom: "36px" }}>
          <h2 style={{ marginBottom: "16px" }}>
            Top places in {destination?.name}
          </h2>

          <div
            style={{
              display: "grid",
              gap: "12px",
              maxWidth: "700px",
            }}
          >
            {topPlaces.map((p, index) => (
              <Link
                key={p.id}
                href={`/places/${p.id}`}
                style={{
                  textDecoration: "none",
                  color: "black",
                  border: "1px solid #e5e5e5",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  backgroundColor: "white",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} {p.name}
                </div>

                <div style={{ marginTop: "6px", color: "#666", fontSize: "14px" }}>
                  ⭐ {p.average_rating || "N/A"} ({p.reviews_count || 0} review
                  {p.reviews_count === 1 ? "" : "s"})
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

        <div style={{ marginTop: "20px" }}>
          <Link
            href={`/destinations/${id}/places`}
            style={{
              display: "inline-block",
              padding: "10px 16px",
              backgroundColor: "#111",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            View all places
          </Link>
        </div>

        <div
          style={{
            height: "1px",
            backgroundColor: "#e5e5e5",
            margin: "36px 0 28px 0",
            maxWidth: "700px",
          }}
        />

        <div style={{ marginBottom: "20px", maxWidth: "420px" }}>
          <input
            type="text"
            placeholder={`Search places in ${destination?.name || "this destination"}`}
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


    </main>
  );
}