"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

export default function PlacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shouldOpenUpdateForm = searchParams.get("share") === "update";
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [experiences, setExperiences] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "experience" | "update">("all");

  const [place, setPlace] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [countryContext, setCountryContext] = useState<any>(null);
  const [allPlaces, setAllPlaces] = useState<any[]>([]);

  const [loadingCountryContext, setLoadingCountryContext] = useState(false);

  const [showCreateChildPlaceForm, setShowCreateChildPlaceForm] = useState(false);
  const [newChildPlaceName, setNewChildPlaceName] = useState("");
  const [newChildPlaceCity, setNewChildPlaceCity] = useState("");
  const [creatingChildPlace, setCreatingChildPlace] = useState(false);
  const [createdChildPlace, setCreatedChildPlace] = useState<any>(null);
  const [searchInsideCountry, setSearchInsideCountry] = useState("");

  const [searchInsideCity, setSearchInsideCity] = useState("");
  const [specificPlaceResults, setSpecificPlaceResults] = useState<any[]>([]);
  const [specificPlaceSearchLoading, setSpecificPlaceSearchLoading] = useState(false);
  const [specificPlaceHasSearched, setSpecificPlaceHasSearched] = useState(false);

  const [showCreateSpecificPlaceForm, setShowCreateSpecificPlaceForm] = useState(false);
  const [newSpecificPlaceName, setNewSpecificPlaceName] = useState("");
  const [newSpecificPlaceType, setNewSpecificPlaceType] = useState<
    "nature" | "restaurant" | "hotel" | "attraction" | "other"
  >("nature");
  const [creatingSpecificPlace, setCreatingSpecificPlace] = useState(false);
  const [createdSpecificPlace, setCreatedSpecificPlace] = useState<any>(null);

  const [ratingsSummary, setRatingsSummary] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateType, setUpdateType] = useState<"event" | "alert" | "info">("info");
  const [updateText, setUpdateText] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const [updateTitle, setUpdateTitle] = useState("");
  const [updateCategory, setUpdateCategory] = useState("general");
  const [updateEventDate, setUpdateEventDate] = useState("");
  const [updateExternalLink, setUpdateExternalLink] = useState("");
  const [updateSourceName, setUpdateSourceName] = useState("");
  const [updateSourceUrl, setUpdateSourceUrl] = useState("");
  const [updatePriority, setUpdatePriority] = useState<"low" | "normal" | "high" | "urgent">("normal");


    useEffect(() => {
      if (shouldOpenUpdateForm) {
        setShowUpdateForm(true);
      }
    }, [shouldOpenUpdateForm]);

  const router = useRouter();

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

  const getUpdateDateLabel = (type?: string) => {
      if (type === "event") return "Event date";
      if (type === "alert") return "Alert date";
      if (type === "info") return "Info date";

      return "Related date";
  };

  const formatUpdateDateTime = (value?: string | null) => {
      if (!value) return null;

      return new Date(value).toLocaleString();
  };

  const normalizeText = (value?: string | null) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

  const placeTypeLabel = getPlaceTypeLabel(place?.place_type);

  const parentLocationLabel =
    place?.place_type === "country"
      ? ""
      : place?.destination_country ||
        destination?.country ||
        place?.destination_name ||
        destination?.name ||
        "";

  const breadcrumbParentLabel =
    place?.place_type === "country"
      ? "Countries"
      : parentLocationLabel || "Places";

const placeIntroText =
    place?.place_type === "country"
      ? `This is the country-level hub for ${place?.name || "this country"}. Use it for broad country experiences, country-wide travel context, alerts, events and useful information that are not tied to one specific city or place.`
      : place?.place_type === "city"
      ? `This is the city/region hub for ${place?.name || "this city or region"}. Use it for experiences and updates about the city or region as a whole, or to find and add specific places inside it.`
      : `This is the specific-place hub for ${place?.name || "this place"}. Use it for reviews, ratings, events, alerts and practical information about this exact location, whether it is a restaurant, hotel, attraction, nature spot or local place.`;

  const placeHubGuidance =
  place?.place_type === "country"
    ? [
        "Share country-level experiences that are not about one exact city or place.",
        "Move down to cities, islands or regions when the experience is more local.",
        "Post country-wide events, alerts or useful information.",
      ]
    : place?.place_type === "city"
    ? [
        "Share experiences about the city or region as a whole.",
        "Move down to a restaurant, hotel, attraction, beach or nature spot for exact-place reviews.",
        "Post local events, alerts or useful information.",
      ]
    : [
        "Share reviews and ratings about this exact place.",
        "Use this level for practical feedback about safety, cost, accessibility and convenience.",
        "Post events, alerts or useful information tied to this exact place.",
      ];

  const placeLocation =
    place?.place_type === "country"
      ? place?.destination_country || place?.name || ""
      : [
          placeTypeLabel,
          place?.city && place.city !== place?.name ? place.city : null,
          parentLocationLabel,
        ]
          .filter(Boolean)
          .join(" · ");

  const countryPlaceForHierarchy = allPlaces.find(
  (p) =>
    p.place_type === "country" &&
    normalizeText(p.name) === normalizeText(parentLocationLabel)
);

const cityPlaceForHierarchy = allPlaces.find(
  (p) =>
    p.place_type === "city" &&
    normalizeText(p.name) === normalizeText(place?.city) &&
    normalizeText(p.destination_country || p.destination_name) ===
      normalizeText(parentLocationLabel)
);

const hierarchyLevelLabel =
  place?.place_type === "country"
    ? "Country hub"
    : place?.place_type === "city"
    ? "City / Region hub"
    : "Specific place hub";

const hierarchyLevelDescription =
  place?.place_type === "country"
    ? "You are viewing the broad country layer. Use this level for general country context. Cities, islands, regions and exact places are organized below it."
    : place?.place_type === "city"
    ? "You are viewing a city or region layer. Use this level for local context. Restaurants, hotels, attractions, nature spots and other exact places are organized below it."
    : "You are viewing an exact-place layer. Ratings, experiences, events, alerts and practical information should refer to this specific place.";

