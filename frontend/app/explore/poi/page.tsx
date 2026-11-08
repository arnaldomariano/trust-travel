"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

type ExternalPOIDetail = {
  name: string;
  canonical_name: string;
  country_code: string;
  latitude: string | number | null;
  longitude: string | number | null;
  address: string;
  locality: string;
  region: string;
  postcode: string;
  categories: {
    external_id: string;
    name: string;
  }[];
  chains: {
    external_id: string;
    name: string;
  }[];
  external_source: "foursquare";
  external_id: string;
};

type ExplorationError = "invalid" | "not_found" | "unavailable" | null;

function POIExplorationContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const id = searchParams.get("id");
  const poiTypeParam = searchParams.get("poi_type");
  const cityPlaceIdParam = searchParams.get("city_place_id");
  const citySourceParam = searchParams.get("city_source");
  const cityIdParam = searchParams.get("city_id");

  const hasExternalCityContext =
    (citySourceParam === "geonames" ||
      citySourceParam === "google_places") &&
    Boolean(cityIdParam?.trim());

  const validPOITypes = [
    "attraction",
    "hotel",
    "restaurant",
    "nature",
    "other",
  ] as const;

  const selectedPOIType = validPOITypes.find(
    (type) => type === poiTypeParam
  );

  const selectedCityPlaceId =
    cityPlaceIdParam && /^[1-9][0-9]*$/.test(cityPlaceIdParam)
      ? Number(cityPlaceIdParam)
      : null;

  const hasRegisteredCityContext =
    selectedCityPlaceId !== null &&
    Number.isSafeInteger(selectedCityPlaceId);

  const [detail, setDetail] = useState<ExternalPOIDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ExplorationError>(null);

  useEffect(() => {
    let active = true;

    setDetail(null);
    setError(null);
    setLoading(true);

    if (source !== "foursquare" || !id?.trim()) {
      setError("invalid");
      setLoading(false);

      return () => {
        active = false;
      };
    }

    const externalId = id.trim();

    const loadDetail = async () => {
      try {
        const params = new URLSearchParams({
          external_source: source,
          external_id: externalId,
        });

        const response = await fetch(
          `${API_URL}/api/geography/pois/external-detail/?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404 ? "not_found" : "unavailable"
          );
        }

        const data: ExternalPOIDetail = await response.json();

        if (
          data.external_source !== "foursquare" ||
          data.external_id !== externalId ||
          !data.name?.trim() ||
          !Array.isArray(data.categories) ||
          !Array.isArray(data.chains)
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
    };
  }, [source, id]);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
      <Link href="/destinations">← Back to place search</Link>

      <h1 style={{ marginTop: 28 }}>Explore a place</h1>

      {loading && <p>Loading place information...</p>}

      {!loading && error === "invalid" && (
        <p>Invalid external place reference. Please return to the search.</p>
      )}

      {!loading && error === "not_found" && (
        <p>This external place reference could not be found.</p>
      )}

      {!loading && error === "unavailable" && (
        <p>
          Place information is temporarily unavailable.
          Please try again later.
        </p>
      )}

      {!loading && detail && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{detail.canonical_name || detail.name}</h2>

          {detail.categories.length > 0 && (
            <p>
              {detail.categories
                .map((category) => category.name)
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {detail.address && (
            <p><strong>Address:</strong> {detail.address}</p>
          )}

          {detail.locality && (
            <p><strong>City / Locality:</strong> {detail.locality}</p>
          )}

          {detail.region && (
            <p><strong>Region:</strong> {detail.region}</p>
          )}

          {detail.postcode && (
            <p><strong>Postal code:</strong> {detail.postcode}</p>
          )}

          {detail.country_code && (
            <p><strong>Country:</strong> {detail.country_code}</p>
          )}

          {detail.chains.length > 0 && (
            <p>
              <strong>Business network:</strong>{" "}
              {detail.chains
                .map((chain) => chain.name)
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {detail.latitude != null && detail.longitude != null && (
            <p>
              <strong>Coordinates:</strong>{" "}
              {detail.latitude}, {detail.longitude}
            </p>
          )}

          <p
            style={{
              padding: 16,
              background: "#f5f7fa",
              borderRadius: 10,
              color: "#444",
              lineHeight: 1.5,
            }}
          >
            Place information supplied by Foursquare.
            This information is not a Trust Travel community review.
            Exploring this reference does not create a Trust Travel place.
          </p>

          {selectedPOIType &&
          (hasRegisteredCityContext !== hasExternalCityContext) ? (
            <Link
              href={`/destinations?${new URLSearchParams({
                mode: "experience",
                share: "true",
                poi_source: "foursquare",
                poi_id: detail.external_id,
                poi_type: selectedPOIType,
                ...(hasRegisteredCityContext
                  ? { city_place_id: String(selectedCityPlaceId) }
                  : {
                      city_source: citySourceParam!,
                      city_id: cityIdParam!.trim(),
                    }),
              }).toString()}`}
            >
              Share your experience
            </Link>
          ) : (
            <p>
              Sharing an experience about this external place is not
              available yet. You can still explore its information.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

export default function POIExplorationPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32 }}>Loading...</main>}>
      <POIExplorationContent />
    </Suspense>
  );
}
