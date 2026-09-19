"use client";

import { useEffect, useRef, useState } from "react";

import { API_URL } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";

type GalleryPlace = {
  id: number;
  name: string;
  place_type: string;
  photo_count: number;
};

type GalleryPhoto = {
  experience_id: number;
  photo_source: "main" | "extra";
  photo_id: number | null;
  image_url: string;
  caption: string;
  experience_title: string;
  place: {
    id: number;
    name: string;
    place_type: string;
  };
  author: {
    display_name: string;
  };
  created_at: string;
  gallery_featured_at: string | null;
  is_new: boolean;
};

type GalleryResponse = {
  places: GalleryPlace[];
  photos: GalleryPhoto[];
  new_photo_count: number;
  had_previous_visit: boolean;
};

export default function GalleryPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [places, setPlaces] = useState<GalleryPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [newPhotoCount, setNewPhotoCount] = useState(0);
  const [hadPreviousVisit, setHadPreviousVisit] = useState(false);
  const gallerySeenPostedRef = useRef(false);

  const visiblePhotos =
    selectedPlaceId === null
      ? photos
      : photos.filter((photo) => photo.place.id === selectedPlaceId);

  useEffect(() => {
    const loadGallery = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_URL}/api/gallery/`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to load Gallery:", res.status, text);
          setError("Could not load the Gallery.");
          return;
        }

        const data: GalleryResponse = await res.json();

        setPhotos(Array.isArray(data.photos) ? data.photos : []);
        setPlaces(Array.isArray(data.places) ? data.places : []);
        setNewPhotoCount(
          typeof data.new_photo_count === "number"
            ? data.new_photo_count
            : 0
        );
        setHadPreviousVisit(data.had_previous_visit === true);
      } catch (loadError) {
        console.error("Gallery load failed:", loadError);
        setError("Could not load the Gallery.");
      } finally {
        setLoading(false);
      }
    };

    loadGallery();
  }, []);

  useEffect(() => {
    if (
      loading ||
      error ||
      authLoading ||
      !isLoggedIn ||
      gallerySeenPostedRef.current
    ) {
      return;
    }

    gallerySeenPostedRef.current = true;

    const markGallerySeen = async () => {
      try {
        const res = await fetch(`${API_URL}/api/gallery/seen/`, {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(
            "Failed to mark Gallery as seen:",
            res.status,
            text
          );
        }
      } catch (seenError) {
        console.error("Gallery seen update failed:", seenError);
      }
    };

    markGallerySeen();
  }, [loading, error, authLoading, isLoggedIn]);

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "12px 0 48px",
      }}
    >
      <section style={{ marginBottom: "28px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            lineHeight: 1.15,
          }}
        >
          Trust Travel Gallery
        </h1>

        <p
          style={{
            margin: "10px 0 0",
            maxWidth: "680px",
            color: "#666",
            lineHeight: 1.6,
          }}
        >
          Places through the eyes of people who experienced them.
        </p>
      </section>

      {!loading &&
        !error &&
        hadPreviousVisit &&
        newPhotoCount > 0 && (
          <div
            style={{
              marginBottom: "18px",
              padding: "10px 12px",
              borderRadius: "12px",
              background: "#f5f7ff",
              color: "#3f4b6e",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {newPhotoCount === 1
              ? "1 new photo since your last visit."
              : `${newPhotoCount} new photos since your last visit.`}
          </div>
        )}

      {loading && (
        <div style={{ color: "#666" }}>
          Loading Gallery...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            background: "#fef2f2",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div
          style={{
            padding: "24px",
            border: "1px solid #eee",
            borderRadius: "16px",
            background: "#fafafa",
            color: "#666",
          }}
        >
          No photos have been featured in the Gallery yet.
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "14px",
              marginBottom: "4px",
              scrollbarWidth: "thin",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedPlaceId(null)}
              style={{
                flex: "0 0 auto",
                padding: "8px 12px",
                borderRadius: "999px",
                border:
                  selectedPlaceId === null
                    ? "1px solid #111"
                    : "1px solid #ddd",
                background: selectedPlaceId === null ? "#111" : "#fff",
                color: selectedPlaceId === null ? "#fff" : "#333",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              All ({photos.length})
            </button>

            {places.map((place) => {
              const isSelected = selectedPlaceId === place.id;

              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setSelectedPlaceId(place.id)}
                  style={{
                    flex: "0 0 auto",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    border: isSelected
                      ? "1px solid #111"
                      : "1px solid #ddd",
                    background: isSelected ? "#111" : "#fff",
                    color: isSelected ? "#fff" : "#333",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {place.name} ({place.photo_count})
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {visiblePhotos.map((photo) => (
              <button
                key={`${photo.experience_id}-${photo.photo_source}-${photo.photo_id ?? "main"}`}
                type="button"
                onClick={() => setSelectedPhoto(photo)}
                aria-label={`View photo details for ${photo.place.name}`}
                style={{
                  overflow: "hidden",
                  borderRadius: "14px",
                  background: "#f3f3f3",
                  aspectRatio: "4 / 3",
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <img
                  src={photo.image_url}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                  }}
                />

                {photo.is_new && (
                  <span
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      padding: "5px 8px",
                      borderRadius: "999px",
                      background: "rgba(17, 17, 17, 0.88)",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    New
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gallery photo details"
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(920px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "18px",
              padding: "16px",
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                aria-label="Close photo details"
                style={{
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: "999px",
                  padding: "7px 11px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <img
              src={selectedPhoto.image_url}
              alt=""
              style={{
                width: "100%",
                maxHeight: "62vh",
                display: "block",
                objectFit: "contain",
                borderRadius: "12px",
                background: "#f3f3f3",
              }}
            />

            <div style={{ padding: "16px 4px 4px" }}>
              {selectedPhoto.experience_title && (
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                  }}
                >
                  {selectedPhoto.experience_title}
                </h2>
              )}

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#444",
                }}
              >
                {selectedPhoto.place.name}
              </div>

              {selectedPhoto.caption && (
                <p
                  style={{
                    margin: "12px 0 0",
                    color: "#555",
                    lineHeight: 1.5,
                  }}
                >
                  {selectedPhoto.caption}
                </p>
              )}

              <div
                style={{
                  marginTop: "14px",
                  fontSize: "13px",
                  color: "#777",
                }}
              >
                Shared by {selectedPhoto.author.display_name} ·{" "}
                {new Date(selectedPhoto.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
