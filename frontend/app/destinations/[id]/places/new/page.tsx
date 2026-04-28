"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../../../lib/api";

export default function NewPlacePage() {
  const params = useParams();
  const router = useRouter();
  const destinationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!destinationId) return;

    if (!name.trim()) {
      alert("Please enter a place name.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/places/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination: Number(destinationId),
          name: name.trim(),
          city: city.trim(),
          image_url: imageUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Create place error:", data);
        alert(data.detail || "Error creating place.");
        return;
      }

      router.push(`/places/${data.id}`);
    } catch (error) {
      console.error("Create place failed:", error);
      alert("Error creating place.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: "680px", margin: "0 auto", padding: "40px" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          Home
        </Link>{" "}
        /{" "}
        <Link
          href="/destinations"
          style={{ color: "#666", textDecoration: "none" }}
        >
          Destinations
        </Link>{" "}
        / <span>Create place</span>
      </div>

      <h1>Create a new place</h1>

        <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "24px" }}>
          Add a place that is not listed yet. This step only creates the place.
          You can share your personal experience and rating after creating it.
        </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "24px",
          border: "1px solid #eee",
          borderRadius: "16px",
          background: "white",
        }}
      >

        <label style={field}>
          <span style={label}>City</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Example: Rome"
            style={input}
          />
        </label>

        <label style={field}>
          <span style={label}>Short description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this place?"
            rows={4}
            style={{ ...input, resize: "vertical" }}
          />
        </label>

        <label style={field}>
          <span style={label}>Image URL (optional for now)</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Optional image URL — photo upload will come later"
            style={input}
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            background: "black",
            color: "white",
            cursor: submitting || !name.trim() ? "not-allowed" : "pointer",
            opacity: submitting || !name.trim() ? 0.5 : 1,
            alignSelf: "flex-start",
          }}
        >
          {submitting ? "Creating..." : "Create place"}
        </button>
      </form>
    </main>
  );
}

const field = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "6px",
};

const label = {
  fontSize: "14px",
  fontWeight: 600,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};