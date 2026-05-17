"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

type SavedItem = {
  id: number;
  trip_plan_id: number;
  experience_id: number;
  title: string;
  comment: string;
  rating: number | null;
  trip_context: string;
  trip_style: string;
  image_url: string | null;
  place: string;
  place_id: number;
  destination: string;
  saved_at: string;
  experience_created_at: string;
};

type TripPlanDetail = {
  id: number;
  title: string;
  destination_text: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  saved_count: number;
  created_at: string;
  updated_at: string;
  saved_items: SavedItem[];
};

export default function TripPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [plan, setPlan] = useState<TripPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);

  const loadPlan = async () => {
    if (!id) return;

    try {
      const res = await fetch(`${API_URL}/api/trip-plans/${id}/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load trip plan:", res.status, text);
        return;
      }

      const data = await res.json();
      setPlan(data);
    } catch (error) {
      console.error("Trip plan detail fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [id]);

  const removeExperienceFromPlan = async (item: SavedItem) => {
    if (!plan) return;

    const confirmed = window.confirm(
      "Remove this experience from your trip plan?"
    );

    if (!confirmed) return;

    setRemovingItemId(item.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/experiences/${item.experience_id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Remove from trip plan error:", data);
        alert(data.detail || "Error removing experience from plan.");
        return;
      }

      setPlan((prev) => {
        if (!prev) return prev;

        const updatedItems = prev.saved_items.filter(
          (savedItem) => savedItem.id !== item.id
        );

        return {
          ...prev,
          saved_items: updatedItems,
          saved_count: updatedItems.length,
        };
      });
    } catch (error) {
      console.error("Failed to remove experience from trip plan:", error);
      alert("Error removing experience from plan.");
    } finally {
      setRemovingItemId(null);
    }
  };

  if (loading) {
    return (
      <main style={page}>
        <p style={muted}>Loading trip plan...</p>
      </main>
    );
  }

  if (!plan) {
    return (
      <main style={page}>
        <p style={muted}>Trip plan not found.</p>
        <Link href="/trip-plans" style={secondaryLink}>
          Back to trip plans
        </Link>
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
        <Link href="/trip-plans" style={breadcrumbLink}>
          Trip plans
        </Link>{" "}
        / <span>{plan.title}</span>
      </div>

      <section style={heroCard}>
        <div style={label}>Trip plan</div>

        <h1 style={titleStyle}>{plan.title}</h1>

        {plan.destination_text && (
          <p style={destinationText}>{plan.destination_text}</p>
        )}

        {plan.description && <p style={descriptionText}>{plan.description}</p>}

        <div style={metaRow}>
          <span>
            {plan.saved_count} saved item{plan.saved_count === 1 ? "" : "s"}
          </span>

          {plan.start_date && (
            <span>From {new Date(plan.start_date).toLocaleDateString()}</span>
          )}

          {plan.end_date && (
            <span>To {new Date(plan.end_date).toLocaleDateString()}</span>
          )}
        </div>

        <div style={actions}>
          <Link href="/trip-plans" style={secondaryLink}>
            Back to plans
          </Link>

          <button
            type="button"
            onClick={() => router.push("/")}
            style={primaryButton}
          >
            Explore feed
          </button>
        </div>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Saved experiences</h2>

        {plan.saved_items.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This plan does not have any saved experiences yet.
            </p>

            <p style={helperText}>
              Open a place or experience and add useful recommendations to this
              trip plan.
            </p>

            <Link href="/" style={primaryLink}>
              Explore experiences
            </Link>
          </div>
        ) : (
          <div style={list}>
            {plan.saved_items.map((item) => (
              <article key={item.id} style={experienceCard}>
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title || "Saved experience"}
                    style={image}
                  />
                )}

                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={label}>Saved experience</div>

                  <h3 style={experienceTitle}>
                    {item.title || item.place || "Experience"}
                  </h3>

                  <div style={placeText}>
                    {item.place}
                    {item.destination && item.destination !== item.place
                      ? ` · ${item.destination}`
                      : ""}
                  </div>

                  {item.rating && (
                    <div style={rating}>
                      {"★".repeat(item.rating)}
                      {"☆".repeat(5 - item.rating)}
                    </div>
                  )}

                  <p style={commentText}>{item.comment}</p>

                  <div style={metaRow}>
                    <span>
                      Saved {new Date(item.saved_at).toLocaleDateString()}
                    </span>

                    <span>
                      Experience{" "}
                      {new Date(
                        item.experience_created_at
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={actions}>
                    <Link
                      href={`/experiences/${item.experience_id}`}
                      style={primaryLink}
                    >
                      View experience
                    </Link>

                    <Link
                      href={`/places/${item.place_id}/experiences?highlight=${item.experience_id}`}
                      style={secondaryLink}
                    >
                      View in place
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeExperienceFromPlan(item)}
                      disabled={removingItemId === item.id}
                      style={{
                        ...dangerButton,
                        opacity: removingItemId === item.id ? 0.5 : 1,
                        cursor:
                          removingItemId === item.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {removingItemId === item.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const page = {
  maxWidth: "860px",
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

const heroCard = {
  padding: "24px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "white",
  marginBottom: "28px",
};

const label = {
  fontSize: "13px",
  color: "#777",
};

const titleStyle = {
  margin: "6px 0 0 0",
  fontSize: "30px",
};

const destinationText = {
  margin: "10px 0 0 0",
  color: "#555",
  fontWeight: 600,
};

const descriptionText = {
  margin: "12px 0 0 0",
  color: "#555",
  lineHeight: 1.6,
};

const metaRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginTop: "12px",
  color: "#777",
  fontSize: "13px",
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "18px",
};

const primaryButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const primaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const secondaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  textDecoration: "none",
};

const dangerButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #f3d1d1",
  background: "#fff5f5",
  color: "#9f1239",
};

const section = {
  display: "grid",
  gap: "14px",
};

const sectionTitle = {
  margin: 0,
  fontSize: "22px",
};

const emptyBox = {
  padding: "22px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
};

const helperText = {
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};

const list = {
  display: "grid",
  gap: "16px",
};

const experienceCard = {
  padding: "20px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  display: "grid",
  gap: "14px",
};

const image = {
  width: "100%",
  maxHeight: "260px",
  objectFit: "cover" as const,
  borderRadius: "12px",
  border: "1px solid #eee",
};

const experienceTitle = {
  margin: 0,
  fontSize: "20px",
};

const placeText = {
  color: "#666",
  fontSize: "14px",
};

const rating = {
  color: "#f5b50a",
  fontSize: "18px",
};

const commentText = {
  color: "#222",
  lineHeight: 1.6,
  margin: 0,
};

const muted = {
  color: "#666",
};