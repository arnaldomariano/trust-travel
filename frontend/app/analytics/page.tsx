"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { API_URL } from "../lib/api";

type TopSavedExperience = {
  experience_id: number;
  title: string;
  comment: string;
  rating: number | null;
  place: string;
  place_id: number;
  place_type: string;
  destination: string;
  saved_count: number;
};

type TopSavedPlace = {
  place_id: number;
  place: string;
  place_type: string;
  destination: string;
  saved_count: number;
};

type AnalyticsSummary = {
  total_saved_items: number;
  unique_experiences_saved: number;
  unique_places_saved: number;
  top_place_type: string | null;
  top_destination: string | null;
};

type TopSavedDestination = {
  destination: string;
  saved_count: number;
  unique_places: number;
  unique_experiences: number;
  unique_users: number;
  user_country: string | null;
};

export default function AnalyticsPage() {
  const [topSavedExperiences, setTopSavedExperiences] = useState<
  TopSavedExperience[]
  >([]);

const [topSavedPlaces, setTopSavedPlaces] = useState<TopSavedPlace[]>([]);
const [selectedPlaceType, setSelectedPlaceType] = useState("");
const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

const [loading, setLoading] = useState(true);

const [topSavedDestinations, setTopSavedDestinations] = useState<
  TopSavedDestination[]
>([]);

const placeTypeFilters = [
  { value: "", label: "All" },
  { value: "country", label: "Countries" },
  { value: "city", label: "Cities" },
  { value: "attraction", label: "Attractions" },
  { value: "hotel", label: "Hotels" },
  { value: "restaurant", label: "Restaurants" },
  { value: "nature", label: "Nature" },
];

useEffect(() => {
  const loadTopSavedExperiences = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/analytics/top-saved-experiences/`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load top saved experiences:", res.status, text);
        setTopSavedExperiences([]);
        return;
      }

      const data = await res.json();
      setTopSavedExperiences(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Top saved experiences fetch error:", error);
      setTopSavedExperiences([]);
    }
  };

  loadTopSavedExperiences();
}, []);

useEffect(() => {
  const loadTopSavedPlaces = async () => {
    setLoading(true);

    try {
      const query = selectedPlaceType
        ? `?place_type=${selectedPlaceType}`
        : "";

      const res = await fetch(
        `${API_URL}/api/analytics/top-saved-places/${query}`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load top saved places:", res.status, text);
        setTopSavedPlaces([]);
        return;
      }

      const data = await res.json();
      setTopSavedPlaces(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Top saved places fetch error:", error);
      setTopSavedPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  loadTopSavedPlaces();
}, [selectedPlaceType]);

useEffect(() => {
  const loadSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/api/analytics/summary/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load analytics summary:", res.status, text);
        setSummary(null);
        return;
      }

      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error("Analytics summary fetch error:", error);
      setSummary(null);
    }
  };

  loadSummary();
}, []);

useEffect(() => {
  const loadTopSavedDestinations = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/analytics/top-saved-destinations/`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error(
          "Failed to load top saved destinations:",
          res.status,
          text
        );
        setTopSavedDestinations([]);
        return;
      }

      const data = await res.json();
      setTopSavedDestinations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Top saved destinations fetch error:", error);
      setTopSavedDestinations([]);
    }
  };

  loadTopSavedDestinations();
}, []);

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        / Analytics
      </div>

      <section style={heroCard}>
        <div style={eyebrow}>Trust Travel insights</div>

        <h1 style={title}>Analytics</h1>

        <p style={description}>
          Early planning signals based on what users are saving to their trip
          plans.
        </p>
      </section>

      <section style={summaryGrid}>
          <div style={summaryCard}>
            <div style={summaryLabel}>Total saved items</div>
            <div style={summaryValue}>
              {summary ? summary.total_saved_items : "—"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Saved experiences</div>
            <div style={summaryValue}>
              {summary ? summary.unique_experiences_saved : "—"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Places tracked</div>
            <div style={summaryValue}>
              {summary ? summary.unique_places_saved : "—"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Top place type</div>
            <div style={summaryValue}>
              {summary?.top_place_type ? formatPlaceType(summary.top_place_type) : "—"}
            </div>
            {summary?.top_destination && (
              <div style={summaryHint}>Top destination: {summary.top_destination}</div>
            )}
          </div>
        </section>

        <section style={{ ...section, marginBottom: "34px" }}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Top saved destinations</h2>
              <p style={sectionDescription}>
                Destinations most often appearing in users&apos; trip plans.
              </p>
            </div>

            <div style={countBadge}>
              {topSavedDestinations.length}{" "}
              {topSavedDestinations.length === 1 ? "destination" : "destinations"}
            </div>
          </div>

          {topSavedDestinations.length === 0 ? (
            <div style={emptyBox}>No saved destinations yet.</div>
          ) : (
            <div style={placesGrid}>
              {topSavedDestinations.map((destination, index) => (
                <article key={destination.destination} style={placeCard}>
                  <div style={rank}>#{index + 1}</div>

                  <div style={{ flex: 1 }}>
                    <h3 style={cardTitle}>{destination.destination}</h3>

                    <div style={cardTopLine}>
                      <span style={savedCountBadge}>
                        {destination.saved_count}{" "}
                        {destination.saved_count === 1 ? "save" : "saves"}
                      </span>

                      <span style={placeTypeBadge}>
                        {destination.unique_places}{" "}
                        {destination.unique_places === 1 ? "place" : "places"}
                      </span>

                      <span style={placeTypeBadge}>
                        {destination.unique_users}{" "}
                        {destination.unique_users === 1 ? "user" : "users"}
                      </span>
                    </div>

                    <div style={metaLine}>
                      {destination.unique_experiences}{" "}
                      {destination.unique_experiences === 1
                        ? "saved experience"
                        : "saved experiences"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      <section style={section}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Top saved experiences</h2>
            <p style={sectionDescription}>
              Experiences most often added to trip plans.
            </p>
          </div>

          <div style={countBadge}>
            {topSavedExperiences.length}{" "}
            {topSavedExperiences.length === 1 ? "item" : "items"}
          </div>
        </div>

        {loading ? (
          <div style={emptyBox}>Loading analytics...</div>
        ) : topSavedExperiences.length === 0 ? (
          <div style={emptyBox}>No saved experiences yet.</div>
        ) : (
          <div style={list}>
            {topSavedExperiences.map((item, index) => (
              <article key={item.experience_id} style={card}>
                <div style={rank}>#{index + 1}</div>

                <div style={{ flex: 1 }}>
                  <div style={cardTopLine}>
                    <span style={placeTypeBadge}>
                      {formatPlaceType(item.place_type)}
                    </span>

                    <span style={savedCountBadge}>
                      {item.saved_count}{" "}
                      {item.saved_count === 1 ? "save" : "saves"}
                    </span>
                  </div>

                  <h3 style={cardTitle}>
                    {item.title || item.comment.slice(0, 70)}
                  </h3>

                  <div style={metaLine}>
                    {item.place}
                    {item.destination && item.destination !== item.place
                      ? ` · ${item.destination}`
                      : ""}
                  </div>

                  {item.rating && (
                    <div style={stars}>
                      {"★".repeat(item.rating)}
                      {"☆".repeat(5 - item.rating)}
                    </div>
                  )}

                  <p style={comment}>
                    {item.comment.length > 160
                      ? `${item.comment.slice(0, 160)}...`
                      : item.comment}
                  </p>

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
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
            </section>

      <section style={{ ...section, marginTop: "34px" }}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Top saved places</h2>
            <p style={sectionDescription}>
              Places appearing most often in users&apos; trip plans.
            </p>
          </div>

          <div style={countBadge}>
            {topSavedPlaces.length}{" "}
            {topSavedPlaces.length === 1 ? "place" : "places"}
          </div>
        </div>

          <div style={filterRow}>

            {placeTypeFilters.map((filter) => {

              const isActive = selectedPlaceType === filter.value;

              return (

                <button

                  key={filter.value || "all"}

                  type="button"

                  onClick={() => setSelectedPlaceType(filter.value)}

                  style={{

                    ...filterButton,

                    ...(isActive ? activeFilterButton : {}),

                  }}

                >

                  {filter.label}

                </button>

              );

            })}

          </div>

        {loading ? (
          <div style={emptyBox}>Loading places analytics...</div>
        ) : topSavedPlaces.length === 0 ? (
          <div style={emptyBox}>No saved places yet.</div>
        ) : (
          <div style={placesGrid}>
            {topSavedPlaces.map((place, index) => (
              <article key={place.place_id} style={placeCard}>
                <div style={rank}>#{index + 1}</div>

                <div style={{ flex: 1 }}>
                  <div style={cardTopLine}>
                    <span style={placeTypeBadge}>
                      {formatPlaceType(place.place_type)}
                    </span>

                    <span style={savedCountBadge}>
                      {place.saved_count}{" "}
                      {place.saved_count === 1 ? "save" : "saves"}
                    </span>
                  </div>

                  <h3 style={cardTitle}>{place.place}</h3>

                  <div style={metaLine}>
                    {place.destination && place.destination !== place.place
                      ? place.destination
                      : "Destination"}
                  </div>

                  <div style={actions}>
                    <Link
                      href={`/places/${place.place_id}`}
                      style={primaryLink}
                    >
                      View place
                    </Link>

                    <Link
                      href={`/places/${place.place_id}/experiences`}
                      style={secondaryLink}
                    >
                      View experiences
                    </Link>
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

function formatPlaceType(type: string) {
  const labels: Record<string, string> = {
    country: "Country",
    city: "City / Region",
    attraction: "Tourist attraction",
    hotel: "Hotel",
    restaurant: "Restaurant / Café",
    nature: "Beach / Nature",
    other: "Other",
  };

  return labels[type] || "Place";
}

const page = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "40px 20px 80px",
};

const breadcrumb = {
  fontSize: "14px",
  color: "#666",
  marginBottom: "20px",
};

const breadcrumbLink = {
  color: "#555",
  textDecoration: "none",
};

const heroCard = {
  padding: "28px",
  borderRadius: "18px",
  border: "1px solid #eee",
  background: "#fafafa",
  marginBottom: "26px",
};

const eyebrow = {
  fontSize: "14px",
  color: "#666",
  marginBottom: "10px",
};

const title = {
  fontSize: "34px",
  margin: "0 0 10px",
};

const description = {
  fontSize: "16px",
  color: "#555",
  lineHeight: 1.6,
  maxWidth: "640px",
  margin: 0,
};

const section = {
  display: "grid",
  gap: "16px",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
};

const sectionTitle = {
  fontSize: "24px",
  margin: "0 0 6px",
};

const sectionDescription = {
  fontSize: "14px",
  color: "#666",
  margin: 0,
};

const countBadge = {
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  fontSize: "13px",
  color: "#444",
  whiteSpace: "nowrap" as const,
};

const emptyBox = {
  padding: "18px",
  borderRadius: "14px",
  border: "1px solid #eee",
  color: "#666",
  background: "white",
};

const list = {
  display: "grid",
  gap: "14px",
};

const card = {
  display: "flex",
  gap: "16px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};

const rank = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  background: "#111",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  flexShrink: 0,
};

const cardTopLine = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginBottom: "10px",
};

const placeTypeBadge = {
  fontSize: "12px",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  color: "#555",
  background: "#fafafa",
};

const savedCountBadge = {
  fontSize: "12px",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #d7f0df",
  color: "#166534",
  background: "#f2fbf5",
  fontWeight: 700,
};

const cardTitle = {
  fontSize: "20px",
  margin: "0 0 8px",
};

const metaLine = {
  fontSize: "14px",
  color: "#666",
  marginBottom: "8px",
};

const stars = {
  color: "#f5b50a",
  marginBottom: "8px",
};

const comment = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: "#333",
  margin: "0 0 14px",
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const primaryLink = {
  padding: "8px 12px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
  fontSize: "14px",
};

const secondaryLink = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "#111",
  textDecoration: "none",
  fontSize: "14px",
};

const placesGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
};

const placeCard = {
  display: "flex",
  gap: "14px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};

const filterRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const filterButton = {
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  color: "#444",
  cursor: "pointer",
  fontSize: "13px",
};

const activeFilterButton = {
  background: "black",
  color: "white",
  border: "1px solid black",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "30px",
};

const summaryCard = {
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};

const summaryLabel = {
  fontSize: "13px",
  color: "#666",
  marginBottom: "8px",
};

const summaryValue = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#111",
};

const summaryHint = {
  fontSize: "12px",
  color: "#777",
  marginTop: "8px",
};