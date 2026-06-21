"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_URL } from "../lib/api";

type AnalysisType =
  | "all"
  | "country"
  | "city"
  | "hotel"
  | "restaurant"
  | "attraction"
  | "nature"
  | "other";

type Place = {
  id: number;
  name: string;
  place_type?: string;
  city?: string | null;
  destination_name?: string | null;
  destination_country?: string | null;
  destination_city?: string | null;
};

type RatingsSummary = {
  overall?: {
    average?: number | string | null;
    total_reviews?: number;
    rated_count?: number;
    distribution?: Record<string, number>;
  };
  practical?: {
    safety?: { average?: number | string | null; count?: number };
    cost?: { average?: number | string | null; count?: number };
    accessibility?: { average?: number | string | null; count?: number };
    convenience?: { average?: number | string | null; count?: number };
  };
};

const analysisTypes: {
  value: AnalysisType;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "All",
    description: "Search freely first, then refine by place type if needed.",
  },
  {
    value: "country",
    label: "Country",
    description: "Filter broad country-level evaluations and travel patterns.",
  },
  {
    value: "city",
    label: "City / Region",
    description: "Filter cities, regions and local travel hubs.",
  },
  {
    value: "hotel",
    label: "Hotel",
    description: "Filter accommodation quality, convenience and trust signals.",
  },
  {
    value: "restaurant",
    label: "Restaurant",
    description: "Filter food places by practical traveler feedback.",
  },
  {
    value: "attraction",
    label: "Attraction",
    description: "Filter tourist attractions, museums, landmarks and activities.",
  },
  {
    value: "nature",
    label: "Nature",
    description: "Filter beaches, trails, waterfalls, parks and natural places.",
  },
  {
    value: "other",
    label: "Other",
    description: "Filter places that do not fit the main categories yet.",
  },
];

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatPlaceType(placeType: string | undefined) {
  if (!placeType) return "Place";

  const labels: Record<string, string> = {
    country: "Country",
    city: "City / Region",
    hotel: "Hotel",
    restaurant: "Restaurant",
    attraction: "Attraction",
    nature: "Nature",
    other: "Other",
  };

  return labels[placeType] || "Place";
}

function getPlaceContext(place: Place) {
  const parts = [
    formatPlaceType(place.place_type),
    place.city,
    place.destination_name,
    place.destination_country,
  ]
    .filter(Boolean)
    .map((item) => String(item));

  return Array.from(new Set(parts)).join(" · ");
}

