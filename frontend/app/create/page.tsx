"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";

export default function CreatePage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const [place, setPlace] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState("experience");

  useEffect(() => {
    const t = localStorage.getItem("access");
    setToken(t);
    setReady(true);
  }, []);

    if (!ready) return null;

    if (!token) {
      router.push("/login");
      return null;
    }

    const handleCreate = async () => {
      const token = localStorage.getItem("access");

      if (!token) {
        alert("Not authenticated");
        return;
      }

    const res = await fetch("http://localhost:8000/api/updates/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        place,
        text,
        type,
        category: "general",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail);
      return;
    }

    // 🔥 volta pro feed
    router.push("/");
  };

  return (
    <main style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Create Post</h1>

      <input
        placeholder="Place ID"
        value={place}
        onChange={(e) => setPlace(e.target.value)}
      />

      <textarea
        placeholder="Write something..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="experience">experience</option>
        <option value="alert">alert</option>
        <option value="event">event</option>
        <option value="info">info</option>
      </select>

      <button onClick={handleCreate}>Post</button>
    </main>
  );
}