"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../../../lib/api";
import { countryCodeToFlagEmoji } from "../../../lib/flags";

type TripPlan = {
  id: number;
  title: string;
  destination_text: string;
  saved_count: number;
};

export default function ExperiencesPage() {

  // =====================
  // Route / navigation
  // =====================

  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedExperienceId = searchParams.get("highlight");

  // =====================
  // Core page state
  // =====================

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

  // =====================
  // Trip plan inline picker state
  // =====================

  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedPlanByExperience, setSelectedPlanByExperience] = useState<Record<number, string>>({});
  const [showTripPlanPicker, setShowTripPlanPicker] = useState<Record<number, boolean>>({});
  const [addingToPlan, setAddingToPlan] = useState<Record<number, boolean>>({});

  const [showCreatePlanByExperience, setShowCreatePlanByExperience] = useState<Record<number, boolean>>({});
  const [newPlanTitleByExperience, setNewPlanTitleByExperience] = useState<Record<number, string>>({});
  const [newPlanDestinationByExperience, setNewPlanDestinationByExperience] = useState<Record<number, string>>({});
  const [creatingPlanByExperience, setCreatingPlanByExperience] = useState<Record<number, boolean>>({});
  const [tripPlanErrorByExperience, setTripPlanErrorByExperience] = useState<Record<number, string>>({});

  const [tripPlanMessageByExperience, setTripPlanMessageByExperience] = useState<
      Record<number, { text: string; planId: number | null }>
    >({});

  // =====================
  // Report / moderation state
  // =====================

  const [showReportFormByExperience, setShowReportFormByExperience] = useState<Record<number, boolean>>({});
  const [reportReasonByExperience, setReportReasonByExperience] = useState<Record<number, string>>({});
  const [reportCommentByExperience, setReportCommentByExperience] = useState<Record<number, string>>({});
  const [submittingReportByExperience, setSubmittingReportByExperience] = useState<Record<number, boolean>>({});
  const [reportMessageByExperience, setReportMessageByExperience] = useState<Record<number, string>>({});
  const [reportErrorByExperience, setReportErrorByExperience] = useState<Record<number, string>>({});

  // =====================
  // Derived page metrics
  // =====================

  const trustedReviewsCount = experiences.filter((e) => e.is_trusted).length;

  const totalExperiences = experiences.length;

  const ratedExperiences = experiences.filter((e) => e.rating);

  const averageRating =
   ratedExperiences.length > 0
    ? (
        ratedExperiences.reduce((sum, e) => sum + e.rating, 0) /
        ratedExperiences.length
      ).toFixed(1)
    : null;

  const recentExperiencesCount = experiences.filter((e) => {
    const createdAt = new Date(e.created_at).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return createdAt >= sevenDaysAgo;
}).length;

const pageTitle =
  place?.place_type === "country" || place?.place_type === "city"
    ? `Experiences in ${place?.name || "this place"}`
    : `Experiences about ${place?.name || "this place"}`;

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

  const highlightedExperience = highlightedExperienceId
  ? sortedExperiences.find(
      (e) => String(e.id) === String(highlightedExperienceId)
    )
  : null;

  const trustedExperiences = sortedExperiences.filter(
  (e) =>
    e.trust_level === 1 &&
    e.user !== currentUsername &&
    (!highlightedExperience || e.id !== highlightedExperience.id)
);

const networkExperiences = sortedExperiences.filter(
  (e) =>
    e.trust_level === 2 &&
    e.user !== currentUsername &&
    (!highlightedExperience || e.id !== highlightedExperience.id)
);

