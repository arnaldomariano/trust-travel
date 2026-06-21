"use client";

import Link from "next/link";

export default function EvaluationsPage() {
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

        <section className="grid gap-5 md:grid-cols-3">
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
