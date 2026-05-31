"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "../lib/api";

type Place = {
  id: number;
  name: string;
  city?: string | null;
  destination?: number;
};

type UpdateType = "alert" | "event" | "info";

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlaceId = searchParams.get("place");

  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState<UpdateType>("alert");

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // =========================
  // Check authentication
  // =========================
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me/`, {
          credentials: "include",
        });

        if (!res.ok) {
          router.push("/login");
          return;
        }

        setCheckingAuth(false);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // =========================
  // Load places
  // =========================
  useEffect(() => {
    const loadPlaces = async () => {
      try {
        const res = await fetch(`${API_URL}/api/places/`, {
          credentials: "include",
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Failed to load places:", res.status, errorText);
          return;
        }

        const data = await res.json();

        const sorted = [...data].sort((a: Place, b: Place) =>
          a.name.localeCompare(b.name)
        );

        setPlaces(sorted);

        if (initialPlaceId) {
          const exists = sorted.some(
            (place: Place) => String(place.id) === String(initialPlaceId)
          );

          if (exists) {
            setSelectedPlaceId(initialPlaceId);
          }
        }

      } catch (error) {
        console.error("Places fetch error:", error);
      } finally {
        setLoadingPlaces(false);
      }
    };

    loadPlaces();
  }, [initialPlaceId]);

  // =========================
  // Create update
  // =========================
  const handleCreate = async () => {
    if (!selectedPlaceId) {
      alert("Please select a place.");
      return;
    }

    if (!text.trim()) {
      alert("Please write something.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/updates/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          place: Number(selectedPlaceId),
          text,
          type,
          category: "tourism",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Error creating post");
        return;
      }

      router.push("/");
    } catch (error) {
      console.error("Create post failed:", error);
      alert("Error creating post");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <main style={page}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <h1>Create Post</h1>

      <p style={intro}>
        Share an alert, event, useful information or a personal travel
        experience about a place.
      </p>

      <section style={card}>
        <div style={field}>
          <label style={label}>Place</label>

          {loadingPlaces ? (
            <p style={hint}>Loading places...</p>
          ) : places.length === 0 ? (
            <p style={hint}>No places available.</p>
          ) : (
            <select
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
              style={input}
            >
              <option value="">Select a place</option>

              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                  {place.city ? ` — ${place.city}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={field}>
          <label style={label}>Post type</label>

          <select
            value={type}
            onChange={(e) => setType(e.target.value as UpdateType)}
            style={input}
          >
            <option value="alert">alert</option>
            <option value="event">event</option>
            <option value="info">info</option>
          </select>

          <small style={hint}>
              Use this form only for alerts, events and useful information.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Text</label>
          <textarea
            placeholder="Write something..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              ...input,
              minHeight: "120px",
              resize: "vertical",
            }}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={submitting || loadingPlaces}
          style={button}
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </section>
    </main>
  );
}

const page = {
  padding: "40px",
  maxWidth: "600px",
  margin: "0 auto",
};

const intro = {
  color: "#666",
  lineHeight: 1.5,
  marginBottom: "20px",
};



const card = {
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "24px",
  background: "white",
  display: "flex",
  flexDirection: "column" as const,
  gap: "18px",
};

const field = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "6px",
};

const label = {
  fontSize: "14px",
  fontWeight: 600,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
};

const hint = {
  color: "#666",
  fontSize: "13px",
};

const button = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
  alignSelf: "flex-start",
};