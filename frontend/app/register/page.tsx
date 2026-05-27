"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL } from "../lib/api";

const COUNTRY_OPTIONS = [
  { code: "", label: "Select your country / nationality", flag: "" },
  { code: "BR", label: "Brazil", flag: "🇧🇷" },
  { code: "PT", label: "Portugal", flag: "🇵🇹" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "MX", label: "Mexico", flag: "🇲🇽" },
  { code: "CL", label: "Chile", flag: "🇨🇱" },
  { code: "AR", label: "Argentina", flag: "🇦🇷" },
  { code: "GR", label: "Greece", flag: "🇬🇷" },
  { code: "TH", label: "Thailand", flag: "🇹🇭" },
  { code: "LA", label: "Laos", flag: "🇱🇦" },
  { code: "BO", label: "Bolivia", flag: "🇧🇴" },
];

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRY_OPTIONS.find(
    (country) => country.code === countryCode
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      alert("Please choose a username.");
      return;
    }

    if (!countryCode) {
      alert("Please choose your country / nationality.");
      return;
    }

    if (!password) {
      alert("Please choose a password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={page}>
      <form onSubmit={handleRegister} style={formCard}>
        <div>
          <div style={eyebrow}>Join Trust Travel</div>
          <h1 style={title}>Create account</h1>

          <p style={introText}>
            Choose your country or nationality now so Trust Travel can generate
            your public code correctly. Showing your flag on travel cards remains
            optional and can be changed later in your profile.
          </p>
        </div>

        <div style={field}>
          <label style={label}>Username</label>
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>Country of birth / Nationality</label>

          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            required
            style={input}
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code || "empty"} value={country.code}>
                {country.flag ? `${country.flag} ${country.label}` : country.label}
              </option>
            ))}
          </select>

          {selectedCountry && selectedCountry.code ? (
            <small style={countryPreview}>
              {selectedCountry.flag} {selectedCountry.label} will be used to
              create your public code, for example {selectedCountry.code}7x2a.
            </small>
          ) : (
            <small style={hint}>
              This helps Trust Travel generate a country-based public code.
            </small>
          )}
        </div>

        <div style={field}>
          <label style={label}>Email optional</label>
          <input
            type="email"
            placeholder="Optional"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <small style={hint}>
            Trust Travel does not require email for the core identity model.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Password</label>
          <input
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={input}
          />
        </div>

        <button type="submit" disabled={loading} style={button}>
          {loading ? "Creating..." : "Create account"}
        </button>

        <div style={loginText}>
          Already have an account?{" "}
          <a href="/login" style={loginLink}>
            Sign in
          </a>
        </div>
      </form>
    </main>
  );
}

const page = {
  display: "flex",
  justifyContent: "center",
  marginTop: "80px",
  fontFamily: "sans-serif",
};

const formCard = {
  display: "grid",
  gap: "16px",
  width: "380px",
  padding: "30px",
  border: "1px solid #eee",
  borderRadius: "16px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  backgroundColor: "white",
};

const eyebrow = {
  fontSize: "13px",
  color: "#777",
  marginBottom: "6px",
};

const title = {
  margin: 0,
};

const introText = {
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
  marginBottom: 0,
};

const field = {
  display: "grid",
  gap: "6px",
};

const label = {
  fontSize: "14px",
  fontWeight: 600,
};

const input = {
  padding: "10px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  background: "white",
};

const hint = {
  color: "#666",
  fontSize: "12px",
  lineHeight: 1.4,
};

const countryPreview = {
  color: "#166534",
  fontSize: "12px",
  lineHeight: 1.4,
  padding: "8px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
};

const button = {
  padding: "10px",
  backgroundColor: "#111",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};

const loginText = {
  fontSize: "14px",
  color: "#666",
  textAlign: "center" as const,
};

const loginLink = {
  color: "#111",
};