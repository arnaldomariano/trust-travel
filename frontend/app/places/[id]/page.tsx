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
  const [photos, setPhotos] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "experience" | "update">("all");

  const [place, setPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [showRatings, setShowRatings] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const placeLocation = [
    place?.city || place?.destination_name || destination?.city || destination?.name,
    place?.destination_country || destination?.country,
  ]
    .filter(Boolean)
    .join(" · ");

  const rating5 = experiences.filter((e) => e.rating === 5).length;
  const rating4 = experiences.filter((e) => e.rating === 4).length;
  const rating3 = experiences.filter((e) => e.rating === 3).length;
  const rating2 = experiences.filter((e) => e.rating === 2).length;
  const rating1 = experiences.filter((e) => e.rating === 1).length;

useEffect(() => {
  const checkLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/me/`, {
        credentials: "include",
      });

      setIsLoggedIn(res.ok);
    } catch (error) {
      console.error("Login check failed:", error);
      setIsLoggedIn(false);
    }
  };

  checkLogin();
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

    fetch(`${API_URL}/api/places/${id}/photos/`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setPhotos(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("PHOTOS ERROR:", err));


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

    // =========================
    // Build mixed activity feed
    // =========================
    // Experience updates are created automatically for the main social feed.
    // On the place page, experiences are already shown from the experiences list,
    // so we hide automatic experience updates here to avoid duplicate cards.
    const visibleUpdates = updates.filter((u) => u.type !== "experience");

    const combinedFeed = [
      ...experiences.map((e) => ({ ...e, content_type: "experience" })),
      ...visibleUpdates.map((u) => ({ ...u, content_type: "update" })),
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
          {place?.destination_name || destination?.name || "Destination"}
        </Link>{" "}
        / <span>{place?.name}</span>
      </div>

        <h1>Activity in {place?.name}</h1>

        {placeLocation && (
          <div style={{ marginTop: "-8px", marginBottom: "8px", color: "#666", fontSize: "15px" }}>
            {placeLocation}
          </div>
        )}

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
                    {item.title && (
                      <div
                        style={{
                          fontWeight: 600,
                          lineHeight: "1.5",
                          marginBottom: "6px",
                        }}
                      >
                        {item.title}
                      </div>
                    )}

                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title || "Shared experience"}
                        style={{
                          width: "140px",
                          height: "90px",
                          objectFit: "cover",
                          borderRadius: "10px",
                          marginTop: "8px",
                          marginBottom: "10px",
                          border: "1px solid #eee",
                          display: "block",
                        }}
                      />
                    )}

                    <div style={{ fontWeight: "400", lineHeight: "1.5" }}>
                      {item.comment}
                    </div>

                    <div style={{ marginTop: "8px", color: "#777", fontSize: "13px" }}>
                      Rating: {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </div>

                    <div style={{ marginTop: "6px", color: "#777", fontSize: "13px" }}>
                      Shared by {item.user || "Unknown user"} •{" "}
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <Link
                          href={`/places/${id}/experiences?highlight=${item.id}`}
                          style={{
                            display: "inline-block",
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "1px solid #ddd",
                            backgroundColor: "#f9f9f9",
                            color: "#111",
                            textDecoration: "none",
                            fontSize: "13px",
                          }}
                        >
                          Read experience
                        </Link>
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
