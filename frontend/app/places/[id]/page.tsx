"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function PlacePage() {
  const params = useParams();
  const id = params.id;

  const [experiences, setExperiences] = useState<any[]>([]);
  const [place, setPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const rating5 = experiences.filter((e) => e.rating === 5).length;
  const rating4 = experiences.filter((e) => e.rating === 4).length;
  const rating3 = experiences.filter((e) => e.rating === 3).length;
  const rating2 = experiences.filter((e) => e.rating === 2).length;
  const rating1 = experiences.filter((e) => e.rating === 1).length;

  useEffect(() => {
    const token = localStorage.getItem("access");
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    if (!id) return;

    fetch(`http://127.0.0.1:8000/api/places/${id}/experiences/`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setExperiences(sorted);
      })
      .catch((err) => console.error(err));

    fetch(`http://127.0.0.1:8000/api/places/${id}/`)
      .then((res) => res.json())
      .then((data) => {
        setPlace(data);

        fetch("http://127.0.0.1:8000/api/destinations/")
          .then((res) => res.json())
          .then((destinations) => {
            const foundDestination = destinations.find(
              (d: any) => d.id === data.destination
            );
            setDestination(foundDestination);
          })
          .catch((err) => console.error(err));
      })
      .catch((err) => console.error(err));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!rating) {
      alert("Please select a rating before posting.");
      return;
    }

    if (!comment.trim()) {
      alert("Please write a comment before posting.");
      return;
    }

    const token = localStorage.getItem("access");
    setSubmitting(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/experiences/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: place?.name,
          comment,
          rating: rating,
          place: Number(id),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("STATUS REAL:", response.status);
        console.error("ERRO REAL:", errorText);
        throw new Error("Erro ao enviar experiência");
      }

      const data = await response.json();

      setExperiences((prev) => [data, ...prev]);
      setComment("");
      setRating(null);
      setShowForm(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const ratedExperiences = experiences.filter((e) => e.rating);
  const averageRating = ratedExperiences.length
    ? (
        ratedExperiences.reduce((sum, e) => sum + e.rating, 0) /
        ratedExperiences.length
      ).toFixed(1)
    : null;

  const roundedStars = ratedExperiences.length
    ? Math.round(
        ratedExperiences.reduce((sum, e) => sum + e.rating, 0) /
          ratedExperiences.length
      )
    : 0;

  const ratingCount = (stars: number) =>
    experiences.filter((e) => e.rating === stars).length;

  const maxCount = Math.max(
    ratingCount(5),
    ratingCount(4),
    ratingCount(3),
    ratingCount(2),
    ratingCount(1),
    1
  );

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ textDecoration: "none", color: "#666" }}>
          Home
        </Link>{" "}
        /{" "}
        <Link
          href={`/destinations/${place?.destination}`}
          style={{ textDecoration: "none", color: "#666" }}
        >
          {destination?.name || "Destination"}
        </Link>{" "}
        / <span>{place?.name}</span>
      </div>

      <h1 style={{ fontSize: "32px", marginBottom: "30px" }}>
          Experiences about {place?.name}
        </h1>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ color: "#111", fontSize: "20px", fontWeight: "600" }}>
          {ratedExperiences.length
            ? `${"★".repeat(roundedStars)}${"☆".repeat(5 - roundedStars)}`
            : "No ratings yet"}
        </div>

        <div style={{ marginTop: "6px", color: "#777", fontSize: "14px" }}>
          {averageRating
            ? `${averageRating} average rating`
            : "No rating provided yet"}{" "}
          • {experiences.length} experience{experiences.length === 1 ? "" : "s"} shared
        </div>
      </div>

        <div
          style={{
            marginBottom: "30px",
            padding: "18px",
            border: "1px solid #eee",
            borderRadius: "12px",
            backgroundColor: "white",
            maxWidth: "520px",
          }}
        >

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>★★★★★</span>
              <span>{rating5}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>★★★★☆</span>
              <span>{rating4}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>★★★☆☆</span>
              <span>{rating3}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>★★☆☆☆</span>
              <span>{rating2}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>★☆☆☆☆</span>
              <span>{rating1}</span>
            </div>
          </div>
        </div>

      <div
        style={{
          marginBottom: "32px",
          padding: "20px",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          backgroundColor: "white",
          maxWidth: "650px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "18px", fontSize: "20px" }}>
          Ratings breakdown
        </h2>

        {[5, 4, 3, 2, 1].map((stars) => {
          const count = ratingCount(stars);
          const widthPercent = `${(count / maxCount) * 100}%`;

          return (
            <div
              key={stars}
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 28px",
                alignItems: "center",
                gap: "12px",
                marginBottom: "10px",
              }}
            >
              <div style={{ color: "#555", fontSize: "14px" }}>{stars}★</div>

              <div
                style={{
                  height: "10px",
                  backgroundColor: "#f1f1f1",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: widthPercent,
                    height: "100%",
                    backgroundColor: "#111",
                    borderRadius: "999px",
                  }}
                />
              </div>

              <div style={{ color: "#777", fontSize: "14px" }}>{count}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "30px" }}>
        <Link
          href={`/places/${id}/experiences`}
          style={{
            padding: "10px 16px",
            backgroundColor: "#f5f5f5",
            color: "#111",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "14px",
            border: "1px solid #ddd",
          }}
        >
          View experiences
        </Link>

        {isLoggedIn ? (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: "10px 16px",
              backgroundColor: "#111",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showForm ? "Close form" : "✍️ Share your experience"}
          </button>
        ) : (
          <Link
            href={`/login?next=/places/${id}`}
            style={{
              padding: "10px 16px",
              backgroundColor: "#111",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Login to share your experience
          </Link>
        )}
      </div>

      {showForm && isLoggedIn && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "12px",
            maxWidth: "600px",
            marginBottom: "40px",
            padding: "20px",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            backgroundColor: "white",
          }}
        >
          <h2 style={{ margin: 0 }}>Add your experience</h2>

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
              value={rating ?? ""}
              onChange={(e) => {
                const value = e.target.value;

                if (!value) {
                  setRating(null);
                  return;
                }

                const numeric = Number(value);

                if (numeric >= 1 && numeric <= 5) {
                  setRating(numeric);
                }
              }}
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
            disabled={submitting || !rating || !comment.trim()}
            style={{
              padding: "12px 16px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: "#111",
              color: "white",
              cursor: submitting || !rating || !comment.trim() ? "not-allowed" : "pointer",
              opacity: submitting || !rating || !comment.trim() ? 0.5 : 1,
              fontSize: "14px",
            }}
          >
            {submitting ? "Submitting..." : "Submit experience"}
          </button>
        </form>
      )}
    </main>
  );
}