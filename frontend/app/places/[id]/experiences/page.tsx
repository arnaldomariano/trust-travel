"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const [replyErrorByExperience, setReplyErrorByExperience] = useState<Record<number, string>>({});

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [lastVisit, setLastVisit] = useState<number>(0);
  const [showOtherReviews, setShowOtherReviews] = useState(false);
  const [relatedPlaces, setRelatedPlaces] = useState<any[]>([]);
  const [showRelatedPlaces, setShowRelatedPlaces] = useState(false);
  const [relatedPlaceSearch, setRelatedPlaceSearch] = useState("");
  const [showCountryExperiences, setShowCountryExperiences] = useState(false);
  const [parentCountryPlace, setParentCountryPlace] = useState<any>(null);

  const [creatingRelatedPlace, setCreatingRelatedPlace] = useState(false);
  const [confirmingRelatedPlaceCreate, setConfirmingRelatedPlaceCreate] = useState(false);
  const [createdRelatedPlace, setCreatedRelatedPlace] = useState<any>(null);
  const [relatedPlaceCreateMessage, setRelatedPlaceCreateMessage] = useState("");
  const [relatedPlaceCreateError, setRelatedPlaceCreateError] = useState("");


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

  const normalizeText = (value?: string) =>
      (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

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
  place?.place_type === "country"
    ? `Experiences about ${place?.name || "this country"}`
    : place?.place_type === "city"
    ? `Experiences in ${place?.name || "this place"}`
    : `Experiences about ${place?.name || "this place"}`;

const isCountryPage = place?.place_type === "country";

const shouldShowExperienceContent =
  !isCountryPage || showCountryExperiences;

  const isCityPage = place?.place_type === "city";

const isSpecificPlacePage =
  !!place &&
  place.place_type !== "country" &&
  place.place_type !== "city";

const getPlaceTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    country: "Country",
    city: "City / Region",
    attraction: "Tourist attraction",
    hotel: "Hotel",
    restaurant: "Restaurant / Café",
    nature: "Beach / Nature spot",
    other: "Place",
  };

  return labels[type || ""] || "Place";
};

const placeTypeLabel = getPlaceTypeLabel(place?.place_type);

const placeContextLabel = [
  place?.city && place.city !== place?.name ? place.city : null,
  place?.destination_country || destination?.country || destination?.name,
]
  .filter(Boolean)
  .join(" · ");

const emptyExperienceEyebrowText = isCountryPage
  ? "Country experience opportunity"
  : isCityPage
  ? "City / region experience opportunity"
  : "Specific place experience opportunity";

const emptyExperienceTitleText = isCountryPage
  ? `No general experiences about ${place?.name || "this country"} yet.`
  : isCityPage
  ? `No experiences in ${place?.name || "this city or region"} yet.`
  : `No experiences about ${place?.name || "this place"} yet.`;

const emptyExperienceBodyText = isCountryPage
  ? `There are no country-level experiences here yet. If you know ${
      place?.name || "this country"
    }, you can share a general impression about culture, costs, safety, accessibility or overall travel feeling.`
  : isCityPage
  ? `${place?.name || "This city or region"} is already listed${
      place?.destination_country ? ` inside ${place.destination_country}` : ""
    }. You can be the first to share an experience here, or go back to the country page to explore broader country-level experiences and other cities or regions.`
  : `${place?.name || "This place"} is listed as a ${placeTypeLabel}${
      placeContextLabel ? ` in ${placeContextLabel}` : ""
    }. You can be the first to share an experience about this specific place.`;

const experienceScopeEyebrowText = isCountryPage
  ? "Country-level experience"
  : isCityPage
  ? "City / region-level experience"
  : "Specific-place experience";

const experienceScopeTitleText = isCountryPage
  ? `You are viewing experiences about ${place?.name || "this country"}`
  : isCityPage
  ? `You are viewing experiences in ${place?.name || "this city or region"}`
  : `You are viewing experiences about ${place?.name || "this place"}`;

