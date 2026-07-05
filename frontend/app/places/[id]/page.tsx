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

  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [suggestedParentPlaceId, setSuggestedParentPlaceId] = useState("");
  const [locationSuggestionReason, setLocationSuggestionReason] = useState("");
  const [submittingLocationSuggestion, setSubmittingLocationSuggestion] = useState(false);
  const [locationSuggestionSubmitted, setLocationSuggestionSubmitted] = useState(false);
  const [showLocationSuggestionForm, setShowLocationSuggestionForm] = useState(false);

  const [loadingCountryContext, setLoadingCountryContext] = useState(false);

  const [showCreateChildPlaceForm, setShowCreateChildPlaceForm] = useState(false);
  const [newChildPlaceName, setNewChildPlaceName] = useState("");
  const [newChildPlaceCity, setNewChildPlaceCity] = useState("");
  const [creatingChildPlace, setCreatingChildPlace] = useState(false);
  const [createdChildPlace, setCreatedChildPlace] = useState<any>(null);
  const [searchInsideCountry, setSearchInsideCountry] = useState("");
  const [hasSearchedInsideCountry, setHasSearchedInsideCountry] = useState(false);

  const [searchInsideCity, setSearchInsideCity] = useState("");
  const [specificPlaceResults, setSpecificPlaceResults] = useState<any[]>([]);
  const [specificPlaceSearchLoading, setSpecificPlaceSearchLoading] = useState(false);
  const [specificPlaceHasSearched, setSpecificPlaceHasSearched] = useState(false);
  const [showSpecificPlaceTools, setShowSpecificPlaceTools] = useState(false);

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

  const parentPlaceLabel =
    place?.place_type !== "country"
      ? place?.parent_place_name || ""
      : "";

  const breadcrumbParentLabel =
    place?.place_type === "country"
      ? "Countries"
      : parentLocationLabel || "Places";

const placeIntroText =
    place?.place_type === "country"
      ? `This is the country-level hub for ${place?.name || "this country"}. Use it for broad country experiences, country-wide travel context, alerts, events and useful information that are not tied to one specific city or place.`
      : place?.place_type === "city"
      ? `This is the city/region hub for ${place?.name || "this city or region"}. Use it for experiences and updates about the city or region as a whole, or to find and add specific places inside it.`
      : parentPlaceLabel
      ? `This is the specific-place hub for ${place?.name || "this place"}, inside ${parentPlaceLabel}. Use it for reviews, ratings, events, alerts and practical information about this exact location.`
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