export default function EvaluationsPage() {
    const [selectedType, setSelectedType] = useState<AnalysisType>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [places, setPlaces] = useState<Place[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [ratingsSummary, setRatingsSummary] = useState<RatingsSummary | null>(null);
    const [loadingRatingsSummary, setLoadingRatingsSummary] = useState(false);
    const [ratingsSummaryError, setRatingsSummaryError] = useState("");
    const [loadingPlaces, setLoadingPlaces] = useState(true);
    const [placesError, setPlacesError] = useState("");

  useEffect(() => {
    async function fetchPlaces() {
      try {
        setLoadingPlaces(true);
        setPlacesError("");

        const response = await fetch(`${API_URL}/api/places/`);

        if (!response.ok) {
          throw new Error("Could not load places.");
        }

        const data = await response.json();
        setPlaces(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setPlacesError("Could not load places from the backend.");
      } finally {
        setLoadingPlaces(false);
      }
    }

    fetchPlaces();
  }, []);

  const loadRatingsSummary = async (placeId: number) => {
      try {
        setLoadingRatingsSummary(true);
        setRatingsSummaryError("");
        setRatingsSummary(null);

        const response = await fetch(
          `${API_URL}/api/places/${placeId}/ratings-summary/`
        );

        if (!response.ok) {
          throw new Error("Could not load ratings summary.");
        }

        const data = await response.json();
        setRatingsSummary(data);
      } catch (error) {
        console.error(error);
        setRatingsSummaryError("Could not load ratings summary for this place.");
        setRatingsSummary(null);
      } finally {
        setLoadingRatingsSummary(false);
      }
  };

  const selectedTypeInfo = useMemo(() => {
    return analysisTypes.find((item) => item.value === selectedType);
  }, [selectedType]);

  const filteredPlaces = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    if (!normalizedSearch) {
      return [];
    }

    return places
      .filter((place) => {
        const matchesType =
          selectedType === "all" || place.place_type === selectedType;

        if (!matchesType) return false;

        const searchableText = normalizeText(
          [
            place.name,
            place.city,
            place.destination_name,
            place.destination_country,
            place.destination_city,
            place.place_type,
          ].join(" ")
        );

        return searchableText.includes(normalizedSearch);
      })
      .slice(0, 8);
  }, [places, searchTerm, selectedType]);

  const averageRating =
      ratingsSummary?.overall?.average !== null &&
      ratingsSummary?.overall?.average !== undefined
        ? Number(ratingsSummary.overall.average).toFixed(1)
        : null;

  const practicalRatingStats = [
      {
        key: "safety",
        label: "Safety",
        ...(ratingsSummary?.practical?.safety || { average: null, count: 0 }),
      },
      {
        key: "cost",
        label: "Cost",
        ...(ratingsSummary?.practical?.cost || { average: null, count: 0 }),
      },
      {
        key: "accessibility",
        label: "Accessibility",
        ...(ratingsSummary?.practical?.accessibility || {
          average: null,
          count: 0,
        }),
      },
      {
        key: "convenience",
        label: "Convenience",
        ...(ratingsSummary?.practical?.convenience || {
          average: null,
          count: 0,
        }),
      },
    ];

  const availablePracticalRatingStats = practicalRatingStats.filter(
      (stat) => stat.average !== null && stat.average !== undefined
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to home
          </Link>

          <div className="mt-6">
            <p className="text-sm uppercase tracking-[0.25em] text-sky-400">
              Trust Travel Analytics
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Evaluations & Ratings
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Search freely first, then refine the analysis by place type.
              This area will centralize structured evaluations across Trust Travel,
              helping users compare countries, cities, hotels, restaurants,
              attractions and other places from one dedicated analytics space.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Search an evaluation target
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Type a country, city, hotel, restaurant, attraction, beach,
                trail or any other place. You can refine the result by category
                after searching.
              </p>
            </div>

            <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200">
              Connected to places
            </div>
          </div>

          <div className="mt-6">
            <label
              htmlFor="evaluation-search"
              className="text-sm font-medium text-slate-200"
            >
              Search target
            </label>

            <input
              id="evaluation-search"
              type="text"
              value={searchTerm}
              onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSelectedPlace(null);
                  setRatingsSummary(null);
                  setRatingsSummaryError("");
              }}

              placeholder="Example: Brazil, Rome, Nias, Colosseum, Padang Padang Beach, Hotel X..."
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400"
            />
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-slate-200">
              Refine by type
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {analysisTypes.map((item) => {
                const isSelected = selectedType === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedType(item.value)}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-sky-400 bg-sky-500/15 text-white"
                        : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600",
                    ].join(" ")}
                  >
                    <div className="font-semibold">{item.label}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-white">
              Matching places
            </h3>

            {loadingPlaces && (
              <p className="mt-3 text-sm text-slate-400">
                Loading places...
              </p>
            )}

            {!loadingPlaces && placesError && (
              <p className="mt-3 text-sm text-red-300">
                {placesError}
              </p>
            )}

            {!loadingPlaces && !placesError && !searchTerm.trim() && (
              <p className="mt-3 text-sm text-slate-400">
                Start typing to see matching places from the Trust Travel database.
              </p>
            )}

            {!loadingPlaces &&
              !placesError &&
              searchTerm.trim() &&
              filteredPlaces.length === 0 && (
                <p className="mt-3 text-sm text-slate-400">
                  No matching place found for this search and active filter.
                </p>
              )}

            {filteredPlaces.length > 0 && (
              <div className="mt-4 grid gap-3">
                {filteredPlaces.map((place) => (
                  <button
                      key={place.id}
                      type="button"
                      onClick={() => {
                          setSelectedPlace(place);
                          loadRatingsSummary(place.id);
                      }}
                      className={[
                        "rounded-xl border p-4 text-left transition hover:border-sky-500/60",
                        selectedPlace?.id === place.id
                          ? "border-sky-400 bg-sky-500/15"
                          : "border-slate-800 bg-slate-900/80",
                      ].join(" ")}
                  >
                    <div className="font-semibold text-white">
                      {place.name}
                    </div>

                    <div className="mt-1 text-sm text-slate-400">
                      {getPlaceContext(place)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="mb-3 text-2xl">⭐</div>
            <h2 className="text-lg font-semibold text-white">
              Ratings overview
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Review average ratings, number of evaluations and rating
              distribution for selected places.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              Coming next
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="mb-3 text-2xl">📍</div>
            <h2 className="text-lg font-semibold text-white">
              Places comparison
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Compare different destinations and specific places by practical
              criteria such as safety, cost, accessibility and convenience.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              Future module
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="mb-3 text-2xl">🛡️</div>
            <h2 className="text-lg font-semibold text-white">
              Trust quality signals
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Prepare the foundation for future quality indicators, including
              trusted evaluations and possible quality seals.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              Future concept
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-white">
            Selected analysis scope
          </h2>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Search target</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {searchTerm.trim() ? searchTerm : "No target selected yet"}
              </p>

              <p className="mt-4 text-sm text-slate-400">Active filter</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {selectedTypeInfo?.label}
              </p>

              <p className="mt-4 text-sm text-slate-400">Selected place</p>

              {selectedPlace ? (
                  <div className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                    <p className="text-lg font-semibold text-white">
                      {selectedPlace.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {getPlaceContext(selectedPlace)}
                    </p>

                    {loadingRatingsSummary && (
                      <p className="mt-4 text-sm text-slate-300">
                        Loading ratings summary...
                      </p>
                    )}

                    {!loadingRatingsSummary && ratingsSummaryError && (
                      <p className="mt-4 text-sm text-red-300">
                        {ratingsSummaryError}
                      </p>
                    )}

                    {!loadingRatingsSummary && ratingsSummary && (
                      <div className="mt-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Average rating
                            </p>
                            <p className="mt-2 text-2xl font-bold text-white">
                              {averageRating ? `${averageRating} ★` : "—"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Total reviews
                            </p>
                            <p className="mt-2 text-2xl font-bold text-white">
                              {ratingsSummary.overall?.total_reviews ?? 0}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Rated experiences
                            </p>
                            <p className="mt-2 text-2xl font-bold text-white">
                              {ratingsSummary.overall?.rated_count ?? 0}
                            </p>
                          </div>
                        </div>

                        {availablePracticalRatingStats.length > 0 && (
                          <div className="mt-5">
                            <p className="text-sm font-semibold text-white">
                              Practical ratings
                            </p>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {availablePracticalRatingStats.map((stat) => (
                                <div
                                  key={stat.key}
                                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"
                                >
                                  <p className="text-sm text-slate-400">
                                    {stat.label}
                                  </p>

                                  <p className="mt-1 text-xl font-semibold text-white">
                                    {Number(stat.average).toFixed(1)} ★
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {stat.count ?? 0} evaluation(s)
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {availablePracticalRatingStats.length === 0 && (
                          <p className="mt-4 text-sm text-slate-400">
                            No practical ratings available for this place yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-white">
                    No place selected yet
                  </p>
              )}
          </div>

          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">
            In the next versions, this section can fetch real evaluation data
            from the backend and show rating summaries, practical criteria,
            comparisons and trust-based signals for the selected target. The
            default filter is All, so users are not forced to classify a place
            before searching.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-white">
            Why this page exists
          </h2>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Place pages should remain focused on discovery, experiences, updates
            and lightweight rating summaries. Deeper analysis belongs here, in a
            centralized area where users can filter and compare evaluations
            without losing the context of their trip planning.
          </p>
        </section>
      </div>
    </main>
  );
}