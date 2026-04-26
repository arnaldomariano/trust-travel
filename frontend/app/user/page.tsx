"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function UserPage() {
  const params = useParams();
  const router = useRouter();

  const username = params.username as string;

  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // =========================
  // 🔥 LOAD USER UPDATES
  // =========================
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/updates/", {
          credentials: "include",
        });

        const data = await res.json();

        const all = [
          ...(data.network || []),
          ...(data.others || []),
        ];

        // 🔥 filtra só esse usuário
        const filtered = all.filter(
          (item: any) => item.username === username
        );

        setUpdates(filtered);
      } catch (err) {
        console.error("Failed to load user data", err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [username]);

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
      <button onClick={() => router.back()} style={{ marginBottom: "20px" }}>
        ← Back
      </button>

      <h1>User: {username}</h1>

      <div style={{ marginTop: "30px" }}>
        {updates.length === 0 ? (
          <p>No activity yet.</p>
        ) : (
          updates.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "12px",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}
              onClick={() => router.push(`/places/${item.place_id}`)}
            >
              <strong>{item.type}</strong> — {item.place}
              <div style={{ fontSize: "12px", color: "#666" }}>
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}