const placeHierarchyItems =
  place?.place_type === "country"
    ? [
        {
          label: place?.name,
          href: null,
        },
      ].filter((item) => item.label)
    : place?.place_type === "city"
    ? [
        {
          label: parentLocationLabel,
          href: countryPlaceForHierarchy
            ? `/places/${countryPlaceForHierarchy.id}`
            : null,
        },
        {
          label: place?.name,
          href: null,
        },
      ].filter((item) => item.label)
    : [
        {
          label: parentLocationLabel,
          href: countryPlaceForHierarchy
            ? `/places/${countryPlaceForHierarchy.id}`
            : null,
        },
        {
          label: place?.city,
          href: cityPlaceForHierarchy
            ? `/places/${cityPlaceForHierarchy.id}`
            : null,
        },
        {
          label: place?.name,
          href: null,
        },
      ].filter((item) => item.label);

  const pageTitle =
      place?.place_type === "country" || place?.place_type === "city"
        ? `Experiences in ${place?.name || "this place"}`
        : `Activity in ${place?.name || "this place"}`;

  const activityFeedTitle =
  filter === "update"
    ? `Events & info about ${place?.name || "this place"}`
    : place?.place_type === "country"
    ? `Country-level activity in ${place?.name || "this country"}`
    : place?.place_type === "city"
    ? `City / region activity in ${place?.name || "this city or region"}`
    : `Activity about ${place?.name || "this place"}`;

const activityFeedDescription =
  filter === "update"
    ? "This list shows only events, alerts and useful information shared about this place."
    : place?.place_type === "country"
    ? "This feed shows broad country-level experiences and updates. For local reviews, move down to a city, island, region or exact place."
    : place?.place_type === "city"
    ? "This feed shows experiences and updates about this city or region as a whole. For exact-place reviews, move down to a restaurant, hotel, attraction, beach or local place."
    : "This feed shows experiences, reviews, events, alerts and useful information about this exact place.";

  const rating5 = experiences.filter((e) => e.rating === 5).length;
  const rating4 = experiences.filter((e) => e.rating === 4).length;
  const rating3 = experiences.filter((e) => e.rating === 3).length;
  const rating2 = experiences.filter((e) => e.rating === 2).length;
  const rating1 = experiences.filter((e) => e.rating === 1).length;

  const loadRatingsSummary = async (placeId: string | number) => {

      try {
        const res = await fetch(`${API_URL}/api/places/${placeId}/ratings-summary/`);

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to load ratings summary:", res.status, text);
          setRatingsSummary(null);
          return;
        }

        const data = await res.json();
        setRatingsSummary(data);
      } catch (error) {
        console.error("Ratings summary error:", error);
        setRatingsSummary(null);
      }
  };

  const loadCountryContext = async (countryPlaceId: string | number) => {
    setLoadingCountryContext(true);

    try {
      const res = await fetch(
        `${API_URL}/api/places/${countryPlaceId}/country-context/`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load country context:", res.status, text);
        setCountryContext(null);
        return;
      }

      const data = await res.json();
      setCountryContext(data);
    } catch (error) {
      console.error("Country context error:", error);
      setCountryContext(null);
    } finally {
      setLoadingCountryContext(false);
    }
  };

