"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../lib/api";

type MyPost = {
  id: number;
  type: string;
  category: string;
  text: string;
  place: string;
  place_id: number;
  created_at: string;
};

type MyExperience = {
  id: number;
  title: string;
  comment: string;
  rating: number | null;
  image_url?: string | null;
  place: string;
  place_id: number;
  destination: string;
  created_at: string;
  updated_at: string;
};

export default function MyPostsPage() {
const [posts, setPosts] = useState<MyPost[]>([]);
const [experiences, setExperiences] = useState<MyExperience[]>([]);
const [loading, setLoading] = useState(true);

const [editingExperienceId, setEditingExperienceId] = useState<number | null>(null);
const [editTitle, setEditTitle] = useState("");
const [editComment, setEditComment] = useState("");
const [editRating, setEditRating] = useState<number | null>(null);

const [editImageFile, setEditImageFile] = useState<File | null>(null);
const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
const [imageAction, setImageAction] = useState<"keep" | "replace" | "remove">("keep");
const [savingExperience, setSavingExperience] = useState(false);

const loadPosts = async () => {
  try {
    const [postsRes, experiencesRes] = await Promise.all([
      fetch(`${API_URL}/api/my-updates/`, {
        credentials: "include",
      }),
      fetch(`${API_URL}/api/my-experiences/`, {
        credentials: "include",
      }),
    ]);

    if (!postsRes.ok) {
      const errorText = await postsRes.text();
      console.error("Failed to load my posts:", postsRes.status, errorText);
    } else {
      const postsData = await postsRes.json();
      setPosts(postsData || []);
    }

    if (!experiencesRes.ok) {
      const errorText = await experiencesRes.text();
      console.error(
        "Failed to load my experiences:",
        experiencesRes.status,
        errorText
      );
    } else {
      const experiencesData = await experiencesRes.json();
      setExperiences(experiencesData || []);
    }
  } catch (error) {
    console.error("My posts fetch error:", error);
  } finally {
    setLoading(false);
  }
};

// =========================
// Start editing experience
// =========================
const startEditingExperience = (experience: MyExperience) => {
  setEditingExperienceId(experience.id);
  setEditTitle(experience.title || "");
  setEditComment(experience.comment || "");
  setEditRating(experience.rating || null);
  setEditImageFile(null);
  setEditImagePreview(null);
  setImageAction("keep");
};

// =========================
// Cancel editing experience
// =========================
const cancelEditingExperience = () => {
  setEditingExperienceId(null);
  setEditTitle("");
  setEditComment("");
  setEditRating(null);
  setEditImageFile(null);
  setEditImagePreview(null);
  setImageAction("keep");
};

// =========================
// Save edited experience
// =========================
const saveEditedExperience = async (experienceId: number) => {
  if (!editTitle.trim()) {
    alert("Please add a short title.");
    return;
  }

  if (!editComment.trim()) {
    alert("Please write your experience.");
    return;
  }

  if (!editRating) {
    alert("Please select a rating.");
    return;
  }

  setSavingExperience(true);

  try {
    const formData = new FormData();

    formData.append("title", editTitle.trim());
    formData.append("comment", editComment.trim());
    formData.append("rating", String(editRating));

    if (imageAction === "replace" && editImageFile) {
      formData.append("image", editImageFile);
    }

    if (imageAction === "remove") {
      formData.append("remove_image", "true");
    }

    const res = await fetch(`${API_URL}/api/experiences/${experienceId}/`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to update experience:", data);
      alert(data.detail || "Error updating experience.");
      return;
    }

    setExperiences((prev) =>
      prev.map((experience) =>
        experience.id === experienceId
          ? {
                ...experience,
                title: data.title,
                comment: data.comment,
                rating: data.rating,
                image_url: data.image_url,
                updated_at: data.updated_at,
              }
          : experience
      )
    );

    cancelEditingExperience();
  } catch (error) {
    console.error("Update experience failed:", error);
    alert("Error updating experience.");
  } finally {
    setSavingExperience(false);
  }
};

  useEffect(() => {
    loadPosts();
  }, []);

  if (loading) {
    return (
      <main style={page}>
        <p>Loading your posts...</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <h1>My Posts</h1>

      {posts.length === 0 && experiences.length === 0 ? (
        <section style={emptyBox}>
          <p>You have not created any posts yet.</p>
          <Link href="/create" style={primaryLink}>
            Create your first post
          </Link>
        </section>
      ) : (
      <>
        {experiences.length > 0 && (
          <section style={list}>
            <h2 style={sectionTitle}>My Experiences</h2>

        {experiences.map((experience) => (
          <article key={experience.id} style={card}>
                {editingExperienceId === experience.id ? (
                  <>
                    <div style={metaRow}>
                      <strong>Edit experience</strong>

                      <span style={dateText}>
                        {new Date(experience.created_at).toLocaleString()}
                      </span>
                    </div>

                    <span style={categoryBadge}>
                      {experience.place}
                      {experience.destination ? ` · ${experience.destination}` : ""}
                    </span>

                    <div style={editForm}>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Short title"
                        maxLength={160}
                        style={input}
                      />

                      <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="Write your experience..."
                        rows={4}
                        style={input}
                      />

                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={editRating ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (!value) {
                            setEditRating(null);
                            return;
                          }

                          const numeric = Number(value);

                          if (numeric >= 1 && numeric <= 5) {
                            setEditRating(numeric);
                          }
                        }}
                        placeholder="Rating from 1 to 5"
                        style={input}
                      />

                        <div style={imageEditBox}>
                          <div style={{ fontSize: "13px", color: "#666", fontWeight: 600 }}>
                            Experience image
                          </div>

                          {experience.image_url && imageAction !== "remove" && !editImagePreview && (
                            <div style={{ display: "grid", gap: "8px" }}>
                              <div style={{ fontSize: "13px", color: "#777" }}>
                                Current image
                              </div>

                              <img
                                src={experience.image_url}
                                alt={experience.title || "Current experience image"}
                                style={imagePreview}
                              />
                            </div>
                          )}

                          {editImagePreview && imageAction === "replace" && (
                            <div style={{ display: "grid", gap: "8px" }}>
                              <div style={{ fontSize: "13px", color: "#777" }}>
                                New image preview
                              </div>

                              <img
                                src={editImagePreview}
                                alt="New selected image preview"
                                style={imagePreview}
                              />

                              <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.4 }}>
                                This new image will replace the current one when you save changes.
                              </div>
                            </div>
                          )}

                          {imageAction === "remove" && (
                            <div style={removeNotice}>
                              Image will be removed when you save changes.
                            </div>
                          )}

                          <div style={{ display: "grid", gap: "8px" }}>
                            <label style={{ fontSize: "13px", color: "#666" }}>
                              Choose a new image
                            </label>

                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;

                                setEditImageFile(file);

                                if (editImagePreview) {
                                  URL.revokeObjectURL(editImagePreview);
                                }

                                if (file) {
                                  setEditImagePreview(URL.createObjectURL(file));
                                  setImageAction("replace");
                                } else {
                                  setEditImagePreview(null);
                                  setImageAction("keep");
                                }
                              }}
                              style={input}
                            />
                          </div>

                          {experience.image_url && (
                            <button
                              type="button"
                              style={dangerButton}
                              onClick={() => {
                                if (editImagePreview) {
                                  URL.revokeObjectURL(editImagePreview);
                                }

                                setEditImageFile(null);
                                setEditImagePreview(null);
                                setImageAction("remove");
                              }}
                            >
                              Remove image
                            </button>
                          )}

                          {(imageAction === "replace" || imageAction === "remove") && (
                            <button
                              type="button"
                              style={secondaryButton}
                              onClick={() => {
                                if (editImagePreview) {
                                  URL.revokeObjectURL(editImagePreview);
                                }

                                setEditImageFile(null);
                                setEditImagePreview(null);
                                setImageAction("keep");
                              }}
                            >
                              Keep current image
                            </button>
                          )}
                        </div>

                      <div style={actions}>
                        <button
                          style={primaryButton}
                          disabled={savingExperience}
                          onClick={() => saveEditedExperience(experience.id)}
                        >
                          {savingExperience ? "Saving..." : "Save changes"}
                        </button>

                        <button
                          style={secondaryButton}
                          disabled={savingExperience}
                          onClick={cancelEditingExperience}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={metaRow}>
                      <strong>{experience.title || "Shared experience"}</strong>

                      <span style={dateText}>
                        {new Date(experience.created_at).toLocaleString()}
                      </span>
                    </div>

                    <span style={categoryBadge}>
                      {experience.place}
                      {experience.destination ? ` · ${experience.destination}` : ""}
                    </span>

                    {experience.image_url && (
                      <img
                        src={experience.image_url}
                        alt={experience.title || "Shared experience"}
                        style={{
                          width: "100%",
                          maxHeight: "260px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          marginTop: "10px",
                          marginBottom: "14px",
                          border: "1px solid #eee",
                        }}
                      />
                    )}

                    <p style={text}>{experience.comment}</p>

                    {experience.rating && (
                      <div style={{ color: "#f5b50a", marginBottom: "16px" }}>
                        {"★".repeat(experience.rating)}
                        {"☆".repeat(5 - experience.rating)}
                      </div>
                    )}

                    <div style={actions}>
                      <Link
                        href={`/places/${experience.place_id}/experiences`}
                        style={secondaryLink}
                      >
                        View experiences
                      </Link>

                      <button
                        style={secondaryButton}
                        onClick={() => startEditingExperience(experience)}
                      >
                        Edit
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </section>
        )}

        {posts.length > 0 && (
          <section style={list}>
            <h2 style={sectionTitle}>My Posts</h2>

            {posts.map((post) => (
              <article key={post.id} style={card}>
                <div style={metaRow}>
                  <strong>
                    {post.type} — {post.place}
                  </strong>

                  <span style={dateText}>
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>

                <span style={categoryBadge}>{post.category}</span>

                <p style={text}>{post.text}</p>

                <div style={actions}>
                  <Link href={`/places/${post.place_id}`} style={secondaryLink}>
                    View place
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </>
    )}
    </main>
  );
}

const page = {
  maxWidth: "760px",
  margin: "0 auto",
  padding: "40px",
};

const list = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "16px",
  marginTop: "24px",
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
  marginBottom: "12px",
};

const text = {
  lineHeight: 1.5,
  marginBottom: "16px",
};

const actions = {
  display: "flex",
  gap: "10px",
};

const primaryLink = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const secondaryLink = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  textDecoration: "none",
};

const emptyBox = {
  marginTop: "24px",
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "24px",
  background: "white",
};

const sectionTitle = {
  margin: "0 0 12px 0",
  fontSize: "20px",
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

const primaryButton = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
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

const imageEditBox = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
};

const imagePreview = {
  width: "100%",
  maxHeight: "220px",
  objectFit: "cover" as const,
  borderRadius: "12px",
  border: "1px solid #eee",
};

const removeNotice = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #f3d1d1",
  background: "#fff5f5",
  color: "#9f1239",
  fontSize: "13px",
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