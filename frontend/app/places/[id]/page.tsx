"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

export default function PlacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shouldOpenUpdateForm = searchParams.get("share") === "update";
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [experiences, setExperiences] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "experience" | "update">("all");

  const [place, setPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [showRatings, setShowRatings] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateType, setUpdateType] = useState<"event" | "alert" | "info">("info");
  const [updateText, setUpdateText] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const [updateTitle, setUpdateTitle] = useState("");
  const [updateCategory, setUpdateCategory] = useState("general");
  const [updateEventDate, setUpdateEventDate] = useState("");
  const [updateExternalLink, setUpdateExternalLink] = useState("");
  const [updateSourceName, setUpdateSourceName] = useState("");
  const [updateSourceUrl, setUpdateSourceUrl] = useState("");
  const [updatePriority, setUpdatePriority] = useState<"low" | "normal" | "high" | "urgent">("normal");


    useEffect(() => {
      if (shouldOpenUpdateForm) {
        setShowUpdateForm(true);
      }
    }, [shouldOpenUpdateForm]);

  const router = useRouter();

  const getPlaceTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      country: "Country",
      city: "City / Region",
      attraction: "Tourist attraction",
      hotel: "Hotel",
      restaurant: "Restaurant / Café",
      nature: "Beach / Nature spot",
      other: "Place",
    };

    return labels[type || ""] || "Place";
  };

  const placeTypeLabel = getPlaceTypeLabel(place?.place_type);

  const parentLocationLabel =
    place?.place_type === "country"
      ? ""
      : place?.destination_country ||
        destination?.country ||
        place?.destination_name ||
        destination?.name ||
        "";

  const breadcrumbParentLabel =
    place?.place_type === "country"
      ? "Countries"
      : parentLocationLabel || "Places";

  const placeIntroText =
    place?.place_type === "country"
      ? `Explore country-level experiences, events and useful information shared about ${place?.name || "this country"}.`
      : place?.place_type === "city"
      ? `Explore experiences, events and useful information shared specifically about ${place?.name || "this city or region"}.`
      : `Explore traveler experiences, events and useful information shared about this specific place.`;

  const placeLocation =
    place?.place_type === "country"
      ? place?.destination_country || place?.name || ""
      : [
          placeTypeLabel,
          place?.city && place.city !== place?.name ? place.city : null,
          parentLocationLabel,
        ]
          .filter(Boolean)
          .join(" · ");

  const pageTitle =
      place?.place_type === "country" || place?.place_type === "city"
        ? `Experiences in ${place?.name || "this place"}`
        : `Activity in ${place?.name || "this place"}`;

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

    const handleSubmitUpdate = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!id) return;

      if (!updateText.trim()) {
        alert("Please write the event or information.");
        return;
      }

    const placeName = place?.name || "this place";

    const confirmed = window.confirm(
      `You are about to post this ${updateType} about ${placeName}. Continue?`
    );

    if (!confirmed) {
      return;
    }

      setSubmittingUpdate(true);

      try {
        const res = await fetch(`${API_URL}/api/updates/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
              place: id,
              type: updateType,
              category: updateCategory,
              title: updateTitle.trim(),
              text: updateText.trim(),
              event_date: updateEventDate || null,
              external_link: updateExternalLink.trim(),
              source_name: updateSourceName.trim(),
              source_url: updateSourceUrl.trim(),
              priority: updatePriority,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Failed to create update:", data);
          alert(data.detail || "Error sharing event or info.");
          return;
        }

        setUpdates((prev) => [data, ...prev]);
        setUpdateTitle("");
        setUpdateText("");
        setUpdateType("info");
        setUpdateCategory("general");
        setUpdateEventDate("");
        setUpdateExternalLink("");
        setUpdateSourceName("");
        setUpdateSourceUrl("");
        setUpdatePriority("normal");
        setShowUpdateForm(false);
        setFilter("update");
      } catch (error) {
        console.error("Create update failed:", error);
        alert("Error sharing event or info.");
      } finally {
        setSubmittingUpdate(false);
      }
    };

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ textDecoration: "none", color: "#666" }}>
          Home
        </Link>{" "}
        /{" "}
        <Link
          href="/destinations"
          style={{ textDecoration: "none", color: "#666" }}
        >
          {breadcrumbParentLabel}
        </Link>{" "}
        / <span>{place?.name || "Place"}</span>
      </div>

        <section
          style={{
            marginBottom: "28px",
            padding: "22px",
            border: "1px solid #eee",
            borderRadius: "16px",
            backgroundColor: "white",
          }}
        >
          <div style={{ fontSize: "13px", color: "#777", marginBottom: "8px" }}>
            {placeTypeLabel} overview
          </div>

          <h1 style={{ margin: 0, fontSize: "28px" }}>
            {place?.name || pageTitle}
          </h1>

          {placeLocation && (
            <div
              style={{
                marginTop: "6px",
                color: "#666",
                fontSize: "15px",
              }}
            >
              {placeLocation}
            </div>
          )}

          <p
            style={{
              marginTop: "14px",
              marginBottom: "18px",
              color: "#666",
              lineHeight: 1.5,
              maxWidth: "620px",
            }}
          >
            {placeIntroText}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>Experiences</div>
              <div style={overviewStatValue}>
                {experiences.length}
              </div>
            </div>

            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>Average rating</div>
              <div style={overviewStatValue}>
              {averageRating ? `${averageRating} ★` : "—"}
            </div>
            </div>

            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>Events & info</div>
              <div style={overviewStatValue}>
                  {visibleUpdates.length}
                </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => router.push(`/places/${id}/experiences`)}
              style={primaryButton}
            >
              View experiences
            </button>

            <button
              onClick={() => router.push(`/destinations?place=${place?.id}&share=true`)}
              style={secondaryButton}
            >
              Share experience
            </button>

            <button
              onClick={() => setShowRatings(!showRatings)}
              style={secondaryButton}
            >
              {showRatings ? "Hide ratings" : "Ratings & insights"}
            </button>

            <button
              onClick={() => setFilter(filter === "update" ? "all" : "update")}
              style={secondaryButton}
            >
              {filter === "update" ? "Show all activity" : "Events & info"}
            </button>

            <button
              onClick={() => setShowUpdateForm(!showUpdateForm)}
              style={secondaryButton}
            >
              {showUpdateForm ? "Cancel info post" : "Share event or info"}
            </button>

          </div>
        </section>

        {showUpdateForm && (
          <section
            style={{
              marginBottom: "28px",
              padding: "22px",
              border: "1px solid #eee",
              borderRadius: "16px",
              backgroundColor: "white",
              maxWidth: "760px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
              Place update
            </div>

            <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "22px" }}>
              Share event or info
            </h2>

            <p
              style={{
                marginTop: 0,
                marginBottom: "16px",
                color: "#666",
                lineHeight: 1.5,
              }}
            >
              Share an event, alert or useful information about this place.
            </p>

            <form onSubmit={handleSubmitUpdate} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Type</label>

                <select
                  value={updateType}
                  onChange={(e) =>
                    setUpdateType(e.target.value as "event" | "alert" | "info")
                  }
                  style={input}
                >
                  <option value="info">Useful info</option>
                  <option value="event">Event</option>
                  <option value="alert">Alert</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Short title</label>

                <input
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder={
                    updateType === "event"
                      ? "Event title, e.g. Free concert tonight"
                      : updateType === "alert"
                      ? "Alert title, e.g. Museum closed this Sunday"
                      : "Useful info title, e.g. Best entrance is on the north side"
                  }
                  maxLength={160}
                  style={input}
                />
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Details</label>

                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Write the event, alert or useful information..."
                  rows={4}
                  style={input}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Category</label>

                  <select
                    value={updateCategory}
                    onChange={(e) => setUpdateCategory(e.target.value)}
                    style={input}
                  >
                    <option value="general">General</option>
                    <option value="tourism">Tourism</option>
                    <option value="music">Music</option>
                    <option value="religious">Religious</option>
                    <option value="social">Social</option>
                    <option value="transport">Transport</option>
                    <option value="safety">Safety</option>
                    <option value="weather">Weather</option>
                    <option value="food">Food</option>
                    <option value="culture">Culture</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>
                    {updateType === "event" ? "Event date" : "Related date"}
                  </label>

                  <input
                    type="datetime-local"
                    value={updateEventDate}
                    onChange={(e) => setUpdateEventDate(e.target.value)}
                    style={input}
                  />
                </div>
              </div>

              {updateType === "alert" && (
                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Alert priority</label>

                  <select
                    value={updatePriority}
                    onChange={(e) =>
                      setUpdatePriority(
                        e.target.value as "low" | "normal" | "high" | "urgent"
                      )
                    }
                    style={input}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              )}

              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "#fafafa",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px" }}>Optional source and links</strong>

                  <p
                    style={{
                      margin: "6px 0 0 0",
                      color: "#666",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    Add a source or official link when the information should be verified.
                  </p>
                </div>

                <input
                  value={updateSourceName}
                  onChange={(e) => setUpdateSourceName(e.target.value)}
                  placeholder="Source name, e.g. official website, venue page, local authority"
                  style={input}
                />

                <input
                  value={updateSourceUrl}
                  onChange={(e) => setUpdateSourceUrl(e.target.value)}
                  placeholder="Source URL, e.g. https://..."
                  style={input}
                />

                <input
                  value={updateExternalLink}
                  onChange={(e) => setUpdateExternalLink(e.target.value)}
                  placeholder="Related link, e.g. ticket page, event page, article..."
                  style={input}
                />
              </div>

              <button
                type="submit"
                disabled={submittingUpdate || !updateText.trim()}
                style={{
                  ...primaryButton,
                  opacity: submittingUpdate || !updateText.trim() ? 0.5 : 1,
                  cursor:
                    submittingUpdate || !updateText.trim() ? "not-allowed" : "pointer",
                }}
              >
                {submittingUpdate
                  ? "Sharing..."
                  : `Share about ${place?.name || "this place"}`}
              </button>
            </form>
          </section>
        )}

            {showRatings && (
              <section
                style={{
                  marginBottom: "32px",
                  padding: "22px",
                  border: "1px solid #eee",
                  borderRadius: "16px",
                  backgroundColor: "white",
                  maxWidth: "760px",
                }}
              >
                <div style={{ marginBottom: "18px" }}>
                  <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
                    Place analytics
                  </div>

                  <h2 style={{ margin: 0, fontSize: "22px" }}>
                    Ratings & insights
                  </h2>

                  <p
                    style={{
                      marginTop: "8px",
                      marginBottom: 0,
                      color: "#666",
                      lineHeight: 1.5,
                    }}
                  >
                    Understand how travelers are evaluating this place based on shared experiences.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "12px",
                    marginBottom: "24px",
                  }}
                >
                  <div style={insightStatCard}>
                    <div style={overviewStatLabel}>Average rating</div>
                    <div style={overviewStatValue}>
                      {averageRating ? `${averageRating} ★` : "—"}
                    </div>
                  </div>

                  <div style={insightStatCard}>
                    <div style={overviewStatLabel}>Total reviews</div>
                    <div style={overviewStatValue}>
                      {experiences.length}
                    </div>
                  </div>

                  <div style={insightStatCard}>
                    <div style={overviewStatLabel}>Rated experiences</div>
                    <div style={overviewStatValue}>
                      {ratedExperiences.length}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "22px",
                  }}
                >
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: "14px", fontSize: "17px" }}>
                      Rating distribution
                    </h3>

                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = ratingCount(stars);
                      const widthPercent = `${(count / maxCount) * 100}%`;

                      return (
                        <div
                          key={stars}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "42px 1fr 32px",
                            alignItems: "center",
                            gap: "12px",
                            marginBottom: "10px",
                          }}
                        >
                          <div style={{ color: "#555", fontSize: "14px" }}>
                            {stars}★
                          </div>

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

                          <div style={{ color: "#777", fontSize: "14px" }}>
                            {count}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      border: "1px dashed #ddd",
                      borderRadius: "14px",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <h3 style={{ marginTop: 0, marginBottom: "8px", fontSize: "17px" }}>
                      Traveler insights
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        color: "#666",
                        lineHeight: 1.5,
                        fontSize: "14px",
                      }}
                    >
                      Coming soon: breakdown by traveler profile, nationality, age group,
                      trip type and travel style.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {filter === "update" && (
              <section
                style={{
                  marginBottom: "22px",
                  padding: "22px",
                  border: "1px solid #eee",
                  borderRadius: "16px",
                  backgroundColor: "white",
                  maxWidth: "760px",
                }}
              >
                <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
                  Place information
                </div>

                <h2 style={{ margin: 0, fontSize: "22px" }}>Events & info</h2>

                <p
                  style={{
                    marginTop: "8px",
                    marginBottom: "18px",
                    color: "#666",
                    lineHeight: 1.5,
                  }}
                >
                  Follow events, alerts and useful information shared about this place.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div style={insightStatCard}>
                    <div style={overviewStatLabel}>Events</div>
                    <div style={overviewStatValue}>
                      {updates.filter((u) => u.type === "event").length}
                    </div>
                  </div>

                  <div style={insightStatCard}>
                    <div style={overviewStatLabel}>Alerts</div>
                    <div style={overviewStatValue}>
                      {updates.filter((u) => u.type === "alert").length}
                    </div>
                  </div>

                  <div style={insightStatCard}>
                    <div style={overviewStatLabel}>Useful info</div>
                    <div style={overviewStatValue}>
                      {updates.filter((u) => u.type === "info").length}
                    </div>
                  </div>
                </div>
              </section>
            )}

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
            {filter === "update"
              ? "No events or information shared about this place yet."
              : "No activity found for this place yet."}
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

                    <div style={{ marginTop: "12px" }}>
                      <Link
                        href={`/updates/${item.id}`}
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
                        Read update
                      </Link>
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

const overviewStatCard = {
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "12px",
  backgroundColor: "#fafafa",
};

const insightStatCard = {
  padding: "16px",
  border: "1px solid #eee",
  borderRadius: "14px",
  backgroundColor: "#fafafa",
};

const overviewStatLabel = {
  fontSize: "12px",
  color: "#777",
  marginBottom: "6px",
};

const overviewStatValue = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#111",
};

const primaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#111",
  color: "white",
  cursor: "pointer",
  fontSize: "14px",
};

const secondaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  backgroundColor: "white",
  color: "#111",
  cursor: "pointer",
  fontSize: "14px",
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const label = {
  fontSize: "13px",
  color: "#666",
  fontWeight: 600,
};