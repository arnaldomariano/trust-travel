"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { getInitials, getColorFromName } from "../lib/avatar";

export default function ProfilePage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [publicCode, setPublicCode] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // =========================
  // Load current profile
  // =========================
  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/profile/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to load profile:", res.status, errorText);
        return;
      }

      const data = await res.json();

      setUsername(data.username || "");
      setDisplayName(data.display_name || "");
      setCountryCode(data.country_code || "");
      setPublicCode(data.public_code || "");
      setAvatarUrl(data.avatar_url || null);
    } catch (error) {
      console.error("Profile fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // =========================
  // Handle local avatar preview
  // =========================
  const handleAvatarChange = (file: File | null) => {
    setAvatarFile(file);

    if (!file) {
      setAvatarPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  // =========================
  // Save profile changes
  // =========================
  const saveProfile = async () => {
    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("display_name", displayName);
      formData.append("country_code", countryCode);

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const res = await fetch(`${API_URL}/api/profile/`, {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert("Error saving profile");
        console.error(data);
        return;
      }

      setDisplayName(data.display_name || "");
      setCountryCode(data.country_code || "");
      setPublicCode(data.public_code || "");
      setAvatarUrl(data.avatar_url || null);
      setAvatarFile(null);
      setAvatarPreview(null);

      alert("Profile saved");
    } catch (error) {
      console.error("Profile save error:", error);
      alert("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={page}>
        <p>Loading profile...</p>
      </main>
    );
  }

  const avatarName = displayName || username;
  const visibleAvatarUrl = avatarPreview || avatarUrl;

  return (
    <main style={page}>
      <h1>Profile</h1>

      <section style={card}>
        {/* Avatar preview */}
        <div style={avatarBox}>
          <AvatarPreview name={avatarName} avatarUrl={visibleAvatarUrl} />

          <div style={avatarInfo}>
            <strong>{avatarName}</strong>
            <span style={hint}>{publicCode}</span>

            <label style={uploadButton}>
              Choose avatar
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleAvatarChange(e.target.files ? e.target.files[0] : null)
                }
                style={{ display: "none" }}
              />
            </label>

            {avatarFile && (
              <small style={hint}>Selected: {avatarFile.name}</small>
            )}
          </div>
        </div>

        <div style={field}>
          <label style={label}>Username</label>
          <input value={username} disabled style={inputDisabled} />
        </div>

        <div style={field}>
          <label style={label}>Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How trusted users will see you"
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>Country code</label>
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="BR, NL, US..."
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>Public code</label>
          <input value={publicCode} disabled style={inputDisabled} />
          <small style={hint}>
            Your public code is used by other users to send connection requests.
          </small>
        </div>

        <button onClick={saveProfile} disabled={saving} style={button}>
          {saving ? "Saving..." : "Save profile"}
        </button>
      </section>
    </main>
  );
}

/* =========================
   Components
========================= */

function AvatarPreview({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile avatar"
        style={{
          width: "86px",
          height: "86px",
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid #eee",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "86px",
        height: "86px",
        borderRadius: "50%",
        background: getColorFromName(name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "bold",
        fontSize: "24px",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

/* =========================
   Styles
========================= */

const page = {
  maxWidth: "700px",
  margin: "0 auto",
  padding: "40px",
};

const card = {
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "24px",
  background: "white",
  display: "flex",
  flexDirection: "column" as const,
  gap: "18px",
};

const avatarBox = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  paddingBottom: "18px",
  borderBottom: "1px solid #eee",
};

const avatarInfo = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "8px",
};

const field = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "6px",
};

const label = {
  fontSize: "14px",
  fontWeight: 600,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
};

const inputDisabled = {
  ...input,
  background: "#f5f5f5",
  color: "#666",
};

const hint = {
  color: "#666",
  fontSize: "12px",
};

const button = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const uploadButton = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
  width: "fit-content",
  fontSize: "14px",
};