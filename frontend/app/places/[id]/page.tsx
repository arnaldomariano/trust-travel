"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PlacePage() {
  const params = useParams();
  const id = params.id;

  const [experiences, setExperiences] = useState<any[]>([]);
  const [place, setPlace] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetch(`http://127.0.0.1:8000/api/places/${id}/experiences/`)
      .then((res) => res.json())
      .then((data) => setExperiences(data))
      .catch((err) => console.error(err));

    fetch(`http://127.0.0.1:8000/api/places/${id}/`)
      .then((res) => res.json())
      .then((data) => setPlace(data))
      .catch((err) => console.error(err));
  }, [id]);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!id) return;

  setSubmitting(true);

  try {
    const response = await fetch("http://127.0.0.1:8000/api/experiences/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: place?.name,
        comment: comment,
        rating: Number(rating),
        place: Number(id),
      }),
    });

    if (!response.ok) {
      throw new Error("Erro ao enviar experiência");
    }

    const newExperience = await response.json();

    setExperiences((prev) => [...prev, newExperience]);
    setComment("");
    setRating("");
  } catch (error) {
    console.error(error);
  } finally {
    setSubmitting(false);
  }
};

  return (
    <main style={{ padding: "40px" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
  <a href="/" style={{ textDecoration: "none", color: "#666" }}>
    Home
  </a>{" "}
  /{" "}
  <a href="/destinations/1" style={{ textDecoration: "none", color: "#666" }}>
    Roma
  </a>{" "}
  / <span>{place?.name}</span>
       </div>

<a
  href="/destinations/1"
  style={{
    display: "inline-block",
    marginBottom: "20px",
    textDecoration: "none",
    color: "#555",
    fontSize: "14px",
  }}
>
  ← Back to Roma
</a>

<h1>
  Experiences in {place?.name}
</h1>

<div style={{ marginBottom: "20px", color: "#777", fontSize: "14px" }}>
  {experiences.length} review{experiences.length !== 1 ? "s" : ""} • Average rating:{" "}
  {experiences.length
    ? (
        experiences.reduce((sum, e) => sum + e.rating, 0) / experiences.length
      ).toFixed(1)
    : "N/A"}
</div>

<form
  onSubmit={handleSubmit}
  style={{
    display: "grid",
    gap: "12px",
    maxWidth: "500px",
    marginBottom: "30px",
  }}
>
  <h2>Add your experience</h2>

  <textarea
    value={comment}
    onChange={(e) => setComment(e.target.value)}
    placeholder="Write your experience..."
    rows={4}
    style={{
      padding: "12px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      fontSize: "14px",
    }}
  />

  <input
    type="number"
    min="1"
    max="5"
    value={rating}
    onChange={(e) => setRating(e.target.value)}
    placeholder="Rating from 1 to 5"
    style={{
      padding: "12px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      fontSize: "14px",
    }}
  />

  <button
    type="submit"
    disabled={submitting}
    style={{
      padding: "12px 16px",
      border: "none",
      borderRadius: "8px",
      backgroundColor: "#111",
      color: "white",
      cursor: "pointer",
      fontSize: "14px",
    }}
  >
    {submitting ? "Submitting..." : "Submit experience"}
  </button>
</form>

      <div style={{ display: "grid", gap: "20px", maxWidth: "500px" }}>
        {experiences.map((e) => (
          <div
            key={e.id}
            style={{
              padding: "20px",
              border: "1px solid #e5e5e5",
              borderRadius: "16px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
              backgroundColor: "white",
            }}
          >
          {place?.image_url && (
          <img
            src={place.image_url}
            style={{
              width: "100%",
              height: "200px",
              objectFit: "cover",
              borderRadius: "12px",
              marginBottom: "18px",
            }}
          />
        )}
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>
              ⭐ {place?.name}
            </div>

            <div style={{ marginTop: "8px", color: "#555" }}>
              {e.comment}
            </div>

          </div>
        ))}
      </div>
    </main>
  );
}