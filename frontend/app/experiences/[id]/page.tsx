"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../lib/api";

export default function ExperienceDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [experience, setExperience] = useState<any>(null);
  const [extraPhotos, setExtraPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadExperience = async () => {
      try {
        const res = await fetch(`${API_URL}/api/experiences/${id}/`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to load experience:", res.status, text);
          return;
        }

        const data = await res.json();
        setExperience(data);

        const photosRes = await fetch(`${API_URL}/api/experiences/${id}/photos/`, {
          credentials: "include",
        });

        if (photosRes.ok) {
          const photosData = await photosRes.json();
          setExtraPhotos(Array.isArray(photosData) ? photosData : []);
        } else {
          const text = await photosRes.text();
          console.error("Failed to load experience photos:", photosRes.status, text);
          setExtraPhotos([]);
        }

      } catch (error) {
        console.error("Experience detail fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadExperience();
  }, [id]);

  if (loading) {
    return (
      <main style={page}>
        <p style={mutedText}>Loading experience...</p>
      </main>
    );
  }

  if (!experience) {
    return (
      <main style={page}>
        <p style={mutedText}>Experience not found.</p>
        <Link href="/" style={secondaryLink}>
          Back to feed
        </Link>
      </main>
    );
  }

    const galleryPhotos =
      extraPhotos.length > 0
        ? extraPhotos
        : experience.image_url
        ? [
            {
              id: "cover",
              image_url: experience.image_url,
              caption: experience.title || "Main experience photo",
            },
          ]
        : [];

    const mainPhoto =
      experience.image_url
        ? {
            id: "main",
            image_url: experience.image_url,
            caption: experience.title || "Main experience photo",
          }
        : galleryPhotos.length > 0
        ? galleryPhotos[0]
        : null;

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/places/${experience.place}`} style={breadcrumbLink}>
          {experience.place_name || "Place"}
        </Link>{" "}
        / <span>Experience</span>
      </div>

      <article style={card}>
        <div style={metaRow}>
          <div>
            <div style={label}>Experience</div>
            <h1 style={title}>
              {experience.title || "Shared experience"}
            </h1>
          </div>

          <span style={dateText}>
            {new Date(experience.created_at).toLocaleString()}
          </span>
        </div>

        <div style={placeText}>
          {experience.place_name}
          {experience.destination_name ? ` · ${experience.destination_name}` : ""}
        </div>

        {mainPhoto && (
  <div style={mainPhotoBox}>
    <img
      src={mainPhoto.image_url}
      alt={mainPhoto.caption || experience.title || "Experience photo"}
      style={mainPhotoImage}
    />

    {mainPhoto.caption && (
      <div style={mainPhotoCaption}>
        {mainPhoto.caption}
      </div>
    )}
  </div>
)}

    {galleryPhotos.length > 0 && (
      <div style={galleryBox}>
        <button
          onClick={() => setShowGallery(!showGallery)}
          style={galleryButton}
        >
          {showGallery
            ? "Hide photo gallery"
            : `View photo gallery (${galleryPhotos.length})`}
        </button>

        {showGallery && (
          <div style={galleryGrid}>
            {galleryPhotos.map((photo) => (
              <div key={photo.id} style={{ display: "grid", gap: "6px" }}>
                <img
                  src={photo.image_url}
                  alt={photo.caption || experience.title || "Experience photo"}
                  style={galleryImage}
                />

                {photo.caption && (
                  <div style={{ fontSize: "12px", color: "#777" }}>
                    {photo.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )}

        <p style={comment}>{experience.comment}</p>

        {experience.rating && (
          <div style={ratingText}>
            {"★".repeat(experience.rating)}
            {"☆".repeat(5 - experience.rating)}
          </div>
        )}

        <div style={authorText}>
          Shared by {experience.user || "Unknown user"}
        </div>

        <div style={actions}>
          <Link
            href={`/places/${experience.place}/experiences`}
            style={secondaryLink}
          >
            View all experiences
          </Link>

          <Link href={`/places/${experience.place}`} style={secondaryLink}>
            Back to place
          </Link>
        </div>
      </article>
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

const card = {
  border: "1px solid #eee",
  borderRadius: "18px",
  padding: "24px",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
};

const label = {
  fontSize: "13px",
  color: "#777",
  marginBottom: "6px",
};

const title = {
  margin: 0,
  fontSize: "28px",
  lineHeight: 1.2,
};

const dateText = {
  fontSize: "12px",
  color: "#777",
  whiteSpace: "nowrap" as const,
};

const placeText = {
  marginTop: "12px",
  color: "#666",
  fontSize: "14px",
};

const mainPhotoBox = {
  marginTop: "18px",
  marginBottom: "12px",
};

const mainPhotoImage = {
  width: "100%",
  maxHeight: "320px",
  objectFit: "cover" as const,
  borderRadius: "14px",
  border: "1px solid #eee",
  display: "block",
};

const mainPhotoCaption = {
  marginTop: "6px",
  fontSize: "12px",
  color: "#777",
};

const comment = {
  marginTop: "20px",
  fontSize: "18px",
  lineHeight: 1.6,
};

const ratingText = {
  marginTop: "16px",
  color: "#f5b50a",
  fontSize: "20px",
};

const authorText = {
  marginTop: "12px",
  color: "#777",
  fontSize: "14px",
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "24px",
};

const secondaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  textDecoration: "none",
  background: "white",
};

const mutedText = {
  color: "#666",
};

const galleryBox = {
  marginTop: "20px",
  marginBottom: "6px",
};

const galleryButton = {
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "#f9f9f9",
  color: "#111",
  cursor: "pointer",
  fontSize: "14px",
};

const galleryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
  marginTop: "12px",
};

const galleryImage = {
  width: "100%",
  height: "160px",
  objectFit: "cover" as const,
  borderRadius: "12px",
  border: "1px solid #eee",
};