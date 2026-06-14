"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import { labels } from "./lib/labels";
import { getInitials, getColorFromName } from "./lib/avatar";
import { API_URL } from "./lib/api";
import { countryCodeToFlagEmoji } from "./lib/flags";

const getProfessionBadge = (profession?: string | null) => {
  const value = (profession || "").trim().toLowerCase();

  if (!value) return "";

  if (value.includes("journalist") || value.includes("jornalista")) return "J";
  if (value.includes("doctor") || value.includes("médico") || value.includes("medico")) return "MD";
  if (value.includes("lawyer") || value.includes("advogado") || value.includes("advogada")) return "LAW";
  if (
    value.includes("teacher") ||
    value.includes("professor") ||
    value.includes("professora") ||
    value.includes("educator")
  ) {
    return "EDU";
  }
  if (value.includes("engineer") || value.includes("engenheiro") || value.includes("engenheira")) return "ENG";
  if (value.includes("artist") || value.includes("artista") || value.includes("creative")) return "ART";
  if (
    value.includes("developer") ||
    value.includes("programmer") ||
    value.includes("programador") ||
    value.includes("technology") ||
    value.includes("tech")
  ) {
    return "DEV";
  }
  if (
    value.includes("athlete") ||
    value.includes("atleta") ||
    value.includes("sports") ||
    value.includes("esportista") ||
    value.includes("surfer") ||
    value.includes("surfista")
  ) {
    return "ATH";
  }

  return "PRO";
};

