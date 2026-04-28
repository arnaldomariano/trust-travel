"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL } from "../../lib/api";
export default function CreateEventPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    place: "",
    text: "",
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const token = localStorage.getItem("access");

    try {
      const res = await fetch(`${API_URL}/api/updates/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "event",
          category: "social",
          place: 1, // temporário
          text: form.text,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("API ERROR:", error);
        return;
      }

      alert("Evento criado!");

      router.push("/"); // volta pro feed

    } catch (err) {
      console.error("Erro:", err);
    }
  };

  return (
    <main style={{ maxWidth: "600px", margin: "0 auto", padding: "40px" }}>
      <h1>➕ Criar evento</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>

        {/* LOCAL */}
        <div style={{ marginBottom: "15px" }}>
          <label>📍 Local</label>
          <input
            type="text"
            value={form.place}
            onChange={(e) =>
              setForm({ ...form, place: e.target.value })
            }
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "5px",
            }}
            required
          />
        </div>

        {/* DESCRIÇÃO */}
        <div style={{ marginBottom: "15px" }}>
          <label>📝 Descrição</label>
          <textarea
            value={form.text}
            onChange={(e) =>
              setForm({ ...form, text: e.target.value })
            }
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "5px",
            }}
            required
          />
        </div>

        {/* BOTÃO */}
        <button
          type="submit"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "black",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          🚀 Publicar evento
        </button>
      </form>
    </main>
  );
}
