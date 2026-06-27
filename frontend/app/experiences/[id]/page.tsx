"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();

  const [experience, setExperience] = useState<any>(null);
  const [extraPhotos, setExtraPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("misleading_information");
  const [reportComment, setReportComment] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedTripPlanId, setSelectedTripPlanId] = useState("");
  const [showTripPlanPicker, setShowTripPlanPicker] = useState(false);
  const [addingToPlan, setAddingToPlan] = useState(false);

  const [showCreateTripPlanForm, setShowCreateTripPlanForm] = useState(false);
  const [newTripPlanTitle, setNewTripPlanTitle] = useState("");
  const [newTripPlanDestination, setNewTripPlanDestination] = useState("");
  const [creatingTripPlan, setCreatingTripPlan] = useState(false);
  const [tripPlanError, setTripPlanError] = useState("");

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

    const createTripPlanAndAddExperience = async () => {
      if (!experience?.id) {
        setTripPlanError("Experience not loaded yet.");
        return;
      }

      const title = newTripPlanTitle.trim();
      const destinationText =
        newTripPlanDestination.trim() ||
        experience.destination_name ||
        experience.place_name ||
        "";

      if (!title) {
        setTripPlanError("Please give your trip plan a title.");
        return;
      }

      setCreatingTripPlan(true);
      setTripPlanError("");

      try {
        const createRes = await fetch(`${API_URL}/api/trip-plans/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            destination_text: destinationText,
          }),
        });

        const createdPlan = await createRes.json();

        if (!createRes.ok) {
          console.error("Create trip plan error:", createdPlan);
          setTripPlanError(createdPlan.detail || "Could not create trip plan.");
          return;
        }

        const addRes = await fetch(
          `${API_URL}/api/trip-plans/${createdPlan.id}/experiences/${experience.id}/`,
          {
            method: "POST",
            credentials: "include",
          }
        );

        const addData = await addRes.json();

        if (!addRes.ok) {
          console.error("Add to new trip plan error:", addData);
          setTripPlanError(
            addData.detail || "Trip plan was created, but the experience was not added."
          );
          return;
        }

        setTripPlans((prev) => [createdPlan, ...prev]);
        setSelectedTripPlanId(String(createdPlan.id));

        setTripPlanMessage({
          text: `Experience added to ${createdPlan.title}.`,
          planId: createdPlan.id,
        });

        setNewTripPlanTitle("");
        setNewTripPlanDestination("");
        setShowCreateTripPlanForm(false);
        setShowTripPlanPicker(false);
      } catch (error) {
        console.error("Create trip plan and add experience error:", error);
        setTripPlanError("Something went wrong while creating the trip plan.");
      } finally {
        setCreatingTripPlan(false);
      }
    };

    const removeExperienceFromTripPlan = async () => {
      if (!experience?.id || !tripPlanMessage?.planId) {
        return;
      }

      try {
        const res = await fetch(
          `${API_URL}/api/trip-plans/${tripPlanMessage.planId}/experiences/${experience.id}/`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          console.error("Remove from trip plan error:", data);
          alert(data.detail || "Could not remove experience from this trip plan.");
          return;
        }

        setTripPlanMessage({
          text: "Experience removed from this trip plan.",
          planId: null,
        });

        setSelectedTripPlanId("");
      } catch (error) {
        console.error("Remove from trip plan error:", error);
        alert("Something went wrong while removing this experience.");
      }
    };

    const handleSubmitReport = async (event: React.FormEvent) => {
      event.preventDefault();

      if (!experience?.id) {
        setReportError("Experience not loaded yet.");
        return;
      }

      setSubmittingReport(true);
      setReportError("");
      setReportMessage("");

      try {
        const res = await fetch(`${API_URL}/api/reports/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content_type: "experience",
            experience: experience.id,
            reason: reportReason,
            comment: reportComment.trim(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const duplicateMessage =
            data?.non_field_errors?.[0] ||
            data?.detail ||
            "Could not submit report.";

          setReportError(duplicateMessage);
          return;
        }

        setReportMessage(
          "Report submitted. Thank you for helping keep Trust Travel safe."
        );
        setReportComment("");
        setShowReportForm(false);
      } catch (error) {
        console.error("Report submit error:", error);
        setReportError("Something went wrong while submitting the report.");
      } finally {
        setSubmittingReport(false);
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
          caption: experience.image_caption || "",
        },
      ]
    : [];

const mainPhoto =
  experience.image_url
    ? {
        id: "main",
        image_url: experience.image_url,
        caption: experience.image_caption || "",
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

    const practicalRatings = [
      ["Safety", experience.safety_rating],
      ["Cost", experience.cost_rating],
      ["Accessibility", experience.accessibility_rating],
      ["Convenience", experience.convenience_rating],
    ].filter(([, value]) => value);

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
              style={{
                ...mainPhotoImage,
                objectFit: experience.image_display_mode || "cover",
              }}
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

        {practicalRatings.length > 0 && (
          <section style={practicalRatingsBox}>
            <strong>Practical ratings</strong>

            <div style={practicalRatingsGrid}>
              {practicalRatings.map(([label, value]) => (
                <span key={label} style={practicalRatingBadge}>
                  {label}: {"★".repeat(Number(value))}
                  {"☆".repeat(5 - Number(value))}
                </span>
              ))}
            </div>
          </section>
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
            Back to all experiences
          </Link>

          <Link
            href={`/evaluations?place=${experience.place}`}
            style={secondaryLink}
          >
            View evaluations
          </Link>

          <button
            type="button"
            style={secondaryButton}
            onClick={() =>
              router.push(
                `/destinations?mode=experience&place=${experience.place}&share=true`
              )
            }
          >
            Share your experience here
          </button>

        <button
          type="button"
          style={secondaryButton}
          onClick={() => {
            setShowTripPlanPicker((prev) => !prev);
            setTripPlanError("");
          }}
        >
          Add to trip plan
        </button>

              <button
                type="button"
                style={reportButton}
                onClick={() => {
                  setShowReportForm((prev) => !prev);
                  setReportError("");
                  setReportMessage("");
                }}
              >
                Report
              </button>
            </div>

            {showReportForm && (
              <form onSubmit={handleSubmitReport} style={reportBox}>
                <div>
                  <div style={reportTitle}>Report this experience</div>

                  <p style={reportIntro}>
                    Use this only for misleading, unsafe, abusive or suspicious content.
                    Your report will help us review possible problems.
                  </p>
                </div>

                <label style={reportLabel}>
                  Reason
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    style={reportSelect}
                  >
                    <option value="misleading_information">Misleading information</option>
                    <option value="unsafe_place">Unsafe place</option>
                    <option value="fake_photo">Fake photo</option>
                    <option value="scam_or_fraud">Scam or fraud</option>
                    <option value="harassment">Harassment</option>
                    <option value="suspicious_behavior">Suspicious behavior</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label style={reportLabel}>
                  Comment optional
                  <textarea
                    value={reportComment}
                    onChange={(event) => setReportComment(event.target.value)}
                    placeholder="Add details that can help us understand the issue..."
                    rows={4}
                    style={reportTextarea}
                  />
                </label>

                {reportError && <div style={reportErrorBox}>{reportError}</div>}

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    style={{
                      ...primaryButton,
                      opacity: submittingReport ? 0.5 : 1,
                      cursor: submittingReport ? "not-allowed" : "pointer",
                    }}
                  >
                    {submittingReport ? "Submitting..." : "Submit report"}
                  </button>

                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={() => {
                      setShowReportForm(false);
                      setReportError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {reportMessage && (
              <div style={reportSuccessBox}>
                {reportMessage}
              </div>
            )}

                {showTripPlanPicker && (
                  <div style={tripPlanPickerBox}>
                    <div style={tripPlanPickerTitle}>
                      Add this experience to your trip plan
                    </div>

                    <div style={tripPlanPickerHelp}>
                      Save this recommendation so you can find it later while planning your trip.
                    </div>

                    {tripPlans.length > 0 && (
                      <div style={existingPlanBox}>
                        <select
                          value={selectedTripPlanId}
                          onChange={(event) => setSelectedTripPlanId(event.target.value)}
                          style={selectInput}
                        >
                          <option value="">Choose an existing trip plan</option>

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
                          {addingToPlan ? "Adding..." : "Add to selected plan"}
                        </button>
                      </div>
                    )}

                    <div style={dividerText}>
                      {tripPlans.length > 0 ? "Or create a new trip plan" : "Create your first trip plan"}
                    </div>

                    {!showCreateTripPlanForm ? (
                      <button
                        type="button"
                        style={secondaryButton}
                        onClick={() => {
                          setShowCreateTripPlanForm(true);
                          setTripPlanError("");

                          if (!newTripPlanDestination) {
                            setNewTripPlanDestination(
                              experience.destination_name || experience.place_name || ""
                            );
                          }
                        }}
                      >
                        Create new trip plan here
                      </button>
                    ) : (
                      <div style={quickCreateBox}>
                        <input
                          type="text"
                          value={newTripPlanTitle}
                          onChange={(event) => setNewTripPlanTitle(event.target.value)}
                          placeholder="Trip plan title, e.g. Italy 2026"
                          style={textInput}
                        />

                        <input
                          type="text"
                          value={newTripPlanDestination}
                          onChange={(event) => setNewTripPlanDestination(event.target.value)}
                          placeholder="Destination, e.g. Rome, Thailand, São Roque"
                          style={textInput}
                        />

                        <div style={quickCreateActions}>
                          <button
                            type="button"
                            disabled={creatingTripPlan}
                            onClick={createTripPlanAndAddExperience}
                            style={{
                              ...primaryButton,
                              opacity: creatingTripPlan ? 0.5 : 1,
                              cursor: creatingTripPlan ? "not-allowed" : "pointer",
                            }}
                          >
                            {creatingTripPlan ? "Creating..." : "Create and add experience"}
                          </button>

                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() => {
                              setShowCreateTripPlanForm(false);
                              setTripPlanError("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {tripPlanError && (
                      <div style={tripPlanErrorBox}>
                        {tripPlanError}
                      </div>
                    )}
                  </div>
                )}

        {tripPlanMessage && (
          <div style={tripPlanSuccessBox}>
            <span>{tripPlanMessage.text}</span>

            {tripPlanMessage.planId && (
              <>
                <Link
                  href={`/trip-plans/${tripPlanMessage.planId}`}
                  style={tripPlanSuccessLink}
                >
                  View trip plan
                </Link>

                <button
                  type="button"
                  onClick={removeExperienceFromTripPlan}
                  style={tripPlanUndoButton}
                >
                  Remove from this plan
                </button>
              </>
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

const tripPlanUndoButton = {
  border: "none",
  background: "transparent",
  color: "#991b1b",
  fontWeight: 700,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  fontSize: "14px",
};

const reportButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  color: "#991b1b",
  background: "#fff5f5",
  cursor: "pointer",
  fontSize: "14px",
};

const reportBox = {
  marginTop: "14px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #f3c2c2",
  background: "#fffafa",
  display: "grid",
  gap: "12px",
};

const reportTitle = {
  fontWeight: 700,
  color: "#991b1b",
};

const reportIntro = {
  margin: "6px 0 0 0",
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.5,
};

const reportLabel = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#444",
};

const reportSelect = {
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  background: "white",
};

const reportTextarea = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  resize: "vertical" as const,
};

const reportErrorBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
  fontSize: "13px",
};

const reportSuccessBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "14px",
};

const tripPlanPickerTitle = {
  fontWeight: 700,
  fontSize: "14px",
};

const tripPlanPickerHelp = {
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.5,
};

const existingPlanBox = {
  display: "grid",
  gap: "10px",
};

const dividerText = {
  marginTop: "4px",
  color: "#777",
  fontSize: "13px",
  fontWeight: 600,
};

const quickCreateBox = {
  display: "grid",
  gap: "10px",
};

const textInput = {
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  maxWidth: "420px",
};

const quickCreateActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const tripPlanErrorBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
  fontSize: "13px",
};

const practicalRatingsBox = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  display: "grid",
  gap: "8px",
  color: "#555",
  fontSize: "13px",
};

const practicalRatingsGrid = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const practicalRatingBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #eee",
  background: "white",
  fontSize: "12px",
};