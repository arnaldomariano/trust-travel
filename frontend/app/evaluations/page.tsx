"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type AnalysisType =
  | "country"
  | "city"
  | "hotel"
  | "restaurant"
  | "attraction"
  | "nature"
  | "other";

const analysisTypes: {
  value: AnalysisType;
  label: string;
  description: string;
}[] = [
  {
    value: "country",
    label: "Country",
    description: "Compare broad country-level evaluations and travel patterns.",
  },
  {
    value: "city",
    label: "City / Region",
    description: "Analyze cities, regions and local travel hubs.",
  },
  {
    value: "hotel",
    label: "Hotel",
    description: "Evaluate accommodation quality, convenience and trust signals.",
  },
  {
    value: "restaurant",
    label: "Restaurant",
    description: "Compare food places by practical traveler feedback.",
  },
  {
    value: "attraction",
    label: "Attraction",
    description: "Review tourist attractions, museums, landmarks and activities.",
  },
  {
    value: "nature",
    label: "Nature",
    description: "Analyze beaches, trails, waterfalls, parks and natural places.",
  },
  {
    value: "other",
    label: "Other",
    description: "Use this for places that do not fit the main categories yet.",
  },
];

export default function EvaluationsPage() {
  const [selectedType, setSelectedType] = useState<AnalysisType>("country");
  const [searchTerm, setSearchTerm] = useState("");

  const selectedTypeInfo = useMemo(() => {
    return analysisTypes.find((item) => item.value === selectedType);
  }, [selectedType]);

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
              This area will centralize structured evaluations across Trust Travel.
              Instead of spreading detailed rating analysis across each place page,
              users will be able to compare countries, cities, hotels, restaurants,
              attractions and other places from one dedicated analytics space.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Choose what you want to evaluate
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Start by selecting the level of analysis. Later, this page will
                connect to real Trust Travel rating data and allow deeper filtering.
              </p>
            </div>

            <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200">
              Early structure
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Example: Brazil, Rome, Nias, Hotel X, restaurant name..."
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400"
            />
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
            <p className="text-sm text-slate-400">Current type</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {selectedTypeInfo?.label}
            </p>

            <p className="mt-4 text-sm text-slate-400">Search target</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {searchTerm.trim() ? searchTerm : "No target selected yet"}
            </p>
          </div>

          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">
            In the next versions, this section can fetch real evaluation data
            from the backend and show rating summaries, practical criteria,
            comparisons and trust-based signals for the selected target.
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