const experienceScopeBodyText = isCountryPage
  ? `Use this page for broad impressions about the country: culture, costs, safety, accessibility, convenience, general travel feeling or country-wide observations.`
  : isCityPage
  ? `Use this page for experiences about the city or region as a whole: atmosphere, mobility, safety, events, general costs or overall local impressions.`
  : `Use this page for experiences about this exact place: service, visit quality, food, stay, access, safety, price, comfort or practical details tied to this location.`;

const experienceScopeWarningText = isCountryPage
  ? `If your experience is mainly about a city, hotel, restaurant, attraction or beach, search or create that more specific place first.`
  : isCityPage
  ? `If your experience is mainly about a restaurant, hotel, attraction, beach or nature spot, use the specific-place page instead of the city page.`
  : `This review will be attached to this exact place, not only to the city or country.`;

const shareExperienceButtonText = isCountryPage
  ? "Share country-level experience"
  : isCityPage
  ? "Share city/region-level experience"
  : "Share experience about this exact place";

const sortedRelatedPlaces = [...relatedPlaces].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

const normalizedRelatedPlaceSearch = normalizeText(relatedPlaceSearch);

const formatPlaceNameForCreation = (value: string) => {
  return value
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) return word.toLowerCase();

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

const filteredRelatedPlaces = normalizedRelatedPlaceSearch
  ? sortedRelatedPlaces.filter((relatedPlace) => {
      const name = normalizeText(relatedPlace.name);
      const city = normalizeText(relatedPlace.city);
      const destinationName = normalizeText(relatedPlace.destination_name);
      const destinationCountry = normalizeText(relatedPlace.destination_country);

      return (
        name.includes(normalizedRelatedPlaceSearch) ||
        city.includes(normalizedRelatedPlaceSearch) ||
        destinationName.includes(normalizedRelatedPlaceSearch) ||
        destinationCountry.includes(normalizedRelatedPlaceSearch)
      );
    })
  : [];

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

  const experienceListIntroTitle =
      totalExperiences === 1
        ? "1 experience shared here"
        : `${totalExperiences} experiences shared here`;

  const experienceListIntroText =
      "Read experiences shared by travelers about this place. Use the full experience page when you want to see photos, gallery details and actions.";

  const trustedExperiences = sortedExperiences.filter(
      (e) => e.trust_level === 1
  );

  const networkExperiences = sortedExperiences.filter(
      (e) => e.trust_level === 2
  );

  const otherExperiences = sortedExperiences.filter(
      (e) => e.trust_level === 3
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
    const res = await fetch(`${API_URL}/api/places/${id}/experiences/`);

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
    setRelatedPlaceSearch("");
    setShowRelatedPlaces(false);
    setShowCountryExperiences(false);

    const destRes = await fetch(`${API_URL}/api/destinations/`);
    const destinations = await destRes.json();

    const foundDestination = destinations.find(
      (d: any) => d.id === data.destination
    );

    setDestination(foundDestination);

    const placesRes = await fetch(`${API_URL}/api/places/`);

    if (!placesRes.ok) {
      setRelatedPlaces([]);
      setParentCountryPlace(null);
      return;
    }

    const placesData = await placesRes.json();

    const parentCountry =
      Array.isArray(placesData)
        ? placesData.find((candidate: any) => {
            if (candidate.place_type !== "country") return false;

            return (
              Number(candidate.destination) === Number(data.destination) ||
              normalizeText(candidate.name) === normalizeText(data.destination_country)
            );
          })
        : null;

    setParentCountryPlace(parentCountry || null);

    if (data.place_type === "country") {
      const countryName = normalizeText(data.name);

      const related = Array.isArray(placesData)
        ? placesData
            .filter((relatedPlace: any) => {
              if (relatedPlace.id === data.id) return false;
              if (relatedPlace.place_type === "country") return false;

              const relatedCountry = normalizeText(
                relatedPlace.destination_country
              );

              const relatedDestination = normalizeText(
                relatedPlace.destination_name
              );

              return (
                relatedCountry === countryName ||
                relatedDestination === countryName
              );
            })
            .sort((a: any, b: any) => {
              const typeOrder: Record<string, number> = {
                city: 1,
                nature: 2,
                attraction: 3,
                restaurant: 4,
                hotel: 5,
                other: 6,
              };

              const orderA = typeOrder[a.place_type] || 99;
              const orderB = typeOrder[b.place_type] || 99;

              if (orderA !== orderB) return orderA - orderB;

              return (a.name || "").localeCompare(b.name || "");
            })
        : [];

      setRelatedPlaces(related);
    } else {
      setRelatedPlaces([]);
    }
  } catch (err) {
    console.error(err);
    setRelatedPlaces([]);
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
// Create related city/region inside country
// =====================

    const createRelatedCityOrRegion = async () => {
      const placeName = formatPlaceNameForCreation(relatedPlaceSearch);

      if (!placeName || !place?.name || !isCountryPage) return;

        setCreatingRelatedPlace(true);
        setCreatedRelatedPlace(null);
        setRelatedPlaceCreateMessage("");
        setRelatedPlaceCreateError("");

      try {
        const res = await fetch(`${API_URL}/api/places/create-basic/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: placeName,
            place_type: "city",
            city: placeName,
            country: place.name,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setRelatedPlaceCreateError(
            data.detail || "Could not create this city or region."
          );
          return;
        }

        setRelatedPlaces((prev) => {
          const alreadyExists = prev.some(
            (relatedPlace) => relatedPlace.id === data.id
          );

          if (alreadyExists) return prev;

          return [...prev, data].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
        });

        setCreatedRelatedPlace(data);

        setRelatedPlaceCreateMessage(
          `${data.name} was created inside ${place.name}.`
        );

        setConfirmingRelatedPlaceCreate(false);
        setRelatedPlaceSearch(data.name || placeName);
      } catch (error) {
        console.error("Create related city/region failed:", error);
        setRelatedPlaceCreateError("Something went wrong while creating this place.");
      } finally {
        setCreatingRelatedPlace(false);
      }
    };

  //==================
  // Reply actions
  // =====================

  const handleReplySubmit = async (experienceId: number) => {
    const token = localStorage.getItem("access");
    const replyText = replyTextByExperience[experienceId]?.trim();

    if (!token) {
      setReplyErrorByExperience((prev) => ({
        ...prev,
        [experienceId]: "You need to be logged in to reply.",
      }));
      return;
    }

    if (!replyText) {
      setReplyErrorByExperience((prev) => ({
        ...prev,
        [experienceId]: "Write a reply before sending.",
      }));
      return;
    }

    setReplyErrorByExperience((prev) => ({
      ...prev,
      [experienceId]: "",
   }));

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

          setReplyErrorByExperience((prev) => ({
            ...prev,
            [experienceId]: "Could not send this reply. Please try again.",
          }));

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

      setReplyErrorByExperience((prev) => ({
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
  // Reusable reply UI
  // =====================

  const renderReplyControls = (experience: any) => {
    if (!experience?.id) return null;

    const experienceId = experience.id;

    return (
      <div style={{ marginTop: "10px" }}>
        <button
          type="button"
          style={{
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
              [experienceId]: !prev[experienceId],
            }))
          }
        >
          {showReplyForm[experienceId] ? "Cancel reply" : "Reply"}
        </button>

        {showReplyForm[experienceId] && (
          <div style={{ marginTop: "10px" }}>
            <textarea
              value={replyTextByExperience[experienceId] || ""}
              onChange={(ev) => {
                setReplyTextByExperience((prev) => ({
                  ...prev,
                  [experienceId]: ev.target.value,
                }));

                setReplyErrorByExperience((prev) => ({
                  ...prev,
                  [experienceId]: "",
                }));
              }}
              placeholder="Write a reply..."
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ddd",
              }}
            />

            {replyErrorByExperience[experienceId] && (
              <div
                style={{
                  marginTop: "6px",
                  padding: "8px",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "12px",
                  lineHeight: 1.4,
                }}
              >
                {replyErrorByExperience[experienceId]}
              </div>
            )}

            <button
              type="button"
              style={{
                marginTop: "6px",
                padding: "4px 10px",
                borderRadius: "6px",
                background: "#0070f3",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => handleReplySubmit(experienceId)}
            >
              {submittingReply[experienceId] ? "Sending..." : "Send"}
            </button>
          </div>
        )}
      </div>
    );
  };

  // =====================
  // Trip plan actions
  // =====================

const getCreateTripPlanUrl = (experienceId: number) => {
  return `/trip-plans?returnTo=${encodeURIComponent(
    `/experiences/${experienceId}`
  )}`;
};

const addExperienceToTripPlan = async (experienceId: number) => {
  const selectedPlanId = selectedPlanByExperience[experienceId];

  if (!selectedPlanId) {
  setTripPlanErrorByExperience((prev) => ({
    ...prev,
    [experienceId]: "Choose one of your trip plans before adding this experience.",
  }));
  return;
}

  setTripPlanErrorByExperience((prev) => ({
      ...prev,
      [experienceId]: "",
  }));

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

      setTripPlanErrorByExperience((prev) => ({
        ...prev,
        [experienceId]: data.detail || "Could not add this experience to your trip plan.",
      }));

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

      setTripPlanErrorByExperience((prev) => ({
        ...prev,
        [experienceId]: "Could not add this experience to your trip plan.",
      }));
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
                  onChange={(event) => {
                    setSelectedPlanByExperience((prev) => ({
                      ...prev,
                      [experienceId]: event.target.value,
                    }));

                    setTripPlanErrorByExperience((prev) => ({
                      ...prev,
                      [experienceId]: "",
                    }));
                  }}
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

              {tripPlanError && (
                  <div
                    style={{
                      padding: "10px",
                      border: "1px solid #fecaca",
                      borderRadius: "10px",
                      backgroundColor: "#fef2f2",
                      color: "#b91c1c",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    {tripPlanError}
                  </div>
              )}

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

          {isCountryPage && (
        <section style={countryIntroBox}>
          <div style={countryIntroEyebrow}>Country overview</div>

          <h2 style={countryIntroTitle}>
            General experiences about {place?.name}
          </h2>

          <p style={countryIntroText}>
            Here you will see experiences shared about the country in general:
            first impressions, culture, costs, safety, accessibility,
            convenience and overall travel feeling.
          </p>

          <p style={countryIntroText}>
            Experiences about specific cities, regions, attractions, hotels or
            restaurants are kept separate so the country overview stays clear.
            Use the related places section below to explore those details.
          </p>
        </section>
      )}

      <section style={experienceScopeBox}>
          <div style={experienceScopeEyebrow}>
            {experienceScopeEyebrowText}
          </div>

          <h2 style={experienceScopeTitle}>
            {experienceScopeTitleText}
          </h2>

          <p style={experienceScopeText}>
            {experienceScopeBodyText}
          </p>

          <div style={experienceScopeWarningBox}>
            <strong>Before sharing:</strong>{" "}
            <span>{experienceScopeWarningText}</span>
          </div>
        </section>

        <div style={experiencePrimaryActions}>
                        {totalExperiences > 0 && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/destinations?mode=experience&place=${id}&share=true`)
                }
                style={{
                  display: "inline-block",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#111",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {shareExperienceButtonText}
              </button>
            )}

          {isCountryPage && (
            <button
              type="button"
              onClick={() => setShowCountryExperiences((current) => !current)}
              style={{
                ...viewAllExperiencesButton,
                background: showCountryExperiences ? "#f5f5f5" : "white",
              }}
            >
              {showCountryExperiences
                ? "Hide country experiences"
                : "View country experiences"}
            </button>
          )}
        </div>

    {shouldShowExperienceContent && (
      <section style={evaluationPromptBox}>
        <div style={evaluationPromptEyebrow}>
          Ratings & practical insights
        </div>

        <h2 style={evaluationPromptTitle}>
          Want a quick evaluation before reading reviews?
        </h2>

        <p style={evaluationPromptText}>
          Use the evaluations page to check average rating, rating distribution,
          safety, cost, accessibility and convenience for this place.
        </p>

        <div style={evaluationPromptActions}>
          <Link
            href={`/evaluations?place=${id}`}
            style={evaluationPromptPrimaryLink}
          >
            View evaluations for this place
          </Link>

          <span style={evaluationPromptMeta}>
            {totalExperiences === 1
              ? "1 experience shared here"
              : `${totalExperiences} experiences shared here`}
          </span>
        </div>
      </section>
    )}

    {isCountryPage && (
      <section id="related-places-section" style={relatedPlacesBox}>
        <div>
          <div style={relatedPlacesEyebrow}>Related cities and places</div>

          <h2 style={relatedPlacesTitle}>
            Search cities and specific places in {place?.name}
          </h2>

          <p style={relatedPlacesText}>
            Country-level experiences above stay focused on general impressions about{" "}
            {place?.name}. Search below if you want to explore experiences from a
            specific city, region or place inside this country.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
              if (showRelatedPlaces) {
                setRelatedPlaceSearch("");
              }

              setShowRelatedPlaces((current) => !current);
            }}
          style={relatedPlacesToggleButton}
        >
          {showRelatedPlaces
            ? "Hide related place search"
            : `Search cities and places in ${place?.name}`}
        </button>

        {showRelatedPlaces && (
          <div style={relatedPlacesSearchBox}>
            <input
              value={relatedPlaceSearch}
              onChange={(event) => {
                setRelatedPlaceSearch(event.target.value);
                setConfirmingRelatedPlaceCreate(false);
                setRelatedPlaceCreateMessage("");
                setRelatedPlaceCreateError("");
              }}
              placeholder={`Search inside ${place?.name}, e.g. Bali, Java, Yogyakarta`}
              style={relatedPlacesSearchInput}
            />

            {!relatedPlaceSearch.trim() ? (
              <div style={relatedPlacesEmptyHint}>
                Start typing a city, region or specific place name.
              </div>
            ) : filteredRelatedPlaces.length > 0 ? (
              <div style={relatedPlacesList}>
                {filteredRelatedPlaces.map((relatedPlace) => (
                  <div key={relatedPlace.id} style={relatedPlaceListItem}>
                    <div>
                      <strong>{relatedPlace.name}</strong>

                      <div style={relatedPlaceSmallMeta}>
                        {relatedPlace.place_type === "city"
                          ? "City / Region"
                          : relatedPlace.place_type === "nature"
                          ? "Nature"
                          : relatedPlace.place_type === "attraction"
                          ? "Tourist attraction"
                          : relatedPlace.place_type === "restaurant"
                          ? "Restaurant / Café"
                          : relatedPlace.place_type === "hotel"
                          ? "Hotel"
                          : "Place"}
                      </div>
                    </div>

                    <div style={relatedPlaceCompactActions}>
                      <Link
                        href={`/places/${relatedPlace.id}/experiences`}
                        style={relatedPlacePrimaryLink}
                      >
                        View experiences
                      </Link>

                      <Link
                        href={`/places/${relatedPlace.id}`}
                        style={relatedPlaceSecondaryLink}
                      >
                        View place
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={relatedPlacesNoResultBox}>
                              <strong>
                                No city or region found for “{relatedPlaceSearch.trim()}” inside{" "}
                                {place?.name}.
                              </strong>

                              <p style={{ margin: "8px 0 0 0", color: "#666", lineHeight: 1.5 }}>
                                If this is a city, region, local area, beach, trail or small destination that
                                should belong to {place?.name}, you can create it now as a city/region.
                                Later, Trust Travel can refine this with external place data, photo metadata
                                and map markers.
                              </p>

                              {relatedPlaceCreateError && (
                                <div style={relatedPlaceCreateErrorBox}>
                                  {relatedPlaceCreateError}
                                </div>
                              )}

                              {relatedPlaceCreateMessage && (
                                  <div style={relatedPlaceCreateSuccessBox}>
                                    <strong>{relatedPlaceCreateMessage}</strong>

                                    {createdRelatedPlace && (
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "10px",
                                          flexWrap: "wrap",
                                          marginTop: "12px",
                                        }}
                                      >
                                        <Link
                                          href={`/places/${createdRelatedPlace.id}/experiences`}
                                          style={relatedPlaceCreateSuccessLink}
                                        >
                                          View {createdRelatedPlace.name} page
                                        </Link>

                                        <Link
                                          href={`/destinations?mode=experience&place=${createdRelatedPlace.id}&share=true`}
                                          style={relatedPlaceCreateSuccessLink}
                                        >
                                          Share first experience
                                        </Link>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRelatedPlaceSearch("");
                                            setCreatedRelatedPlace(null);
                                            setRelatedPlaceCreateMessage("");
                                            setRelatedPlaceCreateError("");
                                            setConfirmingRelatedPlaceCreate(false);
                                          }}
                                          style={relatedPlaceCreateSuccessButton}
                                        >
                                          Search another city/place
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {!confirmingRelatedPlaceCreate ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmingRelatedPlaceCreate(true);
                                      setRelatedPlaceCreateMessage("");
                                      setRelatedPlaceCreateError("");
                                    }}
                                    disabled={!relatedPlaceSearch.trim()}
                                    style={{
                                      ...relatedPlacesSearchMainButton,
                                      background: "black",
                                      color: "white",
                                      opacity: !relatedPlaceSearch.trim() ? 0.5 : 1,
                                      cursor: !relatedPlaceSearch.trim() ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    Create “{formatPlaceNameForCreation(relatedPlaceSearch)}” in {place?.name}
                                  </button>
                                ) : (
                                  <div style={relatedPlaceCreateConfirmBox}>
                                    <strong>
                                      You are creating a new city/region inside {place?.name}.
                                    </strong>

                                    <div style={{ color: "#555", lineHeight: 1.5, fontSize: "14px" }}>
                                      Name: <strong>{formatPlaceNameForCreation(relatedPlaceSearch)}</strong>
                                      <br />
                                      Type: <strong>City / Region</strong>
                                      <br />
                                      Country: <strong>{place?.name}</strong>
                                    </div>

                                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                      <button
                                        type="button"
                                        onClick={createRelatedCityOrRegion}
                                        disabled={creatingRelatedPlace || !relatedPlaceSearch.trim()}
                                        style={{
                                          ...relatedPlacesSearchMainButton,
                                          background: "black",
                                          color: "white",
                                          opacity: creatingRelatedPlace ? 0.5 : 1,
                                          cursor: creatingRelatedPlace ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        {creatingRelatedPlace ? "Saving..." : "Confirm and save"}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setConfirmingRelatedPlaceCreate(false)}
                                        style={relatedPlacesSearchMainButton}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => router.push("/destinations?mode=experience")}
                                  style={relatedPlacesSearchMainButton}
                                >
                                  Search from main place page
                                </button>
                              </div>
                            </div>
            )}
          </div>
        )}
      </section>
    )}

     {shouldShowExperienceContent && totalExperiences === 0 && (
      <div style={emptyExperienceBox}>
        <div style={emptyExperienceEyebrow}>
          {emptyExperienceEyebrowText}
        </div>

        <h2 style={emptyExperienceTitle}>
          {emptyExperienceTitleText}
        </h2>

        <p style={emptyExperienceText}>
          {emptyExperienceBodyText}
        </p>

        <div style={emptyExperienceActions}>
          <button
            type="button"
            onClick={() =>
              router.push(`/destinations?mode=experience&place=${id}&share=true`)
            }
            style={emptyExperiencePrimaryButton}
          >
            {isCountryPage
              ? "Share the first country-level experience"
              : isCityPage
              ? `Share the first city/region-level experience`
              : `Share the first experience about this exact place`}
          </button>

          {!isCountryPage && parentCountryPlace && (
            <button
              type="button"
              onClick={() =>
                router.push(`/places/${parentCountryPlace.id}/experiences`)
              }
              style={emptyExperienceSecondaryButton}
            >
              Back to {place?.destination_country || parentCountryPlace.name || "country"}
            </button>
          )}

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

    {shouldShowExperienceContent && totalExperiences > 0 && (
      <section style={experienceListIntroBox}>
        <div style={experienceListIntroEyebrow}>
          Experience list
        </div>

        <h2 style={experienceListIntroHeading}>
          {experienceListIntroTitle}
        </h2>

        <p style={experienceListIntroTextStyle}>
          {experienceListIntroText}
        </p>
      </section>
    )}

      {shouldShowExperienceContent && trendingExperiences.length > 0 && (
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
                onClick={() => router.push(`/experiences/${e.id}`)}
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

     {shouldShowExperienceContent && trustedActivities.length > 0 && (
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
                    ? router.push(`/experiences/${item.id}`)
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

            {shouldShowExperienceContent && (
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
                                  onChange={(event) => {
                                      setSelectedPlanByExperience((prev) => ({
                                        ...prev,
                                        [e.id]: event.target.value,
                                      }));

                                      setTripPlanErrorByExperience((prev) => ({
                                        ...prev,
                                        [e.id]: "",
                                      }));
                                  }}

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

                                {tripPlanErrorByExperience[e.id] && (
                                  <div
                                    style={{
                                      padding: "10px",
                                      border: "1px solid #fecaca",
                                      borderRadius: "10px",
                                      backgroundColor: "#fef2f2",
                                      color: "#b91c1c",
                                      fontSize: "12px",
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {tripPlanErrorByExperience[e.id]}
                                  </div>
                                )}

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
                            {renderReplyControls(e)}
                            {renderTripPlanControls(e)}



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
                            onChange={(ev) => {
                              setReplyTextByExperience((prev) => ({
                                ...prev,
                                [e.id]: ev.target.value,
                              }));

                              setReplyErrorByExperience((prev) => ({
                                ...prev,
                                [e.id]: "",
                              }));
                            }}
                            placeholder="Write a reply..."
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "6px",
                              border: "1px solid #ddd",
                            }}
                          />

                            {replyErrorByExperience[e.id] && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  padding: "8px",
                                  border: "1px solid #fecaca",
                                  borderRadius: "8px",
                                  backgroundColor: "#fef2f2",
                                  color: "#b91c1c",
                                  fontSize: "12px",
                                  lineHeight: 1.4,
                                }}
                              >
                                {replyErrorByExperience[e.id]}
                              </div>
                            )}

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
                      {renderReplyControls(e)}
                      {renderTripPlanControls(e)}

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
                  Show all other experiences ({otherExperiences.length})
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
                  <div style={{ fontWeight: "600" }}>
                      {isCityPage
                        ? `Experiences from places in ${place?.name || "this city or region"}`
                        : "Other experiences"}
                  </div>

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

                        {isCityPage && e.place_name && e.place_name !== place?.name && (
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "13px",
                              color: "#666",
                              lineHeight: 1.4,
                            }}
                          >
                            About <strong>{e.place_name}</strong>
                            {e.place_type && e.place_type !== "city" && (
                              <> · {getPlaceTypeLabel(e.place_type)}</>
                            )}
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
                          {renderReplyControls(e)}
                          {renderTripPlanControls(e)}


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
      )}
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

const countryIntroBox = {
  marginTop: "14px",
  marginBottom: "18px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  display: "grid",
  gap: "8px",
};

const countryIntroEyebrow = {
  fontSize: "13px",
  color: "#166534",
  fontWeight: 700,
};

const countryIntroTitle = {
  margin: 0,
  fontSize: "20px",
};

const countryIntroText = {
  margin: 0,
  color: "#555",
  lineHeight: 1.6,
  fontSize: "14px",
};

const relatedPlacesBox = {
  marginTop: "20px",
  marginBottom: "30px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  display: "grid",
  gap: "14px",
};

const relatedPlacesEyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
  marginBottom: "4px",
};

const relatedPlacesTitle = {
  margin: 0,
  fontSize: "20px",
};

const relatedPlacesText = {
  margin: "8px 0 0 0",
  color: "#555",
  lineHeight: 1.5,
  fontSize: "14px",
};

const relatedPlacePrimaryLink = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: "8px",
  background: "black",
  color: "white",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 700,
};

const relatedPlaceSecondaryLink = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 700,
};

const relatedPlacesToggleButton = {
  width: "fit-content",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 700,
};

const relatedPlacesList = {
  display: "grid",
  gap: "8px",
};

const relatedPlaceListItem = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
};

const relatedPlaceSmallMeta = {
  marginTop: "4px",
  fontSize: "12px",
  color: "#777",
};

const relatedPlaceCompactActions = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const relatedPlacesSearchBox = {
  display: "grid",
  gap: "12px",
};

const relatedPlacesSearchInput = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const relatedPlacesEmptyHint = {
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#666",
  fontSize: "13px",
};

const relatedPlacesNoResultBox = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#111",
  display: "grid",
  gap: "8px",
};

const relatedPlacesSearchMainButton = {
  width: "fit-content",
  marginTop: "4px",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 700,
};

const relatedPlaceCreateSuccessBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "13px",
};

const relatedPlaceCreateSuccessLink = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #166534",
  background: "#166534",
  color: "white",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 700,
};

