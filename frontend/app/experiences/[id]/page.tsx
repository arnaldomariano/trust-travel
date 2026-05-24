"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../lib/api";
import { countryCodeToFlagEmoji } from "../../lib/flags";

type TripPlan = {
  id: number;
  title: string;
  destination_text: string;
  saved_count: number;
};

export default function ExperienceDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [experience, setExperience] = useState<any>(null);
  const [extraPhotos, setExtraPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);

  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedTripPlanId, setSelectedTripPlanId] = useState("");
  const [showTripPlanPicker, setShowTripPlanPicker] = useState(false);
  const [addingToPlan, setAddingToPlan] = useState(false);

  const [tripPlanMessage, setTripPlanMessage] = useState<{
  text: string;
  planId: number | null;
} | null>(null);

  const loadTripPlans = async () => {
  try {
    const res = await fetch(`${API_URL}/api/trip-plans/`, {
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load trip plans:", res.status, text);
      setTripPlans([]);
      return;
    }

    const data = await res.json();
    setTripPlans(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Trip plans fetch error:", error);
    setTripPlans([]);
  }
};

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
    loadTripPlans();
  }, [id]);

    const addExperienceToTripPlan = async () => {
      if (!experience?.id) {
        alert("Experience not loaded yet.");
        return;
      }

      if (!selectedTripPlanId) {
        alert("Please choose a trip plan first.");
        return;
      }

      setAddingToPlan(true);

      try {
        const res = await fetch(
          `${API_URL}/api/trip-plans/${selectedTripPlanId}/experiences/${experience.id}/`,
          {
            method: "POST",
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          console.error("Add to trip plan error:", data);
          alert(data.detail || "Error adding experience to trip plan.");
          return;
        }

        const selectedPlan = tripPlans.find(
          (plan) => String(plan.id) === String(selectedTripPlanId)
        );

        setTripPlanMessage({
          text: selectedPlan
            ? `Experience added to ${selectedPlan.title}.`
            : "Experience added to your trip plan.",
          planId: selectedPlan ? selectedPlan.id : null,
        });

        setShowTripPlanPicker(false);

      } catch (error) {
        console.error("Failed to add experience to trip plan:", error);
        alert("Error adding experience to trip plan.");
      } finally {
        setAddingToPlan(false);
      }
    };

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

const authorFlag = countryCodeToFlagEmoji(
  experience.author_nationality_country_code
);

const authorLabel = authorFlag
  ? `${experience.user || "Unknown user"} ${authorFlag}`
  : experience.user || "Unknown user";

    const formatTripValue = (value?: string) => {
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

      if (!value || value === "prefer_not_to_say") return "";

      return labels[value] || value;
    };

    const tripContextLabel = formatTripValue(experience.trip_context);
    const tripStyleLabel = formatTripValue(experience.trip_style);

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
            <div style={label}>Traveler experience</div>
            <h1 style={title}>
              {experience.title || experience.place_name || "Experience"}
            </h1>
          </div>

          <span style={dateText}>
            {new Date(experience.created_at).toLocaleString()}
          </span>
        </div>

       <div style={placeText}>
          {experience.place_name === experience.destination_name
            ? experience.place_name
            : `${experience.place_name}${
                experience.destination_name ? ` · ${experience.destination_name}` : ""
              }`}
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

        <p style={comment}>{experience.comment}</p>

        {experience.rating && (
          <div style={ratingText}>
            {"★".repeat(experience.rating)}
            {"☆".repeat(5 - experience.rating)}
          </div>
        )}

        {(tripContextLabel || tripStyleLabel) && (
          <div style={tripMetaRow}>
            {tripContextLabel && (
              <span style={tripMetaBadge}>
                Context: {tripContextLabel}
              </span>
            )}

            {tripStyleLabel && (
              <span style={tripMetaBadge}>
                Style: {tripStyleLabel}
              </span>
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
        <div style={authorText}>
          Shared by {authorLabel}
        </div>

        <div style={actions}>
          <Link
            href={`/places/${experience.place}/experiences`}
            style={secondaryLink}
          >
            View all experiences
          </Link>

          <Link
            href={`/places/${experience.place}/experiences?highlight=${experience.id}`}
            style={secondaryLink}
          >
            Back to experiences
          </Link>

          <button
            type="button"
            style={secondaryButton}
            onClick={() => setShowTripPlanPicker((prev) => !prev)}
          >
            Add to trip plan
          </button>
        </div>

                {showTripPlanPicker && (
                  <div style={tripPlanPickerBox}>
                    {tripPlans.length === 0 ? (
                      <div style={{ fontSize: "13px", color: "#666" }}>
                        You do not have any trip plans yet.{" "}
                        <Link
                          href={`/trip-plans?returnTo=${encodeURIComponent(
                            `/experiences/${experience.id}`
                          )}`}
                          style={{ color: "#111", fontWeight: 600 }}
                        >
                          Create one
                        </Link>
                        .
                      </div>
                    ) : (
                      <>
                        <select
                          value={selectedTripPlanId}
                          onChange={(event) => setSelectedTripPlanId(event.target.value)}
                          style={selectInput}
                        >
                          <option value="">Choose a trip plan</option>

                          {tripPlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.title}
                              {plan.destination_text ? ` — ${plan.destination_text}` : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={addingToPlan}
                          onClick={addExperienceToTripPlan}
                          style={{
                            ...primaryButton,
                            opacity: addingToPlan ? 0.5 : 1,
                            cursor: addingToPlan ? "not-allowed" : "pointer",
                          }}
                        >
                          {addingToPlan ? "Adding..." : "Add"}
                        </button>

                        <Link
                          href={`/trip-plans?returnTo=${encodeURIComponent(
                            `/experiences/${experience.id}`
                          )}`}
                          style={createPlanLink}
                        >
                          Create a new trip plan
                        </Link>
                      </>
                    )}
                  </div>
                )}

        {tripPlanMessage && (
          <div style={tripPlanSuccessBox}>
            <span>{tripPlanMessage.text}</span>

            {tripPlanMessage.planId && (
              <Link
                href={`/trip-plans/${tripPlanMessage.planId}`}
                style={tripPlanSuccessLink}
              >
                View trip plan
              </Link>
            )}
          </div>
        )}
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

const tripMetaRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginTop: "14px",
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

const secondaryButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  cursor: "pointer",
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
  width: "fit-content",
};

const tripPlanPickerBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  display: "grid",
  gap: "10px",
};

const selectInput = {
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  maxWidth: "360px",
};

const tripPlanSuccessBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  fontSize: "14px",
};

const tripPlanSuccessLink = {
  color: "#166534",
  fontWeight: 700,
  textDecoration: "underline",
};

const createPlanLink = {
  color: "#111",
  fontWeight: 600,
  fontSize: "13px",
  textDecoration: "underline",
  width: "fit-content",
};