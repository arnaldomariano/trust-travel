"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL } from "../lib/api";

type CountryCatalogItem = {
  code: string;
  canonical_name: string;
  aliases: string[];
};

const countryCodeToFlag = (code: string) => {
  if (code.length !== 2) return "";

  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((character) => 127397 + character.charCodeAt(0))
  );
};

export default function RegisterPage() {
  const router = useRouter();

const [username, setUsername] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [countryCode, setCountryCode] = useState("");
const [countryCatalog, setCountryCatalog] = useState<CountryCatalogItem[]>([]);
const [countryCatalogLoading, setCountryCatalogLoading] = useState(true);
const [loading, setLoading] = useState(false);
const [formError, setFormError] = useState("");

const [registrationResult, setRegistrationResult] = useState<{
  username: string;
  recovery_code?: string;
} | null>(null);
const selectedCountry = countryCatalog.find(
    (country) => country.code === countryCode
  );

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch(`${API_URL}/api/countries/`);

        if (!response.ok) {
          console.error("Failed to load country catalog");
          return;
        }

        const data = await response.json();
        setCountryCatalog(data.results || []);
      } catch (error) {
        console.error("Country catalog load error:", error);
      } finally {
        setCountryCatalogLoading(false);
      }
    };

    loadCountries();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setFormError("Please choose a username.");
      return;
    }

    const usernamePattern = /^[A-Za-z0-9@.+\-_]+$/;

    if (!usernamePattern.test(username.trim())) {
      setFormError(
        "Username can only contain letters, numbers, and these symbols: @ . + - _"
      );
      return;
    }

    if (!countryCode) {
      setFormError("Please choose your country / nationality.");
      return;
    }

   if (!password) {
      setFormError("Please choose a password.");
      return;
    }

    setFormError("");
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
          setFormError("Registration failed. Please check your details and try again.");
          setLoading(false);
          return;
      }

      const data = await response.json();

    setRegistrationResult({
      username: data.username || username.trim(),
      recovery_code: data.recovery_code,
    });
    } catch (error) {
      console.error(error);
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

    if (registrationResult) {
      return (
        <main style={page}>
          <section style={formCard}>
            <div>
              <div style={eyebrow}>Account created</div>

              <h1 style={title}>Welcome to Trust Travel</h1>

              <p style={introText}>
                Your account was created successfully. Trust Travel is built around
                trusted connections. Invite at least two people you really trust —
                they can help make your travel network stronger and may also help
                you recover your account in the future.
              </p>
            </div>

            {registrationResult.recovery_code && (
              <div style={recoveryCodeBox}>
                <strong>Save this private recovery code</strong>

                <div style={recoveryCodeValue}>
                  {registrationResult.recovery_code}
                </div>

                <p style={recoveryCodeText}>
                  Keep this code in a safe place. It is shown only once. Do not
                  share it publicly.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push("/login")}
              style={button}
            >
              Continue to login
            </button>
          </section>
        </main>
      );
    }

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
              placeholder="Username, e.g. maria_silva"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setFormError("");
              }}
              style={input}
          />

          <small style={hint}>
            Use only letters, numbers, and @ . + - _. No spaces or accents.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Country of birth / Nationality</label>

          <select
              value={countryCode}
              disabled={countryCatalogLoading}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setFormError("");
              }}
              style={input}
          >
            <option value="">
              {countryCatalogLoading
                ? "Loading countries..."
                : "Select your country / nationality"}
            </option>

            {countryCatalog.map((country) => (
              <option key={country.code} value={country.code}>
                {countryCodeToFlag(country.code)} {country.canonical_name}
              </option>
            ))}
          </select>

          {selectedCountry ? (
            <small style={countryPreview}>
              {countryCodeToFlag(selectedCountry.code)}{" "}
              {selectedCountry.canonical_name} will be used to create your
              public code, for example {selectedCountry.code}7x2a.
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
            onChange={(e) => {
              setEmail(e.target.value);
              setFormError("");
            }}
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
              onChange={(e) => {
                setPassword(e.target.value);
                setFormError("");
              }}
              style={input}
          />
        </div>

        {formError && (
          <div style={formErrorBox}>
            {formError}
          </div>
        )}

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

const recoveryCodeBox = {
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  display: "grid",
  gap: "10px",
};

const recoveryCodeValue = {
  padding: "12px",
  borderRadius: "10px",
  background: "white",
  border: "1px dashed #8fd19e",
  color: "#111",
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "1px",
  textAlign: "center" as const,
};

const recoveryCodeText = {
  margin: 0,
  color: "#555",
  fontSize: "13px",
  lineHeight: 1.5,
};

const formErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
};