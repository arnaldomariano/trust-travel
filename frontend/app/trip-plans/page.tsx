"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../lib/api";

type TripPlan = {
  id: number;
  title: string;
  destination_text: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  saved_count: number;
  created_at: string;
  updated_at: string;
};

export default function TripPlansPage() {
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const createPlan = async () => {
    if (!title.trim()) {
      alert("Please add a title for your trip plan.");
      return;
    }

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
          destination_text: destinationText.trim(),
          description: description.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Create trip plan error:", data);
        alert(data.detail || "Error creating trip plan.");
        return;
      }

      setPlans((prev) => [data, ...prev]);

      setTitle("");
      setDestinationText("");
      setDescription("");
      setStartDate("");
      setEndDate("");
    } catch (error) {
      console.error("Failed to create trip plan:", error);
      alert("Error creating trip plan.");
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

      <section style={formCard}>
        <div>
          <strong>Create a new trip plan</strong>
          <p style={helperText}>
            Start with a destination or idea. You can add experiences to this plan later.
          </p>
        </div>

        <div style={field}>
          <label style={fieldLabel}>Plan title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Thailand 2027, Weekend in Amsterdam..."
            style={input}
          />
        </div>

        <div style={field}>
          <label style={fieldLabel}>Destination or theme</label>
          <input
            value={destinationText}
            onChange={(e) => setDestinationText(e.target.value)}
            placeholder="e.g. Thailand, Rome, beaches, restaurants..."
            style={input}
          />
        </div>

        <div style={twoColumns}>
          <div style={field}>
            <label style={fieldLabel}>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={field}>
            <label style={fieldLabel}>End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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

        <button
          type="button"
          onClick={createPlan}
          disabled={creating || !title.trim()}
          style={{
            ...primaryButton,
            opacity: creating || !title.trim() ? 0.5 : 1,
            cursor: creating || !title.trim() ? "not-allowed" : "pointer",
          }}
        >
          {creating ? "Creating..." : "Create trip plan"}
        </button>
      </section>

      <section style={listSection}>
        <h2 style={sectionTitle}>Your plans</h2>

        {plans.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>You do not have any trip plans yet.</p>
            <p style={helperText}>
              Create your first plan, then add experiences from place pages.
            </p>
          </div>
        ) : (
          <div style={list}>
            {plans.map((plan) => (
              <article key={plan.id} style={planCard}>
                <div>
                  <div style={label}>Trip plan</div>

                  <h3 style={planTitle}>{plan.title}</h3>

                  {plan.destination_text && (
                    <p style={destinationTextStyle}>{plan.destination_text}</p>
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