const otherExperiences = sortedExperiences.filter(
  (e) =>
    e.trust_level === 3 &&
    e.user !== currentUsername &&
    (!highlightedExperience || e.id !== highlightedExperience.id)
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

  const getAuthorLabel = (experience: any) => {
  const flag = countryCodeToFlagEmoji(
    experience.author_nationality_country_code
  );

  if (!flag) {
    return experience.user;
  }

  return `${experience.user} ${flag}`;
};

    const formatTripValue = (value?: string) => {
      const labels: Record<string, string> = {
        prefer_not_to_say: "Prefer not to say",
        solo: "Solo traveler",
        couple: "Couple",
        family_children: "Family with children",
        friends_group: "Friends / group",
        business: "Business traveler",
        local_resident: "Local resident",
        retired: "Retired traveler",
        culture_museums: "Culture and museums",
        nature_outdoors: "Nature and outdoors",
        food_restaurants: "Food and restaurants",
        relaxed: "Relaxed travel",
        budget: "Budget travel",
        comfort: "Comfort travel",
        adventure: "Adventure",
        local_life: "Local life",
      };

      if (!value || value === "prefer_not_to_say") return "";

      return labels[value] || value;
    };

    const renderTripMeta = (experience: any) => {
      const contextLabel = formatTripValue(experience.trip_context);
      const styleLabel = formatTripValue(experience.trip_style);

      if (!contextLabel && !styleLabel) return null;

      return (
        <div style={tripMetaRow}>
          {contextLabel && (
            <span style={tripMetaBadge}>
              Context: {contextLabel}
            </span>
          )}

          {styleLabel && (
            <span style={tripMetaBadge}>
              Style: {styleLabel}
            </span>
          )}
        </div>
      );
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

  // =====================
  // Data loading helpers
  // =====================

  const loadRepliesForExperiences = async (
      experiencesList: any[]
        ) => {

        const repliesEntries = await Promise.all(
          experiencesList.map(async (experience: any) => {
            try {
              const res = await fetch(
      `${API_URL}/api/experiences/${experience.id}/replies/`,
      {
        credentials: "include",
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load replies:", res.status, text);
      return [experience.id, []];
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

    const loadTripPlans = async () => {
      try {
        const res = await fetch(`${API_URL}/api/trip-plans/`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to load trip plans:", res.status, text);
          setTripPlans([]);
          return;
        }

        const data = await res.json();
        setTripPlans(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Trip plans fetch error:", error);
        setTripPlans([]);
      }
    };

 // =====================
  // Initial data loading
  // =====================

  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem("access");
const loadCurrentUser = async () => {
  try {
    const res = await fetch(`${API_URL}/api/me/`, {
      credentials: "include",
    });

    if (!res.ok) {
      setCurrentUsername(null);
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
    const res = await fetch(`${API_URL}/api/places/${id}/experiences/`, {
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load experiences:", res.status, text);
      setExperiences([]);
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      setExperiences([]);
      return;
    }

    setExperiences(data);
    await loadRepliesForExperiences(data);
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
loadTripPlans();
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

  // =====================
  // Reply actions
  // =====================

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

  // =====================
  // Trip plan actions
  // =====================

const getCreateTripPlanUrl = (experienceId: number) => {
  return `/trip-plans?returnTo=${encodeURIComponent(
    `/places/${id}/experiences?highlight=${experienceId}`
  )}`;
};

const addExperienceToTripPlan = async (experienceId: number) => {
  const selectedPlanId = selectedPlanByExperience[experienceId];

  if (!selectedPlanId) {
    alert("Please choose a trip plan first.");
    return;
  }

  setAddingToPlan((prev) => ({
    ...prev,
    [experienceId]: true,
  }));

  try {
    const res = await fetch(
      `${API_URL}/api/trip-plans/${selectedPlanId}/experiences/${experienceId}/`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Add to trip plan error:", data);
      alert(data.detail || "Error adding experience to trip plan.");
      return;
    }

    const selectedPlan = tripPlans.find(
      (plan) => String(plan.id) === String(selectedPlanId)
    );

    setTripPlanMessageByExperience((prev) => ({
      ...prev,
      [experienceId]: {
        text: selectedPlan
          ? `Experience added to ${selectedPlan.title}.`
          : "Experience added to your trip plan.",
        planId: selectedPlan ? selectedPlan.id : null,
      },
    }));

    setShowTripPlanPicker((prev) => ({
      ...prev,
      [experienceId]: false,
    }));


  } catch (error) {
    console.error("Failed to add experience to trip plan:", error);
    alert("Error adding experience to trip plan.");
  } finally {
    setAddingToPlan((prev) => ({
      ...prev,
      [experienceId]: false,
    }));
  }
};

const createTripPlanAndAddExperience = async (experience: any) => {
  const experienceId = experience?.id;

  if (!experienceId) {
    setTripPlanErrorByExperience((prev) => ({
      ...prev,
      0: "Experience not loaded yet.",
    }));
    return;
  }

  const title = (newPlanTitleByExperience[experienceId] || "").trim();

  const destinationText =
    (newPlanDestinationByExperience[experienceId] || "").trim() ||
    experience.destination_name ||
    experience.place_name ||
    place?.name ||
    "";

  if (!title) {
    setTripPlanErrorByExperience((prev) => ({
      ...prev,
      [experienceId]: "Please give your trip plan a title.",
    }));
    return;
  }

  setCreatingPlanByExperience((prev) => ({
    ...prev,
    [experienceId]: true,
  }));

  setTripPlanErrorByExperience((prev) => ({
    ...prev,
    [experienceId]: "",
  }));

  try {
    const createRes = await fetch(`${API_URL}/api/trip-plans/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        destination_text: destinationText,
      }),
    });

    const createdPlan = await createRes.json();

    if (!createRes.ok) {
      console.error("Create trip plan error:", createdPlan);

      setTripPlanErrorByExperience((prev) => ({
        ...prev,
        [experienceId]: createdPlan.detail || "Could not create trip plan.",
      }));

      return;
    }

    const addRes = await fetch(
      `${API_URL}/api/trip-plans/${createdPlan.id}/experiences/${experienceId}/`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const addData = await addRes.json();

    if (!addRes.ok) {
      console.error("Add to new trip plan error:", addData);

      setTripPlanErrorByExperience((prev) => ({
        ...prev,
        [experienceId]:
          addData.detail ||
          "Trip plan was created, but the experience was not added.",
      }));

      return;
    }

    setTripPlans((prev) => [createdPlan, ...prev]);

    setSelectedPlanByExperience((prev) => ({
      ...prev,
      [experienceId]: String(createdPlan.id),
    }));

    setTripPlanMessageByExperience((prev) => ({
      ...prev,
      [experienceId]: {
        text: `Experience added to ${createdPlan.title}.`,
        planId: createdPlan.id,
      },
    }));

    setNewPlanTitleByExperience((prev) => ({
      ...prev,
      [experienceId]: "",
    }));

    setNewPlanDestinationByExperience((prev) => ({
      ...prev,
      [experienceId]: "",
    }));

    setShowCreatePlanByExperience((prev) => ({
      ...prev,
      [experienceId]: false,
    }));

    setShowTripPlanPicker((prev) => ({
      ...prev,
      [experienceId]: false,
    }));
  } catch (error) {
    console.error("Create trip plan and add experience error:", error);

    setTripPlanErrorByExperience((prev) => ({
      ...prev,
      [experienceId]: "Something went wrong while creating the trip plan.",
    }));
  } finally {
    setCreatingPlanByExperience((prev) => ({
      ...prev,
      [experienceId]: false,
    }));
  }
};

    const removeExperienceFromTripPlan = async (
      experienceId: number,
      planId: number
    ) => {
      setTripPlanErrorByExperience((prev) => ({
        ...prev,
        [experienceId]: "",
      }));

      try {
        const res = await fetch(
          `${API_URL}/api/trip-plans/${planId}/experiences/${experienceId}/`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          console.error("Remove from trip plan error:", data);

          setTripPlanErrorByExperience((prev) => ({
            ...prev,
            [experienceId]:
              data.detail || "Could not remove experience from this trip plan.",
          }));

          return;
        }

        setTripPlanMessageByExperience((prev) => ({
          ...prev,
          [experienceId]: {
            text: "Experience removed from this trip plan.",
            planId: null,
          },
        }));

        setSelectedPlanByExperience((prev) => ({
          ...prev,
          [experienceId]: "",
        }));
      } catch (error) {
        console.error("Remove from trip plan error:", error);

        setTripPlanErrorByExperience((prev) => ({
          ...prev,
          [experienceId]: "Something went wrong while removing this experience.",
        }));
      }
    };

  // =====================
  // Reusable trip plan UI
  // =====================

const renderTripPlanControls = (experience: any) => {
  if (!experience?.id) return null;

  const experienceId = experience.id;
  const showPicker = showTripPlanPicker[experienceId];
  const selectedPlanId = selectedPlanByExperience[experienceId] || "";
  const isAdding = addingToPlan[experienceId];
  const isCreating = creatingPlanByExperience[experienceId];
  const showCreateForm = showCreatePlanByExperience[experienceId];
  const tripPlanError = tripPlanErrorByExperience[experienceId];
  const tripPlanMessage = tripPlanMessageByExperience[experienceId];

  return (
    <div style={inlineTripPlanContainer}>
      <button
        type="button"
        style={inlineSecondaryButton}
        onClick={() =>
          setShowTripPlanPicker((prev) => ({
            ...prev,
            [experienceId]: !prev[experienceId],
          }))
        }
      >
        Add to trip plan
      </button>

      {showPicker && (
        <div style={inlineTripPlanPickerBox}>
          <div style={inlineTripPlanTitle}>
            Add this experience to your trip plan
          </div>

          <div style={inlineTripPlanHelp}>
            Save this recommendation so you can find it later while planning your trip.
          </div>

          {tripPlans.length > 0 && (
            <div style={inlineExistingPlanBox}>
              <select
                value={selectedPlanId}
                onChange={(event) =>
                  setSelectedPlanByExperience((prev) => ({
                    ...prev,
                    [experienceId]: event.target.value,
                  }))
                }
                style={inlineSelectInput}
              >
                <option value="">Choose an existing trip plan</option>

                {tripPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                    {plan.destination_text ? ` — ${plan.destination_text}` : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isAdding}
                onClick={() => addExperienceToTripPlan(experienceId)}
                style={{
                  ...inlinePrimaryButton,
                  opacity: isAdding ? 0.5 : 1,
                  cursor: isAdding ? "not-allowed" : "pointer",
                }}
              >
                {isAdding ? "Adding..." : "Add to selected plan"}
              </button>
            </div>
          )}

          <div style={inlineDividerText}>
            {tripPlans.length > 0
              ? "Or create a new trip plan"
              : "Create your first trip plan"}
          </div>

          {!showCreateForm ? (
            <button
              type="button"
              style={inlineSecondaryButton}
              onClick={() => {
                setShowCreatePlanByExperience((prev) => ({
                  ...prev,
                  [experienceId]: true,
                }));

                setTripPlanErrorByExperience((prev) => ({
                  ...prev,
                  [experienceId]: "",
                }));

                if (!newPlanDestinationByExperience[experienceId]) {
                  setNewPlanDestinationByExperience((prev) => ({
                    ...prev,
                    [experienceId]:
                      experience.destination_name ||
                      experience.place_name ||
                      place?.name ||
                      "",
                  }));
                }
              }}
            >
              Create new trip plan here
            </button>
          ) : (
            <div style={inlineQuickCreateBox}>
              <input
                type="text"
                value={newPlanTitleByExperience[experienceId] || ""}
                onChange={(event) =>
                  setNewPlanTitleByExperience((prev) => ({
                    ...prev,
                    [experienceId]: event.target.value,
                  }))
                }
                placeholder="Trip plan title, e.g. Italy 2026"
                style={inlineTextInput}
              />

              <input
                type="text"
                value={newPlanDestinationByExperience[experienceId] || ""}
                onChange={(event) =>
                  setNewPlanDestinationByExperience((prev) => ({
                    ...prev,
                    [experienceId]: event.target.value,
                  }))
                }
                placeholder="Destination, e.g. Rome, Thailand, São Roque"
                style={inlineTextInput}
              />

              <div style={inlineQuickCreateActions}>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => createTripPlanAndAddExperience(experience)}
                  style={{
                    ...inlinePrimaryButton,
                    opacity: isCreating ? 0.5 : 1,
                    cursor: isCreating ? "not-allowed" : "pointer",
                  }}
                >
                  {isCreating ? "Creating..." : "Create and add experience"}
                </button>

                <button
                  type="button"
                  style={inlineSecondaryButton}
                  onClick={() => {
                    setShowCreatePlanByExperience((prev) => ({
                      ...prev,
                      [experienceId]: false,
                    }));

                    setTripPlanErrorByExperience((prev) => ({
                      ...prev,
                      [experienceId]: "",
                    }));
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tripPlanError && (
            <div style={inlineTripPlanErrorBox}>
              {tripPlanError}
            </div>
          )}
        </div>
      )}

            {tripPlanMessage && (
        <div style={tripPlanSuccessBox}>
          <span>{tripPlanMessage.text}</span>

          {tripPlanMessage.planId && (
            <>
              <Link
                href={`/trip-plans/${tripPlanMessage.planId}`}
                style={tripPlanSuccessLink}
              >
                Open trip plan
              </Link>

              <button
                type="button"
                onClick={() =>
                  removeExperienceFromTripPlan(
                    experienceId,
                    tripPlanMessage.planId as number
                  )
                }
                style={tripPlanUndoButton}
              >
                Remove from this plan
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

  // =====================
  // Report actions
  // =====================

const submitExperienceReport = async (experienceId: number) => {
  const reason = reportReasonByExperience[experienceId] || "misleading_information";
  const comment = (reportCommentByExperience[experienceId] || "").trim();

  if (!comment) {
    setReportErrorByExperience((prev) => ({
      ...prev,
      [experienceId]: "Please explain why you are reporting this content.",
    }));
    return;
  }

  setSubmittingReportByExperience((prev) => ({
    ...prev,
    [experienceId]: true,
  }));

  setReportErrorByExperience((prev) => ({
    ...prev,
    [experienceId]: "",
  }));

  setReportMessageByExperience((prev) => ({
    ...prev,
    [experienceId]: "",
  }));

  try {
    const res = await fetch(`${API_URL}/api/reports/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: "experience",
        experience: experienceId,
        reason,
        comment,
      }),
    });

    const text = await res.text();

    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      console.error("Report response was not JSON. Status:", res.status);
      console.error("Raw response:", text);

      setReportErrorByExperience((prev) => ({
        ...prev,
        [experienceId]:
          "The server returned an unexpected response. Check the backend terminal for details.",
      }));

      return;
    }

    if (!res.ok) {
      const duplicateMessage =
        data.non_field_errors && Array.isArray(data.non_field_errors)
          ? data.non_field_errors[0]
          : null;

      setReportErrorByExperience((prev) => ({
        ...prev,
        [experienceId]:
          duplicateMessage || data.detail || "Could not submit report.",
      }));

      return;
    }

    setReportMessageByExperience((prev) => ({
      ...prev,
      [experienceId]:
        "Report submitted. Thank you for helping keep Trust Travel safe.",
    }));

    setReportCommentByExperience((prev) => ({
      ...prev,
      [experienceId]: "",
    }));

    setShowReportFormByExperience((prev) => ({
      ...prev,
      [experienceId]: false,
    }));
  } catch (error) {
    console.error("Report submit error:", error);

    setReportErrorByExperience((prev) => ({
      ...prev,
      [experienceId]: "Something went wrong while submitting the report.",
    }));
  } finally {
    setSubmittingReportByExperience((prev) => ({
      ...prev,
      [experienceId]: false,
    }));
  }
};

  // =====================
  // Reusable report UI
  // =====================

const renderReportControls = (experience: any) => {
  if (!experience?.id) return null;

  if (experience.user === currentUsername) {
    return null;
  }

  const experienceId = experience.id;
  const showForm = showReportFormByExperience[experienceId];
  const reason = reportReasonByExperience[experienceId] || "misleading_information";
  const comment = reportCommentByExperience[experienceId] || "";
  const submitting = submittingReportByExperience[experienceId];
  const message = reportMessageByExperience[experienceId];
  const error = reportErrorByExperience[experienceId];



  return (
    <div style={reportContainer}>
      <button
        type="button"
        style={reportButton}
        onClick={() =>
          setShowReportFormByExperience((prev) => ({
            ...prev,
            [experienceId]: !prev[experienceId],
          }))
        }
      >
        Report
      </button>

      {showForm && (
        <div style={reportFormBox}>
          <div style={reportTitle}>Report this experience</div>

          <select
            value={reason}
            onChange={(event) =>
              setReportReasonByExperience((prev) => ({
                ...prev,
                [experienceId]: event.target.value,
              }))
            }
            style={reportInput}
          >
            <option value="misleading_information">Misleading information</option>
            <option value="unsafe_place">Unsafe place</option>
            <option value="fake_photo">Fake photo</option>
            <option value="scam_or_fraud">Scam or fraud</option>
            <option value="harassment">Harassment</option>
            <option value="suspicious_behavior">Suspicious behavior</option>
            <option value="other">Other</option>
          </select>

          <textarea
            value={comment}
            onChange={(event) =>
              setReportCommentByExperience((prev) => ({
                ...prev,
                [experienceId]: event.target.value,
              }))
            }
            placeholder="Briefly explain the issue..."
            rows={3}
            style={reportTextarea}
          />

          {error && <div style={reportErrorBox}>{error}</div>}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitExperienceReport(experienceId)}
              style={{
                ...reportSubmitButton,
                opacity: submitting ? 0.5 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Submit report"}
            </button>

            <button
              type="button"
              style={reportCancelButton}
              onClick={() =>
                setShowReportFormByExperience((prev) => ({
                  ...prev,
                  [experienceId]: false,
                }))
              }
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <div style={reportSuccessBox}>{message}</div>}
    </div>
  );
};

  // =====================
  // Page render
  // =====================

  return (
    <main style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>{pageTitle}</h1>

        <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        marginTop: "12px",
        marginBottom: "18px",
      }}
    >
      <button
        type="button"
        onClick={() =>
          router.push(`/destinations?mode=experience&place=${id}&share=true`)
        }
        style={{
          padding: "10px 14px",
          borderRadius: "10px",
          border: "none",
          background: "black",
          color: "white",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Share your experience here
      </button>
    </div>

          <div
      style={{
        marginTop: "14px",
        marginBottom: "24px",
        padding: "16px",
        border: "1px solid #eee",
        borderRadius: "14px",
        background: "#fafafa",
        display: "grid",
        gap: "10px",
      }}
    >
      <div style={{ fontWeight: 600 }}>
        Overview
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "10px",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", color: "#777" }}>Experiences</div>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            {totalExperiences}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "#777" }}>Average rating</div>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            {averageRating ? `${averageRating} ★` : "No ratings yet"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "#777" }}>Trusted reviews</div>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            {trustedReviewsCount}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "#777" }}>Recent activity</div>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            {recentExperiencesCount}
          </div>
        </div>
      </div>
    </div>

    {totalExperiences === 0 && (
  <div style={emptyExperienceBox}>
    <div style={emptyExperienceEyebrow}>First experience opportunity</div>

    <h2 style={emptyExperienceTitle}>
      You are the first person to explore this place on Trust Travel.
    </h2>

    <p style={emptyExperienceText}>
      There are no shared experiences here yet. If you visited this place,
      your comment can help future travelers understand what to expect.
    </p>

    <div style={emptyExperienceActions}>
      <button
          type="button"
          onClick={() =>
            router.push(`/destinations?mode=experience&place=${id}&share=true`)
          }
          style={emptyExperiencePrimaryButton}
        >
          Share the first experience
        </button>

      <button
        type="button"
        onClick={() => router.push("/destinations?mode=experience")}
        style={emptyExperienceSecondaryButton}
      >
        Search another place
      </button>
    </div>
  </div>
)}

    {highlightedExperience && (
      <div
        style={{
          marginTop: "20px",
          marginBottom: "30px",
          padding: "18px",
          borderRadius: "14px",
          background: "white",
          border: "1px solid #e5e5e5",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ fontSize: "13px", color: "#777", marginBottom: "8px" }}>
          Selected experience
        </div>

        {highlightedExperience.rating && (
          <div style={{ color: "#f5b50a", marginBottom: "8px" }}>
            {"★".repeat(highlightedExperience.rating)}
            {"☆".repeat(5 - highlightedExperience.rating)}
          </div>
        )}

        {highlightedExperience.title && (
          <div
            style={{
              fontWeight: 700,
              fontSize: "18px",
              marginBottom: "8px",
            }}
          >
            {highlightedExperience.title}
          </div>
        )}

        {highlightedExperience.image_url && (
          <img
            src={highlightedExperience.image_url}
            alt={highlightedExperience.title || "Shared experience"}
            style={{
              width: "140px",
              height: "90px",
              objectFit: "cover",
              borderRadius: "10px",
              marginBottom: "10px",
              border: "1px solid #eee",
              display: "block",
            }}
          />
        )}

        <div style={{ lineHeight: 1.5, marginBottom: "10px" }}>
          {highlightedExperience.comment}
        </div>

        {renderTripMeta(highlightedExperience)}

        <div style={{ fontSize: "13px", color: "#777", marginBottom: "12px" }}>
          — {getAuthorLabel(highlightedExperience)} • {timeAgo(highlightedExperience.created_at)}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link
            href={`/experiences/${highlightedExperience.id}`}
            style={{
              fontSize: "13px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "#f9f9f9",
              color: "#111",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            View full experience
          </Link>
        </div>

        {renderTripPlanControls(highlightedExperience)}

        {renderReportControls(highlightedExperience)}

      </div>
    )}

      {!highlightedExperience && trendingExperiences.length > 0 && (
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
                  <strong>{getAuthorLabel(e)}</strong> • {(e.title || e.comment).slice(0, 60)}...

                  {getTrustedRepliesCount(e.id) > 0 && (
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        ⭐ {getTrustedRepliesCount(e.id)} trusted{" "}
                        {getTrustedRepliesCount(e.id) === 1 ? "interaction" : "interactions"}
                      </div>
                    )}

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

          <div style={{ fontWeight: "600", marginBottom: "6px" }}>
              🔥 Trending experiences
            </div>

            <div style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
              Recent experiences people are interacting with.
            </div>

          {trendingExperiences.map((e) => (
              <div
                key={e.id}
                onClick={() =>
                  router.push(`/places/${id}/experiences?highlight=${e.id}`)
                }
                style={{
                  marginBottom: "10px",
                  cursor: "pointer",
                  padding: "8px",
                  borderRadius: "8px",
                }}
              >
                <strong>{getAuthorLabel(e)}</strong> • {(e.title || e.comment).slice(0, 60)}...

                {getTrustedRepliesCount(e.id) > 0 && (
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    ⭐ {getTrustedRepliesCount(e.id)} trusted{" "}
                    {getTrustedRepliesCount(e.id) === 1 ? "interaction" : "interactions"}
                  </div>
                )}

                <div style={{ fontSize: "12px", color: "#777", marginTop: "2px" }}>
                  View this experience →
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

     {trustedActivities.length > 0 && (
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
          Recent trusted activity
        </div>

        <div style={{ fontSize: "14px", color: "#666", lineHeight: 1.6 }}>
          <div style={{ marginBottom: "8px" }}>
            New activity from your network
          </div>

          {trustedActivities.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() =>
                  item.type === "review"
                    ? router.push(`/places/${id}/experiences?highlight=${item.id}`)
                    : router.push(`/places/${id}/experiences`)
                }
              style={{ cursor: "pointer" }}
            >
              <strong>{getAuthorLabel(item)}</strong>{" "}
                {item.type === "review"
                  ? "shared an experience about"
                  : "replied to a review on"}{" "}
                <strong>{place?.name}</strong>
                {destination?.name && destination.name !== place?.name && (
                  <>
                    {" "}
                    • <strong>{destination.name}</strong>
                  </>
                )}{" "}
                • {timeAgo(item.created_at)}
            </div>
          ))}
        </div>
      </div>
    )}

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
                          width: "140px",
                          height: "90px",
                          objectFit: "cover",
                          borderRadius: "10px",
                          marginTop: "8px",
                          marginBottom: "10px",
                          border: "1px solid #eee",
                          display: "block",
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

                    {renderTripMeta(e)}

                    <div style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>
                      — {getAuthorLabel(e)} • {timeAgo(e.created_at)}

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
                          type="button"
                          style={{
                            marginTop: "10px",
                            fontSize: "12px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #ddd",
                            background: "#f0f0f0",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            setShowTripPlanPicker((prev) => ({
                              ...prev,
                              [e.id]: !prev[e.id],
                            }))
                          }
                        >
                          Add to trip plan
                        </button>

                        {showTripPlanPicker[e.id] && (
                          <div
                            style={{
                              marginTop: "10px",
                              padding: "10px",
                              borderRadius: "10px",
                              border: "1px solid #eee",
                              background: "white",
                              display: "grid",
                              gap: "8px",
                            }}
                          >
                            {tripPlans.length === 0 ? (
                              <div style={{ fontSize: "12px", color: "#666" }}>
                                You do not have any trip plans yet.{" "}
                                <Link
                                  href={getCreateTripPlanUrl(e.id)}
                                  style={{ color: "#111", fontWeight: 600 }}
                                >
                                  Create one
                                </Link>
                                .
                              </div>
                            ) : (
                              <>
                                <select
                                  value={selectedPlanByExperience[e.id] || ""}
                                  onChange={(event) =>
                                    setSelectedPlanByExperience((prev) => ({
                                      ...prev,
                                      [e.id]: event.target.value,
                                    }))
                                  }
                                  style={{
                                    padding: "8px",
                                    borderRadius: "8px",
                                    border: "1px solid #ddd",
                                    fontSize: "12px",
                                  }}
                                >
                                  <option value="">Choose a trip plan</option>

                                  {tripPlans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                      {plan.title}
                                      {plan.destination_text ? ` — ${plan.destination_text}` : ""}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  disabled={addingToPlan[e.id]}
                                  onClick={() => addExperienceToTripPlan(e.id)}
                                  style={{
                                    fontSize: "12px",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: "black",
                                    color: "white",
                                    cursor: addingToPlan[e.id] ? "not-allowed" : "pointer",
                                    opacity: addingToPlan[e.id] ? 0.5 : 1,
                                    width: "fit-content",
                                  }}
                                >
                                  {addingToPlan[e.id] ? "Adding..." : "Add"}
                                </button>

                                <Link
                                  href={getCreateTripPlanUrl(e.id)}
                                  style={createPlanLink}
                                >
                                  Create a new trip plan
                                </Link>
                              </>
                            )}
                          </div>
                        )}

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
                              View full experience
                            </Link>

                         {renderReportControls(e)}



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
                              width: "140px",
                              height: "90px",
                              objectFit: "cover",
                              borderRadius: "10px",
                              marginTop: "8px",
                              marginBottom: "10px",
                              border: "1px solid #eee",
                              display: "block",
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

                        {renderTripMeta(e)}

                    <div style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>
                      — {getAuthorLabel(e)} • {timeAgo(e.created_at)}

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
                        View full experience
                      </Link>

                      {renderReportControls(e)}

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
                              width: "140px",
                              height: "90px",
                              objectFit: "cover",
                              borderRadius: "10px",
                              marginTop: "8px",
                              marginBottom: "10px",
                              border: "1px solid #eee",
                              display: "block",
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

                        {renderTripMeta(e)}

                        <div style={{ marginTop: "10px", fontSize: "13px", color: "#777" }}>
                          — {getAuthorLabel(e)} • {timeAgo(e.created_at)}
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
                            View full experience
                          </Link>

                          {renderReportControls(e)}

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

const tripMetaRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginTop: "10px",
  marginBottom: "10px",
};

const tripMetaBadge = {
  display: "inline-block",
  fontSize: "12px",
  color: "#555",
  border: "1px solid #ddd",
  borderRadius: "999px",
  padding: "4px 8px",
  background: "#fafafa",
};

const tripPlanSuccessBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  fontSize: "14px",
};

const tripPlanSuccessLink = {
  color: "#166534",
  fontWeight: 700,
  textDecoration: "underline",
};

const tripPlanUndoButton = {
  border: "none",
  background: "transparent",
  color: "#991b1b",
  fontWeight: 700,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  fontSize: "14px",
};

const createPlanLink = {
  color: "#111",
  fontWeight: 600,
  fontSize: "13px",
  textDecoration: "underline",
  width: "fit-content",
};

const emptyExperienceBox = {
  marginTop: "20px",
  marginBottom: "30px",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  display: "grid",
  gap: "12px",
};

const emptyExperienceEyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
};

const emptyExperienceTitle = {
  margin: 0,
  fontSize: "22px",
  lineHeight: 1.25,
};

const emptyExperienceText = {
  margin: 0,
  color: "#555",
  lineHeight: 1.6,
};

const emptyExperienceActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "6px",
};

const emptyExperiencePrimaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyExperienceSecondaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 700,
};

const reportContainer = {
  marginTop: "10px",
  width: "100%",
};

const reportButton = {
  fontSize: "12px",
  padding: "4px 10px",
  borderRadius: "6px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
};

const reportFormBox = {
  marginTop: "10px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #f3c2c2",
  background: "#fffafa",
  display: "grid",
  gap: "10px",
};

const reportTitle = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#991b1b",
};

const reportInput = {
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "12px",
};

const reportTextarea = {
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "12px",
  resize: "vertical" as const,
};

const reportSubmitButton = {
  fontSize: "12px",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "none",
  background: "black",
  color: "white",
};

const reportCancelButton = {
  fontSize: "12px",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
};

const reportSuccessBox = {
  marginTop: "10px",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "13px",
};

const reportErrorBox = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#991b1b",
  fontSize: "13px",
};

const inlineTripPlanContainer = {
  marginTop: "10px",
  display: "grid",
  gap: "10px",
};

const inlineTripPlanPickerBox = {
  marginTop: "10px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  display: "grid",
  gap: "10px",
};

const inlineTripPlanTitle = {
  fontWeight: 700,
  fontSize: "13px",
};

const inlineTripPlanHelp = {
  color: "#666",
  fontSize: "12px",
  lineHeight: 1.5,
};

const inlineExistingPlanBox = {
  display: "grid",
  gap: "8px",
};

const inlineSelectInput = {
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "12px",
  maxWidth: "360px",
};

const inlinePrimaryButton = {
  fontSize: "12px",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
  width: "fit-content",
};

const inlineSecondaryButton = {
  fontSize: "12px",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
  width: "fit-content",
};

const inlineDividerText = {
  marginTop: "2px",
  color: "#777",
  fontSize: "12px",
  fontWeight: 600,
};

const inlineQuickCreateBox = {
  display: "grid",
  gap: "8px",
};

const inlineTextInput = {
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "12px",
  maxWidth: "360px",
};

const inlineQuickCreateActions = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const inlineTripPlanErrorBox = {
  padding: "9px 10px",
  borderRadius: "8px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
  fontSize: "12px",
};