"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../lib/api";

export default function DestinationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeFromUrl = searchParams.get("place");
  const shouldOpenShareForm = searchParams.get("share") === "true";

  const [places, setPlaces] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceCity, setNewPlaceCity] = useState("");
  const [newPlaceCountry, setNewPlaceCountry] = useState("");
  const [placeType, setPlaceType] = useState<
  "country" | "city" | "attraction" | "hotel" | "restaurant" | "nature" | "other"
>("city");

  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showShareForm, setShowShareForm] = useState(false);

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
// Select place from URL
// =========================
useEffect(() => {
  if (!placeFromUrl || places.length === 0) return;

  const place = places.find((p) => String(p.id) === String(placeFromUrl));

  if (!place) return;

  setSelectedPlace(place);
  setSearchTerm(place.name || "");
  setShowShareForm(shouldOpenShareForm);
  setExperienceShared(false);
  setSharedExperience(null);
  setEditingExperience(false);
  setTitle("");
  setComment("");
  setRating(null);
  setImageFile(null);

  setTimeout(() => {
    document
      .getElementById("selected-place-actions")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}, [placeFromUrl, shouldOpenShareForm, places]);

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
  .sort((a, b) => {
    const aMatchesSelectedType = a.place_type === placeType ? 0 : 1;
    const bMatchesSelectedType = b.place_type === placeType ? 0 : 1;

    if (aMatchesSelectedType !== bMatchesSelectedType) {
      return aMatchesSelectedType - bMatchesSelectedType;
    }

    const aExactName = (a.name || "").toLowerCase() === normalizedSearch ? 0 : 1;
    const bExactName = (b.name || "").toLowerCase() === normalizedSearch ? 0 : 1;

    if (aExactName !== bExactName) {
      return aExactName - bExactName;
    }

    return (a.name || "").localeCompare(b.name || "");
  });

  const canCreatePlace = !!newPlaceName.trim();

  const placeTypeLabels: Record<typeof placeType, string> = {
  country: "Country",
  city: "City / Region",
  attraction: "Tourist attraction",
  hotel: "Hotel",
  restaurant: "Restaurant / Café",
  nature: "Beach / Nature spot",
  other: "Other",
};

const searchPlaceholderByType: Record<typeof placeType, string> = {
  country: "Search a country, e.g. Laos, Brazil, Italy",
  city: "Search a city or region, e.g. Recife, Tuscany, Itatiaia",
  attraction: "Search an attraction, e.g. Coliseu, Acropolis, Kuang Si Waterfalls",
  hotel: "Search a hotel, e.g. Hotel name, resort, hostel...",
  restaurant: "Search a restaurant or café, e.g. Café X, restaurant Y...",
  nature: "Search a beach, park, trail, waterfall or nature spot...",
  other: "Search a place, area, business or travel reference...",
};

const placeNamePlaceholderByType: Record<typeof placeType, string> = {
  country: "Country name, e.g. Laos",
  city: "City or region name, e.g. Recife, Tuscany, Itatiaia",
  attraction: "Attraction name, e.g. Coliseu, Acropolis",
  hotel: "Hotel name, e.g. Hotel X",
  restaurant: "Restaurant or café name, e.g. Café X",
  nature: "Nature spot name, e.g. Praia de Boa Viagem, Kuang Si Waterfalls",
  other: "Neutral place name",
};

const cityPlaceholderByType: Record<typeof placeType, string> = {
  country: "Optional region or capital, e.g. Southeast Asia",
  city: "City or region, e.g. Recife, Tuscany",
  attraction: "City or region, e.g. Rome, Athens, Luang Prabang",
  hotel: "City or region where the hotel is located",
  restaurant: "City or region where the restaurant is located",
  nature: "City, region or nearest location",
  other: "City or region, if relevant",
};

const countryPlaceholderByType: Record<typeof placeType, string> = {
  country: "Country, e.g. Laos",
  city: "Country, e.g. Brazil",
  attraction: "Country, e.g. Italy, Greece, Laos",
  hotel: "Country where the hotel is located",
  restaurant: "Country where the restaurant is located",
  nature: "Country, e.g. Brazil, Laos, Netherlands",
  other: "Country, if relevant",
};

const getPlaceTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    country: "Country",
    city: "City / Region",
    attraction: "Tourist attraction",
    hotel: "Hotel",
    restaurant: "Restaurant / Café",
    nature: "Beach / Nature spot",
    other: "Other",
  };

  return labels[type || ""] || "Place";
};

