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
  const [showCreateMenu, setShowCreateMenu] = useState(false);

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
     const markUpdateAsSeen = (updateId: number) => {
          // Update the UI immediately.
          setUpdates((prev) =>
            prev.map((u: any) =>
              u.id === updateId ? { ...u, is_new: false } : u
            )
          );

          // Persist the seen state in the backend without blocking navigation.
          fetch(`${API_URL}/api/feed/updates/seen/`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              update_id: updateId,
            }),
          }).catch((error) => {
            console.error("Failed to mark update as seen:", error);
          });
        };

    const formatActivityDate = (dateString: string) => {
      if (!dateString) return "";

      const date = new Date(dateString);

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
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
            {newCount > 0 && (
              <div style={trustBadge}>
                T
              </div>
            )}

            <Avatar
              name={displayName}
              avatarUrl={avatarUrl}
              hasNew={newCount > 0}
            />

            <strong style={{ marginTop: "10px" }}>{displayName}</strong>

            {lastUpdate.is_friend && <span style={muted}>{displayCode}</span>}

            <span style={muted}>{newCount > 0 ? "New activity" : ""}</span>
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
                justifyContent: "flex-start",
                textAlign: "center",
                paddingTop: "18px",
                paddingBottom: "18px",
              }}
            >
            {entry.items.slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderBottom: "1px solid #eee",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "center",
                  flexShrink: 0,
                }}

                onClick={(e) => {
                  e.stopPropagation();

                  markUpdateAsSeen(item.id);

                 if (item.type === "experience" && item.experience_id) {
                  router.push(`/places/${item.place_id}/experiences?highlight=${item.experience_id}`);
                } else if (item.type === "experience") {
                  router.push(`/places/${item.place_id}/experiences`);
                } else {
                  router.push(`/places/${item.place_id}`);
                }
                }}

              >
                <div>
                    <strong>
                      {item.is_new
                        ? item.type === "experience"
                          ? "⭐ "
                          : item.type === "event"
                          ? "🎭 "
                          : item.type === "alert"
                          ? "⚠️ "
                          : "ℹ️ "
                        : ""}

                      {item.type === "experience"
                        ? item.text || "Experience"
                        : item.type === "event"
                        ? `Event — ${item.place}`
                        : item.type === "alert"
                        ? `Alert — ${item.place}`
                        : `Info — ${item.place}`}
                    </strong>

                    {item.type === "experience" && (
                      <div style={{ marginTop: "3px", color: "#666", fontSize: "11px" }}>
                        {item.place}
                      </div>
                    )}

                  <div style={{ marginTop: "4px", color: "#777", fontSize: "11px" }}>
                    {formatActivityDate(item.created_at)}
                  </div>
                </div>
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
      if (filteredEntries.length === 0) {
        return <EmptyFeedCard activeFilter={activeFilter} router={router} />;
      }

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

        {/* Create / Share menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowCreateMenu((prev) => !prev)}
            style={primaryButton}
          >
            Create / Share
          </button>

          {showCreateMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "44px",
                minWidth: "220px",
                padding: "8px",
                border: "1px solid #eee",
                borderRadius: "12px",
                background: "white",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 10,
              }}
            >
              <button
                onClick={() => {
                  setShowCreateMenu(false);
                  router.push("/create");
                }}
                style={menuItemButton}
              >
                Post tip, event or alert
              </button>

              <button
                onClick={() => {
                  setShowCreateMenu(false);
                  router.push("/destinations");
                }}
                style={menuItemButton}
              >
                Share an experience
              </button>
            </div>
          )}
        </div>
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

function EmptyFeedCard({
  activeFilter,
  router,
}: {
  activeFilter: string;
  router: any;
}) {
  const title =
    activeFilter === "event"
      ? "Be the first to share an event"
      : activeFilter === "alert"
      ? "Help travelers stay aware"
      : activeFilter === "experience"
      ? "Start with a recent experience"
      : activeFilter === "info"
      ? "Share a useful local tip"
      : "Start your trusted travel network";

  const message =
    activeFilter === "event"
      ? "Know about a concert, festival, exhibition, or local gathering? Share it with people who may be planning a trip."
      : activeFilter === "alert"
      ? "If you know something travelers should be aware of, share it as an alert."
      : activeFilter === "experience"
      ? "Visited a beach, restaurant, museum, hotel, or city recently? Your comment could help someone decide."
      : activeFilter === "info"
      ? "Share practical information, a local detail, or a small tip that could help another traveler."
      : "Share a place you visited recently, a restaurant you liked, an event you heard about, or invite trusted friends to build your network.";

 const actionLabel =
  activeFilter === "event"
    ? "Post an event"
    : activeFilter === "alert"
    ? "Post an alert"
    : activeFilter === "experience"
    ? "Share an experience"
    : activeFilter === "info"
    ? "Post a tip"
    : "Start posting";

  const handlePrimaryAction = () => {
      if (activeFilter === "experience") {
        router.push("/destinations");
        return;
      }

      router.push("/create");
    };

  return (
    <section style={emptyCard}>
      <div style={emptyIcon}>✈️</div>

      <h2 style={emptyTitle}>{title}</h2>

      <p style={emptyMessage}>{message}</p>

      <p style={emptyFutureNote}>
        Later, Trust Travel can also help you create posts from travel photos,
        using details like date and location only with your permission.
      </p>

      <div style={emptyActions}>
        <button onClick={handlePrimaryAction} style={primaryButton}>
          {actionLabel}
        </button>

        <button
          onClick={() => router.push("/connections")}
          style={secondaryButton}
        >
          Invite a friend
        </button>
      </div>
    </section>
  );
}


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

const secondaryButton = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  color: "black",
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

const emptyCard = {
  marginTop: "36px",
  padding: "28px",
  borderRadius: "18px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  maxWidth: "680px",
};

const emptyIcon = {
  fontSize: "34px",
  marginBottom: "12px",
};

const emptyTitle = {
  margin: "0 0 10px 0",
  fontSize: "24px",
};

const emptyMessage = {
  color: "#555",
  lineHeight: 1.6,
  marginBottom: "14px",
};

const emptyFutureNote = {
  color: "#777",
  fontSize: "13px",
  lineHeight: 1.5,
  marginBottom: "20px",
};

const emptyActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const menuItemButton = {
  width: "100%",
  padding: "10px 12px",
  border: "none",
  borderRadius: "8px",
  background: "white",
  color: "black",
  textAlign: "left" as const,
  cursor: "pointer",
  fontSize: "14px",
};

const trustBadge = {
  position: "absolute" as const,
  top: "12px",
  right: "12px",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: "bold",
  boxShadow: "0 0 10px rgba(0,0,0,0.12)",
  zIndex: 2,
};