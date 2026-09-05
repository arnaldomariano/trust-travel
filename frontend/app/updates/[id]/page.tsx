"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../lib/api";

type UpdateDetail = {
  id: number;
  type: "event" | "alert" | "info" | string;
  category: string;
  title?: string;
  text: string;
  event_date?: string | null;
  external_link?: string;
  source_name?: string;
  source_url?: string;
  official_source?: {
    id: number;
    name: string;
    website_url: string;
    source_type: string;
    is_verified: boolean;
    place_id: number | null;
  } | null;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  place: string;
  place_id: number;
  user: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at?: string;
};

type TripPlanDestination = {
  place_name: string;
  place_city?: string;
  destination_name?: string;
  destination_country?: string;
};

type TripPlan = {
  id: number;
  title: string;
  destination_text: string;
  saved_count: number;
  primary_destination: TripPlanDestination | null;
};

const getTripPlanDestinationLabel = (plan: TripPlan) => {
  if (plan.primary_destination) {
    const {
      place_name,
      place_city,
      destination_country,
      destination_name,
    } = plan.primary_destination;

    const normalizedPlaceName = (place_name || "").trim().toLowerCase();
    const normalizedPlaceCity = (place_city || "").trim().toLowerCase();

    return [
      place_name,
      normalizedPlaceCity &&
      normalizedPlaceCity !== normalizedPlaceName
        ? place_city
        : "",
      destination_country || destination_name,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return plan.destination_text || "";
};

export default function UpdateDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [update, setUpdate] = useState<UpdateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedTripPlanId, setSelectedTripPlanId] = useState("");
  const [showTripPlanPicker, setShowTripPlanPicker] = useState(false);
  const [addingToPlan, setAddingToPlan] = useState(false);

  const [showCreateTripPlanForm, setShowCreateTripPlanForm] = useState(false);
  const [newTripPlanTitle, setNewTripPlanTitle] = useState("");
  const [creatingTripPlan, setCreatingTripPlan] = useState(false);

  const [tripPlanMessage, setTripPlanMessage] = useState("");
  const [tripPlanError, setTripPlanError] = useState("");

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

    const loadUpdate = async () => {
      try {
        const res = await fetch(`${API_URL}/api/updates/${id}/`, {
          credentials: "include",
        });

        const text = await res.text();

        let data: any = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { detail: text };
        }

        if (!res.ok) {
          console.error("Failed to load update:", {
            status: res.status,
            id,
            data,
          });

          setUpdate(null);
          return;
        }

        setUpdate(data);


      } catch (error) {
        console.error("Update detail error:", error);
        setUpdate(null);
      } finally {
        setLoading(false);
      }
    };

    loadUpdate();
    loadTripPlans();
  }, [id]);

  const addUpdateToTripPlan = async () => {
    if (!update?.id) {
      setTripPlanError("Update not loaded yet.");
      return;
    }

    if (!selectedTripPlanId) {
      setTripPlanError("Choose one of your trip plans first.");
      return;
    }

    setTripPlanError("");
    setTripPlanMessage("");
    setAddingToPlan(true);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${selectedTripPlanId}/updates/${update.id}/`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Add update to trip plan error:", data);
        setTripPlanError(
          data.detail || "Could not save this update to your trip plan."
        );
        return;
      }

      const selectedPlan = tripPlans.find(
        (plan) => String(plan.id) === String(selectedTripPlanId)
      );

      setTripPlanMessage(
        data.created === false
          ? selectedPlan
            ? `${getTypeLabel(update.type)} is already saved in ${selectedPlan.title}.`
            : "This update is already saved in your trip plan."
          : selectedPlan
            ? `${getTypeLabel(update.type)} saved to ${selectedPlan.title}.`
            : "Update saved to your trip plan."
      );

      setShowTripPlanPicker(false);
    } catch (error) {
      console.error("Failed to save update to trip plan:", error);
      setTripPlanError("Could not save this update to your trip plan.");
    } finally {
      setAddingToPlan(false);
    }
  };

  const createTripPlanAndSaveUpdate = async () => {
    if (!update?.id || !update.place_id) {
      setTripPlanError("Update not loaded yet.");
      return;
    }

    const title = newTripPlanTitle.trim();

    if (!title) {
      setTripPlanError("Please give your trip plan a title.");
      return;
    }

    setCreatingTripPlan(true);
    setTripPlanError("");
    setTripPlanMessage("");

    try {
      const createRes = await fetch(`${API_URL}/api/trip-plans/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          destinations: [
            {
              place_id: update.place_id,
              role: "primary",
              position: 0,
            },
          ],
        }),
      });

      const createdPlan = await createRes.json();

      if (!createRes.ok) {
        console.error("Create trip plan error:", createdPlan);
        setTripPlanError(
          createdPlan.detail || "Could not create trip plan."
        );
        return;
      }

      const addRes = await fetch(
        `${API_URL}/api/trip-plans/${createdPlan.id}/updates/${update.id}/`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const addData = await addRes.json();

      if (!addRes.ok) {
        console.error("Add update to new trip plan error:", addData);
        setTripPlanError(
          addData.detail ||
            "Trip plan was created, but the update was not saved."
        );
        return;
      }

      setTripPlans((prev) => [createdPlan, ...prev]);
      setSelectedTripPlanId(String(createdPlan.id));

      setTripPlanMessage(
        `${getTypeLabel(update.type)} saved to ${createdPlan.title}.`
      );

      setNewTripPlanTitle("");
      setShowCreateTripPlanForm(false);
      setShowTripPlanPicker(false);
    } catch (error) {
      console.error("Create trip plan and save update error:", error);
      setTripPlanError(
        "Something went wrong while creating the trip plan."
      );
    } finally {
      setCreatingTripPlan(false);
    }
  };

  const getTypeLabel = (type?: string) => {
    if (type === "event") return "Event";
    if (type === "alert") return "Alert";
    if (type === "info") return "Useful info";

    return "Update";
  };

  const getTypeIcon = (type?: string) => {
    if (type === "event") return "🎭";
    if (type === "alert") return "⚠️";
    if (type === "info") return "ℹ️";

    return "•";
  };

  const getDateLabel = (type?: string) => {
      if (type === "event") return "Event date and time";
      if (type === "alert") return "Alert related date/time";
      if (type === "info") return "Info related date/time";

      return "Related date/time";
  };

  const getPriorityLabel = (priority?: string) => {
      if (priority === "urgent") return "Urgent";
      if (priority === "high") return "High";
      if (priority === "low") return "Low";
      return "Normal";
    };

    const getPriorityStyle = (priority?: string) => {
      if (priority === "urgent") {
        return {
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "#991b1b",
        };
      }

      if (priority === "high") {
        return {
          border: "1px solid #fed7aa",
          background: "#fff7ed",
          color: "#9a3412",
        };
      }

      if (priority === "low") {
        return {
          border: "1px solid #d1fae5",
          background: "#ecfdf5",
          color: "#065f46",
        };
      }

      return {
        border: "1px solid #eee",
        background: "#fafafa",
        color: "#555",
      };
    };

    const formatDateTime = (value?: string | null) => {
      if (!value) return null;

      return new Date(value).toLocaleString();
    };

  const getTypeStyle = (type?: string) => {
    if (type === "alert") {
      return {
        border: "1px solid #f3d1d1",
        background: "#fff5f5",
        color: "#9f1239",
      };
    }

    if (type === "event") {
      return {
        border: "1px solid #e7ddff",
        background: "#f8f5ff",
        color: "#4c1d95",
      };
    }

    if (type === "info") {
      return {
        border: "1px solid #dbe4ff",
        background: "#f5f7ff",
        color: "#1e3a8a",
      };
    }

    return {
      border: "1px solid #eee",
      background: "#fafafa",
      color: "#555",
    };
  };

  if (loading) {
    return (
      <main style={page}>
        <p style={{ color: "#666" }}>Loading update...</p>
      </main>
    );
  }

  if (!update) {
    return (
      <main style={page}>
        <div style={breadcrumb}>
          <Link href="/" style={breadcrumbLink}>
            Home
          </Link>{" "}
          / <span>Update</span>
        </div>

        <section style={emptyBox}>
          <h1 style={{ marginTop: 0 }}>Update not found</h1>

          <p style={{ color: "#666", lineHeight: 1.5 }}>
            This event, alert or information post could not be loaded.
          </p>

          <button onClick={() => router.push("/")} style={primaryButton}>
            Back to feed
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/places/${update.place_id}`} style={breadcrumbLink}>
          {update.place}
        </Link>{" "}
        / <span>{getTypeLabel(update.type)}</span>
      </div>

      <article style={card}>
        <div
          style={{
            ...typeBadge,
            ...getTypeStyle(update.type),
          }}
        >
          <span>{getTypeIcon(update.type)}</span>
          <span>{getTypeLabel(update.type)}</span>
        </div>

        <h1 style={title}>
          {update.title?.trim() || update.place}
        </h1>

        {update.title?.trim() && (
          <div style={placeSubtitle}>
            {update.place}
          </div>
        )}

        <div style={metaRow}>
          <span>{update.category || "general"}</span>

          {update.type === "alert" && (
            <span
              style={{
                ...priorityBadge,
                ...getPriorityStyle(update.priority),
              }}
            >
              Priority: {getPriorityLabel(update.priority)}
            </span>
          )}

          <span>
            Published: {formatDateTime(update.created_at)}
          </span>
        </div>

        {update.event_date && (
          <section style={dateHighlightBox}>
            <div style={dateHighlightIcon}>📅</div>

            <div>
              <div style={dateHighlightLabel}>
                {getDateLabel(update.type)}
              </div>

              <div style={dateHighlightValue}>
                {formatDateTime(update.event_date)}
              </div>
            </div>
          </section>
        )}

        <p style={text}>{update.text}</p>

        {(
          update.external_link ||
          update.source_name ||
          update.source_url ||
          update.official_source
        ) && (
          <section style={sourceBox}>
            <h2 style={sourceTitle}>Source and links</h2>

            {update.official_source && (
              <div style={officialSourceBox}>
                {update.official_source.is_verified && (
                  <div style={verifiedSourceBadge}>
                    ✓ Verified official source
                  </div>
                )}

                <div style={officialSourceName}>
                  {update.official_source.name}
                </div>

                <div style={officialSourceMeta}>
                  {update.official_source.source_type.replaceAll("_", " ")}
                </div>

                {update.official_source.website_url && (
                  <a
                    href={update.official_source.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={inlineLink}
                  >
                    Open official website
                  </a>
                )}
              </div>
            )}

            {update.source_name && (
              <div style={sourceRow}>
                <strong>Source cited:</strong>
                <span>{update.source_name}</span>
              </div>
            )}

            {update.source_url && (
              <div style={sourceRow}>
                <strong>Source URL:</strong>
                <a
                  href={update.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={inlineLink}
                >
                  Open cited source
                </a>
              </div>
            )}

            {update.external_link && (
              <div style={sourceRow}>
                <strong>Related link:</strong>
                <a
                  href={update.external_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={inlineLink}
                >
                  Open link
                </a>
              </div>
            )}
          </section>
        )}

        <div style={authorBox}>
          {update.avatar_url ? (
            <img
              src={update.avatar_url}
              alt={update.display_name || update.username || update.user}
              style={avatar}
            />
          ) : (
            <div style={avatarFallback}>
              {(update.display_name || update.username || update.user || "?")
                .slice(0, 1)
                .toUpperCase()}
            </div>
          )}

          <div>
            <div style={{ fontSize: "13px", color: "#777" }}>Shared by</div>
            <strong>
              {update.display_name || update.username || update.user}
            </strong>
          </div>
        </div>

        {tripPlanMessage && (
          <div
            style={{
              padding: "12px",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              background: "#f0fdf4",
              color: "#166534",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {tripPlanMessage}
          </div>
        )}

        {tripPlanError && (
          <div
            style={{
              padding: "12px",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {tripPlanError}
          </div>
        )}

        {showTripPlanPicker && (
          <section
            style={{
              padding: "16px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              background: "#fafafa",
              display: "grid",
              gap: "12px",
            }}
          >
            <strong>Save this {getTypeLabel(update.type).toLowerCase()} to a trip plan</strong>

            {tripPlans.length > 0 && (
              <>
                <select
                  value={selectedTripPlanId}
                  onChange={(event) => {
                    setSelectedTripPlanId(event.target.value);
                    setTripPlanError("");
                  }}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    background: "white",
                  }}
                >
                  <option value="">Choose a trip plan</option>

                  {tripPlans.map((plan) => {
                    const destinationLabel =
                      getTripPlanDestinationLabel(plan);

                    return (
                      <option key={plan.id} value={plan.id}>
                        {plan.title}
                        {destinationLabel
                          ? ` — ${destinationLabel}`
                          : ""}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  onClick={addUpdateToTripPlan}
                  disabled={addingToPlan}
                  style={{
                    ...primaryButton,
                    opacity: addingToPlan ? 0.5 : 1,
                    cursor: addingToPlan
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {addingToPlan ? "Saving..." : "Save to selected plan"}
                </button>
              </>
            )}

            <div
              style={{
                color: "#777",
                fontSize: "13px",
              }}
            >
              {tripPlans.length > 0
                ? "Or create a new trip plan"
                : "Create your first trip plan"}
            </div>

            {!showCreateTripPlanForm ? (
              <button
                type="button"
                onClick={() => {
                  setShowCreateTripPlanForm(true);
                  setTripPlanError("");
                }}
                style={secondaryButton}
              >
                Create new trip plan here
              </button>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  value={newTripPlanTitle}
                  onChange={(event) =>
                    setNewTripPlanTitle(event.target.value)
                  }
                  placeholder="Trip plan title, e.g. Italy 2026"
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    boxSizing: "border-box",
                  }}
                />

                <div style={actions}>
                  <button
                    type="button"
                    onClick={createTripPlanAndSaveUpdate}
                    disabled={creatingTripPlan}
                    style={{
                      ...primaryButton,
                      opacity: creatingTripPlan ? 0.5 : 1,
                      cursor: creatingTripPlan
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {creatingTripPlan
                      ? "Creating..."
                      : "Create and save update"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTripPlanForm(false);
                      setTripPlanError("");
                    }}
                    style={secondaryButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowTripPlanPicker(false);
                setShowCreateTripPlanForm(false);
                setTripPlanError("");
              }}
              style={secondaryButton}
            >
              Close
            </button>
          </section>
        )}

        <div style={actions}>
          <button
            type="button"
            onClick={() => {
              setShowTripPlanPicker((current) => !current);
              setTripPlanError("");
              setTripPlanMessage("");
            }}
            style={primaryButton}
          >
            Save to trip plan
          </button>

          <Link href={`/places/${update.place_id}`} style={secondaryLink}>
            View place
          </Link>

          <button onClick={() => router.push("/")} style={secondaryButton}>
            Back to feed
          </button>
        </div>
      </article>
    </main>
  );
}

const page = {
  maxWidth: "760px",
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
  padding: "26px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const typeBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 10px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 600,
  marginBottom: "16px",
};

const title = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "30px",
};

const metaRow = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap" as const,
  color: "#777",
  fontSize: "13px",
  marginBottom: "22px",
};

const text = {
  fontSize: "18px",
  lineHeight: 1.6,
  marginBottom: "24px",
};

const authorBox = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  marginBottom: "22px",
};

const avatar = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  objectFit: "cover" as const,
  border: "1px solid #eee",
};

const avatarFallback = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  background: "#111",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
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
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "black",
  textDecoration: "none",
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

const emptyBox = {
  padding: "24px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
};

const placeSubtitle = {
  marginTop: "-4px",
  marginBottom: "14px",
  color: "#666",
  fontSize: "16px",
};

const priorityBadge = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 600,
};

const sourceBox = {
  padding: "16px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "#fafafa",
  marginBottom: "24px",
};

const sourceTitle = {
  marginTop: 0,
  marginBottom: "12px",
  fontSize: "17px",
};

const officialSourceBox = {
  padding: "12px",
  border: "1px solid #ddd",
  borderRadius: "12px",
  background: "white",
  marginBottom: "14px",
};

const verifiedSourceBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #ccc",
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "8px",
};

const officialSourceName = {
  fontWeight: 700,
  fontSize: "15px",
  marginBottom: "3px",
};

const officialSourceMeta = {
  color: "#666",
  fontSize: "13px",
  textTransform: "capitalize" as const,
  marginBottom: "8px",
};

const sourceRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  color: "#555",
  fontSize: "14px",
  marginBottom: "8px",
};

const inlineLink = {
  color: "#111",
  fontWeight: 600,
};

const dateHighlightBox = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "#fafafa",
  marginBottom: "22px",
};

const dateHighlightIcon = {
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  background: "white",
  border: "1px solid #eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
};

const dateHighlightLabel = {
  color: "#666",
  fontSize: "13px",
  fontWeight: 600,
  marginBottom: "4px",
};

const dateHighlightValue = {
  color: "#111",
  fontSize: "17px",
  fontWeight: 700,
};