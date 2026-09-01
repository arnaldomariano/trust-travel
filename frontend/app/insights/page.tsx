import Link from "next/link";

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-8">
        <Link
          href="/"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to home
        </Link>

        <section className="mt-6">
          <p className="text-sm uppercase tracking-[0.25em] text-sky-400">
            Trust Travel Insights
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Understand places and travel signals
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
            Explore how travelers are evaluating places and what people are
            saving while planning their trips. These views offer different,
            complementary signals across Trust Travel.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <Link
            href="/evaluations"
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg transition hover:border-sky-500/60 hover:bg-slate-900"
          >
            <div className="text-3xl">⭐</div>

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
              Place perception
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Evaluations & Ratings
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              See how travelers are evaluating countries, cities, hotels,
              restaurants, attractions and other places through overall and
              practical ratings.
            </p>

            <div className="mt-6 text-sm font-semibold text-sky-400 transition group-hover:text-sky-300">
              Explore evaluations →
            </div>
          </Link>

          <Link
            href="/analytics"
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg transition hover:border-sky-500/60 hover:bg-slate-900"
          >
            <div className="text-3xl">📊</div>

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
              Planning behavior
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Planning Analytics
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Explore what people are saving to trip plans, which destinations
              are attracting attention and how planning signals differ across
              the Trust Travel community.
            </p>

            <div className="mt-6 text-sm font-semibold text-sky-400 transition group-hover:text-sky-300">
              Explore planning analytics →
            </div>
          </Link>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-sm leading-6 text-slate-400">
            Evaluations describe how places are being experienced. Planning
            analytics show where interest and travel intentions are forming.
            Together, they provide complementary signals rather than a single
            score.
          </p>
        </section>
      </div>
    </main>
  );
}