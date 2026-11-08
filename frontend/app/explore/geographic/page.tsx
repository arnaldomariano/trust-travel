"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

type ExternalGeographicDetail = {
  name: string;
  canonical_name: string;
  country_code: string;
  geographic_type: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  admin_name: string;
  admin_context: {
    level: number;
    name: string;
    code: string;
    external_id: string;
    iso_code: string;
  }[];
  external_source: "geonames" | "google_places";
  external_id: string;
  formatted_address?: string;
};

type POIType = "hotel" | "restaurant" | "attraction" | "nature" | "other";

type ExternalPOIResult = {
  name: string;
  address?: string;
  locality?: string;
  external_source: "foursquare";
  external_id: string;
};

const poiTypeOptions: { value: POIType; label: string }[] = [
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "attraction", label: "Tourist attraction" },
  { value: "nature", label: "Beach / Nature" },
  { value: "other", label: "Other place" },
];

const geographicTypeLabels: Record<string, string> = {
  settlement: "City / Settlement",
  administrative_area: "Administrative area",
  region: "Region",
  island: "Island",
  archipelago: "Archipelago",
  river: "River",
  lake: "Lake",
  mountain: "Mountain",
  valley: "Valley",
  desert: "Desert",
};

function GeographicExplorationContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const id = searchParams.get("id");

  const [detail, setDetail] = useState<ExternalGeographicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"invalid" | "not_found" | "unavailable" | null>(null);

  const [poiType, setPOIType] = useState<POIType>("hotel");
  const [poiQuery, setPOIQuery] = useState("");
  const [poiResults, setPOIResults] = useState<ExternalPOIResult[]>([]);
  const [poiLoading, setPOILoading] = useState(false);
  const [poiSearched, setPOISearched] = useState(false);
  const [poiError, setPOIError] = useState("");
  const poiRequestId = useRef(0);

  useEffect(() => {
    let active = true;
    poiRequestId.current += 1;
    setPOILoading(false);

    setDetail(null);
    setError(null);
    setLoading(true);
    setPOIResults([]);
    setPOISearched(false);
    setPOIError("");

    if (
      (source !== "geonames" && source !== "google_places") ||
      !id?.trim()
    ) {
      setError("invalid");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const loadDetail = async () => {
      try {
        const params = new URLSearchParams({
          external_source: source,
          external_id: id,
        });

        const response = await fetch(
          `${API_URL}/api/geography/places/external-detail/?${params.toString()}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("not_found");
          }
          throw new Error("unavailable");
        }

        const data: ExternalGeographicDetail = await response.json();

        if (
          data.external_source !== source ||
          data.external_id !== id ||
          !data.canonical_name ||
          !Array.isArray(data.admin_context)
        ) {
          throw new Error("unavailable");
        }

        if (active) {
          setDetail(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error && err.message === "not_found"
              ? "not_found"
              : "unavailable"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
      poiRequestId.current += 1;
    };
  }, [source, id]);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
      <Link href="/destinations">← Back to geographic search</Link>

      <h1 style={{ marginTop: 28 }}>Explore a geographic place</h1>

      {loading && <p>Loading geographic information...</p>}

      {!loading && error === "invalid" && (
        <p>Invalid geographic reference. Please return to the search.</p>
      )}

      {!loading && error === "not_found" && (
        <p>This geographic reference could not be found.</p>
      )}

      {!loading && error === "unavailable" && (
        <p>Geographic information is temporarily unavailable. Please try again later.</p>
      )}

      {!loading && detail && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{detail.canonical_name}</h2>

          <p>
            {(detail.geographic_type ? geographicTypeLabels[detail.geographic_type] : null) ||
              "Geographic place"}
          </p>

          {detail.country_code && (
            <p><strong>Country:</strong> {detail.country_code}</p>
          )}

          {detail.admin_name && (
            <p><strong>Administrative area:</strong> {detail.admin_name}</p>
          )}

          {detail.formatted_address && (
            <p><strong>Address:</strong> {detail.formatted_address}</p>
          )}

          {detail.admin_context.length > 0 && (
            <div>
              <strong>Geographic context</strong>
              <ul>
                {detail.admin_context.map((entry, index) => (
                  <li key={`${entry.level}-${entry.external_id}-${index}`}>
                    {entry.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.latitude != null && detail.longitude != null && (
            <p>
              <strong>Coordinates:</strong> {detail.latitude}, {detail.longitude}
            </p>
          )}

          {detail.geographic_type === "settlement" &&
            detail.latitude != null &&
            detail.longitude != null &&
            Number.isFinite(Number(detail.latitude)) &&
            Number.isFinite(Number(detail.longitude)) && (
              <section style={{ display: "grid", gap: 12, marginTop: 20 }}>
                <h3>Find places in {detail.canonical_name}</h3>

                <form
                  onSubmit={async (event) => {
                    event.preventDefault();

                    const query = poiQuery.trim();
                    const requestId = ++poiRequestId.current;

                    setPOISearched(true);
                    setPOIResults([]);
                    setPOIError("");

                    if (query.length < 2) {
                      setPOIError("Enter at least 2 characters.");
                      return;
                    }

                    setPOILoading(true);

                    try {
                      const params = new URLSearchParams({
                        q: query,
                        place_type: poiType,
                        external_source: detail.external_source,
                        external_id: detail.external_id,
                      });

                      const response = await fetch(
                        `${API_URL}/api/geography/pois/search/?${params.toString()}`
                      );

                      if (!response.ok) {
                        throw new Error("search_failed");
                      }

                      const data = await response.json();

                      if (requestId !== poiRequestId.current) return;

                      if (!Array.isArray(data.results)) {
                        throw new Error("invalid_results");
                      }

                      setPOIResults(
                        data.results.filter(
                          (item: ExternalPOIResult) =>
                            item.external_source === "foursquare" &&
                            typeof item.external_id === "string" &&
                            item.external_id.length > 0
                        )
                      );
                    } catch {
                      if (requestId === poiRequestId.current) {
                        setPOIError(
                          "Place discovery is temporarily unavailable. Please try again."
                        );
                      }
                    } finally {
                      if (requestId === poiRequestId.current) {
                        setPOILoading(false);
                      }
                    }
                  }}
                  style={{ display: "grid", gap: 10 }}
                >
                  <label>
                    Place type
                    <select
                      value={poiType}
                      onChange={(event) => {
                        poiRequestId.current += 1;
                        setPOILoading(false);
                        setPOIType(event.target.value as POIType);
                        setPOIResults([]);
                        setPOISearched(false);
                        setPOIError("");
                      }}
                      style={{ display: "block", width: "100%", padding: 10 }}
                    >
                      {poiTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Search
                    <input
                      value={poiQuery}
                      onChange={(event) => {
                        poiRequestId.current += 1;
                        setPOILoading(false);
                        setPOIQuery(event.target.value);
                        setPOIResults([]);
                        setPOISearched(false);
                        setPOIError("");
                      }}
                      placeholder="Example: hotel, museum, restaurant"
                      style={{ display: "block", width: "100%", padding: 10 }}
                    />
                  </label>

                  <button type="submit" disabled={poiLoading}>
                    {poiLoading ? "Searching..." : "Find places"}
                  </button>
                </form>

                {poiError && <p role="alert">{poiError}</p>}

                {poiSearched && !poiLoading && !poiError &&
                  poiResults.length === 0 && (
                    <p>No places found for this search.</p>
                  )}

                {poiResults.map((poi) => (
                  <article
                    key={poi.external_id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <h4 style={{ marginTop: 0 }}>{poi.name}</h4>
                    {(poi.address || poi.locality) && (
                      <p>{poi.address || poi.locality}</p>
                    )}
                    <Link
                      href={`/explore/poi?${new URLSearchParams({
                        source: "foursquare",
                        id: poi.external_id,
                        poi_type: poiType,
                        city_source: detail.external_source,
                        city_id: detail.external_id,
                      }).toString()}`}
                    >
                      Explore place
                    </Link>
                  </article>
                ))}
              </section>
            )}

          <p style={{
            padding: 16,
            background: "#f5f7fa",
            borderRadius: 10,
            color: "#444",
            lineHeight: 1.5,
          }}>
            Geographic information supplied by an external reference provider.
            This information is not a Trust Travel community review.
            Exploring this reference does not create a Trust Travel place.
          </p>
        </section>
      )}
    </main>
  );
}

export default function GeographicExplorationPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32 }}>Loading...</main>}>
      <GeographicExplorationContent />
    </Suspense>
  );
}