const specificPlaceTypes = ["attraction", "hotel", "restaurant", "nature", "other"];

  const childSpecificPlaces = allPlaces
    .filter(
      (p) =>
        place?.id &&
        Number(p.parent_place) === Number(place.id) &&
        specificPlaceTypes.includes(p.place_type)
    )
    .sort((a, b) => {
      const reviewsDiff = Number(b.reviews_count || 0) - Number(a.reviews_count || 0);

      if (reviewsDiff !== 0) return reviewsDiff;

      const ratingDiff = Number(b.average_rating || 0) - Number(a.average_rating || 0);

      if (ratingDiff !== 0) return ratingDiff;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const topChildSpecificPlaces = childSpecificPlaces.slice(0, 5);

  const countryPlaceForHierarchy = allPlaces.find(
  (p) =>
    p.place_type === "country" &&
    normalizeText(p.name) === normalizeText(parentLocationLabel)
);

const cityPlaceForHierarchy =
  place?.parent_place
    ? allPlaces.find((p) => p.id === place.parent_place)
    : allPlaces.find(
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
          label: parentPlaceLabel || place?.city,
          href: cityPlaceForHierarchy
            ? `/places/${cityPlaceForHierarchy.id}`
            : place?.parent_place
            ? `/places/${place.parent_place}`
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
    ? "This feed shows only experiences and updates shared directly about this city or region. For exact-place reviews, open one of the specific places above."
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

  const loadLocationSuggestions = async (placeId: string | number) => {
    try {
      const res = await fetch(
        `${API_URL}/api/places/${placeId}/location-suggestions/`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load location suggestions:", res.status, text);
        setLocationSuggestions([]);
        return;
      }

      const data = await res.json();
      setLocationSuggestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Location suggestions error:", error);
      setLocationSuggestions([]);
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
       loadLocationSuggestions(id);

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

    const visibleExperiences =
      place?.place_type === "city"
        ? experiences.filter((e) => Number(e.place) === Number(place.id))
        : experiences;

    const combinedFeed = [
      ...visibleExperiences.map((e) => ({ ...e, content_type: "experience" })),
      ...visibleUpdates.map((u) => ({ ...u, content_type: "update" })),
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const filteredFeed = combinedFeed.filter((item) => {
      if (filter === "all") return true;
      return item.content_type === filter;
    });

    const suggestedParentPlaceOptions = allPlaces
      .filter((candidate) => {
        if (!place || !candidate) return false;

        if (Number(candidate.id) === Number(place.id)) return false;

        if (!["country", "city"].includes(candidate.place_type)) return false;

        if (
          place.destination &&
          candidate.destination &&
          Number(candidate.destination) !== Number(place.destination)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const typeOrder: Record<string, number> = {
          country: 1,
          city: 2,
        };

        const typeDiff =
          (typeOrder[a.place_type] || 99) - (typeOrder[b.place_type] || 99);

        if (typeDiff !== 0) return typeDiff;

        return String(a.name || "").localeCompare(String(b.name || ""));
      });

        const countryChildPlaces = countryContext?.child_places || [];

        const countryCityRegionPlaces = countryChildPlaces
          .filter((childPlace: any) => {
            const type = (childPlace.place_type || "").toLowerCase();

            // On a country hub, only show cities, islands and regions.
            // Specific places such as restaurants, hotels, attractions and beaches
            // should be searched from inside the city/region hub.
            return type === "city";
          })
          .sort((a: any, b: any) => {
            const reviewsDiff =
              Number(b.reviews_count || 0) - Number(a.reviews_count || 0);

            if (reviewsDiff !== 0) return reviewsDiff;

            const ratingDiff =
              Number(b.average_rating || 0) - Number(a.average_rating || 0);

            if (ratingDiff !== 0) return ratingDiff;

            return String(a.name || "").localeCompare(String(b.name || ""));
          });

        const topCountryCityRegionPlaces = countryCityRegionPlaces.slice(0, 5);

        const filteredCountryChildPlaces = countryCityRegionPlaces.filter(
          (childPlace: any) => {
            const search = searchInsideCountry.trim().toLowerCase();

            // Avoid showing a long list while the user is still typing.
            if (search.length < 4) return false;

            const name = (childPlace.name || "").toLowerCase();
            const city = (childPlace.city || "").toLowerCase();

            return name.includes(search) || city.includes(search);
          }
        );

    const hasCountrySearch =
     hasSearchedInsideCountry && searchInsideCountry.trim().length >= 4;
    const canCreateCountryChildPlace =
      hasCountrySearch && filteredCountryChildPlaces.length === 0;

    const hasSpecificPlaceSearch = specificPlaceHasSearched && searchInsideCity.trim().length >= 2;
    const canCreateSpecificPlace =
      hasSpecificPlaceSearch &&
      !specificPlaceSearchLoading &&
      specificPlaceResults.length === 0;

    const handleSubmitLocationSuggestion = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!place) return;

      if (!isLoggedIn) {
        router.push(`/login?next=/places/${place.id}`);
        return;
      }

      if (!suggestedParentPlaceId) {
        alert("Please choose the suggested city, region or country.");
        return;
      }

      setSubmittingLocationSuggestion(true);
      setLocationSuggestionSubmitted(false);

      try {
        const res = await fetch(`${API_URL}/api/place-location-suggestions/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            place: place.id,
            suggested_parent_place: Number(suggestedParentPlaceId),
            reason: locationSuggestionReason.trim(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Failed to submit location suggestion:", data);
          alert(data.detail || "Could not submit location suggestion.");
          return;
        }

        setSuggestedParentPlaceId("");
        setLocationSuggestionReason("");
        setLocationSuggestionSubmitted(true);
        setShowLocationSuggestionForm(false);

        await loadLocationSuggestions(place.id);
      } catch (error) {
        console.error("Submit location suggestion failed:", error);
        alert("Could not submit location suggestion.");
      } finally {
        setSubmittingLocationSuggestion(false);
      }
    };

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

        const placeResult = {
          ...data,
          already_exists: res.status === 200,
        };

        setCreatedChildPlace(placeResult);
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

        const placeResult = {
          ...data,
          already_exists: res.status === 200,
        };

        setCreatedSpecificPlace(placeResult);
        setNewSpecificPlaceName("");
        setNewSpecificPlaceType("nature");
        setShowCreateSpecificPlaceForm(false);
        setSpecificPlaceResults((prev) => [placeResult, ...prev]);
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

          {place && place.place_type !== "country" && (
            <div
              style={{
                marginTop: "16px",
                marginBottom: "18px",
                padding: "16px",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                backgroundColor: "#fafafa",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#333",
                  marginBottom: "6px",
                }}
              >
                Help improve this place location
              </div>

              <p
                style={{
                  marginTop: 0,
                  marginBottom: "12px",
                  color: "#666",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                If this place should be listed under another city, island or region,
                you can suggest a better location. Suggestions are reviewed before
                changing the hierarchy.
              </p>

              {locationSuggestionSubmitted && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "10px",
                    borderRadius: "10px",
                    backgroundColor: "#ecfdf5",
                    color: "#047857",
                    fontSize: "13px",
                  }}
                >
                  Location suggestion submitted. Thank you for helping improve this place.
                </div>
              )}

              <button
                  type="button"
                  onClick={() => setShowLocationSuggestionForm((prev) => !prev)}
                  style={secondaryButton}
              >
                  {showLocationSuggestionForm
                    ? "Hide suggestion form"
                    : "Suggest a better location"}
              </button>


              {showLocationSuggestionForm && (
                <form onSubmit={handleSubmitLocationSuggestion}>
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#444",
                      marginBottom: "6px",
                    }}
                  >
                    Suggested parent city, region or country
                  </label>

                  <select
                    value={suggestedParentPlaceId}
                    onChange={(e) => setSuggestedParentPlaceId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "10px",
                      backgroundColor: "white",
                    }}
                  >
                    <option value="">Choose a suggested location</option>

                    {suggestedParentPlaceOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {getPlaceTypeLabel(candidate.place_type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#444",
                      marginBottom: "6px",
                    }}
                  >
                    Reason / local context
                  </label>

                  <textarea
                    value={locationSuggestionReason}
                    onChange={(e) => setLocationSuggestionReason(e.target.value)}
                    placeholder="Example: Eagle Beach is commonly associated with Noord, not only Aruba as a whole."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "10px",
                      resize: "vertical",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingLocationSuggestion}
                  style={secondaryButton}
                >
                  {submittingLocationSuggestion
                    ? "Submitting..."
                    : "Suggest better location"}
                </button>
               </form>
              )}

              {locationSuggestions.length > 0 && (
                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "12px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#555",
                      marginBottom: "8px",
                    }}
                  >
                    Current location suggestions
                  </div>

                  {locationSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      style={{
                        padding: "10px",
                        border: "1px solid #eee",
                        borderRadius: "10px",
                        backgroundColor: "white",
                        marginBottom: "8px",
                      }}
                    >
                      <div style={{ fontSize: "14px", color: "#333" }}>
                        Suggested parent:{" "}
                        <strong>{suggestion.suggested_parent_place_name}</strong>
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "#777",
                        }}
                      >
                        Status: {suggestion.status}
                      </div>

                      {suggestion.reason && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "13px",
                            color: "#555",
                            lineHeight: 1.4,
                          }}
                        >
                          {suggestion.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div style={overviewStatCard}>
              <div style={overviewStatLabel}>
                  {place?.place_type === "city" ? "Area experiences" : "Experiences"}
              </div>

              <div style={overviewStatValue}>
                {ratingsSummary?.overall?.total_reviews ?? experiences.length}
              </div>

              {place?.place_type === "city" && (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "#777",
                    lineHeight: 1.4,
                  }}
                >
                  Includes experiences from this city/region and from specific places inside it.
                </div>
              )}
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

            <label style={label}>Step 1 — Search first inside {place.name}</label>

              <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "stretch",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    value={searchInsideCountry}
                    onChange={(e) => {
                      setSearchInsideCountry(e.target.value);
                      setHasSearchedInsideCountry(false);
                      setShowCreateChildPlaceForm(false);
                    }}
                    placeholder={`Search cities, islands or regions inside ${place.name}`}
                    style={{
                      ...input,
                      flex: "1 1 260px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (searchInsideCountry.trim().length < 4) {
                        alert("Type at least 4 characters to search.");
                        return;
                      }

                      setHasSearchedInsideCountry(true);
                      setShowCreateChildPlaceForm(false);
                    }}
                    style={{
                      ...secondaryButton,
                      flex: "0 0 auto",
                    }}
                  >
                    Search
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
                Type the name, then click Search. This helps avoid creating duplicates or
                alternate spellings of the same place.
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
                display: "grid",
                gap: "10px",
                maxWidth: "620px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#555",
                }}
              >
                Step 2 — Create only if this city, island or region is not listed
              </div>

              {!hasCountrySearch ? (
                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  Type at least 4 characters above before creating a new city, island
                  or region.
                </p>
              ) : filteredCountryChildPlaces.length > 0 ? (
                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  We found possible matches. Open an existing page if it is the same
                  place. Create a new one only if your city, island or region is truly
                  different.
                </p>
              ) : (
                <>
                  <p
                    style={{
                      margin: 0,
                      color: "#777",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    No matching city, island or region was found for “{searchInsideCountry}”.
                    You can create a new one if this is really a different place.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateChildPlaceForm((prev) => !prev)
                    }
                    style={{
                      ...secondaryButton,
                      fontSize: "13px",
                      padding: "8px 12px",
                      width: "fit-content",
                    }}
                  >
                    {showCreateChildPlaceForm
                      ? "Cancel"
                      : `Create city, island or region inside ${place.name}`}
                  </button>
                </>
              )}
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
                <strong>
                  {createdChildPlace.already_exists
                    ? "This city, island or region already exists. We found the existing page."
                    : `${createdChildPlace.name} was created.`}
                </strong>

                {createdChildPlace.already_exists && (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      color: "#666",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    To avoid duplicates, Trust Travel will use the existing page for{" "}
                    <strong>{createdChildPlace.name}</strong>.
                  </p>
                )}

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
                    {createdChildPlace.already_exists
                      ? "Share experience"
                      : "Share first experience"}
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

            ) : hasCountrySearch && filteredCountryChildPlaces.length > 0 ? (
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

            ) : searchInsideCountry.trim() && !hasSearchedInsideCountry ? (
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
                Type at least 4 characters, then click Search to look for existing cities, islands or regions inside {place.name}.
              </div>
            ) : searchInsideCountry.trim() ? null : (
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

            {topCountryCityRegionPlaces.length > 0 && (
              <div style={{ marginBottom: "18px" }}>
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "10px",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  {countryCityRegionPlaces.length}{" "}
                  {countryCityRegionPlaces.length === 1
                    ? "city/region added."
                    : "cities/regions added."}{" "}
                  Showing top {topCountryCityRegionPlaces.length} by traveler activity.
                </p>

                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#555",
                    marginBottom: "8px",
                  }}
                >
                  Top cities and regions
                </div>

                <div style={{ display: "grid", gap: "10px", maxWidth: "680px" }}>
                  {topCountryCityRegionPlaces.map((childPlace: any) => (
                    <div
                      key={childPlace.id}
                      style={{
                        padding: "12px",
                        border: "1px solid #eee",
                        borderRadius: "12px",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{childPlace.name}</div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#666",
                          marginTop: "4px",
                          marginBottom: "10px",
                        }}
                      >
                        {getPlaceTypeLabel(childPlace.place_type)}
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Link href={`/places/${childPlace.id}`} style={secondaryButton}>
                          View page
                        </Link>

                        <Link
                          href={`/destinations?place=${childPlace.id}&share=true`}
                          style={secondaryButton}
                        >
                          Share experience
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
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
              Specific places inside {place.name}
            </h2>

            {!showSpecificPlaceTools ? (
              <>
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "16px",
                    color: "#666",
                    lineHeight: 1.5,
                    maxWidth: "680px",
                  }}
                >
                  Restaurants, hotels, attractions, beaches, nature spots and other exact
                  places can be added under this city or region.
                </p>

                                {childSpecificPlaces.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <p
                      style={{
                        marginTop: 0,
                        marginBottom: "10px",
                        color: "#666",
                        fontSize: "14px",
                      }}
                    >
                      {childSpecificPlaces.length}{" "}
                      {childSpecificPlaces.length === 1
                        ? "specific place added."
                        : "specific places added."}{" "}
                      Showing top {topChildSpecificPlaces.length} by traveler activity.
                    </p>

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#555",
                        marginBottom: "8px",
                      }}
                    >
                      Top specific places
                    </div>

                    <div style={{ display: "grid", gap: "10px" }}>
                      {topChildSpecificPlaces.map((child) => (
                        <div
                          key={child.id}
                          style={{
                            padding: "12px",
                            border: "1px solid #eee",
                            borderRadius: "12px",
                            backgroundColor: "#fafafa",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{child.name}</div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "#666",
                              marginTop: "4px",
                              marginBottom: "10px",
                            }}
                          >
                            {getPlaceTypeLabel(child.place_type)}
                          </div>

                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <a href={`/places/${child.id}`} style={secondaryButton}>
                              View place
                            </a>

                            <a
                              href={`/destinations?place=${child.id}&share=true`}
                              style={secondaryButton}
                            >
                              Share experience
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowSpecificPlaceTools(true)}
                  style={secondaryButton}
                >
                  Find or add specific places inside {place.name}
                </button>
              </>
            ) : (
              <>
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

                <div style={{ marginBottom: "16px" }}>
                  <button
                    type="button"
                    onClick={() => setShowSpecificPlaceTools(false)}
                    style={secondaryButton}
                  >
                    Hide specific place tools
                  </button>
                </div>

            <form
              onSubmit={handleSearchSpecificPlaces}
              style={{
                display: "grid",
                gap: "8px",
                marginBottom: "18px",
                maxWidth: "620px",
              }}
            >
              <label style={label}>Step 1 — Search first inside {place.name}</label>

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
                Search first to avoid creating duplicates or alternate spellings of the same
                specific place. If it does not appear, you can create it in Step 2.
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

            <div
              style={{
                borderTop: "1px solid #eee",
                paddingTop: "16px",
                marginTop: "6px",
                marginBottom: "18px",
                display: "grid",
                gap: "10px",
                maxWidth: "620px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#555",
                }}
              >
                Step 2 — Create only if this specific place is not listed
              </div>

              {!specificPlaceHasSearched ? (
                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  Search above before creating a new restaurant, hotel, attraction,
                  beach, nature spot or local place.
                </p>
              ) : specificPlaceSearchLoading ? (
                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  Searching for possible matches...
                </p>
              ) : specificPlaceResults.length > 0 ? (
                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  We found possible matches. Open an existing page if it is the same
                  place. Create a new one only if your specific place is truly different.
                </p>
              ) : (
                <>
                  <p
                    style={{
                      margin: 0,
                      color: "#777",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    No matching specific place was found inside {place.name} for “{searchInsideCity}”.
                    You can create a new one if this is really a different place.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateSpecificPlaceForm((prev) => !prev)
                    }
                    style={{
                      ...secondaryButton,
                      fontSize: "13px",
                      padding: "8px 12px",
                      width: "fit-content",
                    }}
                  >
                    {showCreateSpecificPlaceForm
                      ? "Cancel"
                      : `Create specific place inside ${place.name}`}
                  </button>
                </>
              )}
            </div>

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
                <strong>
                  {createdSpecificPlace.already_exists
                    ? "This place already exists. We found the existing place."
                    : `${createdSpecificPlace.name} was created.`}
                </strong>

                {createdSpecificPlace.already_exists && (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      color: "#666",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    To avoid duplicates, Trust Travel will use the existing page for{" "}
                    <strong>{createdSpecificPlace.name}</strong>.
                  </p>
                )}

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
                  {createdSpecificPlace.already_exists
                      ? "Share experience"
                      : "Share first experience"}
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
            </>
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
