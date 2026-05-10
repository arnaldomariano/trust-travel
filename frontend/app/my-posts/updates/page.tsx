"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../../lib/api";

type MyPost = {
  id: number;
  type: "event" | "alert" | "info" | string;
  category: string;
  text: string;
  place: string;
  place_id: number;
  created_at: string;
};

export default function MyUpdatesPage() {
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<"all" | "event" | "alert" | "info">("all");

  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
  const [editingUpdateText, setEditingUpdateText] = useState("");
  const [editingUpdateType, setEditingUpdateType] =
    useState<"event" | "alert" | "info">("info");
  const [savingUpdate, setSavingUpdate] = useState(false);

  const loadPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/my-updates/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to load my updates:", res.status, errorText);
        return;
      }

      const data = await res.json();

      const nonExperiencePosts = Array.isArray(data)
        ? data.filter((post) => post.type !== "experience")
        : [];

      setPosts(nonExperiencePosts);
    } catch (error) {
      console.error("My updates fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const filteredPosts = posts.filter((post) => {
    if (filter === "all") return true;
    return post.type === filter;
  });

  const startEditingUpdate = (post: MyPost) => {
    setEditingUpdateId(post.id);
    setEditingUpdateText(post.text || "");

    if (post.type === "event" || post.type === "alert" || post.type === "info") {
      setEditingUpdateType(post.type);
    } else {
      setEditingUpdateType("info");
    }
  };

  const cancelEditingUpdate = () => {
    setEditingUpdateId(null);
    setEditingUpdateText("");
    setEditingUpdateType("info");
  };

  const saveUpdateChanges = async (postId: number) => {
    if (!editingUpdateText.trim()) {
      alert("Please write the event or information.");
      return;
    }

    setSavingUpdate(true);

    try {
      const res = await fetch(`${API_URL}/api/updates/${postId}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: editingUpdateType,
          category: "tourism",
          text: editingUpdateText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Update edit error:", data);
        alert(data.detail || "Error updating post.");
        return;
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                type: data.type,
                category: data.category,
                text: data.text,
                place: data.place,
                place_id: data.place_id,
                created_at: data.created_at,
              }
            : post
        )
      );

      cancelEditingUpdate();
    } catch (error) {
      console.error("Failed to update post:", error);
      alert("Error updating post.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const deleteUpdate = async (postId: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this event, alert or info post?"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/updates/${postId}/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Error deleting post.");
        return;
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Error deleting post.");
    }
  };

  const getPostLabel = (type: string) => {
    if (type === "event") return "🎭 Event";
    if (type === "alert") return "⚠️ Alert";
    if (type === "info") return "ℹ️ Info";
    return "Post";
  };

  if (loading) {
    return (
      <main style={page}>
        <p>Loading your events and info...</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        /{" "}
        <Link href="/my-posts" style={breadcrumbLink}>
          My Posts
        </Link>{" "}
        / <span>Events & Info</span>
      </div>

        <section style={managerNav}>
          <div>
            <strong>Manage your content</strong>
            <p style={{ margin: "6px 0 0 0", color: "#666", lineHeight: 1.5 }}>
              Experiences and event/info posts are managed separately to keep editing easier.
            </p>
          </div>

          <div style={actions}>
            <Link href="/my-posts" style={secondaryLink}>
              Experiences
            </Link>

            <Link href="/my-posts/updates" style={primaryLink}>
              Events & Info
            </Link>
          </div>
        </section>

      <section style={heroCard}>
        <div style={label}>Post manager</div>

        <h1 style={{ marginTop: 0, marginBottom: "8px" }}>
          My Events & Info
        </h1>

        <p style={{ margin: 0, color: "#666", lineHeight: 1.5 }}>
          Manage events, alerts and useful information you shared about places.
        </p>

        <div style={statsGrid}>
          <div style={statCard}>
            <div style={statLabel}>All posts</div>
            <div style={statValue}>{posts.length}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Events</div>
            <div style={statValue}>
              {posts.filter((post) => post.type === "event").length}
            </div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Alerts</div>
            <div style={statValue}>
              {posts.filter((post) => post.type === "alert").length}
            </div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Useful info</div>
            <div style={statValue}>
              {posts.filter((post) => post.type === "info").length}
            </div>
          </div>
        </div>
      </section>

      <div style={filterRow}>
        {[
          ["all", "All"],
          ["event", "Events"],
          ["alert", "Alerts"],
          ["info", "Useful info"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value as "all" | "event" | "alert" | "info")}
            style={{
              ...filterButton,
              background: filter === value ? "black" : "white",
              color: filter === value ? "white" : "black",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredPosts.length === 0 ? (
        <section style={emptyBox}>
          <p style={{ marginTop: 0 }}>
            No posts found for this filter.
          </p>

          <Link href="/destinations" style={primaryLink}>
            Search a place to share info
          </Link>
        </section>
      ) : (
        <section style={list}>
          {filteredPosts.map((post) => {
            const isEditing = editingUpdateId === post.id;

            return (
              <article key={post.id} style={card}>
                <div style={metaRow}>
                  <div>
                    <strong>
                      {getPostLabel(post.type)} — {post.place}
                    </strong>

                    <div style={{ marginTop: "6px" }}>
                      <span style={categoryBadge}>{post.category}</span>
                    </div>
                  </div>

                  <span style={dateText}>
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>

                {isEditing ? (
                  <div style={editForm}>
                    <select
                      value={editingUpdateType}
                      onChange={(e) =>
                        setEditingUpdateType(
                          e.target.value as "event" | "alert" | "info"
                        )
                      }
                      style={input}
                    >
                      <option value="info">Useful info</option>
                      <option value="event">Event</option>
                      <option value="alert">Alert</option>
                    </select>

                    <textarea
                      value={editingUpdateText}
                      onChange={(e) => setEditingUpdateText(e.target.value)}
                      rows={4}
                      style={input}
                    />

                    <div style={actions}>
                      <button
                        type="button"
                        onClick={() => saveUpdateChanges(post.id)}
                        disabled={savingUpdate || !editingUpdateText.trim()}
                        style={{
                          ...primaryButton,
                          opacity:
                            savingUpdate || !editingUpdateText.trim() ? 0.5 : 1,
                          cursor:
                            savingUpdate || !editingUpdateText.trim()
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {savingUpdate ? "Saving..." : "Save changes"}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditingUpdate}
                        style={secondaryButton}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={text}>{post.text}</p>

                    <div style={actions}>
                      <Link href={`/places/${post.place_id}`} style={secondaryLink}>
                        View place
                      </Link>

                      <button
                        type="button"
                        onClick={() => startEditingUpdate(post)}
                        style={secondaryButton}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteUpdate(post.id)}
                        style={dangerButton}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

const page = {
  maxWidth: "820px",
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
  padding: "22px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  marginBottom: "24px",
};

const label = {
  fontSize: "13px",
  color: "#777",
  marginBottom: "6px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};

const statCard = {
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "#fafafa",
};

const statLabel = {
  fontSize: "12px",
  color: "#777",
};

const statValue = {
  marginTop: "6px",
  fontSize: "22px",
  fontWeight: 700,
};

const filterRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginBottom: "22px",
};

const filterButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  cursor: "pointer",
};

const list = {
  display: "grid",
  gap: "16px",
};

const card = {
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "20px",
  background: "white",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  marginBottom: "10px",
};

const dateText = {
  fontSize: "12px",
  color: "#666",
};

const categoryBadge = {
  display: "inline-block",
  fontSize: "12px",
  color: "#666",
  border: "1px solid #ddd",
  borderRadius: "999px",
  padding: "4px 8px",
};

const text = {
  lineHeight: 1.5,
  marginBottom: "16px",
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const editForm = {
  display: "grid",
  gap: "12px",
  marginTop: "12px",
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const primaryButton = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const secondaryButton = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "black",
  cursor: "pointer",
};

const secondaryLink = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  textDecoration: "none",
};

const dangerButton = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #f3d1d1",
  background: "#fff5f5",
  color: "#9f1239",
  cursor: "pointer",
};

const emptyBox = {
  marginTop: "24px",
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "24px",
  background: "white",
};

const primaryLink = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const managerNav = {
  marginTop: "20px",
  marginBottom: "28px",
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  display: "grid",
  gap: "14px",
};