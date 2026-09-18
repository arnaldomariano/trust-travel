"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../lib/api";

type ProfessionalLink = {
  id: number;
  link_type: string;
  label: string;
  url: string;
};

type BusinessRelationship = {
  id: number;
  business_presence: number;
  business_name: string;
  place_name: string;
  relationship_type: string;
  disclosure_text: string;
  started_at: string | null;
  declared_by: string;
};

type ProfessionalProfile = {
  public_code: string;
  display_name: string;
  professional_name: string;
  professional_type: string;
  bio: string;
  official_links: ProfessionalLink[];
  business_relationships: BusinessRelationship[];
};

type EvaluationSummary = {
  professional_name: string;
  evaluations_count: number;
  knowledge_average: number | null;
  reliability_average: number | null;
  usefulness_average: number | null;
  transparency_average: number | null;
};

type BusinessDisclosure = {
  relationship_type: string;
  disclosure_text: string;
  started_at: string | null;
  ended_at: string | null;
  is_current: boolean;
  business_name: string;
};

type ProfessionalContribution = {
  id: number;
  professional_name: string;
  place: number;
  place_name: string;
  contribution_type: string;
  title: string;
  text: string;
  business_disclosure: BusinessDisclosure | null;
  evaluations_count: number;
  knowledge_average: number | null;
  reliability_average: number | null;
  usefulness_average: number | null;
  transparency_average: number | null;
  created_at: string;
  updated_at: string;
};

