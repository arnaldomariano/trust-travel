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
  safety_rating?: number | null;
  cost_rating?: number | null;
  accessibility_rating?: number | null;
  convenience_rating?: number | null;
  trip_context: string;
  trip_style: string;
  image_url?: string | null;
  place: string;
  place_id: number;
  destination: string;
  created_at: string;
  updated_at: string;
};

type ExtraPhoto = {
  id: number;
  experience: number;
  image?: string;
  image_url: string;
  caption?: string;
  created_at: string;
};

const MAX_EXTRA_PHOTOS = 3;

export default function MyPostsPage() {
const [posts, setPosts] = useState<MyPost[]>([]);
const [experiences, setExperiences] = useState<MyExperience[]>([]);
const [extraPhotosByExperience, setExtraPhotosByExperience] = useState<
  Record<number, ExtraPhoto[]>
>({});
const [loading, setLoading] = useState(true);


const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
const [editingUpdateText, setEditingUpdateText] = useState("");
const [editingUpdateType, setEditingUpdateType] = useState<"event" | "alert" | "info">("info");
const [savingUpdate, setSavingUpdate] = useState(false);

const [editingExperienceId, setEditingExperienceId] = useState<number | null>(null);

const [editTitle, setEditTitle] = useState("");
const [editComment, setEditComment] = useState("");
const [editRating, setEditRating] = useState<number | null>(null);

const [editSafetyRating, setEditSafetyRating] = useState<number | null>(null);
const [editCostRating, setEditCostRating] = useState<number | null>(null);
const [editAccessibilityRating, setEditAccessibilityRating] = useState<number | null>(null);
const [editConvenienceRating, setEditConvenienceRating] = useState<number | null>(null);

const [editTripContext, setEditTripContext] = useState("prefer_not_to_say");
const [editTripStyle, setEditTripStyle] = useState("prefer_not_to_say");

const resetEditStructuredRatings = () => {
  setEditSafetyRating(null);
  setEditCostRating(null);
  setEditAccessibilityRating(null);
  setEditConvenienceRating(null);
};

const handleOptionalRatingChange = (
  value: string,
  setter: (value: number | null) => void
) => {
  if (!value) {
    setter(null);
    return;
  }

  const numeric = Number(value);

  if (numeric >= 1 && numeric <= 5) {
    setter(numeric);
  }
};

const [imageAction, setImageAction] = useState<"keep" | "replace" | "remove">("keep");
const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

const [editImageFile, setEditImageFile] = useState<File | null>(null);
const [removeImage, setRemoveImage] = useState(false);
const [savingExperience, setSavingExperience] = useState(false);

const [extraPhotoFile, setExtraPhotoFile] = useState<File | null>(null);
const [extraPhotoCaption, setExtraPhotoCaption] = useState("");
const [uploadingExtraPhoto, setUploadingExtraPhoto] = useState(false);
const [openGalleryFor, setOpenGalleryFor] = useState<number | null>(null);

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

    const nonExperiencePosts = Array.isArray(postsData)
      ? postsData.filter((post) => post.type !== "experience")
      : [];

    setPosts(nonExperiencePosts);
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
    const experiencesList = experiencesData || [];

    setExperiences(experiencesList);
    await loadExtraPhotosForExperiences(experiencesList);

    }
  } catch (error) {
    console.error("My posts fetch error:", error);
  } finally {
    setLoading(false);
  }
};

