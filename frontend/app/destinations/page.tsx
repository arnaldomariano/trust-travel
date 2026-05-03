"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../lib/api";

export default function DestinationsPage() {
  const router = useRouter();

  const [places, setPlaces] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceCity, setNewPlaceCity] = useState("");
  const [newPlaceCountry, setNewPlaceCountry] = useState("");

  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [submittingExperience, setSubmittingExperience] = useState(false);
  const [experienceShared, setExperienceShared] = useState(false);
  const [sharedExperience, setSharedExperience] = useState<any>(null);
  const [editingExperience, setEditingExperience] = useState(false);

  // =========================
  // Load places and destinations
  // =========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [placesRes, destinationsRes] = await Promise.all([
          fetch(`${API_URL}/api/places/`),
          fetch(`${API_URL}/api/destinations/`),
        ]);

        if (!placesRes.ok || !destinationsRes.ok) {
          console.error("Failed to load places or destinations");
          return;
        }

        const placesData = await placesRes.json();
        const destinationsData = await destinationsRes.json();

        setPlaces(placesData || []);
        setDestinations(destinationsData || []);
      } catch (error) {
        console.error("Search page load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // =========================
  // Keep new place name aligned with search
  // =========================
  useEffect(() => {
    if (!selectedPlace && searchTerm.trim()) {
      setNewPlaceName(searchTerm.trim());
    }
  }, [searchTerm, selectedPlace]);

  // =========================
  // Destination lookup map
  // =========================
  const destinationNameById = useMemo(() => {
    const map: Record<number, string> = {};

    destinations.forEach((destination) => {
      map[destination.id] = destination.name;
    });

    return map;
  }, [destinations]);

  // =========================
  // Search and filtering
  // =========================
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredPlaces = places
      .filter((place) => {
        if (!normalizedSearch) return false;

        return (
          (place.name || "").toLowerCase().includes(normalizedSearch) ||
          (place.city || "").toLowerCase().includes(normalizedSearch) ||
          (place.destination_name || "").toLowerCase().includes(normalizedSearch) ||
          (place.destination_country || "").toLowerCase().includes(normalizedSearch) ||
          (place.destination_city || "").toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const canCreatePlace = !!newPlaceName.trim();

  // =========================
  // Create a basic place
  // =========================
  const handleCreatePlace = async () => {
    if (!canCreatePlace) return;

    setCreatingPlace(true);

    try {
      const res = await fetch(`${API_URL}/api/places/create-basic/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newPlaceName.trim(),
          city: newPlaceCity.trim(),
          country: newPlaceCountry.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Error creating place.");
        return;
      }

        setPlaces((prev) => {
          const alreadyExists = prev.some((place) => place.id === data.id);

          if (alreadyExists) {
            return prev;
          }

          return [data, ...prev];
        });

        setSelectedPlace(data);
        setExperienceShared(false);
        setSharedExperience(null);
        setEditingExperience(false);
        setSearchTerm(data.name || newPlaceName.trim());

    } catch (error) {
      console.error("Create basic place failed:", error);
      alert("Error creating place.");
    } finally {
      setCreatingPlace(false);
    }
  };

  // =========================
  // Select an existing place
  // =========================
  const handleSelectExistingPlace = (place: any) => {
  setSelectedPlace(place);
  setExperienceShared(false);
  setSharedExperience(null);
  setEditingExperience(false);

  setTimeout(() => {
    document
      .getElementById("share-experience-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

  // =========================
  // Change selected place
  // =========================
  const handleChangePlace = () => {
    setSelectedPlace(null);
    setTitle("");
    setComment("");
    setRating(null);
    setImageFile(null);
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
  };

  // =========================
  // Reset share flow
  // =========================
  const resetShareFlow = () => {
    setSelectedPlace(null);
    setSearchTerm("");
    setNewPlaceName("");
    setNewPlaceCity("");
    setNewPlaceCountry("");
    setTitle("");
    setComment("");
    setRating(null);
    setImageFile(null);
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
  };

// =========================
// Start editing shared experience
// =========================
const startEditingExperience = () => {
  if (!sharedExperience) return;

  setTitle(sharedExperience.title || "");
  setComment(sharedExperience.comment || "");
  setRating(sharedExperience.rating || null);
  setImageFile(null);
  setExperienceShared(false);
  setEditingExperience(true);
};

  // =========================
  // Submit experience
  // =========================
  const handleSubmitExperience = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlace) return;

    if (!title.trim()) {
      alert("Please add a short title.");
      return;
    }

    if (!rating) {
      alert("Please select a rating.");
      return;
    }

    if (!comment.trim()) {
      alert("Please write your experience.");
      return;
    }

    setSubmittingExperience(true);

    try {
      const formData = new FormData();

formData.append("place", String(selectedPlace.id));
formData.append("title", title.trim());
formData.append("rating", String(rating));
formData.append("comment", comment.trim());

if (imageFile) {
  formData.append("image", imageFile);
}

const res = await fetch(`${API_URL}/api/experiences/`, {
  method: "POST",
  credentials: "include",
  body: formData,
});

      const data = await res.json();

      if (!res.ok) {
        console.error("Experience error:", data);
        alert(data.detail || "Error sharing experience.");
        return;
      }

      setSharedExperience(data);
      setTitle("");
      setComment("");
      setRating(null);
      setImageFile(null);
      setExperienceShared(true);
    } catch (error) {
      console.error("Share experience failed:", error);
      alert("Error sharing experience.");
    } finally {
      setSubmittingExperience(false);
    }
  };

// =========================
// Update experience
// =========================
const handleUpdateExperience = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!sharedExperience) return;

  if (!title.trim()) {
    alert("Please add a short title.");
    return;
  }

  if (!rating) {
    alert("Please select a rating.");
    return;
  }

  if (!comment.trim()) {
    alert("Please write your experience.");
    return;
  }

  setSubmittingExperience(true);

  try {
    const res = await fetch(`${API_URL}/api/experiences/${sharedExperience.id}/`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.trim(),
        rating,
        comment: comment.trim(),
        place: selectedPlace.id,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Update experience error:", data);
      alert(data.detail || "Error updating experience.");
      return;
    }

    setSharedExperience(data);
    setTitle("");
    setComment("");
    setRating(null);
    setEditingExperience(false);
    setExperienceShared(true);
  } catch (error) {
    console.error("Update experience failed:", error);
    alert("Error updating experience.");
  } finally {
    setSubmittingExperience(false);
  }
};

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          Home
        </Link>{" "}
        / <span>Share experience</span>
      </div>

      <h1>Where do you want to share your experience?</h1>

      <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "24px" }}>
        Search for a place first. If it already exists, you can share your
        experience there. If not, you can create it.
      </p>

        <input
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);

            if (selectedPlace) {
              setSelectedPlace(null);
              setTitle("");
              setComment("");
              setRating(null);
              setExperienceShared(false);
              setSharedExperience(null);
              setEditingExperience(false);
            }
          }}
        placeholder="Search a place, city, beach, restaurant, viewpoint..."
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "12px 14px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          fontSize: "14px",
          marginBottom: "24px",
        }}
      />

      {loading ? (
        <p style={{ color: "#666" }}>Loading places...</p>
      ) : !searchTerm.trim() ? (
        <div style={helperCard}>
          Start typing the name of a place, for example: Vaticano, Maragogi,
          Coliseu, or a viewpoint you visited.
        </div>
      ) : filteredPlaces.length > 0 ? (
        <section style={{ display: "grid", gap: "14px", maxWidth: "620px" }}>
          <p style={{ color: "#666", margin: 0 }}>
            We found existing places. Choose one to share your experience:
          </p>

          {filteredPlaces.map((place) => (
            <button
              key={place.id}
              onClick={() => handleSelectExistingPlace(place)}
              style={{
                padding: "18px",
                border: "1px solid #eee",
                borderRadius: "14px",
                background:
                  selectedPlace?.id === place.id ? "#f5f5f5" : "white",
                color: "black",
                textAlign: "left",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <strong>{place.name}</strong>

              <div
                style={{
                  marginTop: "6px",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                {[
                  place.city || place.destination_name,
                  place.destination_country,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Place"}
              </div>

              <div style={{ marginTop: "10px", fontSize: "14px" }}>
                Select this place →
              </div>
            </button>
          ))}
        </section>
      ) : (
        <section style={helperCard}>
          <strong>No place found for “{searchTerm.trim()}”.</strong>

          <p
            style={{
              margin: "10px 0 16px 0",
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            You can create this place with a little more context before sharing your
            experience.
          </p>

          <div style={createPlaceForm}>
            <input
              value={newPlaceName}
              onChange={(e) => setNewPlaceName(e.target.value)}
              placeholder="Place name"
              style={input}
            />

            <input
              value={newPlaceCity}
              onChange={(e) => setNewPlaceCity(e.target.value)}
              placeholder="City or region, e.g. Itatiaia"
              style={input}
            />

            <input
              value={newPlaceCountry}
              onChange={(e) => setNewPlaceCountry(e.target.value)}
              placeholder="Country, e.g. Brazil"
              style={input}
            />

            <button
              onClick={handleCreatePlace}
              disabled={!canCreatePlace || creatingPlace}
              style={{
                ...primaryButton,
                opacity: canCreatePlace && !creatingPlace ? 1 : 0.5,
                cursor: canCreatePlace && !creatingPlace ? "pointer" : "not-allowed",
              }}
            >
              {creatingPlace ? "Creating..." : "Create this place"}
            </button>
          </div>
        </section>
      )}

      {selectedPlace && (
          <section
            id="share-experience-form"
            style={{
            marginTop: "28px",
            padding: "22px",
            border: "1px solid #eee",
            borderRadius: "16px",
            background: "white",
            maxWidth: "620px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Share your experience about {selectedPlace.name}
          </h2>

          {!experienceShared && (
            <button
              onClick={handleChangePlace}
              style={{
                ...secondaryButton,
                marginBottom: "16px",
              }}
            >
              Change place
            </button>
          )}

          {experienceShared ? (
            <div>
              <p style={{ color: "#555", lineHeight: 1.5 }}>
                Your experience was shared successfully.
              </p>

              {sharedExperience && (
                <div style={previewCard}>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#777",
                      marginBottom: "8px",
                    }}
                  >
                    Published experience
                  </div>

                    <div style={{ fontWeight: 600, lineHeight: 1.5 }}>
                      {sharedExperience.title || "Shared experience"}
                    </div>

                    {sharedExperience.image_url && (
                      <img
                        src={sharedExperience.image_url}
                        alt={sharedExperience.title || "Shared experience"}
                        style={{
                          width: "100%",
                          maxHeight: "260px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          marginTop: "10px",
                          marginBottom: "10px",
                        }}
                      />
                    )}

                    <div style={{ marginTop: "8px", color: "#555", lineHeight: 1.5 }}>
                      {sharedExperience.comment}
                    </div>
                  <div
                    style={{
                      marginTop: "10px",
                      color: "#777",
                      fontSize: "13px",
                    }}
                  >
                    Rating: {"★".repeat(sharedExperience.rating)}
                    {"☆".repeat(5 - sharedExperience.rating)}
                  </div>
                </div>
              )}

                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button onClick={startEditingExperience} style={secondaryButton}>
                    Edit experience
                  </button>

                  <button
                    onClick={() => router.push(`/places/${selectedPlace.id}/experiences`)}
                    style={primaryButton}
                  >
                    View experiences
                  </button>

                  <button onClick={handleChangePlace} style={secondaryButton}>
                    Share another experience
                  </button>

                  <button onClick={() => router.push("/")} style={secondaryButton}>
                    Back to feed
                  </button>

                  <button onClick={resetShareFlow} style={secondaryButton}>
                    Start over
                  </button>
                </div>
              </div>
            ) : (
            <form
              onSubmit={editingExperience ? handleUpdateExperience : handleSubmitExperience}
              style={{ display: "grid", gap: "14px" }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title, e.g. Sunset on the way to Itatiaia"
                maxLength={160}
                style={input}
              />

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write your experience..."
                rows={4}
                style={input}
              />

              <input
                type="number"
                min="1"
                max="5"
                value={rating ?? ""}
                onChange={(e) => {
                  const value = e.target.value;

                  if (!value) {
                    setRating(null);
                    return;
                  }

                  const numeric = Number(value);

                  if (numeric >= 1 && numeric <= 5) {
                    setRating(numeric);
                  }
                }}
                placeholder="Rating from 1 to 5"
                style={input}
              />

                {!editingExperience && (
                  <div style={{ display: "grid", gap: "6px" }}>
                    <label style={{ fontSize: "13px", color: "#666" }}>
                      Optional image
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                      }}
                      style={input}
                    />

                    <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.4 }}>
                      Avoid sharing real-time or sensitive locations in photos.
                    </div>
                  </div>
                )}

              <button
                type="submit"
                disabled={submittingExperience || !title.trim() || !rating || !comment.trim()}
                style={{
                  ...primaryButton,
                  opacity:
                    submittingExperience || !title.trim() || !rating || !comment.trim()
                      ? 0.5
                      : 1,
                  cursor:
                    submittingExperience || !title.trim() || !rating || !comment.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submittingExperience
                  ? editingExperience
                    ? "Saving..."
                    : "Sharing..."
                  : editingExperience
                  ? "Save changes"
                  : "Share experience"}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}

const helperCard = {
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "white",
  color: "#555",
  maxWidth: "620px",
  lineHeight: 1.5,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const primaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const secondaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "black",
  cursor: "pointer",
};

const previewCard = {
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  marginBottom: "16px",
};

const createPlaceForm = {
  display: "grid",
  gap: "12px",
  marginTop: "14px",
};