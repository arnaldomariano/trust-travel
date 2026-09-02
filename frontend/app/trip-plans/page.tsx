"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "../lib/api";

type TripPlanDestination = {
  id: number;
  place: number;
  place_name: string;
  place_type: string;
  place_city?: string;
  destination_name?: string;
  destination_country?: string;
  role: "primary" | "secondary";
  position: number;
  created_at: string;
};

type TripPlan = {
  id: number;
  title: string;
  destination_text: string;
  destinations: TripPlanDestination[];
  primary_destination: TripPlanDestination | null;
  description: string;
  start_date: string | null;
  end_date: string | null;
  saved_count: number;
  created_at: string;
  updated_at: string;
};

type PlaceSearchResult = {
  id: number;
  name: string;
  canonical_name?: string;
  aliases?: string[];
  place_type: string;
  city?: string;
  destination_name?: string;
  destination_country?: string;
  destination_city?: string;
};

const normalizePlaceLabel = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getPlaceContextLabel = (
  placeName?: string,
  placeCity?: string,
  destinationCountry?: string,
  destinationName?: string
) => {
  const normalizedPlaceName = normalizePlaceLabel(placeName);
  const normalizedPlaceCity = normalizePlaceLabel(placeCity);

  return [
    placeName,
    normalizedPlaceCity &&
    normalizedPlaceCity !== normalizedPlaceName
      ? placeCity
      : "",
    destinationCountry || destinationName,
  ]
    .filter(Boolean)
    .join(" · ");
};

function TripPlansPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [title, setTitle] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [destinationResults, setDestinationResults] = useState<PlaceSearchResult[]>([]);
  const [selectedDestination, setSelectedDestination] =
    useState<PlaceSearchResult | null>(null);
  const [searchingDestinations, setSearchingDestinations] = useState(false);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");

  const loadPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/trip-plans/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load trip plans:", res.status, text);
        return;
      }

      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Trip plans fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
      const query = destinationSearch.trim();

      if (selectedDestination || query.length < 2) {
        setDestinationResults([]);
        setSearchingDestinations(false);
        return;
      }

      const timeoutId = window.setTimeout(async () => {
        setSearchingDestinations(true);

        try {
          const res = await fetch(
            `${API_URL}/api/places/search/?q=${encodeURIComponent(query)}`,
            {
              credentials: "include",
            }
          );

          if (!res.ok) {
            setDestinationResults([]);
            return;
          }

          const data = await res.json();

          setDestinationResults(
            Array.isArray(data?.results) ? data.results : []
          );
        } catch (error) {
          console.error("Destination search error:", error);
          setDestinationResults([]);
        } finally {
          setSearchingDestinations(false);
        }
      }, 300);

      return () => window.clearTimeout(timeoutId);
    }, [destinationSearch, selectedDestination]);

   const handleStartDateChange = (value: string) => {
      setStartDate(value);
      setFormError("");

      if (!value) {
        return;
      }

      if (!endDate || endDate < value) {
        setEndDate(value);
      }
    };

  const createPlan = async () => {
    if (!title.trim()) {
      setFormError("Please add a title for your trip plan.");
      return;
    }

    if (!selectedDestination) {
      setFormError("Please select a destination for this trip plan.");
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setFormError("End date cannot be earlier than start date.");
      return;
    }

    setFormError("");
    setCreating(true);

    try {
      const res = await fetch(`${API_URL}/api/trip-plans/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          destinations: [
            {
              place_id: selectedDestination.id,
              role: "primary",
              position: 0,
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
          console.error("Create trip plan error:", data);
          setFormError(data.detail || "Could not create this trip plan.");
          return;
      }

      setPlans((prev) => [data, ...prev]);

      setTitle("");
      setDestinationSearch("");
      setDestinationResults([]);
      setSelectedDestination(null);
      setDescription("");
      setStartDate("");
      setEndDate("");
      setShowCreateForm(false);

      if (returnTo) {
        router.push(returnTo);
        return;
      }

    } catch (error) {
      console.error("Failed to create trip plan:", error);
      setFormError("Could not create this trip plan.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <main style={page}>
        <p style={muted}>Loading trip plans...</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        / <span>Trip plans</span>
      </div>

      <section style={heroCard}>
        <div style={label}>Build my trip</div>

        <h1 style={titleStyle}>My Trip Plans</h1>

        <p style={introText}>
          Create a plan for a destination, weekend route or future trip. Then add
          trusted experiences, tips and places while you explore Trust Travel.
        </p>
      </section>

      <div style={topActions}>
          <button
            type="button"
            onClick={() => setShowCreateForm((current) => !current)}
            style={showCreateForm ? secondaryButton : primaryButton}
          >
            {showCreateForm ? "Hide new trip plan form" : "Create new trip plan"}
          </button>
      </div>

      {showCreateForm && (
          <section style={formCard}>
          <div>
            <strong>Create a new trip plan</strong>
            <p style={helperText}>
              Start with a destination or idea. You can add experiences to this plan later.
            </p>

            <p style={requiredNote}>
              Fields marked with <span style={requiredMark}>*</span> are required.
            </p>

            {returnTo && (
              <p style={returnNotice}>
                After creating this plan, you will return to the page where you started.
              </p>
            )}

            {formError && (
              <div style={formErrorBox}>
                {formError}
              </div>
            )}

          </div>

        <div style={field}>
          <label style={fieldLabel}>
            Plan title <span style={requiredMark}>*</span>
          </label>

          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setFormError("");
            }}
            placeholder="e.g. Thailand 2027, Weekend in Amsterdam..."
            style={input}
          />

          {!title.trim() && (
            <div style={requiredHint}>
              Plan title is required to create a trip plan.
            </div>
          )}
        </div>

        <div style={field}>
          <label style={fieldLabel}>
            Primary destination <span style={requiredMark}>*</span>
          </label>

          <input
            value={destinationSearch}
            onChange={(e) => {
              setDestinationSearch(e.target.value);
              setSelectedDestination(null);
              setFormError("");
            }}
            placeholder="Search a country, city or specific place..."
            style={input}
          />

          {searchingDestinations && (
              <div style={requiredHint}>Searching destinations...</div>
            )}

            {!searchingDestinations &&
              !selectedDestination &&
              destinationSearch.trim().length >= 2 &&
              destinationResults.length > 0 && (
                <div style={destinationResultsList}>
                  {destinationResults.map((place) => {
                    const context = [
                      place.place_type,
                      place.city,
                      place.destination_country || place.destination_name,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => {
                          setSelectedDestination(place);
                          setDestinationSearch(place.name);
                          setDestinationResults([]);
                          setFormError("");
                        }}
                        style={destinationResultButton}
                      >
                        <strong>{place.name}</strong>

                        {context && (
                          <span style={destinationResultContext}>
                            {context}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

            {!searchingDestinations &&
              !selectedDestination &&
              destinationSearch.trim().length >= 2 &&
              destinationResults.length === 0 && (
                <div style={requiredHint}>
                  No matching destination found.
                </div>
              )}

            {selectedDestination && (
              <div style={selectedDestinationBox}>
                <div>
                  <strong>{selectedDestination.name}</strong>

                  <div style={destinationResultContext}>
                    {[
                      selectedDestination.place_type,
                      selectedDestination.city,
                      selectedDestination.destination_country ||
                        selectedDestination.destination_name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestination(null);
                    setDestinationSearch("");
                    setDestinationResults([]);
                  }}
                  style={smallSecondaryButton}
                >
                  Change
                </button>
              </div>
            )}

          {!selectedDestination && (
            <div style={requiredHint}>
              Select a real place from the search results.
            </div>
          )}
        </div>

        <div style={twoColumns}>
          <div style={field}>
            <label style={fieldLabel}>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              style={input}
            />
          </div>

          <div style={field}>
            <label style={fieldLabel}>End date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                  setEndDate(e.target.value);
                  setFormError("");
              }}
              style={input}
            />
          </div>
        </div>

        <div style={field}>
          <label style={fieldLabel}>Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about this plan..."
            rows={3}
            style={input}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={createPlan}
            disabled={creating}
            style={{
              ...primaryButton,
              opacity: creating ? 0.5 : 1,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Creating..." : "Create trip plan"}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setFormError("");
            }}
            style={secondaryButton}
          >
            Cancel
          </button>
        </div>
      </section>
    )}

      <section style={listSection}>
        <h2 style={sectionTitle}>Your plans</h2>

        {plans.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>You do not have any trip plans yet.</p>
            <p style={helperText}>
              Create your first plan, then save places, experiences and useful
              updates as you plan your trip.
            </p>
          </div>
        ) : (
          <div style={list}>
            {plans.map((plan) => (
              <article key={plan.id} style={planCard}>
                <div>
                  <div style={label}>Trip plan</div>

                  <h3 style={planTitle}>{plan.title}</h3>

                  {plan.primary_destination ? (
                      <p style={destinationTextStyle}>
                        {getPlaceContextLabel(
                          plan.primary_destination.place_name,
                          plan.primary_destination.place_city,
                          plan.primary_destination.destination_country,
                          plan.primary_destination.destination_name
                        )}
                      </p>
                  ) : (
                      plan.destination_text && (
                        <p style={destinationTextStyle}>{plan.destination_text}</p>
                      )
                  )}

                  {plan.description && (
                    <p style={descriptionText}>{plan.description}</p>
                  )}

                  <div style={metaRow}>
                    <span>{plan.saved_count} saved item{plan.saved_count === 1 ? "" : "s"}</span>

                    {plan.start_date && (
                      <span>From {new Date(plan.start_date).toLocaleDateString()}</span>
                    )}

                    {plan.end_date && (
                      <span>To {new Date(plan.end_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div style={actions}>
                  <Link href={`/trip-plans/${plan.id}`} style={primaryLink}>
                    Open plan
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function TripPlansPage() {
  return (
    <Suspense fallback={<main style={page}>Loading trip plans...</main>}>
      <TripPlansPageContent />
    </Suspense>
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

const heroCard = {
  padding: "22px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  marginBottom: "22px",
};

const label = {
  fontSize: "13px",
  color: "#777",
  marginBottom: "6px",
};

const titleStyle = {
  margin: 0,
  fontSize: "30px",
};

const introText = {
  marginTop: "10px",
  color: "#555",
  lineHeight: 1.6,
};

const formCard = {
  display: "grid",
  gap: "14px",
  padding: "22px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  marginBottom: "28px",
};

const helperText = {
  margin: "6px 0 0 0",
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};

const field = {
  display: "grid",
  gap: "6px",
};

const fieldLabel = {
  fontSize: "14px",
  fontWeight: 600,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const twoColumns = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const primaryButton = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  width: "fit-content",
};

const secondaryButton = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  width: "fit-content",
};

const listSection = {
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

const list = {
  display: "grid",
  gap: "14px",
};

const planCard = {
  padding: "20px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  display: "grid",
  gap: "16px",
};

const planTitle = {
  margin: 0,
  fontSize: "20px",
};

const destinationTextStyle = {
  margin: "8px 0 0 0",
  color: "#555",
  fontWeight: 600,
};

const descriptionText = {
  margin: "10px 0 0 0",
  color: "#555",
  lineHeight: 1.5,
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
};

const primaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const muted = {
  color: "#666",
};

const returnNotice = {
  margin: "10px 0 0 0",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "14px",
};

const requiredMark = {
  color: "#b91c1c",
  fontWeight: 700,
};

const requiredNote = {
  margin: "6px 0 0 0",
  color: "#777",
  fontSize: "13px",
};

const requiredHint = {
  color: "#b91c1c",
  fontSize: "12px",
  marginTop: "4px",
};

const topActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginBottom: "22px",
};

const formErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
};

const destinationResultsList = {
  display: "grid",
  gap: "8px",
  marginTop: "8px",
};

const destinationResultButton = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  background: "#ffffff",
  textAlign: "left" as const,
  cursor: "pointer",
  display: "grid",
  gap: "4px",
};

const destinationResultContext = {
  fontSize: "0.85rem",
  color: "#6b7280",
};

const selectedDestinationBox = {
  marginTop: "10px",
  padding: "12px",
  border: "1px solid #bfdbfe",
  borderRadius: "10px",
  background: "#eff6ff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const smallSecondaryButton = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
};