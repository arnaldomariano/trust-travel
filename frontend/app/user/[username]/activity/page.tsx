"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../../lib/api";

export default function UserActivityPage() {
  const params = useParams();
  const router = useRouter();

  const username = Array.isArray(params.username)
    ? params.username[0]
    : params.username;

  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const res = await fetch(`${API_URL}/api/updates/`, {
          credentials: "include",
        });

        if (!res.ok) {
          console.error("Failed to load user activity");
          return;
        }

        const data = await res.json();

        const allUpdates = [
          ...(data.network || []),
          ...(data.others || []),
        ];

        const filtered = allUpdates.filter((item: any) => {
          return (
            item.user === username ||
            item.username === username ||
            item.display_name === username
          );
        });

        setUpdates(filtered);
      } catch (error) {
        console.error("User activity error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      loadActivity();
    }
  }, [username]);

  const displayName = useMemo(() => {
    const first = updates[0];

    if (!first) return username;

    return first.display_name || first.username || first.user || username;
  }, [updates, username]);

  const handleOpenUpdate = (item: any) => {
    if (item.type === "experience" && item.experience_id) {
      router.push(
        `/experiences/${item.experience_id}`
      );
      return;
    }

    if (item.type === "experience") {
      router.push(`/places/${item.place_id}/experiences`);
      return;
    }

    router.push(`/places/${item.place_id}`);
  };

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          Home
        </Link>{" "}
        / <span>User activity</span>
      </div>

      <h1>Activity from {displayName}</h1>

      <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "24px" }}>
        Recent experiences, events, alerts and information shared by this user.
      </p>

      {loading ? (
        <p style={{ color: "#666" }}>Loading activity...</p>
      ) : updates.length === 0 ? (
        <div style={emptyCard}>
          No activity found for this user yet.
        </div>
      ) : (
        <section style={{ display: "grid", gap: "14px" }}>
          {updates.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleOpenUpdate(item)}
              style={activityCard}
            >
              <div style={{ fontSize: "13px", color: "#777", marginBottom: "8px" }}>
                {item.type === "experience" && "⭐ Experience"}
                {item.type === "event" && "🎭 Event"}
                {item.type === "alert" && "⚠️ Alert"}
                {item.type === "info" && "ℹ️ Info"}
              </div>

              <div style={{ fontWeight: 700, lineHeight: 1.5 }}>
                {item.text || "Shared activity"}
              </div>

              <div style={{ marginTop: "8px", color: "#666", fontSize: "14px" }}>
                {item.place}
              </div>

              <div style={{ marginTop: "6px", color: "#999", fontSize: "13px" }}>
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>

              <div style={{ marginTop: "12px", fontSize: "13px", color: "#111" }}>
                Open →
              </div>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

const emptyCard = {
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "white",
  color: "#666",
};

const activityCard = {
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "white",
  color: "#111",
  textAlign: "left" as const,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};
