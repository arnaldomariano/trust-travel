"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { API_URL } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  // 🔐 Auth context
  const { refreshUser, isLoggedIn, loading: authLoading } = useAuth();

  // 🧠 Local state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================
  // 🔁 Redirect if already logged in
  // =========================
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      router.push("/");
    }
  }, [authLoading, isLoggedIn]);

  // =========================
  // 🔐 Handle login
  // =========================
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/api/token/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        });

        if (!response.ok) {
          throw new Error("Login inválido");
        }

        // 🔥 IMPORTANTE: espera o cookie ser aplicado
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 🔥 Atualiza estado do usuário
        const ok = await refreshUser();

        if (ok) {
          router.push(next || "/");
          router.refresh();
        } else {
          setError("Erro ao carregar usuário");
        }

      } catch (err) {
        setError("Usuário ou senha inválidos");
      } finally {
        setLoading(false);
      }
    };

  // =========================
  // 🧱 Render
  // =========================
  return (
    <main style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}>
      <h1>Login</h1>

      <form
        onSubmit={handleLogin}
        style={{ display: "grid", gap: "12px", marginTop: "20px" }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            backgroundColor: "#111",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {error && (
          <div style={{ color: "red", fontSize: "14px" }}>{error}</div>
        )}

        <button
          type="button"
          onClick={() => router.push("/recover-password")}
          style={{
            border: "none",
            background: "transparent",
            color: "#111",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "14px",
            padding: "4px",
          }}
        >
          Forgot password?
        </button>

      </form>
    </main>
  );
}