export default function HomePage() {
  const { username, isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const t = labels.en;

  const [updates, setUpdates] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [openProfileContextUser, setOpenProfileContextUser] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const [tripPlanActivity, setTripPlanActivity] = useState<{
      has_activity: boolean;
      plans_with_activity_count: number;
      total_related_count: number;
      total_unsaved_related_count?: number;
  } | null>(null);


// Anonymous users see the public landing screen.
// Logged-in users see the feed.

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
          const priorityA = a.feed_priority || 2;
          const priorityB = b.feed_priority || 2;

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
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

useEffect(() => {
  const loadTripPlanActivity = async () => {
    try {
      const res = await fetch(`${API_URL}/api/trip-plans/activity/`, {
        credentials: "include",
      });

      if (!res.ok) {
        setTripPlanActivity(null);
        return;
      }

      const data = await res.json();
      setTripPlanActivity(data);
    } catch (error) {
      console.error("Trip plan activity fetch error:", error);
      setTripPlanActivity(null);
    }
  };

  loadTripPlanActivity();
}, []);

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
          priority: lastUpdate.feed_priority || 2,
        };
    })
    .filter((entry: any) => {
      if (activeFilter === "all") return true;

      return entry.items.some((item: any) => item.type === activeFilter);
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

    const formatActivityDate = (dateString?: string | null) => {
      if (!dateString) return "";

      const date = new Date(dateString);

      if (Number.isNaN(date.getTime())) return "";

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };

// =========================
// Activity labels
// =========================
const getActivityLabel = (type: string, item?: any) => {
  if (type === "experience") return "Experience";
  if (type === "event") return "Event";

  if (type === "alert") {
    const priority = item?.priority;

    if (priority === "urgent") return "Alert · Urgent";
    if (priority === "high") return "Alert · High";
    if (priority === "low") return "Alert · Low";

    return "Alert";
  }

  if (type === "info") return "Info";
  return "Activity";
};

const getActivityIcon = (type: string) => {
  if (type === "experience") return "⭐";
  if (type === "event") return "🎭";
  if (type === "alert") return "⚠️";
  if (type === "info") return "ℹ️";
  return "•";
};

const getActivityPreviewText = (item: any) => {
  if (item.type === "experience") {
    return item.text || "Shared an experience";
  }

  return (
    item.title?.trim() ||
    item.text ||
    `${getActivityLabel(item.type, item)} about ${item.place}`
  );
};

const getActivityMetaText = (item: any) => {
  if (item.type === "experience") {
    return item.place;
  }

  if (item.event_date) {
    const label = item.type === "event" ? "Event date" : "Related date";
    return `${label}: ${formatActivityDate(item.event_date)}`;
  }

  if (item.source_name) {
    return `Source: ${item.source_name}`;
  }

  return item.place;
};


  // =========================
  // Render user card
  // =========================
  const renderCard = (entry: any) => {
    const user = entry.user;
    const lastUpdate = entry.lastUpdate;
    const newCount = entry.items.filter((i: any) => i.is_new).length;

    const visibleItems =
      activeFilter === "all"
        ? entry.items
        : entry.items.filter((item: any) => item.type === activeFilter);

    const previewItems = visibleItems.slice(0, 2);
    const remainingCount = visibleItems.length - previewItems.length;

    // Trusted users can show username + public code.
    // Explore users remain identified only by public code.
    const displayName = lastUpdate.is_friend
      ? lastUpdate.display_name || lastUpdate.username
      : user;

    const displayCode = user;

    const nationalityCode = (
      lastUpdate.author_nationality_country_code || ""
    ).toUpperCase();

    const nationalityFlag = countryCodeToFlagEmoji(nationalityCode);

    const nationalityBadge =
      nationalityFlag && nationalityCode
        ? `${nationalityFlag} ${nationalityCode}`
        : "";

    const professionBadge = getProfessionBadge(lastUpdate.author_profession);

    const profileContextText = [
      lastUpdate.author_profession,
      lastUpdate.author_travel_interests,
    ]
      .filter(Boolean)
      .join(" · ");

    // Only trusted users can show their real avatar.
    // Explore/public users remain protected.
    const avatarUrl = lastUpdate.is_friend ? lastUpdate.avatar_url : null;

    const isOpen = openUser === user;

    return (
      <div
        key={user}
        onClick={() => {
          setOpenProfileContextUser(null);
          setOpenUser(isOpen ? null : user);
        }}
        style={{ perspective: "1000px", width: "170px", height: "240px" }}
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

            {professionBadge && profileContextText && (
                  <>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        setOpenProfileContextUser((current) =>
                          current === user ? null : user
                        );
                      }}
                      title={profileContextText}
                      style={professionBadgeStyle}
                    >
                      {professionBadge}
                    </button>

                    {openProfileContextUser === user && (
                      <div
                        style={profileContextPopover}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div style={profileContextPopoverTitle}>Travel context</div>
                        <div style={profileContextPopoverText}>{profileContextText}</div>
                      </div>
                    )}
                  </>
                )}

            <Avatar
              name={displayName}
              avatarUrl={avatarUrl}
              hasNew={newCount > 0}
            />

            <strong style={{ marginTop: "10px" }}>{displayName}</strong>

            {nationalityBadge && (
              <span style={countryBadge}>
                {nationalityBadge}
              </span>
            )}

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
            {previewItems.map((item: any) => (
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
                    router.push(`/updates/${item.id}`);
                  }
                }}

              >
                <div>
                  <div style={{ display: "grid", gap: "5px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      alignSelf: "center",
                      fontSize: "11px",
                      padding: "3px 7px",
                      borderRadius: "999px",
                      border: item.type === "alert" ? "1px solid #f3d1d1" : "1px solid #eee",
                      background:
                        item.type === "alert"
                          ? "#fff5f5"
                          : item.type === "event"
                          ? "#f8f5ff"
                          : item.type === "info"
                          ? "#f5f7ff"
                          : "#f9f9f9",
                      color: item.type === "alert" ? "#9f1239" : "#555",
                      fontWeight: 600,
                    }}
                  >
                    <span>{getActivityIcon(item.type)}</span>
                    <span>{getActivityLabel(item.type, item)}</span>
                  </div>

                  <strong
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.35,
                      color: "#111",
                    }}
                  >
                    {getActivityPreviewText(item).slice(0, 70)}
                    {getActivityPreviewText(item).length > 70 ? "..." : ""}
                  </strong>

                  <div style={{ color: "#666", fontSize: "11px", lineHeight: 1.3 }}>
                      {getActivityMetaText(item)}
                    </div>

                    {item.type !== "experience" &&
                      item.place &&
                      getActivityMetaText(item) !== item.place && (
                        <div style={{ color: "#999", fontSize: "11px", lineHeight: 1.3 }}>
                          {item.place}
                        </div>
                      )}

                  <div style={{ color: "#999", fontSize: "11px" }}>
                    {formatActivityDate(item.created_at)}
                  </div>

                  <div style={{ color: "#111", fontSize: "11px", fontWeight: 600 }}>
                    {item.type === "experience" ? "Read experience →" : "Read update →"}
                     </div>
                   </div>
                </div>
              </div>
            ))}

        {remainingCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();

              if (lastUpdate?.user_id) {
              router.push(`/user/${user}/activity`);
              }
            }}
            style={{
              marginTop: "10px",
              border: "none",
              background: "transparent",
              color: "#111",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            View all →
          </button>
        )}

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

    if (loading) {
      return (
        <main style={landingPage}>
          <section style={landingCard}>
            <div style={landingEyebrow}>Trust Travel</div>
            <h1 style={landingTitle}>Loading...</h1>
          </section>
        </main>
      );
    }

    if (!isLoggedIn) {
      return (
        <main style={landingPage}>
          <section style={landingCard}>
            <div style={landingEyebrow}>Trust Travel</div>

            <h1 style={landingTitle}>
              Plan trips through trusted human experiences.
            </h1>

            <p style={landingText}>
              Discover places, experiences, alerts and travel ideas shared by people
              you trust — and by broader networks with clear context.
            </p>

            <div style={landingActions}>
              <button
                type="button"
                onClick={() => router.push("/login")}
                style={landingPrimaryButton}
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => router.push("/register")}
                style={landingSecondaryButton}
              >
                Create account
              </button>
            </div>

            <div style={landingNote}>
              Your public code protects your identity outside your trusted network.
              You decide what profile context appears on your cards.
            </div>
          </section>
        </main>
      );
    }

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
                const filterLabels: Record<string, string> = {
                  all: "All",
                  event: "Events",
                  alert: "Alerts",
                  experience: "Experiences",
                  info: "Info",
                  connections: "Connections",
                };

                const label =
                  f === "connections" && requests.length > 0
                    ? `${filterLabels[f]} (${requests.length})`
                    : filterLabels[f] || f;

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

          {/* Quick planning + Search / Create / Share menu */}
          <div style={topActionButtons}>
            <button
                  type="button"
                  onClick={() =>
                    router.push(
                      tripPlanActivity?.has_activity
                        ? "/trip-plans/activity"
                        : "/trip-plans"
                    )
                  }
                  style={{
                    ...secondaryButton,
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
              <span>My trips</span>

              {tripPlanActivity?.has_activity && (
                <span
                  title={`${tripPlanActivity.total_unsaved_related_count ?? tripPlanActivity.total_related_count} unsaved radar suggestions`}
                  style={{
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 6px",
                    borderRadius: "999px",
                    background: "black",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {tripPlanActivity.plans_with_activity_count}
                </span>
              )}
            </button>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowCreateMenu((prev) => !prev)}
                style={primaryButton}
              >
                Search / Create / Share
              </button>

              {showCreateMenu && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "44px",
                    minWidth: "260px",
                    padding: "8px",
                    border: "1px solid #eee",
                    borderRadius: "12px",
                    background: "white",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 10,
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      router.push("/destinations");
                    }}
                    style={menuItemButton}
                  >
                    🔎 Search or choose a place
                  </button>

                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      router.push("/destinations?mode=experience");
                    }}
                    style={menuItemButton}
                  >
                    ⭐ Share an experience
                  </button>

                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      router.push("/destinations?mode=update");
                    }}
                    style={menuItemButton}
                  >
                    ℹ️ Share event, alert or info
                  </button>
                </div>
              )}
            </div>
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
        router.push("/destinations?mode=experience");
        return;
      }

      if (
        activeFilter === "event" ||
        activeFilter === "alert" ||
        activeFilter === "info"
      ) {
        router.push("/destinations?mode=update");
        return;
      }

      router.push("/destinations");
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
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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

