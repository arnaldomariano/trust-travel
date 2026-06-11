"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../lib/api";

export default function DestinationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeFromUrl = searchParams.get("place");
  const shouldOpenShareForm = searchParams.get("share") === "true";

  const mode = searchParams.get("mode");
  const isExperienceMode = mode === "experience";
  const isUpdateMode = mode === "update";

  const [places, setPlaces] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceCity, setNewPlaceCity] = useState("");
  const [newPlaceCountry, setNewPlaceCountry] = useState("");
  const [showCreatePlaceForm, setShowCreatePlaceForm] = useState(false);

  const [placeType, setPlaceType] = useState<
  "country" | "city" | "attraction" | "hotel" | "restaurant" | "nature" | "other"
  >("country");

  const [selectedCountryPlace, setSelectedCountryPlace] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showShareForm, setShowShareForm] = useState(false);
  const [createdPlaceId, setCreatedPlaceId] = useState<number | null>(null);
  const [showRelatedPlaces, setShowRelatedPlaces] = useState(false);
  const [relatedPlaceSearch, setRelatedPlaceSearch] = useState("");

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [tripContext, setTripContext] = useState("prefer_not_to_say");
  const [tripStyle, setTripStyle] = useState("prefer_not_to_say");

  const [submittingExperience, setSubmittingExperience] = useState(false);
  const [experienceShared, setExperienceShared] = useState(false);
  const [sharedExperience, setSharedExperience] = useState<any>(null);
  const [editingExperience, setEditingExperience] = useState(false);

  // =========================
  // Load places and destinations
  // =========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [placesRes, destinationsRes] = await Promise.all([
          fetch(`${API_URL}/api/places/`),
          fetch(`${API_URL}/api/destinations/`),
        ]);

        if (!placesRes.ok || !destinationsRes.ok) {
          console.error("Failed to load places or destinations");
          return;
        }

        const placesData = await placesRes.json();
        const destinationsData = await destinationsRes.json();

        setPlaces(placesData || []);
        setDestinations(destinationsData || []);
      } catch (error) {
        console.error("Search page load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

// =========================
// Select place from URL
// =========================
useEffect(() => {
  if (!placeFromUrl || places.length === 0) return;

  const place = places.find((p) => String(p.id) === String(placeFromUrl));

  if (!place) return;

  setSelectedPlace(place);
  setSearchTerm(place.name || "");
  setShowShareForm(shouldOpenShareForm);
  setExperienceShared(false);
  setSharedExperience(null);
  setEditingExperience(false);
  setTitle("");
  setComment("");
  setRating(null);
  setImageFile(null);
  setTripContext("prefer_not_to_say");
   setTripStyle("prefer_not_to_say");

  setTimeout(() => {
    document
      .getElementById("selected-place-actions")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}, [placeFromUrl, shouldOpenShareForm, places]);

  // =========================
  // Search and filtering
  // =========================

  const normalizeText = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizedSearchText = normalizeText(searchTerm);

const getSimilarityScore = (place: any) => {
  if (!normalizedSearchText) return 0;

  const placeName = normalizeText(place.name);
  const placeCity = normalizeText(place.city || place.destination_name);

  const isCountrySearch = placeType === "country";
  const isCitySearch = placeType === "city";
  const isSpecificSearch = placeType !== "country" && placeType !== "city";

  // Country mode must only suggest countries.
  if (isCountrySearch) {
    if (place.place_type !== "country") return 0;

    if (placeName === normalizedSearchText) return 100;
    if (placeName.startsWith(normalizedSearchText)) return 90;
    if (placeName.includes(normalizedSearchText)) return 80;

    return 0;
  }

  // City / Region mode must only suggest cities/regions.
  // It should not suggest a city only because its country matches the search.
  if (isCitySearch) {
    if (place.place_type !== "city") return 0;

    if (placeName === normalizedSearchText) return 100;
    if (placeName.startsWith(normalizedSearchText)) return 90;
    if (placeName.includes(normalizedSearchText)) return 80;

    if (normalizedSearchText.length >= 4 && placeCity.includes(normalizedSearchText)) {
      return 60;
    }

    return 0;
  }

  // Specific place types should only be suggested after a country is selected.
  if (isSpecificSearch) {
    if (!selectedCountryPlace) return 0;
    if (place.place_type !== placeType) return 0;

    const selectedCountryName = normalizeText(selectedCountryPlace.name);
    const placeCountry = normalizeText(place.destination_country);

    if (placeCountry !== selectedCountryName) return 0;

    if (placeName === normalizedSearchText) return 100;
    if (placeName.startsWith(normalizedSearchText)) return 90;
    if (placeName.includes(normalizedSearchText)) return 80;

    if (normalizedSearchText.length >= 4 && placeCity.includes(normalizedSearchText)) {
      return 60;
    }

    return 0;
  }

  return 0;
};

const similarPlaces = places
  .map((place) => ({
    ...place,
    similarityScore: getSimilarityScore(place),
  }))
  .filter((place) => place.similarityScore >= 60)
  .sort((a, b) => b.similarityScore - a.similarityScore)
  .slice(0, 5);

const getSearchMatchScore = (place: any) => {
  if (!normalizedSearchText) return 0;

  const name = normalizeText(place.name);
  const city = normalizeText(place.city || place.destination_name);

  const isCountrySearch = placeType === "country";
  const isCitySearch = placeType === "city";
  const isSpecificSearch = placeType !== "country" && placeType !== "city";

  const isCountry = place.place_type === "country";
  const isCity = place.place_type === "city";
  const isSpecific = place.place_type === placeType;

  // =========================
  // Country search
  // =========================
  // Country mode must only return countries.
  if (isCountrySearch) {
    if (!isCountry) return 0;

    if (name === normalizedSearchText) return 100;
    if (name.startsWith(normalizedSearchText)) return 90;
    if (name.includes(normalizedSearchText)) return 80;

    return 0;
  }

  // =========================
  // City / region search
  // =========================
  // City mode may search globally by city/region name.
  // This is useful when the user knows the city but not the country.
  // But it must NOT return cities only because the country name matches.
  if (isCitySearch) {
    if (!isCity) return 0;

    if (name === normalizedSearchText) return 100;
    if (name.startsWith(normalizedSearchText)) return 90;
    if (name.includes(normalizedSearchText)) return 80;

    if (normalizedSearchText.length < 4) return 0;

    if (city.includes(normalizedSearchText)) return 60;

    return 0;
  }

  // =========================
  // Specific place search
  // =========================
  // Attractions, hotels, restaurants, nature spots and other specific places
  // should only be searched after a country context exists.
  if (isSpecificSearch) {
    if (!selectedCountryPlace) return 0;
    if (!isSpecific) return 0;

    const selectedCountryName = normalizeText(selectedCountryPlace.name);
    const placeCountry = normalizeText(place.destination_country);

    if (placeCountry !== selectedCountryName) return 0;

    if (name === normalizedSearchText) return 100;
    if (name.startsWith(normalizedSearchText)) return 90;
    if (name.includes(normalizedSearchText)) return 80;

    if (normalizedSearchText.length < 4) return 0;

    if (city.includes(normalizedSearchText)) return 60;

    return 0;
  }

  return 0;
};

const filteredPlaces = places
  .map((place) => ({
    ...place,
    searchMatchScore: getSearchMatchScore(place),
  }))
  .filter((place) => place.searchMatchScore > 0)
  .sort((a, b) => {
    if (a.searchMatchScore !== b.searchMatchScore) {
      return b.searchMatchScore - a.searchMatchScore;
    }

    return (a.name || "").localeCompare(b.name || "");
  });

const placesInsideSelectedCountry = selectedCountryPlace
  ? places
      .filter((place) => {
        if (place.place_type === "country") return false;

        const selectedCountryName = normalizeText(selectedCountryPlace.name);
        const placeCountry = normalizeText(place.destination_country);

        return placeCountry === selectedCountryName;
      })
      .sort((a, b) => {
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


const normalizedRelatedPlaceSearch = normalizeText(relatedPlaceSearch);

const filteredPlacesInsideSelectedCountry = normalizedRelatedPlaceSearch
  ? placesInsideSelectedCountry.filter((place) => {
      const name = normalizeText(place.name);
      const city = normalizeText(place.city || place.destination_name);

      return (
        name.includes(normalizedRelatedPlaceSearch) ||
        city.includes(normalizedRelatedPlaceSearch)
      );
    })
  : [];

  const canCreatePlace = !!newPlaceName.trim();

const searchPlaceholderByType: Record<typeof placeType, string> = {
  country: "Search a country, e.g. Laos, Brazil, Italy",
  city: "Search a city or region, e.g. Recife, Tuscany, Itatiaia",
  attraction: "Search an attraction, e.g. Coliseu, Acropolis, Kuang Si Waterfalls",
  hotel: "Search a hotel, e.g. Hotel name, resort, hostel...",
  restaurant: "Search a restaurant or café, e.g. Café X, restaurant Y...",
  nature: "Search a beach, park, trail, waterfall or nature spot...",
  other: "Search a place, area, business or travel reference...",
};

const placeNamePlaceholderByType: Record<typeof placeType, string> = {
  country: "Country name, e.g. Laos",
  city: "City or region name, e.g. Recife, Tuscany, Itatiaia",
  attraction: "Attraction name, e.g. Coliseu, Acropolis",
  hotel: "Hotel name, e.g. Hotel X",
  restaurant: "Restaurant or café name, e.g. Café X",
  nature: "Nature spot name, e.g. Praia de Boa Viagem, Kuang Si Waterfalls",
  other: "Neutral place name",
};

const cityPlaceholderByType: Record<typeof placeType, string> = {
  country: "Optional region or capital, e.g. Southeast Asia",
  city: "City or region, e.g. Recife, Tuscany",
  attraction: "City or region, e.g. Rome, Athens, Luang Prabang",
  hotel: "City or region where the hotel is located",
  restaurant: "City or region where the restaurant is located",
  nature: "City, region or nearest location",
  other: "City or region, if relevant",
};

const countryPlaceholderByType: Record<typeof placeType, string> = {
  country: "Country, e.g. Laos",
  city: "Country, e.g. Brazil",
  attraction: "Country, e.g. Italy, Greece, Laos",
  hotel: "Country where the hotel is located",
  restaurant: "Country where the restaurant is located",
  nature: "Country, e.g. Brazil, Laos, Netherlands",
  other: "Country, if relevant",
};

// =========================
// Place hierarchy helpers
// =========================

const isCountryPlace = (place: any) => {
  return place?.place_type === "country";
};

const isCityOrRegionPlace = (place: any) => {
  return place?.place_type === "city";
};

const isSpecificPlace = (place: any) => {
  return (
    !!place &&
    place.place_type !== "country" &&
    place.place_type !== "city"
  );
};

const getParentCountryName = (place: any) => {
  if (!place) return "";

  if (isCountryPlace(place)) {
    return place.name || "";
  }

  return (
    place.destination_country ||
    place.country_name ||
    ""
  );
};

const getParentDestinationName = (place: any) => {
  if (!place) return "";

  if (isCountryPlace(place)) {
    return place.name || "";
  }

  return (
    place.destination_country ||
    place.destination_name ||
    place.country_name ||
    ""
  );
};

const getPlaceHierarchyLabel = (place: any) => {
  if (!place) return "";

  if (isCountryPlace(place)) {
    return place.name || "Country";
  }

  const parentCountry = getParentCountryName(place);

  if (parentCountry) {
    return `${place.name} · ${parentCountry}`;
  }

  return place.name || "Place";
};

const getPlaceTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    country: "Country",
    city: "City / Region",
    attraction: "Tourist attraction",
    hotel: "Hotel",
    restaurant: "Restaurant / Café",
    nature: "Beach / Nature spot",
    other: "Other",
  };

  return labels[type || ""] || "Place";
};

const getPlaceLocationText = (place: any) => {
  if (!place) return "Place";

  if (isCountryPlace(place)) {
    return place.name || "Country";
  }

  const locationParts = [
    place.city || place.destination_name,
    getParentCountryName(place),
  ].filter(Boolean);

  return locationParts.join(" · ") || getPlaceHierarchyLabel(place);
};

const filteredCountryPlaces =
  placeType === "country"
    ? filteredPlaces.filter((place) => isCountryPlace(place))
    : [];

const filteredCityOrRegionPlaces =
  placeType === "city"
    ? filteredPlaces.filter((place) => isCityOrRegionPlace(place))
    : [];

const filteredSpecificPlaces =
  placeType !== "country" && placeType !== "city"
    ? filteredPlaces.filter((place) => place.place_type === placeType)
    : [];

const isDirectPlaceFlow = !!placeFromUrl && !!selectedPlace;

const selectedPlaceReviewsCount =
  Number(selectedPlace?.reviews_count ?? selectedPlace?.average_rating_count ?? 0);

const selectedPlaceParentCountryName = selectedPlace
  ? getParentCountryName(selectedPlace)
  : "";

const selectedPlaceParentCountryPlace = selectedPlaceParentCountryName
  ? places.find(
      (place) =>
        isCountryPlace(place) &&
        normalizeText(place.name) === normalizeText(selectedPlaceParentCountryName)
    )
  : null;

const selectedPlaceHasNoExperiences =
  !!selectedPlace && selectedPlaceReviewsCount === 0;

const primaryPlaceTypeOptions = [
  ["country", "Country"],
  ["city", "City / Region"],
] as const;

const specificPlaceTypeOptions = [
  ["attraction", "Tourist attraction"],
  ["hotel", "Hotel"],
  ["restaurant", "Restaurant / Café"],
  ["nature", "Beach / Nature"],
  ["other", "Other"],
] as const;

const placeTypeOptionsToShow =
  selectedCountryPlace || selectedPlace
    ? [...primaryPlaceTypeOptions, ...specificPlaceTypeOptions]
    : primaryPlaceTypeOptions;

  // =========================
  // Create a basic place
  // =========================
  const handleCreatePlace = async () => {
    if (!canCreatePlace) return;

    setCreatingPlace(true);

    try {
      const res = await fetch(`${API_URL}/api/places/create-basic/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newPlaceName.trim(),
          place_type: placeType,
          city:
            placeType === "country"
              ? ""
              : placeType === "city"
              ? newPlaceCity.trim() || newPlaceName.trim()
              : newPlaceCity.trim(),
          country:
            placeType === "country"
              ? newPlaceName.trim()
              : newPlaceCountry.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Error creating place.");
        return;
      }

        setPlaces((prev) => {
          const alreadyExists = prev.some((place) => place.id === data.id);

          if (alreadyExists) {
            return prev;
          }

          return [data, ...prev];
        });

if (isUpdateMode) {
  router.push(`/create?place=${data.id}`);
  return;
}

    setSelectedPlace(data);
    setCreatedPlaceId(data.id);

    // Do not open the experience form automatically after creating a place.
    // The user can click the selected place card to open the form.
    setShowShareForm(false);
    setShowCreatePlaceForm(false);

    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
    setSearchTerm(data.name || newPlaceName.trim());

    setNewPlaceName("");
    setNewPlaceCity("");
    setNewPlaceCountry("");

    } catch (error) {
      console.error("Create basic place failed:", error);
      alert("Error creating place.");
    } finally {
      setCreatingPlace(false);
    }
  };

    // =========================
    // Select country as search context
    // =========================
    const handleSelectCountry = (place: any) => {
      // In normal exploration mode, opening a country should go directly
      // to the country experiences page.
      if (!isExperienceMode && !isUpdateMode) {
        router.push(`/places/${place.id}/experiences`);
        return;
      }

      // In creation modes, keep the country as context so the user can decide
      // whether to share/post about the country or choose a city/region.
      setSelectedCountryPlace(place);
      setSelectedPlace(null);
      setCreatedPlaceId(null);
      setShowShareForm(false);
      setShowCreatePlaceForm(false);
      setShowRelatedPlaces(false);
      setRelatedPlaceSearch("");
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);
      setTitle("");
      setComment("");
      setRating(null);
      setImageFile(null);
      setTripContext("prefer_not_to_say");
      setTripStyle("prefer_not_to_say");

      setTimeout(() => {
        document
          .getElementById("country-context")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    // =========================
    // Share directly about selected country
    // =========================
    const handleShareAboutCountry = () => {
      if (!selectedCountryPlace) return;

      setSelectedPlace(selectedCountryPlace);
      setCreatedPlaceId(null);
      setShowShareForm(true);
      setShowCreatePlaceForm(false);
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);
      setTitle("");
      setComment("");
      setRating(null);
      setImageFile(null);
      setTripContext("prefer_not_to_say");
      setTripStyle("prefer_not_to_say");

      setTimeout(() => {
        document
          .getElementById("share-experience-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    // =========================
    // Create city/region inside selected country
    // =========================
    const openCreateCityInSelectedCountry = () => {
      if (!selectedCountryPlace) return;

      setPlaceType("city");
      setSelectedPlace(null);
      setCreatedPlaceId(null);
      setShowShareForm(false);
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);

      setNewPlaceName("");
      setNewPlaceCity("");
      setNewPlaceCountry(selectedCountryPlace.name || "");

      setShowCreatePlaceForm(true);

      setTimeout(() => {
        document
          .getElementById("create-place-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

  // =========================
  // Select an existing place
  // =========================
  const handleSelectExistingPlace = (place: any) => {
  if (isUpdateMode) {
    router.push(`/create?place=${place.id}`);
    return;
  }

    const isSameSelectedPlace = selectedPlace?.id === place.id;

    setSelectedPlace(place);
    setCreatedPlaceId(null);

    // In experience mode, the first click selects the place.
    // If the place is already selected, clicking again opens the experience form.
    setShowShareForm(isExperienceMode && isSameSelectedPlace);

    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
      setTitle("");
      setComment("");
      setRating(null);
      setImageFile(null);
      setTripContext("prefer_not_to_say");
      setTripStyle("prefer_not_to_say");

      setTimeout(() => {
        document
          .getElementById(
            isExperienceMode && isSameSelectedPlace
              ? "share-experience-form"
              : "selected-place-actions"
          )
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

  // =========================
  // Change selected place
  // =========================
  const handleChangePlace = () => {
    setSelectedCountryPlace(null);
    setSelectedPlace(null);
    setCreatedPlaceId(null);
    setShowRelatedPlaces(false);
    setRelatedPlaceSearch("");
    setTitle("");
    setComment("");
    setRating(null);
    setImageFile(null);
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
    setShowShareForm(false);
    setShowCreatePlaceForm(false);
    setTripContext("prefer_not_to_say");
    setTripStyle("prefer_not_to_say");
  };

  // =========================
  // Reset share flow
  // =========================
  const resetShareFlow = () => {
    setSelectedCountryPlace(null);
    setSelectedPlace(null);
    setCreatedPlaceId(null);
    setSearchTerm("");
    setNewPlaceName("");
    setNewPlaceCity("");
    setNewPlaceCountry("");
    setTitle("");
    setComment("");
    setRating(null);
    setImageFile(null);
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
    setShowShareForm(false);
    setShowCreatePlaceForm(false);
    setRelatedPlaceSearch("");
    setTripContext("prefer_not_to_say");
    setTripStyle("prefer_not_to_say");
  };

// =========================
// Start editing shared experience
// =========================
const startEditingExperience = () => {
  if (!sharedExperience) return;

  setTitle(sharedExperience.title || "");
  setComment(sharedExperience.comment || "");
  setRating(sharedExperience.rating || null);
  setImageFile(null);
  setTripContext(sharedExperience.trip_context || "prefer_not_to_say");
  setTripStyle(sharedExperience.trip_style || "prefer_not_to_say");
  setExperienceShared(false);
  setEditingExperience(true);
};

  // =========================
  // Submit experience
  // =========================
  const handleSubmitExperience = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlace) return;

    if (!title.trim()) {
      alert("Please add a short title.");
      return;
    }

    if (!rating) {
      alert("Please select a rating.");
      return;
    }

    if (!comment.trim()) {
      alert("Please write your experience.");
      return;
    }

    setSubmittingExperience(true);

    try {
      const formData = new FormData();

formData.append("place", String(selectedPlace.id));
formData.append("title", title.trim());
formData.append("rating", String(rating));
formData.append("comment", comment.trim());
formData.append("trip_context", tripContext);
formData.append("trip_style", tripStyle);


if (imageFile) {
  formData.append("image", imageFile);
}

const res = await fetch(`${API_URL}/api/experiences/`, {
  method: "POST",
  credentials: "include",
  body: formData,
});

      const data = await res.json();

      if (!res.ok) {
        console.error("Experience error:", data);
        alert(data.detail || "Error sharing experience.");
        return;
      }

      setSharedExperience(data);
      setTitle("");
      setComment("");
      setRating(null);
      setImageFile(null);
      setExperienceShared(true);
      setTripContext("prefer_not_to_say");
      setTripStyle("prefer_not_to_say");
    } catch (error) {
      console.error("Share experience failed:", error);
      alert("Error sharing experience.");
    } finally {
      setSubmittingExperience(false);
    }
  };

// =========================
// Update experience
// =========================
const handleUpdateExperience = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!sharedExperience) return;

  if (!title.trim()) {
    alert("Please add a short title.");
    return;
  }

  if (!rating) {
    alert("Please select a rating.");
    return;
  }

  if (!comment.trim()) {
    alert("Please write your experience.");
    return;
  }

  setSubmittingExperience(true);

  try {
    const res = await fetch(`${API_URL}/api/experiences/${sharedExperience.id}/`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      title: title.trim(),
      rating,
      comment: comment.trim(),
      place: selectedPlace.id,
      trip_context: tripContext,
      trip_style: tripStyle,
    }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Update experience error:", data);
      alert(data.detail || "Error updating experience.");
      return;
    }

    setSharedExperience(data);
    setTitle("");
    setComment("");
    setRating(null);
    setEditingExperience(false);
    setExperienceShared(true);
    setTripContext("prefer_not_to_say");
    setTripStyle("prefer_not_to_say");
  } catch (error) {
    console.error("Update experience failed:", error);
    alert("Error updating experience.");
  } finally {
    setSubmittingExperience(false);
  }
};

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          Home
        </Link>{" "}
        / <span>Explore</span>
      </div>

      <h1>
          {isExperienceMode
            ? "Find a place to share your experience"
            : isUpdateMode
            ? "Find a place to share event, alert or info"
            : "Find a destination or place"}
        </h1>

        <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "24px" }}>
          {isExperienceMode
            ? "Search for the place you visited. You can read existing experiences first — then share your own review."
            : isUpdateMode
            ? "Search for the place related to your event, alert or useful information."
            : "Search by country, city, attraction, hotel, restaurant or nature spot. You can read existing experiences first — and share your own if you want."}
        </p>

        <div style={{ marginBottom: "22px" }}>

        {!selectedCountryPlace && !selectedPlace && (
          <p
            style={{
              margin: "10px 0 0 0",
              color: "#666",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            Start with a country or city/region. Specific places such as hotels,
            restaurants, attractions and nature spots are easier to add after the main
            destination is clear.
          </p>
        )}

          <div style={{ fontWeight: 600, marginBottom: "10px" }}>
            What do you want to search or share about?
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {placeTypeOptionsToShow.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPlaceType(value as typeof placeType);
                  setSelectedCountryPlace(null);
                  setSelectedPlace(null);
                  setSearchTerm("");
                  setNewPlaceName("");
                  setNewPlaceCity("");
                  setNewPlaceCountry("");
                  setTitle("");
                  setComment("");
                  setRating(null);
                  setImageFile(null);
                  setExperienceShared(false);
                  setSharedExperience(null);
                  setEditingExperience(false);
                  setShowShareForm(false);
                  setTripContext("prefer_not_to_say");
                  setTripStyle("prefer_not_to_say");
                  setShowCreatePlaceForm(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: placeType === value ? "#111" : "white",
                  color: placeType === value ? "white" : "#111",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <input
          value={searchTerm}
          onChange={(e) => {
              const value = e.target.value;

              setSearchTerm(value);

              if (placeType === "country") {
                setNewPlaceName(value);
                setNewPlaceCountry(value);
                setNewPlaceCity("");
              }

              if (selectedCountryPlace) {
                setSelectedCountryPlace(null);
              }

              if (selectedPlace) {
                setSelectedPlace(null);
                setShowCreatePlaceForm(false);
                setTitle("");
                setComment("");
                setRating(null);
                setExperienceShared(false);
                setSharedExperience(null);
                setEditingExperience(false);
                setTripContext("prefer_not_to_say");
                setTripStyle("prefer_not_to_say");
              }
            }}
        placeholder={searchPlaceholderByType[placeType]}
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "12px 14px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          fontSize: "14px",
          marginBottom: "24px",
        }}
      />

          {loading ? (
      <p style={{ color: "#666" }}>Loading places...</p>
        ) : isDirectPlaceFlow ? (
      <div style={helperCard}>
        {isUpdateMode ? (
          <>
            You are preparing a post about{" "}
            <strong>{selectedPlace.name}</strong>.
          </>
        ) : isExperienceMode ? (
          <>
            You are sharing an experience about{" "}
            <strong>{selectedPlace.name}</strong>.
          </>
        ) : (
          <>
            You selected <strong>{selectedPlace.name}</strong>.
          </>
        )}
      </div>
    ) : !searchTerm.trim() ? (
      <div style={helperCard}>
        Start typing based on the type you selected. For example, search for a country,
        city, attraction, hotel, restaurant or nature spot.
      </div>

    ) : placeType !== "country" && placeType !== "city" && !selectedCountryPlace ? (
      <div style={helperCard}>
        Start by searching and selecting a country first. Then you can choose or create
        attractions, hotels, restaurants, nature spots or other specific places inside that country.
      </div>

    ) : filteredPlaces.length > 0 && !selectedCountryPlace && !selectedPlace ? (
      <section style={{ display: "grid", gap: "18px", maxWidth: "620px" }}>

        <p style={{ color: "#666", margin: 0, lineHeight: 1.5 }}>
          We found existing places related to your search and selected type.
          Start with a country when needed, then choose a city, region or specific place.
        </p>

        {filteredCountryPlaces.length > 0 && (
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>
              Countries
            </div>

            {filteredCountryPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => handleSelectCountry(place)}
                style={{
                  padding: "18px",
                  border: "1px solid #d7f0df",
                  borderRadius: "14px",
                  background:
                    selectedPlace?.id === place.id ? "#f2fbf5" : "white",
                  color: "black",
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <strong>{place.name}</strong>

                  <span
                    style={{
                      fontSize: "11px",
                      color: "#166534",
                      background: "#f2fbf5",
                      border: "1px solid #d7f0df",
                      borderRadius: "999px",
                      padding: "4px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getPlaceTypeLabel(place.place_type)}
                  </span>
                </div>

                <div style={{ marginTop: "8px", color: "#666", fontSize: "14px" }}>
                  {getPlaceLocationText(place)}
                </div>

                <div style={{ marginTop: "10px", fontSize: "14px" }}>
                  {isUpdateMode
                    ? "Post alert, event or info about this country →"
                    : isExperienceMode
                    ? "Share experience about this country →"
                    : "Open this country →"}
                </div>
              </button>
            ))}
          </div>
        )}

        {filteredCityOrRegionPlaces.length > 0 && (
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginTop: "4px" }}>
              Cities / Regions
            </div>

            {filteredCityOrRegionPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => handleSelectExistingPlace(place)}
                style={{
                  padding: "18px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  background:
                    selectedPlace?.id === place.id ? "#f5f5f5" : "white",
                  color: "black",
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <strong>{place.name}</strong>

                  <span
                    style={{
                      fontSize: "11px",
                      color: "#555",
                      background: "#f5f5f5",
                      border: "1px solid #e5e5e5",
                      borderRadius: "999px",
                      padding: "4px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getPlaceTypeLabel(place.place_type)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  {getPlaceLocationText(place)}
                </div>

                <div style={{ marginTop: "10px", fontSize: "14px" }}>
                  {isUpdateMode
                    ? "Post alert, event or info about this city/region →"
                    : isExperienceMode
                    ? "Share experience about this city/region →"
                    : "Open this city/region →"}
                </div>
              </button>
            ))}
          </div>
        )}

        {filteredSpecificPlaces.length > 0 && (
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginTop: "4px" }}>
              Specific places
            </div>

            <p style={{ color: "#666", margin: 0, lineHeight: 1.5, fontSize: "14px" }}>
              These are hotels, restaurants, attractions, nature spots or other
              specific places connected to a city, region or country.
            </p>

            {filteredSpecificPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => handleSelectExistingPlace(place)}
                style={{
                  padding: "18px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  background:
                    selectedPlace?.id === place.id ? "#f5f5f5" : "white",
                  color: "black",
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <strong>{place.name}</strong>

                  <span
                    style={{
                      fontSize: "11px",
                      color: "#555",
                      background: "#f5f5f5",
                      border: "1px solid #e5e5e5",
                      borderRadius: "999px",
                      padding: "4px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getPlaceTypeLabel(place.place_type)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  {getPlaceLocationText(place)}
                </div>

                <div style={{ marginTop: "10px", fontSize: "14px" }}>
                  {isUpdateMode
                    ? "Post alert, event or info about this place →"
                    : isExperienceMode
                    ? "Share experience about this place →"
                    : "Open this place →"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
        ) : !selectedCountryPlace && !selectedPlace ? (
            <section style={helperCard}>
          <strong>No exact place found for “{searchTerm.trim()}”.</strong>

          <p
              style={{
                margin: "10px 0 16px 0",
                color: "#666",
                lineHeight: 1.5,
              }}
          >
              We did not find this place in the current Trust Travel database. For now,
              you can create it manually using a neutral name that other travelers can also
              reuse. Later, this step can be connected to an external places API to suggest
              official countries, cities, hotels, restaurants, attractions and nature spots.
          </p>

            <div style={futureExternalSourceBox}>
              <strong>Future external place search</strong>

              <p style={futureExternalSourceText}>
                This area is prepared for a future integration with an external places
                database. When connected, Trust Travel can show suggested official places
                here before asking the user to create a new one manually.
              </p>
            </div>

            {similarPlaces.length > 0 && (
              <div style={duplicateWarningBox}>
                <strong>Possible similar places already exist:</strong>

                <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                  {similarPlaces.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => handleSelectExistingPlace(place)}
                      style={similarPlaceButton}
                    >
                      <span>
                        <strong>{place.name}</strong>
                        <br />
                        <span style={{ color: "#666", fontSize: "13px" }}>
                          {getPlaceTypeLabel(place.place_type)} · {getPlaceLocationText(place)}
                        </span>
                      </span>

                      <span style={{ fontSize: "13px", color: "#111" }}>
                        Use this →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={createPlaceForm}>
              <input
                value={newPlaceName}
                onChange={(e) => {
                  const value = e.target.value;

                  setNewPlaceName(value);

                  if (placeType === "country") {
                    setNewPlaceCountry(value);
                    setNewPlaceCity("");
                  }
                }}
                placeholder={placeNamePlaceholderByType[placeType]}
                style={input}
              />

              {placeType !== "country" && (
                <input
                  value={newPlaceCity}
                  onChange={(e) => setNewPlaceCity(e.target.value)}
                  placeholder={cityPlaceholderByType[placeType]}
                  style={input}
                />
              )}

              {placeType !== "country" && (
                <input
                  value={newPlaceCountry}
                  onChange={(e) => setNewPlaceCountry(e.target.value)}
                  placeholder={countryPlaceholderByType[placeType]}
                  style={input}
                />
              )}

              <button
                onClick={handleCreatePlace}
                disabled={!canCreatePlace || creatingPlace}
                style={{
                  ...primaryButton,
                  opacity: canCreatePlace && !creatingPlace ? 1 : 0.5,
                  cursor: canCreatePlace && !creatingPlace ? "pointer" : "not-allowed",
                }}
              >
                {creatingPlace
                  ? "Creating..."
                  : placeType === "country"
                  ? "Create country"
                  : "Create this place"}
              </button>
            </div>
          </section>
      ) : null}

           {selectedCountryPlace && !selectedPlace && (
      <section
        id="country-context"
        style={{
          marginTop: "28px",
          padding: "22px",
          border: "1px solid #d7f0df",
          borderRadius: "16px",
          background: "#f2fbf5",
          maxWidth: "620px",
        }}
      >
        <div style={{ fontSize: "13px", color: "#166534", fontWeight: 700 }}>
          Country selected
        </div>

        <h2 style={{ margin: "6px 0 0 0" }}>
          {isExperienceMode
            ? `You are sharing within ${selectedCountryPlace.name}`
            : isUpdateMode
            ? `You are posting about ${selectedCountryPlace.name}`
            : `You are exploring ${selectedCountryPlace.name}`}
        </h2>

        <p style={{ color: "#555", lineHeight: 1.5 }}>
          {isExperienceMode
            ? "Start with the country, then choose a city or region inside it. You can also share an experience about the country in general."
            : isUpdateMode
            ? "Start with the country, then choose a city or region inside it. You can also post an alert, event or useful information about the country in general."
            : "Read country-level experiences, choose a city or region, or create another place inside this country."}
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
              type="button"
              onClick={() => {
                if (isUpdateMode) {
                  router.push(`/create?place=${selectedCountryPlace.id}`);
                  return;
                }

                if (isExperienceMode) {
                  handleShareAboutCountry();
                  return;
                }

                router.push(`/places/${selectedCountryPlace.id}/experiences`);
              }}
              style={primaryButton}
            >
              {isExperienceMode
                ? `Share experience about ${selectedCountryPlace.name}`
                : isUpdateMode
                ? `Post alert, event or info about ${selectedCountryPlace.name}`
                : `View experiences in ${selectedCountryPlace.name}`}
            </button>

          <button
            type="button"
            onClick={openCreateCityInSelectedCountry}
            style={secondaryButton}
          >
            Create another city/region in {selectedCountryPlace.name}
          </button>

          <button
            type="button"
            onClick={() => setSelectedCountryPlace(null)}
            style={secondaryButton}
          >
            Change country
          </button>
        </div>

        {placesInsideSelectedCountry.length > 0 && (
          <div style={{ marginTop: "20px", display: "grid", gap: "10px" }}>
            <div style={{ fontWeight: 700 }}>
              Cities / regions already listed in {selectedCountryPlace.name}
            </div>

            <p style={{ margin: 0, color: "#555", fontSize: "14px", lineHeight: 1.5 }}>
              Keep the country experience general, or open the list below if you want to
              share about a specific city or region.
            </p>

            <button
              type="button"
              onClick={() => setShowRelatedPlaces((current) => !current)}
              style={secondaryButton}
            >
              {showRelatedPlaces
                ? "Hide cities / regions"
                : `Show cities / regions in ${selectedCountryPlace.name} (${placesInsideSelectedCountry.length})`}
            </button>

            {showRelatedPlaces && (
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  value={relatedPlaceSearch}
                  onChange={(e) => setRelatedPlaceSearch(e.target.value)}
                  placeholder={`Search city or region in ${selectedCountryPlace.name}`}
                  style={input}
                />

                {!relatedPlaceSearch.trim() ? (
                  <div style={helperNote}>
                    Start typing a city or region already listed in {selectedCountryPlace.name}.
                  </div>
                ) : filteredPlacesInsideSelectedCountry.length > 0 ? (
                  filteredPlacesInsideSelectedCountry.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelectExistingPlace(place)}
                    style={{
                      padding: "12px 14px",
                      border: "1px solid #ddd",
                      borderRadius: "12px",
                      background: "white",
                      color: "#111",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <strong>{place.name}</strong>

                    <span style={{ color: "#666", fontSize: "13px" }}>
                      {getPlaceTypeLabel(place.place_type)} →
                    </span>
                  </button>
                  ))
                ) : (
                  <div style={helperNote}>
                    No city or region found inside {selectedCountryPlace.name}. You can create a new one.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showCreatePlaceForm && (
          <section id="create-place-form" style={{ marginTop: "20px" }}>
            <strong>Create a city or region in {selectedCountryPlace.name}</strong>

            <p
              style={{
                margin: "10px 0 16px 0",
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              Add the city or region first. Hotels, restaurants, attractions and
              nature spots can be added later inside that city or region.
            </p>

            <div style={createPlaceForm}>
              <input
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                placeholder="City or region name, e.g. Bali, Jakarta, Lombok"
                style={input}
              />

              <input
                value={newPlaceCountry}
                onChange={(e) => setNewPlaceCountry(e.target.value)}
                placeholder="Country"
                style={input}
              />

              <button
                onClick={handleCreatePlace}
                disabled={!canCreatePlace || creatingPlace}
                style={{
                  ...primaryButton,
                  opacity: canCreatePlace && !creatingPlace ? 1 : 0.5,
                  cursor: canCreatePlace && !creatingPlace ? "pointer" : "not-allowed",
                }}
              >
                {creatingPlace ? "Creating..." : "Create city/region"}
              </button>

              <button
                type="button"
                onClick={() => setShowCreatePlaceForm(false)}
                style={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </section>
    )}

    {selectedPlace && !showShareForm && (
      <section
        id="selected-place-actions"
        style={{
          marginTop: "28px",
          padding: "22px",
          border: "1px solid #eee",
          borderRadius: "16px",
          background: "white",
          maxWidth: "620px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>{selectedPlace.name}</h2>

        {isUpdateMode ? (
          <p style={{ color: "#666", lineHeight: 1.5 }}>
            Choose what you want to share about this place.
          </p>
        ) : selectedPlaceHasNoExperiences ? (
          <div style={newPlaceNotice}>
            <strong>
              There are no experiences about this place yet.
            </strong>

            <p style={{ margin: "8px 0 0 0", color: "#555", lineHeight: 1.5 }}>
              Be the first to share what you know about {selectedPlace.name}.
              Your experience can help future travelers decide if this place fits
              their trip.
            </p>
          </div>
        ) : (
          <p style={{ color: "#666", lineHeight: 1.5 }}>
            You can read existing experiences first — then share your own review.
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {isUpdateMode ? (
            <button
              type="button"
              onClick={() => router.push(`/create?place=${selectedPlace.id}`)}
              style={primaryButton}
            >
              Post alert, event or info here
            </button>
          ) : selectedPlaceHasNoExperiences ? (
            <>
              <button
                type="button"
                onClick={() => setShowShareForm(true)}
                style={primaryButton}
              >
                Share the first experience
              </button>

              <button
                type="button"
                onClick={() => router.push(`/places/${selectedPlace.id}/experiences`)}
                style={secondaryButton}
              >
                Open {selectedPlace.name} page
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push(`/places/${selectedPlace.id}/experiences`)}
                style={primaryButton}
              >
                View experiences first
              </button>

              <button
                type="button"
                onClick={() => setShowShareForm(true)}
                style={secondaryButton}
              >
                Share your experience
              </button>
            </>
          )}

          {!isCountryPlace(selectedPlace) && selectedPlaceParentCountryName && (
              <button
                type="button"
                onClick={() => {
                  if (selectedPlaceParentCountryPlace) {
                    router.push(`/places/${selectedPlaceParentCountryPlace.id}/experiences`);
                    return;
                  }

                  setPlaceType("country");
                  setSearchTerm(selectedPlaceParentCountryName);
                  setSelectedPlace(null);
                  setSelectedCountryPlace(null);
                  setShowShareForm(false);
                  setShowCreatePlaceForm(false);
                  setRelatedPlaceSearch("");
                }}
                style={secondaryButton}
              >
                Back to {selectedPlaceParentCountryName}
              </button>
            )}

          <button
            type="button"
            onClick={handleChangePlace}
            style={secondaryButton}
          >
            Change selection
          </button>
        </div>
      </section>
    )}

        {selectedPlace && showShareForm && (
          <section
            id="share-experience-form"
            style={{
              marginTop: "18px",
              padding: "22px",
              border: "1px solid #eee",
              borderRadius: "16px",
              background: "white",
              maxWidth: "620px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Share your experience about {selectedPlace.name}
            </h2>

            {experienceShared ? (
              <div>
                <p style={{ color: "#555", lineHeight: 1.5 }}>
                  Your experience was shared successfully.
                </p>

                {sharedExperience && (
                  <div style={previewCard}>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#777",
                        marginBottom: "8px",
                      }}
                    >
                      Published experience
                    </div>

                    <div style={{ fontWeight: 600, lineHeight: 1.5 }}>
                      {sharedExperience.title || "Shared experience"}
                    </div>

                    {sharedExperience.image_url && (
                      <img
                        src={sharedExperience.image_url}
                        alt={sharedExperience.title || "Shared experience"}
                        style={{
                          width: "100%",
                          maxHeight: "260px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          marginTop: "10px",
                          marginBottom: "10px",
                        }}
                      />
                    )}

                    <div style={{ marginTop: "8px", color: "#555", lineHeight: 1.5 }}>
                      {sharedExperience.comment}
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        color: "#777",
                        fontSize: "13px",
                      }}
                    >
                      Rating: {"★".repeat(sharedExperience.rating)}
                      {"☆".repeat(5 - sharedExperience.rating)}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button onClick={startEditingExperience} style={secondaryButton}>
                    Edit experience
                  </button>

                  <button
                    onClick={() =>
                      sharedExperience
                        ? router.push(
                            `/places/${selectedPlace.id}/experiences?highlight=${sharedExperience.id}`
                          )
                        : router.push(`/places/${selectedPlace.id}/experiences`)
                    }
                    style={primaryButton}
                  >
                    View your experience
                  </button>

                  <button onClick={handleChangePlace} style={secondaryButton}>
                    Choose another place
                  </button>

                  <button onClick={() => router.push("/")} style={secondaryButton}>
                    Back to feed
                  </button>

                  <button onClick={resetShareFlow} style={secondaryButton}>
                    Start over
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={editingExperience ? handleUpdateExperience : handleSubmitExperience}
                style={{ display: "grid", gap: "14px" }}
              >
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Experience title, e.g. Beautiful but too crowded in high season"
                  maxLength={160}
                  style={input}
                />

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write your experience..."
                  rows={4}
                  style={input}
                />

                <input
                  type="number"
                  min="1"
                  max="5"
                  value={rating ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;

                    if (!value) {
                      setRating(null);
                      return;
                    }

                    const numeric = Number(value);

                    if (numeric >= 1 && numeric <= 5) {
                      setRating(numeric);
                    }
                  }}
                  placeholder="Rating from 1 to 5"
                  style={input}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "grid", gap: "6px" }}>
                    <label style={label}>Trip context</label>

                    <select
                      value={tripContext}
                      onChange={(e) => setTripContext(e.target.value)}
                      style={input}
                    >
                      <option value="prefer_not_to_say">Prefer not to say</option>
                      <option value="solo">Solo traveler</option>
                      <option value="couple">Couple</option>
                      <option value="family_children">Family with children</option>
                      <option value="friends_group">Friends / group</option>
                      <option value="business">Business traveler</option>
                      <option value="local_resident">Local resident</option>
                      <option value="retired">Retired traveler</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: "6px" }}>
                    <label style={label}>Trip style</label>

                    <select
                      value={tripStyle}
                      onChange={(e) => setTripStyle(e.target.value)}
                      style={input}
                    >
                      <option value="prefer_not_to_say">Prefer not to say</option>
                      <option value="culture_museums">Culture and museums</option>
                      <option value="nature_outdoors">Nature and outdoors</option>
                      <option value="food_restaurants">Food and restaurants</option>
                      <option value="relaxed">Relaxed travel</option>
                      <option value="budget">Budget travel</option>
                      <option value="comfort">Comfort travel</option>
                      <option value="adventure">Adventure</option>
                      <option value="local_life">Local life</option>
                    </select>
                  </div>
                </div>

                <div style={helperNote}>
                  These fields describe this specific experience, not your permanent profile.
                  They will help future analytics compare recommendations by trip context.
                </div>

                {!editingExperience && (
                  <div style={{ display: "grid", gap: "6px" }}>
                    <label style={{ fontSize: "13px", color: "#666" }}>
                      Optional image
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                      }}
                      style={input}
                    />

                    <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.4 }}>
                      Avoid sharing real-time or sensitive locations in photos.
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingExperience || !title.trim() || !rating || !comment.trim()}
                  style={{
                    ...primaryButton,
                    opacity:
                      submittingExperience || !title.trim() || !rating || !comment.trim()
                        ? 0.5
                        : 1,
                    cursor:
                      submittingExperience || !title.trim() || !rating || !comment.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {submittingExperience
                    ? editingExperience
                      ? "Saving..."
                      : "Sharing..."
                    : editingExperience
                    ? "Save changes"
                    : "Share experience"}
                </button>
              </form>
            )}
          </section>
        )}
    </main>
  );
}

const helperCard = {
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "white",
  color: "#555",
  maxWidth: "620px",
  lineHeight: 1.5,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const primaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const secondaryButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "black",
  cursor: "pointer",
};

const previewCard = {
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  marginBottom: "16px",
};

const createPlaceForm = {
  display: "grid",
  gap: "12px",
  marginTop: "14px",
};

const duplicateWarningBox = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #f1e4b8",
  background: "#fffbea",
  color: "#5f4b00",
  marginBottom: "16px",
};

const similarPlaceButton = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eadfbd",
  background: "white",
  color: "#111",
  textAlign: "left" as const,
  cursor: "pointer",
};

const helperNote = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#666",
  fontSize: "12px",
  lineHeight: 1.5,
};

const newPlaceNotice = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  marginBottom: "16px",
};

const label = {
  fontSize: "13px",
  color: "#666",
  fontWeight: 600,
};

const futureExternalSourceBox = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px dashed #ddd",
  background: "#fafafa",
  color: "#333",
  marginBottom: "16px",
};

const futureExternalSourceText = {
  margin: "8px 0 0 0",
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.5,
};