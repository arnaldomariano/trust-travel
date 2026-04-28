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

    const [selectedPlace, setSelectedPlace] = useState<any>(null);
    const [comment, setComment] = useState("");
    const [rating, setRating] = useState<number | null>(null);
    const [submittingExperience, setSubmittingExperience] = useState(false);
    const [experienceShared, setExperienceShared] = useState(false);

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

  const destinationNameById = useMemo(() => {
    const map: Record<number, string> = {};

    destinations.forEach((destination) => {
      map[destination.id] = destination.name;
    });

    return map;
  }, [destinations]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredPlaces = places
    .filter((place) => {
      if (!normalizedSearch) return false;

      return (
        (place.name || "").toLowerCase().includes(normalizedSearch) ||
        (place.city || "").toLowerCase().includes(normalizedSearch)
      );
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const canCreatePlace = !!searchTerm.trim();

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
        name: searchTerm.trim(),
        city: searchTerm.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Error creating place.");
      return;
    }

    setSelectedPlace(data);
    setExperienceShared(false);
  } catch (error) {
    console.error("Create basic place failed:", error);
    alert("Error creating place.");
  } finally {
    setCreatingPlace(false);
  }
};

const handleSelectExistingPlace = (place: any) => {
  setSelectedPlace(place);
  setExperienceShared(false);
};

const handleSubmitExperience = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!selectedPlace) return;

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
    const res = await fetch(`${API_URL}/api/experiences/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        place: selectedPlace.id,
        rating,
        comment: comment.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Experience error:", data);
      alert(data.detail || "Error sharing experience.");
      return;
    }

    setComment("");
    setRating(null);
    setExperienceShared(true);
  } catch (error) {
    console.error("Share experience failed:", error);
    alert("Error sharing experience.");
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
        onChange={(e) => setSearchTerm(e.target.value)}
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
              background: selectedPlace?.id === place.id ? "#f5f5f5" : "white",
              color: "black",
              textAlign: "left",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <strong>{place.name}</strong>

            <div style={{ marginTop: "6px", color: "#666", fontSize: "14px" }}>
              {destinationNameById[place.destination] || place.city || "Place"}
            </div>

            <div style={{ marginTop: "10px", fontSize: "14px" }}>
              Share your experience here →
            </div>
          </button>
        ))}
        </section>
      ) : (
        <section style={helperCard}>
          <strong>No place found for “{searchTerm.trim()}”.</strong>

          <p style={{ margin: "10px 0 16px 0", color: "#666", lineHeight: 1.5 }}>
            You can create this place and then share your experience there.
          </p>

          <button
          onClick={handleCreatePlace}
          disabled={!canCreatePlace || creatingPlace}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            background: "black",
            color: "white",
            cursor: canCreatePlace && !creatingPlace ? "pointer" : "not-allowed",
            opacity: canCreatePlace && !creatingPlace ? 1 : 0.5,
          }}
        >
          {creatingPlace ? "Creating..." : "Create this place"}
        </button>
        </section>
      )}

      {selectedPlace && (
      <section
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

        {experienceShared ? (
          <div>
            <p style={{ color: "#555", lineHeight: 1.5 }}>
              Your experience was shared successfully.
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push(`/places/${selectedPlace.id}`)}
                style={primaryButton}
              >
                View place page
              </button>

              <button onClick={() => router.push("/")} style={secondaryButton}>
                Back to feed
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitExperience} style={{ display: "grid", gap: "14px" }}>
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

            <button
              type="submit"
              disabled={submittingExperience || !rating || !comment.trim()}
              style={{
                ...primaryButton,
                opacity: submittingExperience || !rating || !comment.trim() ? 0.5 : 1,
                cursor:
                  submittingExperience || !rating || !comment.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {submittingExperience ? "Sharing..." : "Share experience"}
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