const getPlaceLocationText = (place: any) => {
  if (place.place_type === "country") {
    return place.destination_country || place.name || "Country";
  }

  const locationParts = [
    place.city || place.destination_name,
    place.destination_country,
  ].filter(Boolean);

  return locationParts.join(" · ") || "Place";
};

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
          place_type: placeType,
          city: placeType === "country" ? "" : newPlaceCity.trim(),
          country:
            placeType === "country"
              ? newPlaceName.trim()
              : newPlaceCountry.trim(),
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
  setShowShareForm(false);
  setExperienceShared(false);
  setSharedExperience(null);
  setEditingExperience(false);
  setTitle("");
  setComment("");
  setRating(null);
  setImageFile(null);

  setTimeout(() => {
    document
      .getElementById("selected-place-actions")
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
    setShowShareForm(false);
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
    setShowShareForm(false);
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
        / <span>Explore</span>
      </div>

      <h1>Find a destination or place</h1>

      <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "24px" }}>
        Search by country, city, attraction, hotel, restaurant or nature spot.
        You can read existing experiences first — and share your own if you want.
      </p>

        <div style={{ marginBottom: "22px" }}>
          <div style={{ fontWeight: 600, marginBottom: "10px" }}>
            What do you want to search or share about?
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              ["country", "Country"],
              ["city", "City / Region"],
              ["attraction", "Tourist attraction"],
              ["hotel", "Hotel"],
              ["restaurant", "Restaurant / Café"],
              ["nature", "Beach / Nature"],
              ["other", "Other"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPlaceType(value as typeof placeType);
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
                  setShowShareForm(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: placeType === value ? "#111" : "white",
                  color: placeType === value ? "white" : "#111",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

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
        placeholder={searchPlaceholderByType[placeType]}
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
          Start typing based on the type you selected. For example, search for a country,
          city, attraction, hotel, restaurant or nature spot.
        </div>
      ) : filteredPlaces.length > 0 ? (
        <section style={{ display: "grid", gap: "14px", maxWidth: "620px" }}>
          <p style={{ color: "#666", margin: 0 }}>
              We found existing places. Results matching your selected type appear first:
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
              <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <strong>{place.name}</strong>

              <span
                style={{
                  fontSize: "11px",
                  color: "#555",
                  background: "#f5f5f5",
                  border: "1px solid #e5e5e5",
                  borderRadius: "999px",
                  padding: "4px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                {getPlaceTypeLabel(place.place_type)}
              </span>
            </div>

                {place.place_type !== "country" && (
                  <div
                    style={{
                      marginTop: "6px",
                      color: "#666",
                      fontSize: "14px",
                    }}
                  >
                    {getPlaceLocationText(place)}
                  </div>
                )}

              <div style={{ marginTop: "10px", fontSize: "14px" }}>
                Explore or share here →
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
              Create a neutral {placeTypeLabels[placeType].toLowerCase()} name that other
              travelers can also use. Avoid using opinions, warnings, or personal advice
              here. You can add your personal opinion in the experience title later.
            </p>

          <div style={createPlaceForm}>
            <input
              value={newPlaceName}
              onChange={(e) => setNewPlaceName(e.target.value)}
              placeholder={placeNamePlaceholderByType[placeType]}
              style={input}
            />

            <input
              value={newPlaceCity}
              onChange={(e) => setNewPlaceCity(e.target.value)}
              placeholder={cityPlaceholderByType[placeType]}
              style={input}
            />

            <input
              value={newPlaceCountry}
              onChange={(e) => setNewPlaceCountry(e.target.value)}
              placeholder={countryPlaceholderByType[placeType]}
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
    id="selected-place-actions"
    style={{
      marginTop: "28px",
      padding: "22px",
      border: "1px solid #eee",
      borderRadius: "16px",
      background: "white",
      maxWidth: "620px",
    }}
  >
    <h2 style={{ marginTop: 0 }}>{selectedPlace.name}</h2>

    <p style={{ color: "#666", lineHeight: 1.5 }}>
      Choose what you want to do next.
    </p>

    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => router.push(`/places/${selectedPlace.id}/experiences`)}
        style={primaryButton}
      >
        View experiences
      </button>

      <button
        type="button"
        onClick={() => setShowShareForm(true)}
        style={secondaryButton}
      >
        Share your experience
      </button>

      <button
        type="button"
        onClick={handleChangePlace}
        style={secondaryButton}
      >
        Change selection
      </button>
    </div>
  </section>
)}

        {selectedPlace && showShareForm && (
          <section
            id="share-experience-form"
            style={{
              marginTop: "18px",
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
                    onClick={() =>
                      sharedExperience
                        ? router.push(
                            `/places/${selectedPlace.id}/experiences?highlight=${sharedExperience.id}`
                          )
                        : router.push(`/places/${selectedPlace.id}/experiences`)
                    }
                    style={primaryButton}
                  >
                    View your experience
                  </button>

                  <button onClick={handleChangePlace} style={secondaryButton}>
                    Choose another place
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
                  placeholder="Experience title, e.g. Beautiful but too crowded in high season"
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