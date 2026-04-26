"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import { labels } from "./lib/labels";
import { getInitials, getColorFromName } from "./lib/avatar";
import { API_URL } from "./lib/api";

export default function HomePage() {
  const { username, isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const t = labels.en;

  const [updates, setUpdates] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // =========================
  // Redirect anonymous users
  // =========================
  useEffect(() => {
    if (!loading && username === null) {
      router.push("/login");
    }
  }, [loading, username, router]);

  // =========================
  // Load feed updates
  // =========================
  const loadUpdates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/updates/`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        const error = await res.text();
        console.error("API ERROR:", error);
        return;
      }

      const data = await res.json();

      const merged = [...(data.network || []), ...(data.others || [])];

      const unique = Array.from(
        new Map(merged.map((item: any) => [item.id, item])).values()
      );

      const sorted = unique.sort((a: any, b: any) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });

      setUpdates(sorted);
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Fetch failed:", err);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    loadUpdates();

    const handler = () => loadUpdates();

    window.addEventListener("connectionsUpdated", handler);

    return () => {
      window.removeEventListener("connectionsUpdated", handler);
    };
  }, [isLoggedIn]);

  // =========================
  // Group updates by user/public code
  // =========================
  const groupedByUser = updates.reduce((acc: any, item: any) => {
    if (!acc[item.user]) acc[item.user] = [];

    acc[item.user].push(item);

    acc[item.user].sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    return acc;
  }, {});

  const filteredEntries = Object.entries(groupedByUser)
    .map(([user, items]: any) => {
      const lastUpdate = items.reduce((latest: any, current: any) => {
        return new Date(current.created_at) > new Date(latest.created_at)
          ? current
          : latest;
      });

      return {
        user,
        items,
        lastUpdate,
        priority: lastUpdate.priority || 2,
      };
    })
    .filter((entry: any) => {
      if (activeFilter === "all") return true;
      return entry.lastUpdate?.type === activeFilter;
    })
    .sort((a: any, b: any) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return (
        new Date(b.lastUpdate.created_at).getTime() -
        new Date(a.lastUpdate.created_at).getTime()
      );
    });

  // =========================
  // Split feed sections
  // =========================
  const trusted = filteredEntries.filter((e: any) => e.lastUpdate.is_friend);
  const explore = filteredEntries.filter((e: any) => !e.lastUpdate.is_friend);

  // =========================
  // Mark user updates as seen
  // =========================
  const markUserAsSeen = async (targetUserId: number) => {
    setUpdates((prev) =>
      prev.map((u: any) =>
        u.user_id === targetUserId ? { ...u, is_new: false } : u
      )
    );

    await fetch(`${API_URL}/api/feed/seen/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: targetUserId,
      }),
    });
  };

  // =========================
  // Render user card
  // =========================
  const renderCard = (entry: any) => {
    const user = entry.user;
    const lastUpdate = entry.lastUpdate;
    const newCount = entry.items.filter((i: any) => i.is_new).length;

    // Trusted users can show username + public code.
    // Explore users remain identified only by public code.
    const displayName = lastUpdate.is_friend
      ? lastUpdate.display_name || lastUpdate.username
      : user;

    const displayCode = user;

    // Only trusted users can show their real avatar.
    // Explore/public users remain protected.
    const avatarUrl = lastUpdate.is_friend ? lastUpdate.avatar_url : null;

    const isOpen = openUser === user;

    return (
      <div
        key={user}
        onClick={() => setOpenUser(isOpen ? null : user)}
        style={{ perspective: "1000px", width: "160px", height: "220px" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "0.5s",
          }}
        >
          {/* Front */}
          <div
            style={{
              ...card,
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
            }}
          >
            <Avatar
              name={displayName}
              avatarUrl={avatarUrl}
              hasNew={newCount > 0}
            />

            <strong style={{ marginTop: "10px" }}>{displayName}</strong>

            {lastUpdate.is_friend && <span style={muted}>{displayCode}</span>}

            <span style={muted}>{newCount > 0 ? `${newCount} new` : ""}</span>
          </div>

          {/* Back */}
          <div
            style={{
              ...card,
              position: "absolute",
              width: "100%",
              height: "100%",
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              overflowY: "auto",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            {entry.items.slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                style={{
                  width: "100%",
                  padding: "6px 0",
                  borderBottom: "1px solid #eee",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
                onClick={async (e) => {
                  e.stopPropagation();

                  await markUserAsSeen(entry.lastUpdate.user_id);

                  router.push(`/places/${item.place_id}`);
                }}
              >
                <strong>{item.type}</strong> — {item.place}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // =========================
  // Render feed
  // =========================
  const renderFeed = () => {
    return (
      <>
        {trusted.length > 0 && (
          <>
            <h2 style={{ marginTop: "30px" }}>Trusted Network</h2>
            <section style={grid}>{trusted.map(renderCard)}</section>
          </>
        )}

        {explore.length > 0 && (
          <>
            <h2 style={{ marginTop: "30px" }}>Explore</h2>
            <section style={grid}>{explore.map(renderCard)}</section>
          </>
        )}
      </>
    );
  };

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>
      <h1>{t.appName}</h1>

      {/* Top actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          margin: "20px 0",
        }}
      >
        {/* Feed filters */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {["all", "event", "alert", "experience", "info", "connections"].map(
            (f) => {
              const label =
                f === "connections" && requests.length > 0
                  ? `connections (${requests.length})`
                  : f;

              return (
                <button
                  key={f}
                  onClick={() => {
                    if (f === "connections") {
                      router.push("/connections");
                      return;
                    }

                    setActiveFilter(f);
                  }}
                  style={filterButton(activeFilter === f)}
                >
                  {label}
                </button>
              );
            }
          )}
        </div>

        {/* Post button */}
        <button onClick={() => router.push("/create")} style={primaryButton}>
          Post
        </button>
      </div>

      {/* Feed content */}
      {renderFeed()}
    </main>
  );
}

// =========================
// Components
// =========================

const Avatar = ({
  name,
  avatarUrl,
  hasNew,
}: {
  name: string;
  avatarUrl?: string | null;
  hasNew?: boolean;
}) => {
  const color = getColorFromName(name);

  return (
    <div
      style={{
        position: "relative",
        width: "70px",
        height: "70px",
      }}
    >
      {hasNew && (
        <div
          style={{
            position: "absolute",
            inset: "-6px",
            borderRadius: "50%",
            background: color,
            filter: "blur(10px)",
            opacity: 0.35,
            animation: "heartbeatGlow 2.2s ease-in-out infinite",
            zIndex: 0,
          }}
        />
      )}

      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            border: "1px solid #eee",
            zIndex: 1,
          }}
        />
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            zIndex: 1,
          }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
};

// =========================
// Styles
// =========================

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: "20px",
  marginTop: "20px",
};

const card = {
  borderRadius: "16px",
  border: "1px solid #eee",
  padding: "16px",
  background: "white",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: "10px",
};

const primaryButton = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const muted = {
  fontSize: "12px",
  color: "#666",
};

const filterButton = (active: boolean) => ({
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: active ? "black" : "white",
  color: active ? "white" : "black",
  cursor: "pointer",
});