// =========================
// Load extra gallery photos for experiences
// =========================
const loadExtraPhotosForExperiences = async (experiencesList: MyExperience[]) => {
  try {
    const entries = await Promise.all(
      experiencesList.map(async (experience) => {
        const res = await fetch(
          `${API_URL}/api/experiences/${experience.id}/photos/`,
          {
            credentials: "include",
          }
        );

        if (!res.ok) {
          const text = await res.text();
          console.error(
            "Failed to load extra photos:",
            experience.id,
            res.status,
            text
          );
          return [experience.id, []];
        }

        const data = await res.json();

        return [experience.id, Array.isArray(data) ? data : []];
      })
    );

    setExtraPhotosByExperience(Object.fromEntries(entries));
  } catch (error) {
    console.error("Failed to load extra gallery photos:", error);
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

  setEditSafetyRating(experience.safety_rating || null);
  setEditCostRating(experience.cost_rating || null);
  setEditAccessibilityRating(experience.accessibility_rating || null);
  setEditConvenienceRating(experience.convenience_rating || null);

  setEditTripContext(experience.trip_context || "prefer_not_to_say");
  setEditTripStyle(experience.trip_style || "prefer_not_to_say");
  setEditImageFile(null);
  setRemoveImage(false);
  setExtraPhotoFile(null);
  setExtraPhotoCaption("");
  setUploadingExtraPhoto(false);
  setEditImagePreview(null);
  setImageAction("keep");
  setOpenGalleryFor(null);
};

// =========================
// Cancel editing experience
// =========================
const cancelEditingExperience = () => {
  setEditingExperienceId(null);
  setEditTitle("");
  setEditComment("");
  setEditRating(null);
  resetEditStructuredRatings();
  setEditTripContext("prefer_not_to_say");
  setEditTripStyle("prefer_not_to_say");
  setEditImageFile(null);
  setRemoveImage(false);
  setExtraPhotoFile(null);
  setExtraPhotoCaption("");
  setUploadingExtraPhoto(false);
  setEditImagePreview(null);
  setImageAction("keep");
  setOpenGalleryFor(null);
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

    if (editSafetyRating) {
      formData.append("safety_rating", String(editSafetyRating));
    } else {
      formData.append("safety_rating", "");
    }

    if (editCostRating) {
      formData.append("cost_rating", String(editCostRating));
    } else {
      formData.append("cost_rating", "");
    }

    if (editAccessibilityRating) {
      formData.append("accessibility_rating", String(editAccessibilityRating));
    } else {
      formData.append("accessibility_rating", "");
    }

    if (editConvenienceRating) {
      formData.append("convenience_rating", String(editConvenienceRating));
    } else {
      formData.append("convenience_rating", "");
    }

    formData.append("trip_context", editTripContext);
    formData.append("trip_style", editTripStyle);

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
            safety_rating: data.safety_rating,
            cost_rating: data.cost_rating,
            accessibility_rating: data.accessibility_rating,
            convenience_rating: data.convenience_rating,
            trip_context: data.trip_context,
            trip_style: data.trip_style,
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

// =========================
// Upload extra gallery photo
// =========================
const uploadExtraPhoto = async (experienceId: number) => {
  if (!extraPhotoFile) {
    alert("Please choose an extra photo first.");
    return;
  }

const currentExtraPhotos = extraPhotosByExperience[experienceId] || [];

if (currentExtraPhotos.length >= MAX_EXTRA_PHOTOS) {
  alert(`You can add up to ${MAX_EXTRA_PHOTOS} extra photos to each experience.`);
  return;
}

  setUploadingExtraPhoto(true);

  try {
    const formData = new FormData();

    formData.append("image", extraPhotoFile);

    if (extraPhotoCaption.trim()) {
      formData.append("caption", extraPhotoCaption.trim());
    }

    const res = await fetch(`${API_URL}/api/experiences/${experienceId}/photos/`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to upload extra photo:", data);
      alert(data.detail || "Error uploading extra photo.");
      return;
    }

    setExtraPhotoFile(null);
    setExtraPhotoCaption("");

    await loadExtraPhotosForExperiences(experiences);

    alert("Extra photo added to the experience gallery.");
  } catch (error) {
    console.error("Upload extra photo failed:", error);
    alert("Error uploading extra photo.");
  } finally {
    setUploadingExtraPhoto(false);
  }
};

// =========================
// Start editing event/info/alert
// =========================
const startEditingUpdate = (post: MyPost) => {
  setEditingUpdateId(post.id);
  setEditingUpdateText(post.text || "");

  if (post.type === "event" || post.type === "alert" || post.type === "info") {
    setEditingUpdateType(post.type);
  } else {
    setEditingUpdateType("info");
  }
};

// =========================
// Cancel editing event/info/alert
// =========================
const cancelEditingUpdate = () => {
  setEditingUpdateId(null);
  setEditingUpdateText("");
  setEditingUpdateType("info");
};

// =========================
// Save edited event/info/alert
// =========================
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

// =========================
// Delete experience
// =========================
const deleteExperience = async (experienceId: number) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this experience? This action cannot be undone."
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/api/experiences/${experienceId}/`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      let message = "Error deleting experience.";

      try {
        const data = await res.json();
        message = data.detail || message;
      } catch {
        // Keep default message if response has no JSON body.
      }

      alert(message);
      return;
    }

    setExperiences((prev) =>
      prev.filter((experience) => experience.id !== experienceId)
    );

    setExtraPhotosByExperience((prev) => {
      const copy = { ...prev };
      delete copy[experienceId];
      return copy;
    });

    if (editingExperienceId === experienceId) {
      cancelEditingExperience();
    }

    if (openGalleryFor === experienceId) {
      setOpenGalleryFor(null);
    }
  } catch (error) {
    console.error("Failed to delete experience:", error);
    alert("Error deleting experience.");
  }
};


// =========================
// Delete event/info/alert
// =========================
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

const formatTripValue = (value: string) => {
  const labels: Record<string, string> = {
    prefer_not_to_say: "Prefer not to say",
    solo: "Solo traveler",
    couple: "Couple",
    family_children: "Family with children",
    friends_group: "Friends / group",
    business: "Business traveler",
    local_resident: "Local resident",
    retired: "Retired traveler",
    culture_museums: "Culture and museums",
    nature_outdoors: "Nature and outdoors",
    food_restaurants: "Food and restaurants",
    relaxed: "Relaxed travel",
    budget: "Budget travel",
    comfort: "Comfort travel",
    adventure: "Adventure",
    local_life: "Local life",
  };

  return labels[value] || value;
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

        <section style={managerNav}>
          <div>
            <strong>Manage your content</strong>
            <p style={{ margin: "6px 0 0 0", color: "#666", lineHeight: 1.5 }}>
              Experiences and event/info posts are managed separately to keep editing easier.
            </p>
          </div>

          <div style={actions}>
            <Link href="/my-posts" style={primaryLink}>
              Experiences
            </Link>

            <Link href="/my-posts/updates" style={secondaryLink}>
              Events & Info
            </Link>
          </div>
        </section>

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

                      <section style={structuredRatingsBox}>
                          <div>
                            <strong>Optional practical ratings</strong>

                            <p style={structuredRatingsIntro}>
                              These ratings are optional and help future travelers compare this place by
                              practical criteria.
                            </p>
                          </div>

                          <div style={structuredRatingsGrid}>
                            <label style={structuredRatingField}>
                              Safety
                              <select
                                value={editSafetyRating ?? ""}
                                onChange={(e) =>
                                  handleOptionalRatingChange(e.target.value, setEditSafetyRating)
                                }
                                style={input}
                              >
                                <option value="">Not rated</option>
                                <option value="1">1 — Poor</option>
                                <option value="2">2 — Limited</option>
                                <option value="3">3 — Okay</option>
                                <option value="4">4 — Good</option>
                                <option value="5">5 — Excellent</option>
                              </select>
                            </label>

                            <label style={structuredRatingField}>
                              Cost
                              <select
                                value={editCostRating ?? ""}
                                onChange={(e) =>
                                  handleOptionalRatingChange(e.target.value, setEditCostRating)
                                }
                                style={input}
                              >
                                <option value="">Not rated</option>
                                <option value="1">1 — Very expensive / poor value</option>
                                <option value="2">2 — Expensive</option>
                                <option value="3">3 — Fair</option>
                                <option value="4">4 — Good value</option>
                                <option value="5">5 — Excellent value</option>
                              </select>
                            </label>

                            <label style={structuredRatingField}>
                              Accessibility
                              <select
                                value={editAccessibilityRating ?? ""}
                                onChange={(e) =>
                                  handleOptionalRatingChange(e.target.value, setEditAccessibilityRating)
                                }
                                style={input}
                              >
                                <option value="">Not rated</option>
                                <option value="1">1 — Very difficult</option>
                                <option value="2">2 — Difficult</option>
                                <option value="3">3 — Acceptable</option>
                                <option value="4">4 — Easy</option>
                                <option value="5">5 — Very easy</option>
                              </select>
                            </label>

                            <label style={structuredRatingField}>
                              Convenience
                              <select
                                value={editConvenienceRating ?? ""}
                                onChange={(e) =>
                                  handleOptionalRatingChange(e.target.value, setEditConvenienceRating)
                                }
                                style={input}
                              >
                                <option value="">Not rated</option>
                                <option value="1">1 — Poor</option>
                                <option value="2">2 — Limited</option>
                                <option value="3">3 — Okay</option>
                                <option value="4">4 — Convenient</option>
                                <option value="5">5 — Very convenient</option>
                              </select>
                            </label>
                          </div>
                        </section>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          <div style={{ display: "grid", gap: "6px" }}>
                            <label style={smallLabel}>Trip context</label>

                            <select
                              value={editTripContext}
                              onChange={(e) => setEditTripContext(e.target.value)}
                              style={input}
                            >
                              <option value="prefer_not_to_say">Prefer not to say</option>
                              <option value="solo">Solo traveler</option>
                              <option value="couple">Couple</option>
                              <option value="family_children">Family with children</option>
                              <option value="friends_group">Friends / group</option>
                              <option value="business">Business traveler</option>
                              <option value="local_resident">Local resident</option>
                              <option value="retired">Retired traveler</option>
                            </select>
                          </div>

                          <div style={{ display: "grid", gap: "6px" }}>
                            <label style={smallLabel}>Trip style</label>

                            <select
                              value={editTripStyle}
                              onChange={(e) => setEditTripStyle(e.target.value)}
                              style={input}
                            >
                              <option value="prefer_not_to_say">Prefer not to say</option>
                              <option value="culture_museums">Culture and museums</option>
                              <option value="nature_outdoors">Nature and outdoors</option>
                              <option value="food_restaurants">Food and restaurants</option>
                              <option value="relaxed">Relaxed travel</option>
                              <option value="budget">Budget travel</option>
                              <option value="comfort">Comfort travel</option>
                              <option value="adventure">Adventure</option>
                              <option value="local_life">Local life</option>
                            </select>
                          </div>
                        </div>

                        <div style={helperNote}>
                          These fields describe this specific experience and can be corrected later if you selected the wrong context.
                        </div>

                        <div style={imageEditBox}>
                          <div>
                          <div style={{ fontSize: "13px", color: "#666", fontWeight: 600 }}>
                            Main experience photo
                          </div>

                          <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.4, marginTop: "4px" }}>
                            This is the main photo shown on experience cards. Extra gallery photos are managed separately after saving.
                          </div>
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

                    {[
                      ["Safety", experience.safety_rating],
                      ["Cost", experience.cost_rating],
                      ["Accessibility", experience.accessibility_rating],
                      ["Convenience", experience.convenience_rating],
                    ].some(([, value]) => value) && (
                      <div style={structuredRatingsPreviewBox}>
                        <strong>Practical ratings</strong>

                        <div style={structuredRatingsPreviewGrid}>
                          {[
                            ["Safety", experience.safety_rating],
                            ["Cost", experience.cost_rating],
                            ["Accessibility", experience.accessibility_rating],
                            ["Convenience", experience.convenience_rating],
                          ]
                            .filter(([, value]) => value)
                            .map(([label, value]) => (
                              <span key={label} style={structuredRatingsPreviewBadge}>
                                {label}: {"★".repeat(Number(value))}
                                {"☆".repeat(5 - Number(value))}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {(experience.trip_context !== "prefer_not_to_say" ||
                      experience.trip_style !== "prefer_not_to_say") && (
                      <div style={tripMetaRow}>
                        {experience.trip_context !== "prefer_not_to_say" && (
                          <span style={tripMetaBadge}>
                            Context: {formatTripValue(experience.trip_context)}
                          </span>
                        )}

                        {experience.trip_style !== "prefer_not_to_say" && (
                          <span style={tripMetaBadge}>
                            Style: {formatTripValue(experience.trip_style)}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={photoSummaryBox}>
                      <strong>Photos</strong>

                      <span>
                        Main photo: {experience.image_url ? "added" : "not added yet"} · Extra gallery:{" "}
                        {(extraPhotosByExperience[experience.id] || []).length} / {MAX_EXTRA_PHOTOS}
                      </span>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <button
                          type="button"
                          style={secondaryButton}
                          onClick={() => {
                            setOpenGalleryFor((current) =>
                              current === experience.id ? null : experience.id
                            );
                          }}
                        >
                          {openGalleryFor === experience.id
                            ? "Hide gallery manager"
                            : `Manage gallery photos (${(extraPhotosByExperience[experience.id] || []).length}/${MAX_EXTRA_PHOTOS})`}
                      </button>
                    </div>

                    {openGalleryFor === experience.id && (
                      <div style={extraGalleryBox}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                          <strong style={{ fontSize: "14px" }}>Extra gallery photos</strong>

                          <span style={{ fontSize: "12px", color: "#777" }}>
                            {(extraPhotosByExperience[experience.id] || []).length} / {MAX_EXTRA_PHOTOS} photos
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: "6px",
                            marginBottom: "12px",
                            fontSize: "12px",
                            color: "#777",
                            lineHeight: 1.5,
                          }}
                        >
                            This area is only for additional gallery photos. The main photo is managed with the Edit button.
                            You can add up to {MAX_EXTRA_PHOTOS} extra photos, one photo at a time. These photos appear when travelers open the photo gallery on the full experience page.
                        </div>

                        {(extraPhotosByExperience[experience.id] || []).length > 0 && (
                          <div style={extraPhotosGrid}>
                            {(extraPhotosByExperience[experience.id] || []).map((photo, index) => (
                              <div key={photo.id} style={extraPhotoItem}>
                                <img
                                  src={photo.image_url}
                                  alt={photo.caption || `Gallery photo ${index + 1}`}
                                  style={extraPhotoThumb}
                                />

                                <div style={{ fontSize: "12px", color: "#666" }}>
                                  Photo {index + 1}
                                </div>

                                {photo.caption && (
                                  <div style={{ fontSize: "11px", color: "#777", lineHeight: 1.4 }}>
                                    {photo.caption}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {(extraPhotosByExperience[experience.id] || []).length < MAX_EXTRA_PHOTOS ? (
                          <>
                            <div style={extraPhotoUploadBox}>
                              <div>
                                <strong style={{ fontSize: "13px" }}>Add one extra gallery photo</strong>

                                <p style={extraPhotoUploadText}>
                                  Choose one photo from your device. It will be uploaded as an additional
                                  gallery photo for this experience. The main photo is edited separately.
                                </p>
                              </div>

                              <label style={smallLabel}>Photo file</label>

                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setExtraPhotoFile(file);
                                }}
                                style={input}
                              />

                              <label style={smallLabel}>Caption before upload</label>

                              <p style={extraPhotoUploadText}>
                                Optional: write a short caption now. This caption will be saved together
                                with the photo when you click upload.
                              </p>

                              <input
                                value={extraPhotoCaption}
                                onChange={(e) => setExtraPhotoCaption(e.target.value)}
                                placeholder="Example: View from the trail, hotel entrance, waterfall area..."
                                maxLength={160}
                                style={input}
                              />
                            </div>

                        {!extraPhotoFile ? (
                          <div style={helperNote}>
                            After choosing a photo file, the upload button will appear here.
                          </div>
                        ) : (
                          <button
                            type="button"
                            style={{
                              ...secondaryButton,
                              opacity: uploadingExtraPhoto ? 0.5 : 1,
                              cursor: uploadingExtraPhoto ? "not-allowed" : "pointer",
                            }}
                            disabled={uploadingExtraPhoto}
                            onClick={() => uploadExtraPhoto(experience.id)}
                          >
                            {uploadingExtraPhoto ? "Uploading..." : "Upload gallery photo"}
                          </button>
                        )}
                          </>
                        ) : (
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: "10px",
                              border: "1px solid #eee",
                              background: "white",
                              color: "#666",
                              fontSize: "13px",
                            }}
                          >
                            Gallery complete: {MAX_EXTRA_PHOTOS} / {MAX_EXTRA_PHOTOS} photos added.
                          </div>
                        )}
                      </div>
                    )}
                    <div style={actions}>
                          <Link
                            href={`/experiences/${experience.id}`}
                            style={secondaryLink}
                          >
                            View experience
                          </Link>

                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() => startEditingExperience(experience)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            style={dangerButton}
                            onClick={() => deleteExperience(experience.id)}
                          >
                            Delete
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
            <h2 style={sectionTitle}>My Events & Info</h2>

            {posts.map((post) => {
              const isEditing = editingUpdateId === post.id;

              return (
                <article key={post.id} style={card}>
                  <div style={metaRow}>
                    <div>
                      <strong>
                        {post.type === "event" && "🎭 Event"}
                        {post.type === "alert" && "⚠️ Alert"}
                        {post.type === "info" && "ℹ️ Info"}
                        {" "}— {post.place}
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

const extraGalleryBox = {
  display: "grid",
  gap: "10px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
};

const extraPhotoUploadBox = {
  display: "grid",
  gap: "8px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "white",
};

const extraPhotoUploadText = {
  margin: "4px 0 0 0",
  color: "#666",
  fontSize: "12px",
  lineHeight: 1.5,
};

const extraPhotosGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "10px",
};

const extraPhotoItem = {
  display: "grid",
  gap: "6px",
};

const extraPhotoThumb = {
  width: "100%",
  height: "110px",
  objectFit: "contain" as const,
  borderRadius: "10px",
  border: "1px solid #eee",
  background: "#f5f5f5",
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
  maxHeight: "260px",
  objectFit: "contain" as const,
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#f5f5f5",
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

const smallLabel = {
  fontSize: "13px",
  color: "#666",
  fontWeight: 600,
};

const helperNote = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#666",
  fontSize: "12px",
  lineHeight: 1.5,
};

const tripMetaRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginBottom: "16px",
};

const tripMetaBadge = {
  display: "inline-block",
  fontSize: "12px",
  color: "#555",
  border: "1px solid #ddd",
  borderRadius: "999px",
  padding: "4px 8px",
  background: "#fafafa",
};

const structuredRatingsBox = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  display: "grid",
  gap: "12px",
};

const structuredRatingsIntro = {
  margin: "6px 0 0 0",
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.5,
};

const structuredRatingsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
};

const structuredRatingField = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  color: "#555",
  fontWeight: 600,
};

const structuredRatingsPreviewBox = {
  marginBottom: "16px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  display: "grid",
  gap: "8px",
  color: "#555",
  fontSize: "13px",
};

const structuredRatingsPreviewGrid = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const structuredRatingsPreviewBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #eee",
  background: "white",
  fontSize: "12px",
};

const photoSummaryBox = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginBottom: "14px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#555",
  fontSize: "13px",
};

