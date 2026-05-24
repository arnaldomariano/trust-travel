"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { getInitials, getColorFromName } from "../lib/avatar";

const COUNTRY_OPTIONS = [
  { code: "", label: "Select a country", flag: "" },
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

const getCountryOption = (code: string) => {
  return COUNTRY_OPTIONS.find((country) => country.code === code) || null;
};

const getCountryByLabel = (label: string) => {
  return COUNTRY_OPTIONS.find((country) => country.label === label) || null;
};

export default function ProfilePage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [publicCode, setPublicCode] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [nationality, setNationality] = useState("");
  const [nationalityCountryCode, setNationalityCountryCode] = useState("");
  const [showNationality, setShowNationality] = useState(false);

  const [countryOfBirth, setCountryOfBirth] = useState("");
  const [countryOfResidence, setCountryOfResidence] = useState("");
  const [residenceMode, setResidenceMode] = useState<"same" | "other">("same");

  const [profession, setProfession] = useState("");
  const [travelInterests, setTravelInterests] = useState("");
  const [showProfileContext, setShowProfileContext] = useState(false);

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
      setCountryCode(data.country_code && data.country_code !== "XX" ? data.country_code : "");
      setPublicCode(data.public_code || "");
      setAvatarUrl(data.avatar_url || null);
      setNationality(data.nationality || "");
      setNationalityCountryCode(
          data.nationality_country_code && data.nationality_country_code !== "XX"
            ? data.nationality_country_code
            : ""
      );
      setShowNationality(Boolean(data.show_nationality));

      const birthCountry = data.country_of_birth || "";
      const residenceCountry = data.country_of_residence || "";

      setCountryOfBirth(birthCountry);
      setCountryOfResidence(residenceCountry);

      if (birthCountry && residenceCountry && birthCountry !== residenceCountry) {
          setResidenceMode("other");
      } else {
          setResidenceMode("same");
      }

      setProfession(data.profession || "");
      setTravelInterests(data.travel_interests || "");
      setShowProfileContext(Boolean(data.show_profile_context));

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

    const handleCountryChange = (value: string) => {
      setCountryCode(value);

      const selectedCountry = getCountryOption(value);

      if (selectedCountry && selectedCountry.code) {
        setCountryOfBirth(selectedCountry.label);

        if (!nationalityCountryCode || nationalityCountryCode === "XX") {
          setNationalityCountryCode(selectedCountry.code);
        }

        if (!nationality) {
          setNationality(selectedCountry.label);
        }
      }
    };

    const handleNationalityChange = (value: string) => {
      setCountryCode(value);
      setNationalityCountryCode(value);

      const selectedCountry = getCountryOption(value);

      if (selectedCountry && selectedCountry.code) {
        setNationality(selectedCountry.label);
        setCountryOfBirth(selectedCountry.label);

        if (residenceMode === "same") {
          setCountryOfResidence(selectedCountry.label);
        }
      } else {
        setNationality("");
        setCountryOfBirth("");
      }
    };

  // =========================
  // Save profile changes
  // =========================
  const saveProfile = async () => {
    setSaving(true);

    try {
      const formData = new FormData();

      const selectedNationalityCountry = getCountryOption(countryCode);
      const nationalityLabel = selectedNationalityCountry?.label || "";
      const residenceCountry =
        residenceMode === "same" ? nationalityLabel : countryOfResidence;

      formData.append("display_name", displayName);
      formData.append("country_code", countryCode || "");

      formData.append("nationality", nationalityLabel);
      formData.append("nationality_country_code", countryCode || "");
      formData.append("show_nationality", String(showNationality));

      formData.append("country_of_birth", nationalityLabel);
      formData.append("country_of_residence", residenceCountry);

      formData.append("profession", profession.trim());
      formData.append("travel_interests", travelInterests.trim());
      formData.append("show_profile_context", String(showProfileContext));

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
      setCountryCode(data.country_code && data.country_code !== "XX" ? data.country_code : "");
      setPublicCode(data.public_code || "");
      setAvatarUrl(data.avatar_url || null);
      setAvatarFile(null);
      setAvatarPreview(null);

      setNationality(data.nationality || "");
      setNationalityCountryCode(
          data.nationality_country_code && data.nationality_country_code !== "XX"
            ? data.nationality_country_code
            : ""
      );
      setShowNationality(Boolean(data.show_nationality));

      setCountryOfBirth(data.country_of_birth || "");
      setCountryOfResidence(data.country_of_residence || "");

      setProfession(data.profession || "");
      setTravelInterests(data.travel_interests || "");
      setShowProfileContext(Boolean(data.show_profile_context));

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
  const selectedNationalityCountry = getCountryOption(countryCode);

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

        {!countryCode && (
          <div style={profileWarning}>
            <strong>Complete your country/nationality</strong>
            <p style={{ margin: "6px 0 0 0", color: "#7a4b00", lineHeight: 1.5 }}>
              Choose your country of birth or nationality to improve travel analytics
              and help other travelers understand your perspective. Showing your flag on
              travel cards remains optional.
            </p>
          </div>
        )}

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
          <label style={label}>Country of birth / Nationality</label>

          <select
            value={countryCode}
            onChange={(e) => handleNationalityChange(e.target.value)}
            style={input}
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code || "empty"} value={country.code}>
                {country.flag ? `${country.flag} ${country.label}` : country.label}
              </option>
            ))}
          </select>

          {selectedNationalityCountry && selectedNationalityCountry.code ? (
            <small style={countryPreview}>
              {selectedNationalityCountry.flag} {selectedNationalityCountry.label} will
              be used in aggregated planner analytics.
            </small>
          ) : (
            <small style={hint}>
              Choose the country that represents your nationality or country of birth.
            </small>
          )}
        </div>

        <div style={field}>
          <label style={label}>Public code</label>
          <input value={publicCode} disabled style={inputDisabled} />
          <small style={hint}>
            Other users can use this code to send you a connection request.
          </small>
        </div>

        <div style={field}>
          <label style={checkboxRow}>
            <input
              type="checkbox"
              checked={showNationality}
              onChange={(e) => setShowNationality(e.target.checked)}
            />

            <span>
              Show my country/nationality flag on travel cards.
            </span>
          </label>

          <small style={hint}>
            If enabled, other travelers may see your public code with your country flag,
            for example {publicCode || "BR757zn50"} 🇧🇷. Your real identity remains
            protected.
          </small>
        </div>
      </section>

      <section style={card}>
        <div>
          <div style={eyebrow}>Travel profile for analytics</div>

          <h2 style={sectionTitle}>Optional context</h2>

          <p style={sectionText}>
              These optional fields help Trust Travel generate aggregated insights, such as
              how travelers from different countries plan trips. They are not used to reveal
              your real identity.
          </p>
        </div>

        <div style={field}>
          <label style={label}>Country where you live</label>

          <div style={radioGroup}>
            <label style={radioRow}>
              <input
                type="radio"
                checked={residenceMode === "same"}
                onChange={() => {
                  setResidenceMode("same");

                  const selectedCountry = getCountryOption(countryCode);
                  setCountryOfResidence(selectedCountry?.label || "");
                }}
              />
              Same as nationality
            </label>

            <label style={radioRow}>
              <input
                type="radio"
                checked={residenceMode === "other"}
                onChange={() => setResidenceMode("other")}
              />
              Other country
            </label>
          </div>

          {residenceMode === "other" && (
            <select
              value={countryOfResidence}
              onChange={(e) => setCountryOfResidence(e.target.value)}
              style={input}
            >
              <option value="">Select country of residence</option>

              {COUNTRY_OPTIONS.filter((country) => country.code).map((country) => (
                <option key={country.code} value={country.label}>
                  {country.flag} {country.label}
                </option>
              ))}
            </select>
          )}

          <small style={hint}>
            This helps future aggregated insights compare nationality and country of
            residence.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Profession / occupation</label>
          <input
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            placeholder="Optional, e.g. doctor, lawyer, teacher, engineer..."
            style={input}
          />
          <small style={hint}>
            This can help future insights compare travel decisions by professional
            context.
          </small>
        </div>

        <div style={field}>
          <label style={label}>Travel interests / identity</label>
          <input
            value={travelInterests}
            onChange={(e) => setTravelInterests(e.target.value)}
            placeholder="Optional, e.g. surfer, art lover, hiker, foodie..."
            style={input}
          />
          <small style={hint}>
            Add a few words that describe how you travel or what you usually look for.
          </small>
        </div>

        <div style={field}>
          <label style={checkboxRow}>
            <input
              type="checkbox"
              checked={showProfileContext}
              onChange={(e) => setShowProfileContext(e.target.checked)}
            />

            <span>
              Show my profession/interests as travel context.
            </span>
          </label>

          <small style={hint}>
            Optional. This may help other travelers understand your perspective, while
            your public identity remains protected.
          </small>
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
            Aggregated analytics may use your profile context, but your real identity is not
            shown individually. Public travel cards use your public code, with your country
            flag only if you allow it.
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

const countryPreview = {
  color: "#166534",
  fontSize: "12px",
  padding: "8px 10px",
  borderRadius: "10px",
  background: "#f2fbf5",
  border: "1px solid #d7f0df",
};

const radioGroup = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap" as const,
};

const radioRow = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#555",
  fontSize: "14px",
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

const profileWarning = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#7a4b00",
  marginBottom: "18px",
};