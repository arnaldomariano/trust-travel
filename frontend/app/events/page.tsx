"use client";

import { useRouter } from "next/navigation";

export default function EventsPage() {
  const router = useRouter();

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>
      <h1>🎶 Events</h1>

        {/* NAV */}
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button
            onClick={() => router.push("/")}
            style={navButton}
          >
            ← Feed
          </button>

          <button
            onClick={() => router.push("/home")}
            style={navButton}
          >
            🗺 Mapa
          </button>
        </div>

      {/* BOTÃO CRIAR EVENTO */}
      <button
        onClick={() => router.push("/events/create")}
        style={{
          marginTop: "20px",
          padding: "10px 16px",
          borderRadius: "8px",
          background: "black",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        ➕ Criar evento
      </button>

      {/* LISTA (por enquanto vazia) */}
      <p style={{ marginTop: "20px", color: "#666" }}>
        Lista de eventos aparecerá aqui...
      </p>
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