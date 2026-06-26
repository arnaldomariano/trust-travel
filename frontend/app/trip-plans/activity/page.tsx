"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_URL } from "../../lib/api";

type ActivityItem = {
  type: string;
  category?: string;
  id: number;
  title: string;
  text: string;
  rating?: number | null;
  priority?: string;
  event_date?: string | null;
  external_link?: string;
  source_name?: string;
  source_url?: string;
  place_id: number | null;
  place_name: string;
  destination_name: string;
  destination_country: string;
  trip_plan_id: number;
  trip_plan_title: string;
  watch_mode: string;
  created_at: string;
  is_saved: boolean;
  url: string;
};

type ActivityResponse = {
  count: number;
  items: ActivityItem[];
};

type ActivityFilter = "all" | "experience" | "alert" | "info" | "event" | "update";

export default function TripPlanActivityPage() {
  const [activity, setActivity] = useState<ActivityResponse>({
    count: 0,
    items: [],
  });

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [error, setError] = useState("");

  const markActivityAsSeen = async () => {
  try {
    const res = await fetch(`${API_URL}/api/trip-plans/activity/seen/`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to mark trip activity as seen:", res.status, text);
    }
  } catch (error) {
    console.error("Trip activity seen error:", error);
  }
};

  const loadActivity = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_URL}/api/trip-plans/activity/items/`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to load trip activity:", res.status, text);
          setError("Could not load Trip Radar activity.");
          return;
        }

        const data = await res.json();

        setActivity({
          count: data.count || 0,
          items: Array.isArray(data.items) ? data.items : [],
        });

        await markActivityAsSeen();
      } catch (error) {
        console.error("Trip activity fetch error:", error);
        setError("Could not load Trip Radar activity.");
      } finally {
        setLoading(false);
      }
    };
  useEffect(() => {
    loadActivity();
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "all") return activity.items;

    return activity.items.filter((item) => {
      if (filter === "experience") {
        return item.type === "experience";
      }

      return item.type === filter || item.category === filter;
    });
  }, [activity.items, filter]);

  const experienceCount = activity.items.filter(
    (item) => item.type === "experience"
  ).length;

  const alertCount = activity.items.filter(
    (item) => item.type === "alert" || item.category === "alert"
  ).length;

  const infoCount = activity.items.filter(
    (item) => item.type === "info" || item.category === "info"
  ).length;

  const eventCount = activity.items.filter(
    (item) => item.type === "event" || item.category === "event"
  ).length;

  const getTypeLabel = (item: ActivityItem) => {
    if (item.type === "experience") return "Experience";
    if (item.type === "alert") return "Alert";
    if (item.type === "info") return "Info";
    if (item.type === "event") return "Event";
    return item.category || item.type || "Update";
  };

  const getTypeBadgeStyle = (item: ActivityItem) => {
    if (item.type === "experience") return experienceBadge;
    if (item.type === "alert" || item.category === "alert") return alertBadge;
    if (item.type === "event" || item.category === "event") return eventBadge;
    return infoBadge;
  };

  const getRelativeTime = (dateValue: string) => {
    const date = new Date(dateValue);
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (Number.isNaN(diffMinutes)) return "";

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        /{" "}
        <Link href="/trip-plans" style={breadcrumbLink}>
          Trip plans
        </Link>{" "}
        / <span>Activity</span>
      </div>

      <section style={heroCard}>
        <div style={label}>Trust Radar</div>

        <h1 style={titleStyle}>Trip activity</h1>

        <p style={descriptionText}>
          New experiences, alerts, events and useful information found in places
          monitored by your Trip Radar.
        </p>

        <div style={actions}>
          <Link href="/trip-plans" style={secondaryLink}>
            Back to my trips
          </Link>

          <Link href="/" style={primaryLink}>
            Explore feed
          </Link>
        </div>
      </section>

      <section style={toolbar}>
        <button
          type="button"
          onClick={() => setFilter("all")}
          style={{
            ...filterButton,
            ...(filter === "all" ? activeFilterButton : {}),
          }}
        >
          All {activity.count}
        </button>

        <button
          type="button"
          onClick={() => setFilter("experience")}
          style={{
            ...filterButton,
            ...(filter === "experience" ? activeFilterButton : {}),
          }}
        >
          Experiences {experienceCount}
        </button>

        <button
          type="button"
          onClick={() => setFilter("alert")}
          style={{
            ...filterButton,
            ...(filter === "alert" ? activeFilterButton : {}),
          }}
        >
          Alerts {alertCount}
        </button>

        <button
          type="button"
          onClick={() => setFilter("info")}
          style={{
            ...filterButton,
            ...(filter === "info" ? activeFilterButton : {}),
          }}
        >
          Info {infoCount}
        </button>

        <button
          type="button"
          onClick={() => setFilter("event")}
          style={{
            ...filterButton,
            ...(filter === "event" ? activeFilterButton : {}),
          }}
        >
          Events {eventCount}
        </button>

        <button
          type="button"
          onClick={loadActivity}
          style={secondaryButton}
        >
          Refresh
        </button>
      </section>

      {loading ? (
        <div style={emptyBox}>Loading Trip Radar activity...</div>
      ) : error ? (
        <div style={errorBox}>{error}</div>
      ) : filteredItems.length === 0 ? (
        <div style={emptyBox}>
          <p style={{ marginTop: 0 }}>No activity found for this filter.</p>

          <p style={muted}>
            When travelers share something new in places monitored by your Radar,
            it will appear here.
          </p>
        </div>
      ) : (
        <section style={activityList}>
            {filteredItems.map((item, index) => (
              <article key={`${item.type}-${item.id}-${index}`} style={activityCard}>
              <div style={activityHeader}>
                <span style={getTypeBadgeStyle(item)}>
                  {getTypeLabel(item)}
                </span>

                <span style={activityTime}>
                  {getRelativeTime(item.created_at)}
                </span>
              </div>

              <h2 style={activityTitle}>{item.title || "Untitled activity"}</h2>

              <div style={activityMeta}>
                <span>{item.trip_plan_title}</span>

                {item.place_name && (
                  <>
                    <span>·</span>
                    <span>{item.place_name}</span>
                  </>
                )}

                {item.destination_country && (
                  <>
                    <span>·</span>
                    <span>{item.destination_country}</span>
                  </>
                )}
              </div>

              {typeof item.rating === "number" && item.rating > 0 && (
                <div style={rating}>
                  {"★".repeat(item.rating)}
                  {"☆".repeat(5 - item.rating)}
                </div>
              )}

              {item.text && (
                <p style={activityText}>
                  {item.text.length > 220
                    ? `${item.text.slice(0, 220)}...`
                    : item.text}
                </p>
              )}

              {item.event_date && (
                <div style={eventDate}>
                  Date: {new Date(item.event_date).toLocaleDateString()}
                </div>
              )}

              <div style={actions}>
                {item.url ? (
                  <Link href={item.url} style={primaryLink}>
                    Open
                  </Link>
                ) : item.place_id ? (
                  <Link
                    href={`/places/${item.place_id}/experiences`}
                    style={primaryLink}
                  >
                    Open place
                  </Link>
                ) : null}

                {item.trip_plan_id && (
                  <Link
                    href={`/trip-plans/${item.trip_plan_id}`}
                    style={secondaryLink}
                  >
                    View trip
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

const page = {
  maxWidth: "860px",
  margin: "0 auto",
  padding: "40px",
};

const breadcrumb = {
  marginBottom: "20px",
  color: "#666",
  fontSize: "14px",
};

const breadcrumbLink = {
  color: "#666",
  textDecoration: "none",
};

const heroCard = {
  padding: "24px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "white",
  marginBottom: "18px",
};

const label = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
};

const titleStyle = {
  margin: "6px 0 0 0",
  fontSize: "30px",
};

const descriptionText = {
  margin: "12px 0 0 0",
  color: "#555",
  lineHeight: 1.6,
};

const toolbar = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginBottom: "18px",
};

const filterButton = {
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  color: "#444",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 700,
};

const activeFilterButton = {
  background: "black",
  color: "white",
  border: "1px solid black",
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "18px",
};

const primaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const secondaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  textDecoration: "none",
};

const secondaryButton = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 700,
};

const emptyBox = {
  padding: "22px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
};

const errorBox = {
  marginBottom: "18px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
  fontSize: "14px",
};

const activityList = {
  display: "grid",
  gap: "12px",
};

const activityCard = {
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  display: "grid",
  gap: "8px",
};

const activityHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const activityTitle = {
  margin: 0,
  fontSize: "20px",
};

const activityMeta = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap" as const,
  color: "#666",
  fontSize: "14px",
};

const activityText = {
  margin: 0,
  color: "#333",
  lineHeight: 1.5,
};

const activityTime = {
  color: "#777",
  fontSize: "13px",
};

const experienceBadge = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: "12px",
  fontWeight: 700,
};

const alertBadge = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#fff5f5",
  color: "#991b1b",
  fontSize: "12px",
  fontWeight: 700,
};

const infoBadge = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "12px",
  fontWeight: 700,
};

const eventBadge = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#fff7ed",
  color: "#9a3412",
  fontSize: "12px",
  fontWeight: 700,
};

const rating = {
  color: "#f5b50a",
  fontSize: "18px",
};

const eventDate = {
  padding: "8px 10px",
  borderRadius: "10px",
  background: "#f9fafb",
  color: "#555",
  fontSize: "13px",
};

const muted = {
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};