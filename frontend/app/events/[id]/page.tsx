"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { labels } from "../../lib/labels";

import { API_URL } from "../../lib/api";
export default function EventPage() {

  const t = labels.en;
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [event, setEvent] = useState<any>(null);

  const participants = [
      { name: "João", status: "going" },
      { name: "Maria", status: "interested" },
      { name: "Carlos", status: "going" },
    ];

  useEffect(() => {
    const token = localStorage.getItem("access");

    if (!token) {
      router.push("/login");
      return;
    }

    fetch(`${API_URL}/api/updates/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar evento");
        return res.json();
      })
      .then((data) => {
        const all = [...(data.network || []), ...(data.others || [])];
        const found = all.find((item: any) => String(item.id) === String(id));
        setEvent(found || null);
      })
      .catch((err) => {
        console.error("Erro ao carregar evento:", err);
      });
  }, [id, router]);

  if (!event) {
    return (
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>
        <h1>🎶 Event</h1>
        <p style={{ color: "#666", marginTop: "20px" }}>Carregando evento...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>
      {/* topo */}
        <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            {"←"} Feed
          </button>

          <button
            onClick={() => router.push("/events")}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            🎶 Eventos
          </button>
        </div>

      {/* cabeçalho do evento */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: "16px",
          padding: "24px",
          background: "#fafafa",
        }}
      >
        <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
          🎶 Event
        </div>

        <h1 style={{ margin: 0 }}>
          {event.text?.slice(0, 60) || "Evento"}
        </h1>

        <div style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
          <div>
            <strong>📍 {t.location}:</strong>
          </div>

          <div>
            <strong>🕒 {t.publishedAt}:</strong>
            {new Date(event.created_at).toLocaleString()}
          </div>

          <div>
            <strong>👤 {t.createdBy}:</strong>
          </div>
        </div>
      </div>

      {/* descrição */}
      <div
        style={{
          marginTop: "20px",
          border: "1px solid #eee",
          borderRadius: "16px",
          padding: "24px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Sobre o evento</h2>
        <p style={{ lineHeight: 1.6 }}>
          {event.text}
        </p>
      </div>

      {/* ações */}
      <div
        style={{
          marginTop: "20px",
          border: "1px solid #eee",
          borderRadius: "16px",
          padding: "24px",
        }}
      >
              {/* 👥 PARTICIPANTES */}
        <div
          style={{
            marginTop: "20px",
            border: "1px solid #eee",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Quem está indo</h2>

          <div style={{ display: "grid", gap: "8px" }}>
            {participants
              .filter((p) => p.status === "going")
              .map((p, i) => (
                <div key={i}>✅ {p.name}</div>
              ))}
          </div>

          <h3 style={{ marginTop: "16px" }}>Interessados</h3>

          <div style={{ display: "grid", gap: "8px" }}>
            {participants
              .filter((p) => p.status === "interested")
              .map((p, i) => (
                <div key={i}>❤️ {p.name}</div>
              ))}
          </div>
        </div>

        <h2 style={{ marginTop: 0 }}>Ações</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              window.location.href = `/home?lat=41.9028&lng=12.4964`;
            }}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            🗺 Ver no mapa
          </button>

          <button
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: "black",
              color: "white",
              cursor: "pointer",
            }}
          >
            ❤️ Tenho interesse
          </button>

          <button
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            ✅ Vou
          </button>
        </div>
      </div>
    </main>
  );
}
const navButton = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};
