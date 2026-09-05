"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../../lib/api";

type OfficialSource = {
  id: number;
  name: string;
  website_url: string;
  source_type: string;
  is_verified: boolean;
  place_id: number | null;
};

type MyPost = {
  id: number;
  type: "event" | "alert" | "info" | string;
  category: string;
  title?: string;
  text: string;
  event_date?: string | null;
  external_link?: string;
  source_name?: string;
  source_url?: string;
  official_source?: OfficialSource | null;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  place: string;
  place_id: number;
  created_at: string;
  updated_at?: string;
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
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [pendingDeleteUpdate, setPendingDeleteUpdate] = useState<MyPost | null>(null);

  const clearUpdateFeedback = () => {
      setUpdateMessage("");
      setUpdateError("");
  };

  const [editingUpdateTitle, setEditingUpdateTitle] = useState("");
  const [editingUpdateCategory, setEditingUpdateCategory] = useState("general");
  const [editingUpdateEventDate, setEditingUpdateEventDate] = useState("");
  const [editingUpdateExternalLink, setEditingUpdateExternalLink] = useState("");
  const [editingUpdateSourceName, setEditingUpdateSourceName] = useState("");
  const [editingUpdateSourceUrl, setEditingUpdateSourceUrl] = useState("");
  const [editingUpdatePriority, setEditingUpdatePriority] =
    useState<"low" | "normal" | "high" | "urgent">("normal");

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

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString();
};

  const filteredPosts = posts.filter((post) => {
    if (filter === "all") return true;
    return post.type === filter;
  });

  const startEditingUpdate = (post: MyPost) => {
      clearUpdateFeedback();
      setPendingDeleteUpdate(null);
      setEditingUpdateId(post.id);
      setEditingUpdateTitle(post.title || "");
      setEditingUpdateText(post.text || "");
      setEditingUpdateCategory(post.category || "general");
      setEditingUpdateEventDate(toDateTimeLocalValue(post.event_date));
      setEditingUpdateExternalLink(post.external_link || "");
      setEditingUpdateSourceName(post.source_name || "");
      setEditingUpdateSourceUrl(post.source_url || "");

  if (post.type === "event" || post.type === "alert" || post.type === "info") {
    setEditingUpdateType(post.type);
  } else {
    setEditingUpdateType("info");
  }

  if (
    post.priority === "low" ||
    post.priority === "normal" ||
    post.priority === "high" ||
    post.priority === "urgent"
  ) {
    setEditingUpdatePriority(post.priority);
  } else {
    setEditingUpdatePriority("normal");
  }
};

  const cancelEditingUpdate = () => {
      clearUpdateFeedback();
      setEditingUpdateId(null);
      setEditingUpdateTitle("");
      setEditingUpdateText("");
      setEditingUpdateType("info");
      setEditingUpdateCategory("general");
      setEditingUpdateEventDate("");
      setEditingUpdateExternalLink("");
      setEditingUpdateSourceName("");
      setEditingUpdateSourceUrl("");
      setEditingUpdatePriority("normal");
  };

  const saveUpdateChanges = async (postId: number) => {
    if (!editingUpdateText.trim()) {
      setUpdateError("Please write the event or information.");
      setUpdateMessage("");
      return;
    }

    clearUpdateFeedback();
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
          category: editingUpdateCategory,
          title: editingUpdateTitle.trim(),
          text: editingUpdateText.trim(),
          event_date: editingUpdateEventDate || null,
          external_link: editingUpdateExternalLink.trim(),
          source_name: editingUpdateSourceName.trim(),
          source_url: editingUpdateSourceUrl.trim(),
          priority: editingUpdatePriority,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
          console.error("Update edit error:", data);
          setUpdateError(data.detail || "Could not update this post.");
          return;
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                type: data.type,
                category: data.category,
                title: data.title,
                text: data.text,
                event_date: data.event_date,
                external_link: data.external_link,
                source_name: data.source_name,
                source_url: data.source_url,
                priority: data.priority,
                place: data.place,
                place_id: data.place_id,
                created_at: data.created_at,
                updated_at: data.updated_at,
              }
            : post
        )
      );

      cancelEditingUpdate();
      setUpdateMessage("Post updated.");
      } catch (error) {
          console.error("Failed to update post:", error);
          setUpdateError("Could not update this post.");
        } finally {
          setSavingUpdate(false);
        }
      };

  const deleteUpdate = async (postId: number) => {
      clearUpdateFeedback();

      try {
        const res = await fetch(`${API_URL}/api/updates/${postId}/`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json();
          setUpdateError(data.detail || "Could not delete this post.");
          return;
        }

        setPosts((prev) => prev.filter((post) => post.id !== postId));
        setPendingDeleteUpdate(null);
        setUpdateMessage("Post deleted.");
      } catch (error) {
        console.error("Failed to delete post:", error);
        setUpdateError("Could not delete this post.");
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

      {updateError && (
          <div style={updateErrorBox}>
            {updateError}
          </div>
        )}

        {updateMessage && (
          <div style={updateSuccessBox}>
            {updateMessage}
          </div>
        )}

        {pendingDeleteUpdate && (
          <div style={deleteConfirmBox}>
            <div>
              <strong>Delete this post?</strong>
              <p style={deleteConfirmText}>
                This will permanently delete{" "}
                <strong>{pendingDeleteUpdate.title || pendingDeleteUpdate.text}</strong>.
              </p>
            </div>

            <div style={actions}>
              <button
                type="button"
                style={secondaryButton}
                onClick={() => setPendingDeleteUpdate(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={dangerButton}
                onClick={() => deleteUpdate(pendingDeleteUpdate.id)}
              >
                Delete post
              </button>
            </div>
          </div>
        )}

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
                      <div style={{ display: "grid", gap: "6px" }}>
                        <label style={fieldLabel}>Type</label>

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
                      </div>

                      <div style={{ display: "grid", gap: "6px" }}>
                        <label style={fieldLabel}>Short title</label>

                        <input
                          value={editingUpdateTitle}
                          onChange={(e) => setEditingUpdateTitle(e.target.value)}
                          placeholder="Short title"
                          maxLength={160}
                          style={input}
                        />
                      </div>

                      <div style={{ display: "grid", gap: "6px" }}>
                        <label style={fieldLabel}>Details</label>

                        <textarea
                          value={editingUpdateText}
                          onChange={(e) => setEditingUpdateText(e.target.value)}
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
                          <label style={fieldLabel}>Category</label>

                          <select
                            value={editingUpdateCategory}
                            onChange={(e) => setEditingUpdateCategory(e.target.value)}
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
                          <label style={fieldLabel}>
                            {editingUpdateType === "event" ? "Event date" : "Related date"}
                          </label>

                          <input
                            type="datetime-local"
                            value={editingUpdateEventDate}
                            onChange={(e) => setEditingUpdateEventDate(e.target.value)}
                            style={input}
                          />
                        </div>
                      </div>

                      {editingUpdateType === "alert" && (
                        <div style={{ display: "grid", gap: "6px" }}>
                          <label style={fieldLabel}>Alert priority</label>

                          <select
                            value={editingUpdatePriority}
                            onChange={(e) =>
                              setEditingUpdatePriority(
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

                      <div style={sourceEditBox}>
                        <strong style={{ fontSize: "14px" }}>Optional source and links</strong>

                        <input
                          value={editingUpdateSourceName}
                          onChange={(e) => setEditingUpdateSourceName(e.target.value)}
                          placeholder="Source name"
                          style={input}
                        />

                        <input
                          value={editingUpdateSourceUrl}
                          onChange={(e) => setEditingUpdateSourceUrl(e.target.value)}
                          placeholder="Source URL"
                          style={input}
                        />

                        <input
                          value={editingUpdateExternalLink}
                          onChange={(e) => setEditingUpdateExternalLink(e.target.value)}
                          placeholder="Related link"
                          style={input}
                        />
                      </div>

                      <div style={actions}>
                        <button
                          type="button"
                          onClick={() => saveUpdateChanges(post.id)}
                          disabled={savingUpdate}
                          style={{
                              ...primaryButton,
                              opacity: savingUpdate ? 0.5 : 1,
                              cursor: savingUpdate ? "not-allowed" : "pointer",
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
                      {post.title?.trim() && (
                        <h2 style={postTitle}>{post.title}</h2>
                      )}

                      <p style={text}>{post.text}</p>

                      {post.official_source?.is_verified && (
                        <div style={officialSourceLine}>
                          ✓ Official source · {post.official_source.name}
                        </div>
                      )}

                      <div style={detailsGrid}>
                        {post.event_date && (
                          <span style={detailChip}>
                            Related date: {formatDateTime(post.event_date)}
                          </span>
                        )}

                        {post.type === "alert" && (
                          <span style={detailChip}>
                            Priority: {post.priority || "normal"}
                          </span>
                        )}

                        {post.source_name && (
                          <span style={detailChip}>
                            Source cited: {post.source_name}
                          </span>
                        )}
                      </div>

                      {(post.source_url || post.external_link) && (
                        <div style={linkRow}>
                          {post.source_url && (
                            <a
                              href={post.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={smallLink}
                            >
                              Open cited source
                            </a>
                          )}

                          {post.external_link && (
                            <a
                              href={post.external_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={smallLink}
                            >
                              Open related link
                            </a>
                          )}
                        </div>
                      )}

                      <div style={actions}>
                        <Link href={`/updates/${post.id}`} style={secondaryLink}>
                          Read update
                        </Link>

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
                          onClick={() => {
                            clearUpdateFeedback();
                            setPendingDeleteUpdate(post);
                          }}
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

const officialSourceLine = {
  color: "#555",
  fontSize: "13px",
  fontWeight: 600,
  marginBottom: "2px",
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

const fieldLabel = {
  fontSize: "13px",
  color: "#666",
  fontWeight: 600,
};

const sourceEditBox = {
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "#fafafa",
  display: "grid",
  gap: "12px",
};

const postTitle = {
  marginTop: "12px",
  marginBottom: "8px",
  fontSize: "20px",
};

const detailsGrid = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginBottom: "14px",
};

const detailChip = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#555",
  fontSize: "12px",
};

const linkRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginBottom: "14px",
};

const smallLink = {
  color: "#111",
  fontSize: "13px",
  fontWeight: 600,
};

const updateErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
  marginBottom: "16px",
};

const updateSuccessBox = {
  padding: "10px",
  border: "1px solid #bbf7d0",
  borderRadius: "10px",
  backgroundColor: "#f0fdf4",
  color: "#166534",
  fontSize: "13px",
  lineHeight: 1.4,
  marginBottom: "16px",
};

const deleteConfirmBox = {
  padding: "14px",
  border: "1px solid #fecaca",
  borderRadius: "12px",
  backgroundColor: "#fff7f7",
  color: "#7f1d1d",
  fontSize: "13px",
  lineHeight: 1.4,
  marginBottom: "18px",
  display: "grid",
  gap: "12px",
};

const deleteConfirmText = {
  margin: "6px 0 0 0",
  color: "#7f1d1d",
};