useEffect(() => {
  const checkLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/me/`, {
        credentials: "include",
      });

      setIsLoggedIn(res.ok);
    } catch (error) {
      console.error("Login check failed:", error);
      setIsLoggedIn(false);
    }
  };

  checkLogin();
}, []);

  useEffect(() => {
    if (!id) return;

    loadRatingsSummary(id);

    fetch(`${API_URL}/api/places/${id}/experiences/`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setExperiences(sorted);
      })
      .catch((err) => console.error(err));

fetch(`${API_URL}/api/places/${id}/updates/`, {
  credentials: "include",
})

.then(async (res) => {
  const data = await res.json();
  return data;
})

  .then((data) => {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.data)
      ? data.data
      : [];


    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setUpdates(sorted);
  })
  .catch((err) => console.error("UPDATES ERROR:", err));

    fetch(`${API_URL}/api/places/${id}/photos/`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setPhotos(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("PHOTOS ERROR:", err));

    fetch(`${API_URL}/api/places/`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        setAllPlaces(list);
      })
      .catch((err) => console.error("PLACES LIST ERROR:", err));

    fetch(`${API_URL}/api/places/${id}/`)
      .then((res) => res.json())
      .then((data) => {
        setPlace(data);

        if (data.place_type === "country") {
          loadCountryContext(data.id);
        } else {
          setCountryContext(null);
        }

        fetch(`${API_URL}/api/destinations/`)
          .then((res) => res.json())
          .then((destinations) => {
            const foundDestination = destinations.find(
              (d: any) => d.id === data.destination
            );
            setDestination(foundDestination);
          })
          .catch((err) => console.error(err));
      })
      .catch((err) => console.error(err));
  }, [id]);

  const ratedExperiences = experiences.filter((e) => e.rating);

  const averageRating =
      ratingsSummary?.overall?.average !== null &&
      ratingsSummary?.overall?.average !== undefined
        ? Number(ratingsSummary.overall.average).toFixed(1)
        : null;

    const roundedStars = averageRating ? Math.round(Number(averageRating)) : 0;

    const ratingCount = (stars: number) => {
      const distribution = ratingsSummary?.overall?.distribution || {};
      return Number(distribution[String(stars)] || 0);
    };

    const maxCount = Math.max(
      ratingCount(5),
      ratingCount(4),
      ratingCount(3),
      ratingCount(2),
      ratingCount(1),
      1
  );

    const practicalRatingStats = [
      {
        key: "safety",
        label: "Safety",
        description: "How safe travelers felt here.",
        ...(ratingsSummary?.practical?.safety || { average: null, count: 0 }),
      },
      {
        key: "cost",
        label: "Cost",
        description: "How travelers evaluate cost and value.",
        ...(ratingsSummary?.practical?.cost || { average: null, count: 0 }),
      },
      {
        key: "accessibility",
        label: "Accessibility",
        description: "How easy this place is to access or navigate.",
        ...(ratingsSummary?.practical?.accessibility || { average: null, count: 0 }),
      },
      {
        key: "convenience",
        label: "Convenience",
        description: "How practical or convenient the experience felt.",
        ...(ratingsSummary?.practical?.convenience || { average: null, count: 0 }),
      },
    ];

    const availablePracticalRatingStats = practicalRatingStats.filter(
      (stat) => stat.average !== null && stat.average !== undefined
    );

    // =========================
    // Build mixed activity feed
    // =========================
    // Experience updates are created automatically for the main social feed.
    // On the place page, experiences are already shown from the experiences list,
    // so we hide automatic experience updates here to avoid duplicate cards.
    const visibleUpdates = updates.filter((u) => u.type !== "experience");

    const combinedFeed = [
      ...experiences.map((e) => ({ ...e, content_type: "experience" })),
      ...visibleUpdates.map((u) => ({ ...u, content_type: "update" })),
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const filteredFeed = combinedFeed.filter((item) => {
      if (filter === "all") return true;
      return item.content_type === filter;
    });

    const countryChildPlaces = countryContext?.child_places || [];

    const filteredCountryChildPlaces = countryChildPlaces.filter((childPlace: any) => {
      const search = searchInsideCountry.trim().toLowerCase();

      // Avoid showing a long list while the user is still typing.
      if (search.length < 4) return false;

      const type = (childPlace.place_type || "").toLowerCase();

      // On a country hub, only show cities, islands and regions.
      // Specific places such as restaurants, hotels, attractions and beaches
      // should be searched from inside the city/region hub.
      if (type !== "city") return false;

      const name = (childPlace.name || "").toLowerCase();
      const city = (childPlace.city || "").toLowerCase();

      return name.includes(search) || city.includes(search);
    });

    const handleCreateChildPlace = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!place || place.place_type !== "country") return;

      const name = newChildPlaceName.trim();
      const city = newChildPlaceCity.trim() || name;
      const countryName =
        place.destination_country ||
        destination?.country ||
        place.name;

      if (!name) {
        alert("Please enter the city, island or region name.");
        return;
      }

      const confirmed = window.confirm(
          `You are creating a new city, island or region inside ${place.name}: ${name}. Continue?`
      );

      if (!confirmed) return;

      setCreatingChildPlace(true);
      setCreatedChildPlace(null);

      try {
        const res = await fetch(`${API_URL}/api/places/create-basic/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            city,
            country: countryName,
            place_type: "city",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Failed to create city/region:", data);
          alert(data.detail || "Error creating city or region.");
          return;
        }

        setCreatedChildPlace(data);
        setNewChildPlaceName("");
        setNewChildPlaceCity("");
        setShowCreateChildPlaceForm(false);

        await loadCountryContext(place.id);
      } catch (error) {
        console.error("Create child place failed:", error);
        alert("Error creating city or region.");
      } finally {
        setCreatingChildPlace(false);
      }
    };

    const handleSearchSpecificPlaces = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!place || place.place_type !== "city") return;

      const query = searchInsideCity.trim();

      setSpecificPlaceHasSearched(true);
      setSpecificPlaceResults([]);

      if (query.length < 2) {
        alert("Type at least 2 characters to search inside this city or region.");
        return;
      }

      const countryName =
        place.destination_country ||
        destination?.country ||
        destination?.name ||
        "";

      setSpecificPlaceSearchLoading(true);

      try {
        const params = new URLSearchParams({
          q: query,
        });

        if (countryName) {
          params.set("country", countryName);
        }

        const res = await fetch(
          `${API_URL}/api/places/search/?${params.toString()}`,
          {
            credentials: "include",
          }
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("Specific place search failed:", res.status, text);
          alert("Could not search specific places right now.");
          return;
        }

        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];

        const filtered = results.filter((result: any) => {
          const resultCity = String(result.city || "").toLowerCase().trim();
          const currentCity = String(place.name || "").toLowerCase().trim();

          const resultType = String(result.place_type || "").toLowerCase();

          return (
            resultCity === currentCity &&
            resultType !== "country" &&
            resultType !== "city"
          );
        });

        setSpecificPlaceResults(filtered);
      } catch (error) {
        console.error("Specific place search error:", error);
        alert("Could not search specific places right now.");
      } finally {
        setSpecificPlaceSearchLoading(false);
      }
    };

    const handleCreateSpecificPlace = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!place || place.place_type !== "city") return;

      const name = newSpecificPlaceName.trim();

      if (!name) {
        alert("Please enter the specific place name.");
        return;
      }

      const countryName =
        place.destination_country ||
        destination?.country ||
        destination?.name ||
        "";

      if (!countryName) {
        alert("Could not identify the country for this city or region.");
        return;
      }

      const confirmed = window.confirm(
        `You are creating a new specific place inside ${place.name}: ${name}. Continue?`
      );

      if (!confirmed) return;

      setCreatingSpecificPlace(true);
      setCreatedSpecificPlace(null);

      try {
        const res = await fetch(`${API_URL}/api/places/create-basic/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            city: place.name,
            country: countryName,
            place_type: newSpecificPlaceType,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Failed to create specific place:", data);
          alert(data.detail || "Error creating specific place.");
          return;
        }

        setCreatedSpecificPlace(data);
        setNewSpecificPlaceName("");
        setNewSpecificPlaceType("nature");
        setShowCreateSpecificPlaceForm(false);
        setSpecificPlaceResults((prev) => [data, ...prev]);
      } catch (error) {
        console.error("Create specific place failed:", error);
        alert("Error creating specific place.");
      } finally {
        setCreatingSpecificPlace(false);
      }
    };

    const handleSubmitUpdate = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!id) return;

      if (!updateText.trim()) {
        alert("Please write the event or information.");
        return;
      }

    const placeName = place?.name || "this place";

    const confirmed = window.confirm(
      `You are about to post this ${updateType} about ${placeName}. Continue?`
    );

    if (!confirmed) {
      return;
    }

      setSubmittingUpdate(true);

      try {
        const res = await fetch(`${API_URL}/api/updates/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
              place: id,
              type: updateType,
              category: updateCategory,
              title: updateTitle.trim(),
              text: updateText.trim(),
              event_date: updateEventDate || null,
              external_link: updateExternalLink.trim(),
              source_name: updateSourceName.trim(),
              source_url: updateSourceUrl.trim(),
              priority: updatePriority,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Failed to create update:", data);
          alert(data.detail || "Error sharing event or info.");
          return;
        }

        setUpdates((prev) => [data, ...prev]);
        setUpdateTitle("");
        setUpdateText("");
        setUpdateType("info");
        setUpdateCategory("general");
        setUpdateEventDate("");
        setUpdateExternalLink("");
        setUpdateSourceName("");
        setUpdateSourceUrl("");
        setUpdatePriority("normal");
        setShowUpdateForm(false);
        setFilter("update");
      } catch (error) {
        console.error("Create update failed:", error);
        alert("Error sharing event or info.");
      } finally {
        setSubmittingUpdate(false);
      }
    };

