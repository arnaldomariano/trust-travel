"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../lib/api";
export default function PlacePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [experiences, setExperiences] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "experience" | "update">("all");
  const [place, setPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRatings, setShowRatings] = useState(false);
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

    fetch(`${API_URL}/api/places/${id}/experiences/`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setExperiences(sorted);
      })
      .catch((err) => console.error(err));

fetch(`${API_URL}/api/places/${id}/updates/`, {
  credentials: "include",
})

.then(async (res) => {
  const data = await res.json();
  return data;
})

  .then((data) => {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.data)
      ? data.data
      : [];


    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setUpdates(sorted);
  })
  .catch((err) => console.error("UPDATES ERROR:", err));

    fetch(`${API_URL}/api/places/${id}/`)
      .then((res) => res.json())
      .then((data) => {
        setPlace(data);

        fetch(`${API_URL}/api/destinations/`)
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
      const response = await fetch(`${API_URL}/api/experiences/`, {
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

    const combinedFeed = [
      ...experiences.map((e) => ({ ...e, content_type: "experience" })),
      ...updates.map((u) => ({ ...u, content_type: "update" })),
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const filteredFeed = combinedFeed.filter((item) => {
      if (filter === "all") return true;
      return item.content_type === filter;
    });

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
        <h1>Activity in {place?.name}</h1>

        <div style={{ marginBottom: "24px" }}>
          <div style={{ marginTop: "6px", color: "#777", fontSize: "14px" }}>
            {experiences.length} experience{experiences.length === 1 ? "" : "s"} shared
          </div>

          <button
            onClick={() => setShowRatings(!showRatings)}
            style={{
              marginTop: "12px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              backgroundColor: "#f5f5f5",
              color: "#111",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showRatings ? "Hide ratings" : "Show ratings"}
          </button>
        </div>

        {showRatings && (
          <>
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
          </>
        )}

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

        <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          {["all", "experience", "update"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                backgroundColor: filter === f ? "#111" : "#f5f5f5",
                color: filter === f ? "white" : "#111",
                cursor: "pointer",
              }}
            >
              {f === "all" && "All"}
              {f === "experience" && "Experiences"}
              {f === "update" && "Events & Info"}
            </button>
          ))}
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

        <h2 style={{ marginBottom: "20px" }}>Activity</h2>

        {filteredFeed.length === 0 ? (
          <div
            style={{
              padding: "16px",
              border: "1px solid #eee",
              borderRadius: "10px",
              backgroundColor: "white",
              color: "#777",
              fontSize: "14px",
            }}
          >
            No activity found for this filter yet.
          </div>
        ) : (
          filteredFeed.map((item) => {
            const isExperience = item.content_type === "experience";

            const label = isExperience
              ? "Review"
              : item.type === "event"
              ? "Event"
              : item.type === "alert"
              ? "Alert"
              : "Info";

            const icon = isExperience
              ? "⭐"
              : item.type === "event"
              ? "🎭"
              : item.type === "alert"
              ? "⚠️"
              : "ℹ️";

            return (
              <div
                key={`${item.content_type}-${item.id}`}
                style={{
                  padding: "18px",
                  marginBottom: "14px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#777" }}>
                    {icon} {label}
                  </div>

                  {item.category && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#555",
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #eee",
                        borderRadius: "999px",
                        padding: "4px 8px",
                      }}
                    >
                      {item.category}
                    </div>
                  )}
                </div>

                {isExperience ? (
                  <>
                    <div style={{ fontWeight: "500", lineHeight: "1.5" }}>
                      {item.comment}
                    </div>

                    <div style={{ marginTop: "8px", color: "#777", fontSize: "13px" }}>
                      Rating: {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: "500", lineHeight: "1.5" }}>
                      {item.text}
                    </div>

                    <div style={{ marginTop: "8px", color: "#777", fontSize: "13px" }}>
                      Shared by {item.display_name || item.username || item.user}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
    </main>
  );
}
