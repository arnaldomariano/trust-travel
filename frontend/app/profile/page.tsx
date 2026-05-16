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
  const [nationality, setNationality] = useState("");
  const [showNationality, setShowNationality] = useState(false);

  const [countryOfBirth, setCountryOfBirth] = useState("");
  const [countryOfResidence, setCountryOfResidence] = useState("");
  const [ageRange, setAgeRange] = useState("prefer_not_to_say");


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
      setNationality(data.nationality || "");
      setShowNationality(Boolean(data.show_nationality));

      setCountryOfBirth(data.country_of_birth || "");
      setCountryOfResidence(data.country_of_residence || "");
      setAgeRange(data.age_range || "prefer_not_to_say");

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

      formData.append("nationality", nationality);
      formData.append("show_nationality", String(showNationality));

      formData.append("country_of_birth", countryOfBirth);
      formData.append("country_of_residence", countryOfResidence);
      formData.append("age_range", ageRange);

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

      setNationality(data.nationality || "");
      setShowNationality(Boolean(data.show_nationality));

      setCountryOfBirth(data.country_of_birth || "");
      setCountryOfResidence(data.country_of_residence || "");
      setAgeRange(data.age_range || "prefer_not_to_say");


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
      <section style={heroCard}>
        <div style={eyebrow}>Identity and trust</div>

        <h1 style={{ marginTop: 0, marginBottom: "10px" }}>Profile</h1>

        <p style={heroText}>
          Manage how you appear in Trust Travel. Your public code protects your
          identity outside your trusted network. Travel profile fields are optional
          and intended for future aggregated analytics.
        </p>
      </section>

      <section style={card}>
        <div>
          <div style={eyebrow}>Public identity</div>

          <h2 style={sectionTitle}>How people identify you</h2>

          <p style={sectionText}>
            People outside your trusted network see your public code. Trusted
            connections may see your display name and avatar.
          </p>
        </div>

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
          <small style={hint}>
            This is shown mainly to trusted connections, not to everyone.
          </small>
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
          <small style={hint}>
            Used to generate or contextualize your public code.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Public code</label>
          <input value={publicCode} disabled style={inputDisabled} />
          <small style={hint}>
            Other users can use this code to send you a connection request.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Nationality / country of origin</label>
          <input
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="Optional, e.g. Brazilian, Dutch, Italian..."
            style={input}
          />
        </div>

        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={showNationality}
            onChange={(e) => setShowNationality(e.target.checked)}
          />

          <span>
            Allow my nationality to appear in trusted identity contexts.
          </span>
        </label>
      </section>

      <section style={card}>
        <div>
          <div style={eyebrow}>Travel profile for analytics</div>

          <h2 style={sectionTitle}>Optional context</h2>

          <p style={sectionText}>
            These fields are not meant to be displayed on public cards. They can
            later help generate aggregated insights, such as recommendations by country of residence, country of birth or age range,
            residence, age range or travel style.
          </p>
        </div>

        <div style={fieldGrid}>
          <div style={field}>
            <label style={label}>Country of birth</label>
            <input
              value={countryOfBirth}
              onChange={(e) => setCountryOfBirth(e.target.value)}
              placeholder="Optional"
              style={input}
            />
          </div>

          <div style={field}>
            <label style={label}>Country of residence</label>
            <input
              value={countryOfResidence}
              onChange={(e) => setCountryOfResidence(e.target.value)}
              placeholder="Optional"
              style={input}
            />
          </div>
        </div>

        <div style={field}>
          <label style={label}>Age range</label>
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            style={input}
          >
            <option value="prefer_not_to_say">Prefer not to say</option>
            <option value="18_24">18–24</option>
            <option value="25_34">25–34</option>
            <option value="35_44">35–44</option>
            <option value="45_54">45–54</option>
            <option value="55_64">55–64</option>
            <option value="65_plus">65+</option>
          </select>
        </div>


        <div style={privacyNote}>
          <strong>Privacy note</strong>
          <p style={{ margin: "6px 0 0 0", color: "#666", lineHeight: 1.5 }}>
            These fields should be used for aggregated analytics, not to expose
            personal details individually in public cards.
          </p>
        </div>
      </section>

      <button onClick={saveProfile} disabled={saving} style={button}>
        {saving ? "Saving..." : "Save profile"}
      </button>
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
  maxWidth: "780px",
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

const heroCard = {
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "24px",
  background: "white",
  marginBottom: "22px",
};

const eyebrow = {
  fontSize: "13px",
  color: "#777",
  marginBottom: "6px",
};

const heroText = {
  color: "#666",
  lineHeight: 1.5,
  margin: 0,
};

const sectionTitle = {
  marginTop: 0,
  marginBottom: "8px",
};

const sectionText = {
  margin: 0,
  color: "#666",
  lineHeight: 1.5,
};

const checkboxRow = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#555",
  fontSize: "14px",
};

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const privacyNote = {
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "#fafafa",
};