const formatProfessionalType = (value: string) => {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const pluralize = (
  count: number,
  singular: string,
  plural: string
) => {
  return `${count} ${count === 1 ? singular : plural}`;
};

export default function ProfessionalPublicPage() {
  const params = useParams();

  const publicCode = Array.isArray(params.publicCode)
    ? params.publicCode[0]
    : params.publicCode;

  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [contributions, setContributions] = useState<
    ProfessionalContribution[]
  >([]);

  const [feedMuted, setFeedMuted] = useState(false);
  const [feedMuteLoaded, setFeedMuteLoaded] = useState(false);
  const [feedMuteSaving, setFeedMuteSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfessionalPage = async () => {
      if (!publicCode) return;

      setLoading(true);
      setError("");
      setFeedMuteLoaded(false);

      try {
        const [
          profileResponse,
          summaryResponse,
          contributionsResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/api/professional-presences/${publicCode}/`
          ),
          fetch(
            `${API_URL}/api/professional-presences/${publicCode}/evaluation-summary/`
          ),
          fetch(
            `${API_URL}/api/professional-presences/${publicCode}/contributions/`
          ),
        ]);

        if (
          !profileResponse.ok ||
          !summaryResponse.ok ||
          !contributionsResponse.ok
        ) {
          setError("Professional profile could not be loaded.");
          return;
        }

        const [
          profileData,
          summaryData,
          contributionsData,
        ] = await Promise.all([
          profileResponse.json(),
          summaryResponse.json(),
          contributionsResponse.json(),
        ]);

        setProfile(profileData);
        setSummary(summaryData);
        setContributions(contributionsData);

        try {
          const feedMuteResponse = await fetch(
            `${API_URL}/api/professional-presences/${publicCode}/feed-mute/`,
            {
              credentials: "include",
            }
          );

          if (feedMuteResponse.ok) {
            const feedMuteData = await feedMuteResponse.json();

            setFeedMuted(Boolean(feedMuteData.muted));
            setFeedMuteLoaded(true);
          }
        } catch (feedMuteError) {
          console.error(
            "Professional feed mute state load error:",
            feedMuteError
          );
        }

      } catch (loadError) {
        console.error(
          "Professional profile load error:",
          loadError
        );

        setError("Professional profile could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadProfessionalPage();
  }, [publicCode]);

  const handleFeedMuteToggle = async () => {
    if (!publicCode || !feedMuteLoaded || feedMuteSaving) {
      return;
    }

    setFeedMuteSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/api/professional-presences/${publicCode}/feed-mute/`,
        {
          method: feedMuted ? "DELETE" : "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        console.error(
          "Professional feed mute update failed:",
          response.status
        );
        return;
      }

      const data = await response.json();

      setFeedMuted(Boolean(data.muted));
    } catch (feedMuteError) {
      console.error(
        "Professional feed mute update error:",
        feedMuteError
      );
    } finally {
      setFeedMuteSaving(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          color: "#666",
          fontSize: "14px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#666",
            textDecoration: "none",
          }}
        >
          Home
        </Link>{" "}
        / <span>Professional profile</span>
      </div>

      {loading ? (
        <p style={{ color: "#666" }}>
          Loading professional profile...
        </p>
      ) : error ? (
        <p style={{ color: "#b42318" }}>
          {error}
        </p>
      ) : !profile ? (
        <p style={{ color: "#666" }}>
          Professional profile not found.
        </p>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "20px",
            }}
          >
            <div>
              <h1 style={{ marginTop: 0 }}>
                {profile.professional_name}
              </h1>

              <p style={{ color: "#666" }}>
                {formatProfessionalType(profile.professional_type)}
              </p>
            </div>

            {feedMuteLoaded && (
              <button
                type="button"
                onClick={handleFeedMuteToggle}
                disabled={feedMuteSaving}
                style={{
                  padding: "9px 14px",
                  border: "1px solid #d0d5dd",
                  borderRadius: "10px",
                  background: "#fff",
                  color: "#344054",
                  cursor: feedMuteSaving
                    ? "default"
                    : "pointer",
                  opacity: feedMuteSaving ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {feedMuteSaving
                  ? "Saving..."
                  : feedMuted
                    ? "Show in feed"
                    : "Hide from feed"}
              </button>
            )}
          </div>

          {profile.bio && (
            <p
              style={{
                lineHeight: 1.6,
                marginTop: "18px",
              }}
            >
              {profile.bio}
            </p>
          )}

          <section
            style={{
              marginTop: "30px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "14px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                }}
              >
                How this professional is evaluated
              </h2>

              <span
                style={{
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                {pluralize(
                  summary?.evaluations_count ?? 0,
                  "contextual evaluation",
                  "contextual evaluations"
                )}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                ["Knowledge", summary?.knowledge_average],
                ["Reliability", summary?.reliability_average],
                ["Usefulness", summary?.usefulness_average],
                ["Transparency", summary?.transparency_average],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    padding: "16px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "14px",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      color: "#666",
                      fontSize: "13px",
                      marginBottom: "8px",
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                    }}
                  >
                    {typeof value === "number"
                      ? value.toFixed(1)
                      : "—"}
                  </div>

                  <div
                    style={{
                      color: "#999",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    out of 5
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              marginTop: "34px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "14px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                }}
              >
                Professional contributions
              </h2>

              <span
                style={{
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                {pluralize(
                  contributions.length,
                  "contribution",
                  "contributions"
                )}
              </span>
            </div>

            {contributions.length === 0 ? (
              <div
                style={{
                  padding: "18px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  background: "#fff",
                  color: "#666",
                }}
              >
                No professional contributions yet.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "16px",
                }}
              >
                {contributions.map((contribution) => (
                  <article
                    key={contribution.id}
                    style={{
                      padding: "20px",
                      border: "1px solid #e5e5e5",
                      borderRadius: "16px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        alignItems: "flex-start",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#777",
                            fontSize: "13px",
                            textTransform: "capitalize",
                            marginBottom: "6px",
                          }}
                        >
                          {contribution.contribution_type}
                        </div>

                        <h3
                          style={{
                            margin: 0,
                            fontSize: "18px",
                          }}
                        >
                          {contribution.title}
                        </h3>
                      </div>

                      <span
                        style={{
                          color: "#666",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pluralize(
                          contribution.evaluations_count,
                          "evaluation",
                          "evaluations"
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "#666",
                        fontSize: "14px",
                        marginBottom: "12px",
                      }}
                    >
                      {contribution.place_name}
                    </div>

                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {contribution.text}
                    </p>

                    {contribution.business_disclosure && (
                      <div
                        style={{
                          marginTop: "16px",
                          padding: "12px 14px",
                          borderRadius: "12px",
                          background: "#f7f7f7",
                          fontSize: "13px",
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>Commercial disclosure:</strong>{" "}
                        {contribution.business_disclosure.business_name} ·{" "}
                        {contribution.business_disclosure.relationship_type}
                        {contribution.business_disclosure.disclosure_text
                          ? ` · ${contribution.business_disclosure.disclosure_text}`
                          : ""}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "10px",
                        marginTop: "16px",
                      }}
                    >
                      {[
                        ["Knowledge", contribution.knowledge_average],
                        ["Reliability", contribution.reliability_average],
                        ["Usefulness", contribution.usefulness_average],
                        ["Transparency", contribution.transparency_average],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          style={{
                            padding: "10px 12px",
                            border: "1px solid #eee",
                            borderRadius: "10px",
                          }}
                        >
                          <div
                            style={{
                              color: "#777",
                              fontSize: "12px",
                              marginBottom: "4px",
                            }}
                          >
                            {label}
                          </div>

                          <div
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {typeof value === "number"
                              ? value.toFixed(1)
                              : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}