const handleToggleEventsInfo = () => {
  if (filter === "update") {
    setFilter("all");
    setShowUpdateForm(false);
    return;
  }

  setFilter("update");

  setTimeout(() => {
    document
      .getElementById("events-info-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

    const handleToggleUpdateForm = () => {
      if (showUpdateForm) {
        setShowUpdateForm(false);
        return;
      }

      setShowUpdateForm(true);

      setTimeout(() => {
        document
          .getElementById("place-update-form-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
       <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "#666" }}>
            Home
          </Link>

          {placeHierarchyItems.map((item, index) => (
            <span key={`${item.label}-breadcrumb-${index}`}>
              {" "}
              /{" "}
              {item.href ? (
                <Link href={item.href} style={{ textDecoration: "none", color: "#666" }}>
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </div>

        <section
          style={{
            marginBottom: "28px",
            padding: "22px",
            border: "1px solid #eee",
            borderRadius: "16px",
            backgroundColor: "white",
          }}
        >
          <div style={{ fontSize: "13px", color: "#777", marginBottom: "8px" }}>
            {placeTypeLabel} overview
          </div>

          <h1 style={{ margin: 0, fontSize: "28px" }}>
            {place?.name || pageTitle}
          </h1>

          {placeLocation && (
            <div
              style={{
                marginTop: "6px",
                color: "#666",
                fontSize: "15px",
              }}
            >
              {placeLocation}
            </div>
          )}

          {placeHierarchyItems.length > 0 && (
              <div style={hierarchyBox}>
                <div style={hierarchyLabel}>Place hierarchy</div>

                <div style={hierarchyPath}>
                  {placeHierarchyItems.map((item, index) => (
                    <span key={`${item.label}-${index}`} style={hierarchyItem}>
                      {index > 0 && <span style={hierarchySeparator}>→</span>}

                      {item.href ? (
                        <Link href={item.href} style={hierarchyLink}>
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: "12px",
                marginBottom: "18px",
                padding: "14px",
                border: "1px solid #dbeafe",
                borderRadius: "14px",
                backgroundColor: "#eff6ff",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#1d4ed8",
                  marginBottom: "6px",
                }}
              >
                {hierarchyLevelLabel}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "#1e3a8a",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {hierarchyLevelDescription}
              </p>

              <p
                style={{
                  marginTop: "8px",
                  marginBottom: 0,
                  color: "#1e3a8a",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {placeIntroText}
              </p>
            </div>

          <div style={hubGuidanceBox}>
              <div style={hubGuidanceTitle}>
                What this hub is for
              </div>

              <div style={hubGuidanceList}>
                {placeHubGuidance.map((item) => (
                  <div key={item} style={hubGuidanceItem}>
                    <span>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>Experiences</div>
              <div style={overviewStatValue}>
                {ratingsSummary?.overall?.total_reviews ?? experiences.length}
              </div>
            </div>

            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>Average rating</div>
              <div style={overviewStatValue}>
              {averageRating ? `${averageRating} ★` : "—"}
            </div>
            </div>

            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>Events & info</div>
              <div style={overviewStatValue}>
                  {visibleUpdates.length}
                </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => router.push(`/places/${id}/experiences`)}
              style={primaryButton}
            >
              Experiences
            </button>

            <button
              onClick={() => router.push(`/evaluations?place=${id}`)}
              style={secondaryButton}
            >
              View evaluations & insights
            </button>

            <button
              onClick={handleToggleEventsInfo}
              style={secondaryButton}
            >
              {filter === "update" ? "Hide events & info" : "Events & info"}
            </button>
            </div>

        <div style={actionHelperBox}>
          <strong>Want to rate or review?</strong>{" "}
          Use <strong>Experiences</strong>. Ratings are submitted together with a shared experience.
          {place?.place_type === "country"
            ? " If your review is about a specific city, island, region, restaurant, hotel, attraction or nature spot, move down the hierarchy first."
            : place?.place_type === "city"
            ? " If your review is about an exact restaurant, hotel, attraction, beach or nature spot, move to that specific place first."
            : " Use this level only when your review is about this exact place."}
          {" "}The ratings & insights area only summarizes what travelers have already shared.
        </div>

        </section>

           {filter === "update" && (

             <section
              id="events-info-section"
              style={{
              marginBottom: "28px",
              padding: "22px",
              border: "1px solid #eee",
              borderRadius: "16px",
              backgroundColor: "white",
              maxWidth: "760px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
              Place information
            </div>

            <h2 style={{ margin: 0, fontSize: "22px" }}>Events & info</h2>

            <p
              style={{
                marginTop: "8px",
                marginBottom: "18px",
                color: "#666",
                lineHeight: 1.5,
              }}
            >
              View events, alerts and useful information shared about this place — or add
              a new update.
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "18px",
              }}
            >
             <button
              type="button"
              onClick={handleToggleUpdateForm}
              style={primaryButton}
            >
              {showUpdateForm ? "Cancel new update" : "Share event, alert or info"}
            </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              <div style={insightStatCard}>
                <div style={overviewStatLabel}>Events</div>
                <div style={overviewStatValue}>
                  {updates.filter((u) => u.type === "event").length}
                </div>
              </div>

              <div style={insightStatCard}>
                <div style={overviewStatLabel}>Alerts</div>
                <div style={overviewStatValue}>
                  {updates.filter((u) => u.type === "alert").length}
                </div>
              </div>

              <div style={insightStatCard}>
                <div style={overviewStatLabel}>Useful info</div>
                <div style={overviewStatValue}>
                  {updates.filter((u) => u.type === "info").length}
                </div>
              </div>
            </div>
          </section>
        )}

        {place?.place_type === "country" && (
          <section
            style={{
              marginBottom: "28px",
              padding: "22px",
              border: "1px solid #eee",
              borderRadius: "16px",
              backgroundColor: "white",
            }}
          >
            <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
              Country structure
            </div>

            <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "22px" }}>
              Cities, islands and regions inside {place.name}
            </h2>
            <p
              style={{
                marginTop: 0,
                marginBottom: "18px",
                color: "#666",
                lineHeight: 1.5,
                maxWidth: "680px",
              }}
            >
              Use this section to move from the country layer into cities, islands,
              provinces or regions inside {place.name}. Search first before creating a new
              city or region, so country-level experiences stay separate from local
              experiences.
            </p>

                        <div
              style={{
                display: "grid",
                gap: "8px",
                marginBottom: "18px",
                maxWidth: "620px",
              }}
            >
              <label style={label}>Search inside {place.name}</label>

              <input
                value={searchInsideCountry}
                onChange={(e) => setSearchInsideCountry(e.target.value)}
                placeholder={`Search cities, islands or regions inside ${place.name}`}
                style={input}
              />

              <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  Type at least 4 characters to search for a city, island or region inside this country.
              </p>
            </div>

            {showCreateChildPlaceForm && (
              <form
                onSubmit={handleCreateChildPlace}
                style={{
                  display: "grid",
                  gap: "12px",
                  padding: "16px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "#fafafa",
                  marginBottom: "18px",
                  maxWidth: "620px",
                }}
              >
                <div>
                  <strong>Create city, island or region inside {place.name}</strong>

                  <p
                    style={{
                      margin: "6px 0 0 0",
                      color: "#666",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    Use this for broad travel areas inside this country, such as cities,
                    islands, provinces or regions. Specific beaches, restaurants, hotels
                    and attractions should be added later inside a city or region.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>City, island or region name</label>

                  <input
                    value={newChildPlaceName}
                    onChange={(e) => setNewChildPlaceName(e.target.value)}
                    placeholder="Example: Bali, Nias, Jakarta, Lombok, Tuscany"
                    style={input}
                  />
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Optional display label</label>

                  <input
                    value={newChildPlaceCity}
                    onChange={(e) => setNewChildPlaceCity(e.target.value)}
                    placeholder="Optional. Leave blank to use the same name."
                    style={input}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingChildPlace || !newChildPlaceName.trim()}
                  style={{
                    ...primaryButton,
                    opacity:
                      creatingChildPlace || !newChildPlaceName.trim()
                        ? 0.5
                        : 1,
                    cursor:
                      creatingChildPlace || !newChildPlaceName.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                {creatingChildPlace
                  ? "Creating..."
                  : `Create city/island/region inside ${place.name}`}
                </button>
              </form>
            )}

            <div
              style={{
                borderTop: "1px solid #eee",
                paddingTop: "16px",
                marginTop: "6px",
                marginBottom: "18px",
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowCreateChildPlaceForm((prev) => !prev)
                }
                style={{
                  ...secondaryButton,
                  fontSize: "13px",
                  padding: "8px 12px",
                }}
              >
                {showCreateChildPlaceForm
                  ? "Cancel"
                  : `Add city, island or region inside ${place.name}`}
              </button>
            </div>

            {createdChildPlace && (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #c7f0d8",
                  borderRadius: "14px",
                  backgroundColor: "#f2fbf5",
                  marginBottom: "18px",
                }}
              >
                <strong>{createdChildPlace.name} was created.</strong>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/places/${createdChildPlace.id}`)
                    }
                    style={primaryButton}
                  >
                    View page
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/destinations?place=${createdChildPlace.id}&share=true`
                      )
                    }
                    style={secondaryButton}
                  >
                    Share first experience
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatedChildPlace(null)}
                    style={secondaryButton}
                  >
                    Stay here
                  </button>
                </div>
              </div>
            )}

            {loadingCountryContext ? (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "12px",
                  color: "#777",
                  backgroundColor: "#fafafa",
                }}
              >
                Loading cities, islands and regions...
              </div>

            ) : searchInsideCountry.trim().length >= 4 && filteredCountryChildPlaces.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                {filteredCountryChildPlaces.map((childPlace: any) => (
                  <div
                    key={childPlace.id}
                    style={{
                      padding: "14px",
                      border: "1px solid #eee",
                      borderRadius: "14px",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#777",
                        marginBottom: "6px",
                      }}
                    >
                      {getPlaceTypeLabel(childPlace.place_type)}
                    </div>

                    <h3
                      style={{
                        margin: 0,
                        marginBottom: "6px",
                        fontSize: "17px",
                      }}
                    >
                      {childPlace.name}
                    </h3>

                    {childPlace.city && (
                      <div
                        style={{
                          color: "#666",
                          fontSize: "13px",
                          marginBottom: "10px",
                        }}
                      >
                        {childPlace.city}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginTop: "10px",
                      }}
                    >
                      <Link
                        href={`/places/${childPlace.id}`}
                        style={{
                          display: "inline-block",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          backgroundColor: "#111",
                          color: "white",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        View page
                      </Link>

                      <Link
                        href={`/destinations?place=${childPlace.id}&share=true`}
                        style={{
                          display: "inline-block",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          border: "1px solid #ddd",
                          backgroundColor: "white",
                          color: "#111",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        Share experience
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

            ) : searchInsideCountry.trim() && searchInsideCountry.trim().length < 4 ? (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "12px",
                  color: "#777",
                  backgroundColor: "#fafafa",
                  marginBottom: "18px",
                }}
              >
                Keep typing to search inside {place.name}. Use at least 4 characters.
              </div>
            ) : searchInsideCountry.trim() ? (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "12px",
                  color: "#777",
                  backgroundColor: "#fafafa",
                  marginBottom: "18px",
                }}
              >
               No city, island or region found for “{searchInsideCountry}”.
              </div>
            ) : (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "12px",
                  color: "#777",
                  backgroundColor: "#fafafa",
                  marginBottom: "18px",
                }}
              >
                Use the search above to find cities, islands or regions inside{" "}
                {place.name}.
              </div>
            )}
          </section>
        )}

        {place?.place_type === "city" && (
          <section
            style={{
              marginBottom: "28px",
              padding: "22px",
              border: "1px solid #eee",
              borderRadius: "16px",
              backgroundColor: "white",
            }}
          >
            <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
              City / region structure
            </div>

            <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "22px" }}>
              Find or add specific places inside {place.name}
            </h2>

            <p
              style={{
                marginTop: 0,
                marginBottom: "18px",
                color: "#666",
                lineHeight: 1.5,
                maxWidth: "680px",
              }}
            >
              Use this section to move from the city or region layer into specific places
              inside {place.name}, such as beaches, hotels, restaurants, attractions or
              nature spots. Search first before creating a new place, so city-level
              experiences stay separate from experiences about exact locations.
            </p>

            <form
              onSubmit={handleSearchSpecificPlaces}
              style={{
                display: "grid",
                gap: "8px",
                marginBottom: "18px",
                maxWidth: "620px",
              }}
            >
              <label style={label}>Search inside {place.name}</label>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={searchInsideCity}
                  onChange={(e) => {
                    setSearchInsideCity(e.target.value);
                    setSpecificPlaceResults([]);
                    setSpecificPlaceHasSearched(false);
                  }}
                  placeholder={`Example: beach, hotel, restaurant, viewpoint or attraction inside ${place.name}`}
                  style={{
                    ...input,
                    flex: 1,
                    minWidth: "220px",
                  }}
                />

                <button
                  type="submit"
                  disabled={specificPlaceSearchLoading}
                  style={{
                    ...secondaryButton,
                    opacity: specificPlaceSearchLoading ? 0.5 : 1,
                    cursor: specificPlaceSearchLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {specificPlaceSearchLoading ? "Searching..." : "Search"}
                </button>
              </div>

                          <p
                style={{
                  margin: 0,
                  color: "#777",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                Search first if you already know the specific place. If it does not appear,
                you can add it below as a specific place inside {place.name}.
              </p>

            </form>

            {specificPlaceHasSearched && specificPlaceResults.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                {specificPlaceResults.map((specificPlace: any) => (
                  <div
                    key={specificPlace.id}
                    style={{
                      padding: "14px",
                      border: "1px solid #eee",
                      borderRadius: "14px",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#777",
                        marginBottom: "6px",
                      }}
                    >
                      {getPlaceTypeLabel(specificPlace.place_type)}
                    </div>

                    <h3
                      style={{
                        margin: 0,
                        marginBottom: "6px",
                        fontSize: "17px",
                      }}
                    >
                      {specificPlace.name}
                    </h3>

                    <div
                      style={{
                        color: "#666",
                        fontSize: "13px",
                        marginBottom: "10px",
                      }}
                    >
                      {specificPlace.city || place.name}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginTop: "10px",
                      }}
                    >
                      <Link
                        href={`/places/${specificPlace.id}`}
                        style={{
                          display: "inline-block",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          backgroundColor: "#111",
                          color: "white",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        View page
                      </Link>

                      <Link
                        href={`/destinations?place=${specificPlace.id}&share=true`}
                        style={{
                          display: "inline-block",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          border: "1px solid #ddd",
                          backgroundColor: "white",
                          color: "#111",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        Share experience
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {specificPlaceHasSearched &&
              !specificPlaceSearchLoading &&
              specificPlaceResults.length === 0 && (
                <div
                  style={{
                    padding: "14px",
                    border: "1px solid #eee",
                    borderRadius: "12px",
                    color: "#777",
                    backgroundColor: "#fafafa",
                    marginBottom: "18px",
                  }}
                >
                  No specific place found inside {place.name} for “{searchInsideCity}”.
                </div>
              )}

            {showCreateSpecificPlaceForm && (
              <form
                onSubmit={handleCreateSpecificPlace}
                style={{
                  display: "grid",
                  gap: "12px",
                  padding: "16px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "#fafafa",
                  marginBottom: "18px",
                  maxWidth: "620px",
                }}
              >
                <div>
                  <strong>Create specific place inside {place.name}</strong>

                  <p
                    style={{
                      margin: "6px 0 0 0",
                      color: "#666",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    Use this for beaches, restaurants, hotels, tourist
                    attractions, nature spots or other specific places inside
                    this city, island or region.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Specific place name</label>

                  <input
                    value={newSpecificPlaceName}
                    onChange={(e) => setNewSpecificPlaceName(e.target.value)}
                    placeholder="Example: Kuta Beach, Colosseum, Central Market"
                    style={input}
                  />
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Place type</label>

                  <select
                    value={newSpecificPlaceType}
                    onChange={(e) =>
                      setNewSpecificPlaceType(
                        e.target.value as
                          | "nature"
                          | "restaurant"
                          | "hotel"
                          | "attraction"
                          | "other"
                      )
                    }
                    style={input}
                  >
                    <option value="nature">Beach / Nature spot</option>
                    <option value="restaurant">Restaurant / Café</option>
                    <option value="hotel">Hotel / Stay</option>
                    <option value="attraction">Tourist attraction</option>
                    <option value="other">Other specific place</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={creatingSpecificPlace || !newSpecificPlaceName.trim()}
                  style={{
                    ...primaryButton,
                    opacity:
                      creatingSpecificPlace || !newSpecificPlaceName.trim()
                        ? 0.5
                        : 1,
                    cursor:
                      creatingSpecificPlace || !newSpecificPlaceName.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {creatingSpecificPlace
                    ? "Creating..."
                    : `Create specific place inside ${place.name}`}
                </button>
              </form>
            )}

            <div
              style={{
                borderTop: "1px solid #eee",
                paddingTop: "16px",
                marginTop: "6px",
                marginBottom: "18px",
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowCreateSpecificPlaceForm((prev) => !prev)
                }
                style={{
                  ...secondaryButton,
                  fontSize: "13px",
                  padding: "8px 12px",
                }}
              >
                {showCreateSpecificPlaceForm
                  ? "Cancel"
                  : `Add specific place inside ${place.name}`}
              </button>
            </div>

            {createdSpecificPlace && (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #c7f0d8",
                  borderRadius: "14px",
                  backgroundColor: "#f2fbf5",
                  marginBottom: "18px",
                }}
              >
                <strong>{createdSpecificPlace.name} was created.</strong>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/places/${createdSpecificPlace.id}`)
                    }
                    style={primaryButton}
                  >
                    View page
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/destinations?place=${createdSpecificPlace.id}&share=true`
                      )
                    }
                    style={secondaryButton}
                  >
                    Share first experience
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatedSpecificPlace(null)}
                    style={secondaryButton}
                  >
                    Stay here
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {showUpdateForm && (
          <section
            id="place-update-form-section"
            style={{
              marginBottom: "28px",
              padding: "22px",
              border: "1px solid #eee",
              borderRadius: "16px",
              backgroundColor: "white",
              maxWidth: "760px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
              Place update
            </div>

            <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "22px" }}>
              Share event or info
            </h2>

            <p
              style={{
                marginTop: 0,
                marginBottom: "16px",
                color: "#666",
                lineHeight: 1.5,
              }}
            >
              Share an event, alert or useful information about this place.
            </p>

            <form onSubmit={handleSubmitUpdate} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Type</label>

                <select
                  value={updateType}
                  onChange={(e) =>
                    setUpdateType(e.target.value as "event" | "alert" | "info")
                  }
                  style={input}
                >
                  <option value="info">Useful info</option>
                  <option value="event">Event</option>
                  <option value="alert">Alert</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Short title</label>

                <input
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder={
                    updateType === "event"
                      ? "Event title, e.g. Free concert tonight"
                      : updateType === "alert"
                      ? "Alert title, e.g. Museum closed this Sunday"
                      : "Useful info title, e.g. Best entrance is on the north side"
                  }
                  maxLength={160}
                  style={input}
                />
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Details</label>

                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Write the event, alert or useful information..."
                  rows={4}
                  style={input}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Category</label>

                  <select
                    value={updateCategory}
                    onChange={(e) => setUpdateCategory(e.target.value)}
                    style={input}
                  >
                    <option value="general">General</option>
                    <option value="tourism">Tourism</option>
                    <option value="music">Music</option>
                    <option value="religious">Religious</option>
                    <option value="social">Social</option>
                    <option value="transport">Transport</option>
                    <option value="safety">Safety</option>
                    <option value="weather">Weather</option>
                    <option value="food">Food</option>
                    <option value="culture">Culture</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>
                    {updateType === "event"
                      ? "Event date and time"
                      : updateType === "alert"
                      ? "Alert related date/time"
                      : "Info related date/time"}
                  </label>

                  <input
                    type="datetime-local"
                    value={updateEventDate}
                    onChange={(e) => setUpdateEventDate(e.target.value)}
                    style={input}
                  />

                  <div style={dateTimeHelperBox}>
                    <strong>
                      {updateType === "event"
                        ? "When does this event happen?"
                        : updateType === "alert"
                        ? "When is this alert relevant?"
                        : "When is this information relevant?"}
                    </strong>

                    <span>
                      Use this field when the information has a specific date or time. Avoid
                      repeating the date only inside the text.
                    </span>
                  </div>
                </div>
              </div>

              {updateType === "alert" && (
                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Alert priority</label>

                  <select
                    value={updatePriority}
                    onChange={(e) =>
                      setUpdatePriority(
                        e.target.value as "low" | "normal" | "high" | "urgent"
                      )
                    }
                    style={input}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              )}

              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "#fafafa",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px" }}>Optional source and links</strong>

                  <p
                    style={{
                      margin: "6px 0 0 0",
                      color: "#666",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    Add a source or official link when the information should be verified.
                  </p>
                </div>

                <input
                  value={updateSourceName}
                  onChange={(e) => setUpdateSourceName(e.target.value)}
                  placeholder="Source name, e.g. official website, venue page, local authority"
                  style={input}
                />

                <input
                  value={updateSourceUrl}
                  onChange={(e) => setUpdateSourceUrl(e.target.value)}
                  placeholder="Source URL, e.g. https://..."
                  style={input}
                />

                <input
                  value={updateExternalLink}
                  onChange={(e) => setUpdateExternalLink(e.target.value)}
                  placeholder="Related link, e.g. ticket page, event page, article..."
                  style={input}
                />
              </div>

              <button
                type="submit"
                disabled={submittingUpdate || !updateText.trim()}
                style={{
                  ...primaryButton,
                  opacity: submittingUpdate || !updateText.trim() ? 0.5 : 1,
                  cursor:
                    submittingUpdate || !updateText.trim() ? "not-allowed" : "pointer",
                }}
              >
                {submittingUpdate
                  ? "Sharing..."
                  : `Share about ${place?.name || "this place"}`}
              </button>
            </form>
          </section>
        )}

        <section
          style={{
            marginBottom: "18px",
            padding: "18px",
            border: "1px solid #eee",
            borderRadius: "14px",
            backgroundColor: "white",
          }}
        >
          <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
            Activity feed
          </div>

          <h2 style={{ margin: 0, fontSize: "22px" }}>
            {activityFeedTitle}
          </h2>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#666",
              lineHeight: 1.5,
              fontSize: "14px",
              maxWidth: "680px",
            }}
          >
            {activityFeedDescription}
          </p>
        </section>

        {filteredFeed.length === 0 ? (
          <div
            style={{
              padding: "16px",
              border: "1px solid #eee",
              borderRadius: "10px",
              backgroundColor: "white",
              color: "#777",
              fontSize: "14px",
            }}
          >
            {filter === "update"
              ? "No events or information shared about this place yet."
              : "No activity found for this place yet."}
          </div>
        ) : (
          filteredFeed.map((item) => {
            const isExperience = item.content_type === "experience";

            const label = isExperience
              ? "Review"
              : item.type === "event"
              ? "Event"
              : item.type === "alert"
              ? "Alert"
              : "Info";

            const icon = isExperience
              ? "⭐"
              : item.type === "event"
              ? "🎭"
              : item.type === "alert"
              ? "⚠️"
              : "ℹ️";

            return (
              <div
                key={`${item.content_type}-${item.id}`}
                style={{
                  padding: "18px",
                  marginBottom: "14px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#777" }}>
                    {icon} {label}
                  </div>

                  {item.category && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#555",
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #eee",
                        borderRadius: "999px",
                        padding: "4px 8px",
                      }}
                    >
                      {item.category}
                    </div>
                  )}
                </div>

                {isExperience ? (
                  <>
                    {item.title && (
                      <div
                        style={{
                          fontWeight: 600,
                          lineHeight: "1.5",
                          marginBottom: "6px",
                        }}
                      >
                        {item.title}
                      </div>
                    )}

                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title || "Shared experience"}
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

                    <div style={{ fontWeight: "400", lineHeight: "1.5" }}>
                      {item.comment}
                    </div>

                    <div style={{ marginTop: "8px", color: "#777", fontSize: "13px" }}>
                      Rating: {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </div>

                    {[
                      ["Safety", item.safety_rating],
                      ["Cost", item.cost_rating],
                      ["Accessibility", item.accessibility_rating],
                      ["Convenience", item.convenience_rating],
                    ].some(([, value]) => value) && (
                      <div style={practicalRatingsMiniBox}>
                        <strong>Practical ratings</strong>

                        <div style={practicalRatingsMiniGrid}>
                          {[
                            ["Safety", item.safety_rating],
                            ["Cost", item.cost_rating],
                            ["Accessibility", item.accessibility_rating],
                            ["Convenience", item.convenience_rating],
                          ]
                            .filter(([, value]) => value)
                            .map(([label, value]) => (
                              <span key={label} style={practicalRatingsMiniBadge}>
                                {label}: {"★".repeat(Number(value))}
                                {"☆".repeat(5 - Number(value))}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: "6px", color: "#777", fontSize: "13px" }}>
                      Shared by {item.user || "Unknown user"} •{" "}
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>


                    <div style={{ marginTop: "12px" }}>
                        <Link
                          href={`/experiences/${item.id}`}
                          style={{
                            display: "inline-block",
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "1px solid #ddd",
                            backgroundColor: "#f9f9f9",
                            color: "#111",
                            textDecoration: "none",
                            fontSize: "13px",
                          }}
                        >
                          Read experience
                        </Link>
                    </div>


                  </>
                ) : (
                  <>
                    {item.event_date && (
                      <div style={updateDateMiniBox}>
                        <span style={updateDateMiniIcon}>📅</span>

                        <span>
                          <strong>{getUpdateDateLabel(item.type)}:</strong>{" "}
                          {formatUpdateDateTime(item.event_date)}
                        </span>
                      </div>
                    )}

                    <div style={{ fontWeight: "500", lineHeight: "1.5" }}>
                      {item.text}
                    </div>

                    <div style={{ marginTop: "8px", color: "#777", fontSize: "13px" }}>
                      Shared by {item.display_name || item.username || item.user}
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <Link
                        href={`/updates/${item.id}`}
                        style={{
                          display: "inline-block",
                          padding: "8px 12px",
                          borderRadius: "10px",
                          border: "1px solid #ddd",
                          backgroundColor: "#f9f9f9",
                          color: "#111",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        Read update
                      </Link>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
    </main>
  );
}

const overviewStatCard = {
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "12px",
  backgroundColor: "#fafafa",
};

const insightStatCard = {
  padding: "16px",
  border: "1px solid #eee",
  borderRadius: "14px",
  backgroundColor: "#fafafa",
};

const overviewStatLabel = {
  fontSize: "12px",
  color: "#777",
  marginBottom: "6px",
};

const overviewStatValue = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#111",
};

const primaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#111",
  color: "white",
  cursor: "pointer",
  fontSize: "14px",
};

const secondaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  backgroundColor: "white",
  color: "#111",
  cursor: "pointer",
  fontSize: "14px",
};

const updateDateMiniBox = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 10px",
  borderRadius: "999px",
  border: "1px solid #eee",
  backgroundColor: "#fafafa",
  color: "#555",
  fontSize: "13px",
  marginBottom: "10px",
};

const updateDateMiniIcon = {
  fontSize: "14px",
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const label = {
  fontSize: "13px",
  color: "#666",
  fontWeight: 600,
};

const dateTimeHelperBox = {
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #eee",
  backgroundColor: "#fafafa",
  color: "#555",
  fontSize: "12px",
  lineHeight: 1.45,
};

const hubGuidanceBox = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  backgroundColor: "#fafafa",
  marginBottom: "18px",
  maxWidth: "680px",
};

const hubGuidanceTitle = {
  fontSize: "13px",
  color: "#555",
  fontWeight: 700,
  marginBottom: "8px",
};

const hubGuidanceList = {
  display: "grid",
  gap: "6px",
};

const hubGuidanceItem = {
  display: "flex",
  gap: "8px",
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.45,
};

const hierarchyBox = {
  marginTop: "14px",
  padding: "12px 14px",
  border: "1px solid #eee",
  borderRadius: "14px",
  backgroundColor: "#fafafa",
  maxWidth: "680px",
};

const hierarchyLabel = {
  fontSize: "12px",
  color: "#777",
  fontWeight: 600,
  marginBottom: "6px",
};

const hierarchyPath = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "6px",
  alignItems: "center",
  color: "#333",
  fontSize: "14px",
  fontWeight: 600,
};

const hierarchyItem = {
  display: "inline-flex",
  gap: "6px",
  alignItems: "center",
};

const hierarchySeparator = {
  color: "#999",
  fontWeight: 400,
};

const hierarchyLink = {
  color: "#111",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  fontWeight: 700,
};

const actionHelperBox = {
  marginTop: "12px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #eee",
  backgroundColor: "#fafafa",
  color: "#555",
  fontSize: "13px",
  lineHeight: 1.5,
  maxWidth: "680px",
};

const practicalRatingsMiniBox = {
  marginTop: "10px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  backgroundColor: "#fafafa",
  display: "grid",
  gap: "8px",
  color: "#555",
  fontSize: "12px",
};

const practicalRatingsMiniGrid = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const practicalRatingsMiniBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #eee",
  backgroundColor: "white",
  fontSize: "12px",
};