const relatedPlaceCreateSuccessButton = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "white",
  color: "#166534",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 700,
};

const relatedPlaceCreateErrorBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#991b1b",
  fontSize: "13px",
};

const relatedPlaceCreateConfirmBox = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  display: "grid",
  gap: "12px",
};

const experienceScopeBox = {
  marginTop: "16px",
  marginBottom: "18px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  display: "grid",
  gap: "8px",
};

const experienceScopeEyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
};

const experienceScopeTitle = {
  margin: 0,
  fontSize: "20px",
  lineHeight: 1.25,
};

const experienceScopeText = {
  margin: 0,
  color: "#555",
  lineHeight: 1.6,
  fontSize: "14px",
};

const experienceScopeWarningBox = {
  marginTop: "6px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#555",
  fontSize: "13px",
  lineHeight: 1.5,
};

const experiencePrimaryActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "12px",
  marginBottom: "18px",
};

const shareExperiencePrimaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const viewAllExperiencesButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 700,
};

const experienceListIntroBox = {
  marginTop: "18px",
  marginBottom: "20px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "white",
  display: "grid",
  gap: "6px",
};

const experienceListIntroEyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
};

const experienceListIntroHeading = {
  margin: 0,
  fontSize: "20px",
  lineHeight: 1.25,
};

const experienceListIntroTextStyle = {
  margin: 0,
  color: "#555",
  lineHeight: 1.5,
  fontSize: "14px",
};

const evaluationPromptBox = {
  marginTop: "14px",
  marginBottom: "24px",
  padding: "16px",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  background: "#fafafa",
  display: "grid",
  gap: "8px",
};

const evaluationPromptEyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
};

const evaluationPromptTitle = {
  margin: 0,
  fontSize: "18px",
  lineHeight: 1.3,
};

const evaluationPromptText = {
  margin: 0,
  color: "#555",
  fontSize: "14px",
  lineHeight: 1.5,
};

const evaluationPromptActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  alignItems: "center",
  marginTop: "6px",
};

const evaluationPromptPrimaryLink = {
  display: "inline-block",
  padding: "9px 12px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 700,
};

const evaluationPromptMeta = {
  color: "#666",
  fontSize: "13px",
};