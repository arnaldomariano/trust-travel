"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL } from "../lib/api";

export default function RecoverPasswordPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }

    if (!recoveryCode.trim()) {
      setError("Please enter your recovery code.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/recover-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          recovery_code: recoveryCode.trim(),
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Could not reset password.");
        return;
      }

      setSuccessMessage(
        data.detail ||
          "Password updated successfully. You can now log in with your new password."
      );

      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={page}>
      <section style={card}>
        <div>
          <div style={eyebrow}>Account recovery</div>

          <h1 style={title}>Recover password</h1>

          <p style={introText}>
            Enter your username and the private recovery code you received when
            creating your account. Later, Trust Travel will also support account
            recovery through trusted contacts.
          </p>
        </div>

        {successMessage ? (
          <div style={successBox}>
            <strong>Password updated</strong>

            <p style={{ margin: "8px 0 0 0", lineHeight: 1.5 }}>
              {successMessage}
            </p>

            <button
              type="button"
              onClick={() => router.push("/login")}
              style={{ ...primaryButton, marginTop: "14px" }}
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRecoverPassword} style={form}>
            <div style={field}>
              <label style={label}>Username</label>

              <input
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={input}
              />
            </div>

            <div style={field}>
              <label style={label}>Recovery code</label>

              <input
                type="text"
                placeholder="TT-XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                required
                style={input}
              />

              <small style={hint}>
                This is the private code shown once after creating your account.
              </small>
            </div>

            <div style={field}>
              <label style={label}>New password</label>

              <input
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={input}
              />
            </div>

            <div style={field}>
              <label style={label}>Confirm new password</label>

              <input
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={input}
              />
            </div>

            {error && <div style={errorBox}>{error}</div>}

            <button type="submit" disabled={loading} style={primaryButton}>
              {loading ? "Updating password..." : "Update password"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/login")}
              style={secondaryButton}
            >
              Back to login
            </button>
          </form>
        )}

        <div style={trustNote}>
          <strong>Trust Travel recovery model</strong>

          <p style={{ margin: "6px 0 0 0", lineHeight: 1.5 }}>
            Invite at least two trusted contacts after logging in. In the future,
            trusted contacts may help you recover access without relying on email.
          </p>
        </div>
      </section>
    </main>
  );
}

const page = {
  padding: "40px",
  maxWidth: "460px",
  margin: "auto",
};

const card = {
  display: "grid",
  gap: "18px",
  padding: "28px",
  borderRadius: "18px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
};

const eyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
  marginBottom: "6px",
};

const title = {
  margin: 0,
};

const introText = {
  color: "#666",
  lineHeight: 1.5,
  marginBottom: 0,
};

const form = {
  display: "grid",
  gap: "14px",
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
  padding: "12px",
  border: "1px solid #ddd",
  borderRadius: "8px",
};

const hint = {
  color: "#666",
  fontSize: "12px",
  lineHeight: 1.4,
};

const primaryButton = {
  padding: "12px",
  backgroundColor: "#111",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButton = {
  padding: "12px",
  backgroundColor: "white",
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 700,
};

const errorBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
  fontSize: "14px",
};

const successBox = {
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
};

const trustNote = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#666",
  fontSize: "13px",
};
