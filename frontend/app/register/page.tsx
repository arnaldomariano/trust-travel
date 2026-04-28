"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL } from "../lib/api";
export default function RegisterPage() {
  const router = useRouter();

const [username, setUsername] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [countryCode, setCountryCode] = useState("");
const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          country_code: countryCode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(errorText);
        alert("Registration failed");
        setLoading(false);
        return;
      }

      alert("Account created successfully");

      router.push("/login");
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: "80px",
        fontFamily: "sans-serif",
      }}
    >
      <form
        onSubmit={handleRegister}
        style={{
          display: "grid",
          gap: "14px",
          width: "340px",
          padding: "30px",
          border: "1px solid #eee",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          backgroundColor: "white",
        }}
      >
        <h1 style={{ margin: 0 }}>Create account</h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        />

        <input
          type="text"
          placeholder="Country code (e.g. IT, ES, BR, NL)"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          required
          maxLength={2}
          style={{
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#111",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <div style={{ fontSize: "14px", color: "#666", textAlign: "center" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#111" }}>
            Sign in
          </a>
        </div>
      </form>
    </main>
  );
}
