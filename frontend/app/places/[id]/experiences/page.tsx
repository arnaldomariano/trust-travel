"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../../lib/api";

export default function ExperiencesPage() {
  const params = useParams();
  const id = params.id;
  const router = useRouter();

  const [experiences, setExperiences] = useState<any[]>([]);
  const [place, setPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [repliesByExperience, setRepliesByExperience] = useState<Record<number, any[]>>({});
  const [replyTextByExperience, setReplyTextByExperience] = useState<Record<number, string>>({});
  const [showReplyForm, setShowReplyForm] = useState<Record<number, boolean>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<number, boolean>>({});
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [lastVisit, setLastVisit] = useState<number>(0);
  const [showOtherReviews, setShowOtherReviews] = useState(false);

  const trustedReviewsCount = experiences.filter((e) => e.is_trusted).length;

  const recentActivities = experiences
    .filter((e) => new Date(e.created_at).getTime() > lastVisit)
    .slice(0, 3);

  const recentReplies = Object.entries(repliesByExperience)
    .flatMap(([experienceId, replies]) =>
      replies.map((reply: any) => ({
        ...reply,
        experienceId: Number(experienceId),
        type: "reply",
      }))
    )
    .filter((r: any) => new Date(r.created_at).getTime() > lastVisit);

  const combinedActivities = [
    ...recentActivities.map((e) => ({ ...e, type: "review" })),
    ...recentReplies,
  ]
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  const trustedActivities = combinedActivities.filter((item: any) => item.is_trusted);

  const sortedExperiences = [...experiences].sort((a, b) => {
    if (a.trust_level !== b.trust_level) {
      return a.trust_level - b.trust_level;
    }

    const aTrustedReplies =
      (repliesByExperience[a.id] || []).filter((r: any) => r.is_trusted).length;

    const bTrustedReplies =
      (repliesByExperience[b.id] || []).filter((r: any) => r.is_trusted).length;

    if (aTrustedReplies !== bTrustedReplies) {
      return bTrustedReplies - aTrustedReplies;
    }

    const aReplies = (repliesByExperience[a.id] || []).length;
    const bReplies = (repliesByExperience[b.id] || []).length;

    if (aReplies !== bReplies) {
      return bReplies - aReplies;
    }

    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  const trustedExperiences = sortedExperiences.filter(
    (e) => e.trust_level === 1 && e.user !== currentUsername
  );

  const networkExperiences = sortedExperiences.filter(
    (e) => e.trust_level === 2 && e.user !== currentUsername
  );

  const otherExperiences = sortedExperiences.filter(
    (e) => e.trust_level === 3 && e.user !== currentUsername
  );

  const getTrustedRepliesCount = (experienceId: number) =>
    (repliesByExperience[experienceId] || []).filter(
      (reply: any) => reply.is_trusted
    ).length;

  const getTrustedEngagementText = (experienceId: number) => {
    const count = (repliesByExperience[experienceId] || []).filter(
      (r: any) => r.is_trusted
    ).length;

    if (count === 0) return null;
    if (count === 1) return "⭐ 1 trusted person interacted here";
    return `⭐ ${count} trusted people interacted here`;
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} d ago`;

    return date.toLocaleDateString();
  };

  const getWhyExplanation = (e: any) => {
    if (e.trust_level === 1) return "⭐ From your direct connection";
    if (e.trust_level === 2) return "🌐 From your network";
    return null;
  };

  const getTrustLabel = (e: any) => {
      const trustedReplies = getTrustedRepliesCount(e.id);

      if (e.trust_level === 1 && trustedReplies >= 2) {
        return "🔥 Strong trusted signal";
      }

      if (e.trust_level === 1) {
        return "⭐ Trusted source";
      }

      if (e.trust_level === 2) {
        return "🌐 Indirect trust";
      }

      return null;
    };

  const getTrendingScore = (e: any) => {
    const replies = repliesByExperience[e.id] || [];
    const totalReplies = replies.length;
    const trustedReplies = replies.filter((r: any) => r.is_trusted).length;

    const hoursAgo =
      (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60);

    const recencyBoost = Math.max(0, 48 - hoursAgo);

    return (
      (4 - e.trust_level) * 10 +
      trustedReplies * 5 +
      totalReplies * 2 +
      recencyBoost
    );
  };

  const seenUsers = new Set<string>();

  const trendingExperiences = [...sortedExperiences]
    .filter((e) => e.user !== currentUsername)
    .map((e) => ({
      ...e,
      score: getTrendingScore(e),
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((e) => {
      if (seenUsers.has(e.user)) return false;
      seenUsers.add(e.user);
      return true;
    })
    .slice(0, 3);

  const trendingTrusted = [...experiences]
    .filter((e) => e.trust_level === 1 && e.user !== currentUsername)
    .map((e) => ({
      ...e,
      score: getTrendingScore(e),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const loadRepliesForExperiences = async (
    experiencesList: any[],
    token?: string | null
  ) => {
    const repliesEntries = await Promise.all(
      experiencesList.map(async (experience: any) => {
        try {
          let res = await fetch(
            `${API_URL}/api/experiences/${experience.id}/replies/`,
            {
              headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {},
            }
          );

          if (!res.ok) {
            res = await fetch(
              `${API_URL}/api/experiences/${experience.id}/replies/`
            );
          }

          const text = await res.text();

        try {
          const replies = JSON.parse(text);
          return [experience.id, Array.isArray(replies) ? replies : []];
        } catch {
          console.error("Invalid JSON:", text);
          return [experience.id, []];
        }
          return [experience.id, Array.isArray(replies) ? replies : []];
        } catch (error) {
          console.error(error);
          return [experience.id, []];
        }
      })
    );

    setRepliesByExperience(Object.fromEntries(repliesEntries));
  };

  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem("access");

    const loadCurrentUser = async () => {
      if (!token) {
        setCurrentUsername(null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/me/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          localStorage.removeItem("access");
          setCurrentUsername(null);
          return;
        }

        if (!res.ok) {
          const text = await res.text();
          console.error(text);
          return;
        }

        const data = await res.json();
        setCurrentUsername(data.username);
      } catch (err) {
        console.error("Error loading user:", err);
        setCurrentUsername(null);
      }
    };

    const loadExperiences = async () => {
      try {
        let res = await fetch(
          `${API_URL}/api/places/${id}/experiences/`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {},
          }
        );

        if (!res.ok) {
          res = await fetch(
            `${API_URL}/api/places/${id}/experiences/`
          );
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
          setExperiences([]);
          return;
        }

        setExperiences(data);
        await loadRepliesForExperiences(data, token);
      } catch (err) {
        console.error(err);
        setExperiences([]);
      }
    };

    const loadPlace = async () => {
      try {
        const res = await fetch(`${API_URL}/api/places/${id}/`);
        const data = await res.json();
        setPlace(data);

        const destRes = await fetch(`${API_URL}/api/destinations/`);
        const destinations = await destRes.json();

        const foundDestination = destinations.find(
          (d: any) => d.id === data.destination
        );

        setDestination(foundDestination);
      } catch (err) {
        console.error(err);
      }
    };

    loadCurrentUser();
    loadExperiences();
    loadPlace();
  }, [id]);

  useEffect(() => {
    const stored = localStorage.getItem("last_visit");
    if (stored) {
      setLastVisit(Number(stored));
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    localStorage.setItem("last_visit", String(now));
  }, []);

  const handleReplySubmit = async (experienceId: number) => {
    const token = localStorage.getItem("access");
    const replyText = replyTextByExperience[experienceId]?.trim();

    if (!token) {
      alert("You need to be logged in to reply.");
      return;
    }

    if (!replyText) {
      alert("Please write a reply before sending.");
      return;
    }

    setSubmittingReply((prev) => ({ ...prev, [experienceId]: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/experiences/${experienceId}/replies/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comment: replyText,
          }),
        }
      );

      if (!response.ok) {
          const text = await response.text();
          console.error("Backend error:", text);
          alert("Error sending reply");
          return;
        }

const newReply = await response.json();

      setRepliesByExperience((prev) => ({
        ...prev,
        [experienceId]: [...(prev[experienceId] || []), newReply],
      }));

      setReplyTextByExperience((prev) => ({
        ...prev,
        [experienceId]: "",
      }));

      setShowReplyForm((prev) => ({
        ...prev,
        [experienceId]: false,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setSubmittingReply((prev) => ({
        ...prev,
        [experienceId]: false,
      }));
    }
  };

  return (
    <main style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Experiences about {place?.name}</h1>

      {trendingExperiences.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            marginBottom: "30px",
            padding: "16px",
            borderRadius: "12px",
            background: "#fff7e6",
            border: "1px solid #ffe3b3",
          }}
        >
          {trendingTrusted.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                marginBottom: "20px",
                padding: "14px",
                borderRadius: "12px",
                background: "#eef6ff",
                border: "1px solid #cce3ff",
              }}
            >
              <div style={{ fontWeight: "600", marginBottom: "8px" }}>
                ⭐ Trending from trusted people
              </div>

              {trendingTrusted.map((e) => (
                <div key={e.id} style={{ marginBottom: "10px" }}>
                  <strong>{e.user}</strong> • {(e.title || e.comment).slice(0, 60)}...

                  <div style={{ fontSize: "12px", color: "#666" }}>
                    ⭐ {getTrustedRepliesCount(e.id)} trusted interactions
                  </div>

                  <div style={{ fontSize: "12px", color: "#999" }}>
                    {getWhyExplanation(e)}
                  </div>

                  {getTrustLabel(e) && (
                    <div style={{ fontSize: "12px", color: "#444" }}>
                      {getTrustLabel(e)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontWeight: "600", marginBottom: "10px" }}>
            🔥 Trending in your network
          </div>

          {trendingExperiences.map((e) => (
            <div key={e.id} style={{ marginBottom: "10px" }}>
              <strong>{e.user}</strong> • {(e.title || e.comment).slice(0, 60)}...

              <div style={{ fontSize: "12px", color: "#666" }}>
                ⭐ {getTrustedRepliesCount(e.id)} trusted interactions
              </div>

              <div style={{ fontSize: "12px", color: "#999" }}>
                {getWhyExplanation(e)}
              </div>

              {getTrustLabel(e) && (
                <div style={{ fontSize: "12px", color: "#444" }}>
                  {getTrustLabel(e)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {currentUsername && (
        <div style={{ fontSize: "13px", color: "#666", marginTop: "6px" }}>
          Viewing as <strong>{currentUsername}</strong>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          marginBottom: "24px",
          padding: "16px",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          backgroundColor: "#fafafa",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>
          Trusted activity
        </div>

        <div style={{ fontSize: "14px", color: "#666", lineHeight: 1.6 }}>
          {trustedActivities.length > 0 ? (
            <>
              <div style={{ marginBottom: "8px" }}>
                New activity from your network
              </div>

              {trustedActivities.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/places/${id}/experiences`)}
                  style={{ cursor: "pointer" }}
                >
                  <strong>{item.user}</strong>{" "}
                  {item.type === "review"
                    ? "commented on"
                    : "replied to a review on"}{" "}
                  <strong>{place?.name}</strong>
                  {destination?.name && (
                    <>
                      {" "}
                      • <strong>{destination.name}</strong>
                    </>
                  )}{" "}
                  • {timeAgo(item.created_at)}
                </div>
              ))}
            </>
          ) : (
            <div>No recent activity yet.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        {trustedExperiences.length > 0 && (
          <>
            <div style={{ fontWeight: "600", marginBottom: "10px" }}>
              Trusted reviews
            </div>

            <div style={{ display: "grid", gap: "20px" }}>
              {trustedExperiences.map((e) => {
                const isNew = new Date(e.created_at).getTime() > lastVisit;
                const isHot =
                  e.trust_level === 1 &&
                  getTrustedRepliesCount(e.id) >= 1;

                return (
                  <div
                    key={e.id}
                    style={{
                      padding: "4px 0",
                      border: isHot ? "2px solid #0070f3" : "1px solid #e5f2ff",
                      borderRadius: "10px",
                      background: isHot
                        ? "#eaf4ff"
                        : isNew
                        ? "#f0f8ff"
                        : "#f8fbff",
                      boxShadow: isHot
                        ? "0 0 0 2px rgba(0,112,243,0.1)"
                        : "none",
                    }}
                  >
                    {e.rating && (
                      <div style={{ color: "#f5b50a" }}>
                        {"★".repeat(e.rating)}
                        {"☆".repeat(5 - e.rating)}
                      </div>
                    )}

                    {e.title && (
                      <div
                        style={{
                          marginTop: "10px",
                          fontWeight: 600,
                          lineHeight: 1.5,
                        }}
                      >
                        {e.title}
                      </div>
                    )}

                    {e.image_url && (

                      <img
                        src={e.image_url}
                        alt={e.title || "Shared experience"}
                        style={{
                          width: "100%",
                          maxHeight: "260px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          marginTop: "10px",
                          marginBottom: "10px",
                          border: "1px solid #eee",

                        }}
                      />
                    )}

                    <div
                      style={{
                        marginTop: e.title ? "6px" : "10px",
                        lineHeight: 1.5,
                      }}
                    >
                      {e.comment}
                    </div>

                    <div style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>
                      — {e.user} • {timeAgo(e.created_at)}

                      {getTrustedEngagementText(e.id) && (
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                          {getTrustedEngagementText(e.id)}
                        </div>
                      )}

                      {getWhyExplanation(e) && (
                        <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                          {getWhyExplanation(e)}
                        </div>
                      )}

                    <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>

                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: "#0070f3",
                          color: "white",
                          fontWeight: "600",
                        }}
                      >
                        Trusted
                      </span>

                      <button
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                          background: "#f9f9f9",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setShowReplyForm((prev) => ({
                            ...prev,
                            [e.id]: true,
                          }))
                        }
                      >
                        Reply
                      </button>

                      {/* 🔥 NOVO BOTÃO */}
                      <button
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                          background: "#f0f0f0",
                          cursor: "pointer",
                        }}
                      >
                        Save for later
                      </button>

                        <Link
                          href={`/experiences/${e.id}`}
                          style={{
                            marginTop: "10px",
                            fontSize: "12px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #ddd",
                            background: "#f9f9f9",
                            color: "#111",
                            textDecoration: "none",
                            display: "inline-block",
                          }}
                        >
                          Open experience
                        </Link>




                      {isHot && (
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: "#ef4444",
                            color: "white",
                            fontWeight: "600",
                          }}
                        >
                          🔥 Hot
                        </span>
                      )}

                    </div>

                      {showReplyForm[e.id] && (
                        <div style={{ marginTop: "10px" }}>
                          <textarea
                            value={replyTextByExperience[e.id] || ""}
                            onChange={(ev) =>
                              setReplyTextByExperience((prev) => ({
                                ...prev,
                                [e.id]: ev.target.value,
                              }))
                            }
                            placeholder="Write a reply..."
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "6px",
                              border: "1px solid #ddd",
                            }}
                          />

                          <button
                            style={{
                              marginTop: "6px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: "#0070f3",
                              color: "white",
                              border: "none",
                            }}
                            onClick={() => handleReplySubmit(e.id)}
                          >
                            Send
                          </button>
                        </div>
                      )}

                      {(repliesByExperience[e.id] || []).length > 0 && (
                        <div
                          style={{
                            marginTop: "12px",
                            paddingLeft: "10px",
                            borderLeft: "2px solid #eee",
                          }}
                        >
                          {(repliesByExperience[e.id] || []).map((r: any) => (
                            <div
                              key={r.id}
                              style={{
                                marginBottom: "10px",
                                padding: "10px",
                                borderRadius: "8px",
                                background: "#f9fafb",
                                border: "1px solid #eee",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: "#ddd",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {r.user?.[0]?.toUpperCase()}
                                </div>

                                <div style={{ fontSize: "13px" }}>
                                  <strong>{r.user}</strong> • {timeAgo(r.created_at)}
                                </div>
                              </div>

                              <div
                                style={{
                                  marginTop: "6px",
                                  fontSize: "14px",
                                  fontStyle: "italic",
                                  color: "#333",
                                }}
                              >
                                “{r.comment || r.text}”
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {networkExperiences.length > 0 && (
          <>
            <div style={{ fontWeight: "600", marginTop: "30px", marginBottom: "10px" }}>
              From your network
            </div>

            <div style={{ display: "grid", gap: "20px" }}>
              {networkExperiences.map((e) => {
                const isNew = new Date(e.created_at).getTime() > lastVisit;

                return (
                  <div
                    key={e.id}
                    style={{
                      padding: "4px 0",
                      border: "1px solid #fff3cd",
                      borderRadius: "10px",
                      background: isNew ? "#fff9e6" : "#fffdf5",
                    }}
                  >
                    {e.rating && (
                      <div style={{ color: "#f5b50a" }}>
                        {"★".repeat(e.rating)}
                        {"☆".repeat(5 - e.rating)}
                      </div>
                    )}

                    {e.title && (
                          <div
                            style={{
                              marginTop: "10px",
                              fontWeight: 600,
                              lineHeight: 1.5,
                            }}
                          >
                            {e.title}
                          </div>
                        )}

                        {e.image_url && (
                          <img
                            src={e.image_url}
                            alt={e.title || "Shared experience"}
                            style={{
                              width: "100%",
                              maxHeight: "260px",
                              objectFit: "cover",
                              borderRadius: "12px",
                              marginTop: "10px",
                              marginBottom: "10px",
                              border: "1px solid #eee",
                            }}
                          />
                        )}

                        <div
                          style={{
                            marginTop: e.title ? "6px" : "10px",
                            lineHeight: 1.5,
                          }}
                        >
                          {e.comment}
                        </div>

                    <div style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>
                      — {e.user} • {timeAgo(e.created_at)}

                      <span
                        style={{
                          marginLeft: "6px",
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: "#eab308",
                          color: "white",
                          fontWeight: "600",
                        }}
                      >
                        Network
                      </span>
                    </div>

                    <div style={{ marginTop: "10px" }}>
                      <Link
                        href={`/experiences/${e.id}`}
                        style={{
                          fontSize: "12px",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                          background: "#f9f9f9",
                          color: "#111",
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        Open experience
                      </Link>
                    </div>

                  </div>
                );
              })}
            </div>
          </>
        )}

        {otherExperiences.length > 0 && (
          <>
            {!showOtherReviews && (
              <div style={{ marginTop: "30px" }}>
                <button
                  onClick={() => setShowOtherReviews(true)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    background: "#f9f9f9",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Show other reviews ({otherExperiences.length})
                </button>
              </div>
            )}

            {showOtherReviews && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "30px",
                  }}
                >
                  <div style={{ fontWeight: "600" }}>Other reviews</div>

                  <button
                    onClick={() => setShowOtherReviews(false)}
                    style={{
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                      background: "#f5f5f5",
                      cursor: "pointer",
                    }}
                  >
                    Hide
                  </button>
                </div>

                <div style={{ display: "grid", gap: "20px" }}>
                  {otherExperiences.map((e) => {
                    const isNew = new Date(e.created_at).getTime() > lastVisit;

                    return (
                      <div
                        key={e.id}
                        style={{
                          padding: "4px 0",
                          border: "1px solid #eee",
                          borderRadius: "10px",
                          background: isNew ? "#f8fbff" : "white",
                        }}
                      >
                        {e.rating && (
                          <div style={{ color: "#f5b50a" }}>
                            {"★".repeat(e.rating)}
                            {"☆".repeat(5 - e.rating)}
                          </div>
                        )}

                        {e.title && (
                          <div
                            style={{
                              marginTop: "10px",
                              fontWeight: 600,
                              lineHeight: 1.5,
                            }}
                          >
                            {e.title}
                          </div>
                        )}

                        {e.image_url && (
                          <img
                            src={e.image_url}
                            alt={e.title || "Shared experience"}
                            style={{
                              width: "100%",
                              maxHeight: "260px",
                              objectFit: "cover",
                              borderRadius: "12px",
                              marginTop: "10px",
                              marginBottom: "10px",
                              border: "1px solid #eee",
                            }}
                          />
                        )}

                        <div
                          style={{
                            marginTop: e.title ? "6px" : "10px",
                            lineHeight: 1.5,
                          }}
                        >
                          {e.comment}
                        </div>

                        <div style={{ marginTop: "10px", fontSize: "13px", color: "#777" }}>
                          — {e.user} • {timeAgo(e.created_at)}
                        </div>

                        <div style={{ marginTop: "10px" }}>
                          <Link
                            href={`/experiences/${e.id}`}
                            style={{
                              fontSize: "12px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              border: "1px solid #ddd",
                              background: "#f9f9f9",
                              color: "#111",
                              textDecoration: "none",
                              display: "inline-block",
                            }}
                          >
                            Open experience
                          </Link>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