const topActionButtons = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap" as const,
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

const countryBadge = {
  fontSize: "11px",
  padding: "3px 8px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "#fafafa",
  color: "#444",
  fontWeight: 600,
};

const professionBadgeStyle = {
  position: "absolute" as const,
  top: "12px",
  left: "12px",
  minWidth: "24px",
  height: "22px",
  padding: "0 6px",
  borderRadius: "999px",
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "10px",
  fontWeight: "bold",
  boxShadow: "0 0 10px rgba(0,0,0,0.10)",
  zIndex: 2,
  cursor: "pointer",
};

const profileContextPopover = {
  position: "absolute" as const,
  top: "40px",
  left: "10px",
  right: "10px",
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
  zIndex: 5,
  fontSize: "12px",
  textAlign: "left" as const,
};

const profileContextPopoverTitle = {
  fontSize: "11px",
  color: "#777",
  fontWeight: 700,
  marginBottom: "4px",
};

const profileContextPopoverText = {
  fontSize: "12px",
  color: "#333",
  lineHeight: 1.4,
};

const landingPage = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
  background:
    "radial-gradient(circle at top left, #f4f0ff 0, transparent 34%), #fafafa",
};

const landingCard = {
  width: "100%",
  maxWidth: "680px",
  padding: "38px",
  borderRadius: "24px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
};

const landingEyebrow = {
  fontSize: "14px",
  color: "#666",
  fontWeight: 700,
  marginBottom: "12px",
};

const landingTitle = {
  fontSize: "42px",
  lineHeight: 1.1,
  margin: "0 0 18px",
  maxWidth: "620px",
};

const landingText = {
  fontSize: "18px",
  color: "#555",
  lineHeight: 1.6,
  margin: "0 0 26px",
};

const landingActions = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap" as const,
  marginBottom: "22px",
};

const landingPrimaryButton = {
  padding: "12px 18px",
  borderRadius: "999px",
  border: "none",
  background: "black",
  color: "white",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const landingSecondaryButton = {
  padding: "12px 18px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const landingNote = {
  padding: "14px",
  borderRadius: "14px",
  background: "#f8f8f8",
  border: "1px solid #eee",
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};