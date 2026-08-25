"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { API_URL } from "../lib/api";

type CountryCatalogItem = {
  code: string;
  canonical_name: string;
  aliases: string[];
};

type GeographyCityResult = {
  name: string;
  canonical_name: string;
  aliases: string[];
  country_code: string;
  place_type: "city";
  latitude: string | null;
  longitude: string | null;
  feature_code: string;
  population: number;
  admin_name: string;
  external_source: string;
  external_id: string;
  existing_place_id: number | null;
};

function DestinationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeFromUrl = searchParams.get("place");
  const shouldOpenShareForm = searchParams.get("share") === "true";

  const mode = searchParams.get("mode");
  const isExperienceMode = mode === "experience";
  const isUpdateMode = mode === "update";

  const [places, setPlaces] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [countryCatalog, setCountryCatalog] = useState<CountryCatalogItem[]>([]);
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [createPlaceError, setCreatePlaceError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [placeType, setPlaceType] = useState<
  "country" | "city" | "attraction" | "hotel" | "restaurant" | "nature" | "other"
  >("country");

  const [selectedCountryPlace, setSelectedCountryPlace] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showShareForm, setShowShareForm] = useState(false);
  const [createdPlaceId, setCreatedPlaceId] = useState<number | null>(null);
  const [showRelatedPlaces, setShowRelatedPlaces] = useState(false);
  const [relatedPlaceSearch, setRelatedPlaceSearch] = useState("");

  const [createFlowOpen, setCreateFlowOpen] = useState(false);
  const [createCountrySearch, setCreateCountrySearch] = useState("");
  const [createCitySearch, setCreateCitySearch] = useState("");

  const [geographyCityResults, setGeographyCityResults] = useState<
    GeographyCityResult[]
  >([]);
  const [geographyCitySearchLoading, setGeographyCitySearchLoading] =
    useState(false);
  const [geographyCitySearchError, setGeographyCitySearchError] = useState("");

  const [createSelectedCountry, setCreateSelectedCountry] = useState<any>(null);
  const [createSelectedCity, setCreateSelectedCity] = useState<any>(null);
  const [createSpecificPlaceType, setCreateSpecificPlaceType] = useState<
    "attraction" | "hotel" | "restaurant" | "nature" | "other"
  >("nature");
  const [createSpecificPlaceName, setCreateSpecificPlaceName] = useState("");

  const [creatingCreateFlowCountry, setCreatingCreateFlowCountry] = useState(false);
  const [creatingCreateFlowCity, setCreatingCreateFlowCity] = useState(false);
  const [creatingCreateFlowSpecificPlace, setCreatingCreateFlowSpecificPlace] =
    useState(false);
  const [createFlowError, setCreateFlowError] = useState("");

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  const [safetyRating, setSafetyRating] = useState<number | null>(null);
  const [costRating, setCostRating] = useState<number | null>(null);
  const [accessibilityRating, setAccessibilityRating] = useState<number | null>(null);
  const [convenienceRating, setConvenienceRating] = useState<number | null>(null);

  const hasAnyPracticalRating =
      Boolean(safetyRating) ||
      Boolean(costRating) ||
      Boolean(accessibilityRating) ||
      Boolean(convenienceRating);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageDisplayMode, setImageDisplayMode] = useState<"contain" | "cover">("cover");
  const [imageCaption, setImageCaption] = useState("");

  const [tripContext, setTripContext] = useState("prefer_not_to_say");
  const [tripStyle, setTripStyle] = useState("prefer_not_to_say");

  const resetStructuredRatings = () => {
      setSafetyRating(null);
      setCostRating(null);
      setAccessibilityRating(null);
      setConvenienceRating(null);
    };

    const handleOptionalRatingChange = (
      value: string,
      setter: (value: number | null) => void
    ) => {
      if (!value) {
        setter(null);
        return;
      }

      const numeric = Number(value);

      if (numeric >= 1 && numeric <= 5) {
        setter(numeric);
      }
  };

  const [submittingExperience, setSubmittingExperience] = useState(false);
  const [experienceFormError, setExperienceFormError] = useState("");
  const [experienceShared, setExperienceShared] = useState(false);
  const [sharedExperience, setSharedExperience] = useState<any>(null);
  const [editingExperience, setEditingExperience] = useState(false);

  const [showPracticalRatingsConfirm, setShowPracticalRatingsConfirm] = useState(false);
  const [pendingExperienceAction, setPendingExperienceAction] = useState<"create" | "update" | null>(null);
  const [skipPracticalRatingsConfirm, setSkipPracticalRatingsConfirm] = useState(false);
  const skipPracticalRatingsConfirmRef = useRef(false);

  // =========================
  // Load places and destinations
  // =========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [placesRes, destinationsRes, countriesRes] = await Promise.all([
          fetch(`${API_URL}/api/places/`),
          fetch(`${API_URL}/api/destinations/`),
          fetch(`${API_URL}/api/countries/`),
        ]);

        if (!placesRes.ok || !destinationsRes.ok) {
          console.error("Failed to load places or destinations");
          return;
        }

        const placesData = await placesRes.json();
        const destinationsData = await destinationsRes.json();

        setPlaces(placesData || []);
        setDestinations(destinationsData || []);

        if (countriesRes.ok) {
          const countriesData = await countriesRes.json();
          setCountryCatalog(countriesData.results || []);
        } else {
          console.error("Failed to load country catalog");
        }
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
  resetStructuredRatings();
  setImageFile(null);
  setImagePreviewUrl(null);
  setImageDisplayMode("cover");
  setImageCaption("");
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

const getNormalizedPlaceSearchNames = (place: any) => {
  const values = [
    place.name,
    place.canonical_name,
    place.city,
    place.destination_name,
  ];

  if (Array.isArray(place.aliases)) {
    values.push(...place.aliases);
  }

  if (Array.isArray(place.search_aliases)) {
    values.push(...place.search_aliases);
  }

  return values
    .filter(Boolean)
    .map((value) => normalizeText(String(value)));
};

const getBestTextMatchScore = (values: string[]) => {
  if (!normalizedSearchText) return 0;

  if (values.some((value) => value === normalizedSearchText)) {
    return 100;
  }

  if (values.some((value) => value.startsWith(normalizedSearchText))) {
    return 90;
  }

  if (values.some((value) => value.includes(normalizedSearchText))) {
    return 80;
  }

  return 0;
};

const getSimilarityScore = (place: any) => {
  if (!normalizedSearchText) return 0;

  const searchableNames = getNormalizedPlaceSearchNames(place);
  const placeCity = normalizeText(place.city || place.destination_name);

  const isCountrySearch = placeType === "country";
  const isCitySearch = placeType === "city";
  const isSpecificSearch = placeType !== "country" && placeType !== "city";

  // Country mode must only suggest countries.
  if (isCountrySearch) {
    if (place.place_type !== "country") return 0;

  return getBestTextMatchScore(searchableNames);

  }

  // City / Region mode must only suggest cities/regions.
  // It should not suggest a city only because its country matches the search.
  if (isCitySearch) {
    if (place.place_type !== "city") return 0;

  const textMatchScore = getBestTextMatchScore(searchableNames);
  if (textMatchScore > 0) return textMatchScore;

  if (normalizedSearchText.length >= 4 && placeCity.includes(normalizedSearchText)) {
    return 60;
  }

    return 0;
  }

  // Specific place types can be searched globally.
  // If a country is selected, restrict results to that country.
  // If no country is selected, show global results with clear context.
  if (isSpecificSearch) {
    if (place.place_type !== placeType) return 0;

    if (selectedCountryPlace) {
      const selectedCountryName = normalizeText(selectedCountryPlace.name);
      const placeCountry = normalizeText(place.destination_country);

      if (placeCountry !== selectedCountryName) return 0;
    }

    const textMatchScore = getBestTextMatchScore(searchableNames);
    if (textMatchScore > 0) return textMatchScore;

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

  const searchableNames = getNormalizedPlaceSearchNames(place);
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

  return getBestTextMatchScore(searchableNames);

  }

  // =========================
  // City / region search
  // =========================
  // City mode may search globally by city/region name.
  // This is useful when the user knows the city but not the country.
  // But it must NOT return cities only because the country name matches.
  if (isCitySearch) {
    if (!isCity) return 0;

    const textMatchScore = getBestTextMatchScore(searchableNames);
    if (textMatchScore > 0) return textMatchScore;

    if (normalizedSearchText.length < 4) return 0;

    if (city.includes(normalizedSearchText)) return 60;

    return 0;
  }

  // =========================
  // Specific place search
  // =========================
  // Specific places can be searched globally.
  // If a country is selected, restrict results to that country.
  // If no country is selected, show results with full context.
  if (isSpecificSearch) {
    if (!isSpecific) return 0;

    if (selectedCountryPlace) {
      const selectedCountryName = normalizeText(selectedCountryPlace.name);
      const placeCountry = normalizeText(place.destination_country);

      if (placeCountry !== selectedCountryName) return 0;
    }

    const textMatchScore = getBestTextMatchScore(searchableNames);
    if (textMatchScore > 0) return textMatchScore;

    if (normalizedSearchText.length < 4) return 0;

    if (city.includes(normalizedSearchText)) return 60;

    return 0;
  }

  return 0;
};

const getUnifiedSearchScore = (place: any) => {
  const search = normalizeText(searchTerm);

  if (!search) return 0;

  // Avoid showing a long list while the user is still typing.
  if (search.length < 4) return 0;

  const searchableNames = getNormalizedPlaceSearchNames(place);
  const city = normalizeText(place.city || "");
  const type = normalizeText(place.place_type || "");

  if (searchableNames.some((value) => value === search)) {
    return 100;
  }

  if (searchableNames.some((value) => value.startsWith(search))) {
    return 90;
  }

  if (searchableNames.some((value) => value.includes(search))) {
    return 80;
  }

  // Only city/region records should match by city name.
  // Specific places should appear only when the user searches their own name,
  // alias or canonical name.
  if (place.place_type === "city" && city.includes(search)) {
    return 65;
  }

  // Keep type matching only for longer searches.
  // Example: "restaurant", "hotel", "nature".
  if (search.length >= 5 && type.includes(search)) return 45;

  return 0;
};

const filteredPlaces = places
  .map((place) => ({
    ...place,
    searchMatchScore: getUnifiedSearchScore(place),
  }))
  .filter((place) => place.searchMatchScore > 0)
  .sort((a, b) => {
    if (a.searchMatchScore !== b.searchMatchScore) {
      return b.searchMatchScore - a.searchMatchScore;
    }

    const typeOrder: Record<string, number> = {
      country: 1,
      city: 2,
      nature: 3,
      attraction: 4,
      restaurant: 5,
      hotel: 6,
      other: 7,
    };

    const orderA = typeOrder[a.place_type] || 99;
    const orderB = typeOrder[b.place_type] || 99;

    if (orderA !== orderB) return orderA - orderB;

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

const isSpecificPlaceType = (type: string) => {
  return type !== "country" && type !== "city";
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

const filteredCountryPlaces = filteredPlaces.filter((place) =>
  isCountryPlace(place)
);

const filteredCityOrRegionPlaces = filteredPlaces.filter((place) =>
  isCityOrRegionPlace(place)
);

const filteredSpecificPlaces = filteredPlaces.filter((place) =>
  isSpecificPlace(place)
);

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

const createCountryCandidates = createCountrySearch.trim()
  ? countryCatalog
      .filter((country) => {
        const search = normalizeText(createCountrySearch);

        const searchableNames = [
          country.code,
          country.canonical_name,
          ...(country.aliases || []),
        ].map((value) => normalizeText(value));

        return searchableNames.some((value) => value.includes(search));
      })
      .sort((a, b) =>
        a.canonical_name.localeCompare(b.canonical_name)
      )
      .slice(0, 6)
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

const placeTypeOptionsToShow = [
  ...primaryPlaceTypeOptions,
  ...specificPlaceTypeOptions,
];


const openGuidedCreateFlow = () => {
  setCreateFlowOpen(true);
  setCreateFlowError("");
  setCreateSelectedCountry(null);
  setCreateSelectedCity(null);
  setCreateCountrySearch("");
  setCreateCitySearch("");
  setGeographyCityResults([]);
  setGeographyCitySearchError("");
  setCreateSpecificPlaceType("nature");
  setCreateSpecificPlaceName("");
};

const selectCreateFlowCountry = (countryPlace: any) => {
  setCreateSelectedCountry(countryPlace);
  setCreateSelectedCity(null);
  setCreateFlowError("");
  setCreateCitySearch("");
  setGeographyCityResults([]);
  setGeographyCitySearchError("");
  setCreateSpecificPlaceType("nature");
  setCreateSpecificPlaceName("");

  setTimeout(() => {
    document
      .getElementById("guided-create-city-step")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

const handleSearchCreateFlowCities = async () => {
  if (!createSelectedCountry) {
    setCreateFlowError("Please choose a country first.");
    return;
  }

  const query = createCitySearch.trim();
  const countryCode = (
    createSelectedCountry.country_code || ""
  ).trim().toUpperCase();

  if (query.length < 2) {
    setGeographyCityResults([]);
    setGeographyCitySearchError(
      "Type at least 2 characters to search."
    );
    return;
  }

  if (!countryCode) {
    setGeographyCityResults([]);
    setGeographyCitySearchError(
      "Could not identify the country code for this place."
    );
    return;
  }

  setGeographyCitySearchLoading(true);
  setGeographyCitySearchError("");
  setCreateFlowError("");
  setGeographyCityResults([]);

  try {
    const params = new URLSearchParams({
      q: query,
      country_code: countryCode,
    });

    const res = await fetch(
      `${API_URL}/api/geography/cities/search/?${params.toString()}`
    );

    const data = await res.json();

    if (!res.ok) {
      setGeographyCitySearchError(
        data.detail || "Could not search for cities or localities."
      );
      return;
    }

    setGeographyCityResults(
      Array.isArray(data.results) ? data.results : []
    );
  } catch (error) {
    console.error("Guided geographic city search failed:", error);
    setGeographyCitySearchError(
      "Could not search for cities or localities."
    );
  } finally {
    setGeographyCitySearchLoading(false);
  }
};

const selectCreateFlowCity = (cityPlace: any) => {
  setCreateSelectedCity(cityPlace);
  setCreateFlowError("");
  setCreateSpecificPlaceType("nature");
  setCreateSpecificPlaceName("");

  setTimeout(() => {
    document
      .getElementById("guided-create-specific-step")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

const selectGeographyCityForFlow = async (
  cityResult: GeographyCityResult
) => {
  if (!createSelectedCountry) {
    setCreateFlowError("Please choose a country first.");
    return;
  }

  const countryCode = (
    createSelectedCountry.country_code || ""
  ).trim().toUpperCase();

  if (!countryCode) {
    setCreateFlowError(
      "Could not identify the country code for this place."
    );
    return;
  }

  setCreatingCreateFlowCity(true);
  setCreateFlowError("");
  setGeographyCitySearchError("");

  try {
    const res = await fetch(
      `${API_URL}/api/geography/cities/materialize/`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_id: cityResult.external_id,
          country_code: countryCode,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setCreateFlowError(
        data.detail || "Could not prepare this city or locality."
      );
      return;
    }

    setPlaces((prev) => {
      const exists = prev.some((place) => place.id === data.id);

      return exists
        ? prev.map((place) =>
            place.id === data.id ? data : place
          )
        : [data, ...prev];
    });

    setCreateCitySearch(cityResult.canonical_name);
    selectCreateFlowCity(data);
  } catch (error) {
    console.error(
      "Guided geographic city materialization failed:",
      error
    );
    setCreateFlowError(
      "Something went wrong while preparing this city or locality."
    );
  } finally {
    setCreatingCreateFlowCity(false);
  }
};

const selectCreateFlowCountryFromCatalog = async (
  country: CountryCatalogItem
) => {
  setCreatingCreateFlowCountry(true);
  setCreateFlowError("");

  try {
    const normalizedCatalogNames = [
      country.canonical_name,
      ...(country.aliases || []),
    ].map((value) => normalizeText(value));

    const existingCountryPlace = places.find((place) => {
      if (place.place_type !== "country") return false;

      const placeCountryCode = (place.country_code || "").toUpperCase();

      if (placeCountryCode) {
        return placeCountryCode === country.code.toUpperCase();
      }

      const placeNames = getNormalizedPlaceSearchNames(place);

      return placeNames.some((value) =>
        normalizedCatalogNames.includes(value)
      );
    });

    if (existingCountryPlace) {
      setCreateCountrySearch(country.canonical_name);
      selectCreateFlowCountry(existingCountryPlace);
      return;
    }

    const res = await fetch(`${API_URL}/api/places/create-basic/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: country.canonical_name,
        canonical_name: country.canonical_name,
        place_type: "country",
        city: "",
        country: country.canonical_name,
        country_code: country.code,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setCreateFlowError(
        data.detail || "Could not prepare this country."
      );
      return;
    }

    setPlaces((prev) => {
      const alreadyExists = prev.some((place) => place.id === data.id);

      if (alreadyExists) return prev;

      return [data, ...prev];
    });

    setCreateCountrySearch(country.canonical_name);
    selectCreateFlowCountry(data);
  } catch (error) {
    console.error("Guided country selection failed:", error);
    setCreateFlowError(
      "Something went wrong while preparing the country."
    );
  } finally {
    setCreatingCreateFlowCountry(false);
  }
};

const createSpecificPlaceForFlow = async () => {
  const specificPlaceName = formatPlaceNameForCreation(createSpecificPlaceName);

  if (!createSelectedCountry) {
    setCreateFlowError("Please choose or create a country first.");
    return;
  }

  if (!createSelectedCity) {
    setCreateFlowError("Please choose or create a city or region first.");
    return;
  }

  if (!specificPlaceName) {
    setCreateFlowError("Please type the specific place name first.");
    return;
  }

  setCreatingCreateFlowSpecificPlace(true);
  setCreateFlowError("");

  try {
    const res = await fetch(`${API_URL}/api/places/create-basic/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: specificPlaceName,
        place_type: createSpecificPlaceType,
        city: createSelectedCity.name,
        country: createSelectedCountry.name,
        country_code: createSelectedCountry.country_code || "",
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setCreateFlowError(data.detail || "Could not create this specific place.");
      return;
    }

    setPlaces((prev) => {
      const alreadyExists = prev.some((place) => place.id === data.id);

      if (alreadyExists) return prev;

      return [data, ...prev];
    });

    router.push(`/places/${data.id}`);
  } catch (error) {
    console.error("Guided specific place creation failed:", error);
    setCreateFlowError("Something went wrong while creating the specific place.");
  } finally {
    setCreatingCreateFlowSpecificPlace(false);
  }
};

    // =========================
    // Select country as search context
    // =========================
    const handleSelectCountry = (place: any) => {
      // In normal exploration mode, opening a country should go directly
      // to the country experiences page.
      if (!isExperienceMode && !isUpdateMode) {
          router.push(`/places/${place.id}`);
          return;
      }

      // In creation modes, keep the country as context so the user can decide
      // whether to share/post about the country or choose a city/region.
      setSelectedCountryPlace(place);
      setSelectedPlace(null);
      setCreatedPlaceId(null);
      setShowShareForm(false);
      setShowRelatedPlaces(false);
      setRelatedPlaceSearch("");
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);
      setTitle("");
      setComment("");
      setRating(null);
      resetStructuredRatings();
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageDisplayMode("cover");
      setImageCaption("");
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
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);
      setTitle("");
      setComment("");
      setRating(null);
      resetStructuredRatings();
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageDisplayMode("cover");
      setImageCaption("");
      setTripContext("prefer_not_to_say");
      setTripStyle("prefer_not_to_say");

      setTimeout(() => {
        document
          .getElementById("share-experience-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    // =========================
    // Open city/locality selection inside selected country
    // =========================
    const openCreateCityInSelectedCountry = () => {
      if (!selectedCountryPlace) return;

      setCreateFlowOpen(true);
      setCreateFlowError("");
      setCreateSelectedCountry(selectedCountryPlace);
      setCreateSelectedCity(null);
      setCreateCountrySearch(selectedCountryPlace.name || "");
      setCreateCitySearch("");
      setCreateSpecificPlaceType("nature");
      setCreateSpecificPlaceName("");

      setSelectedPlace(null);
      setCreatedPlaceId(null);
      setShowShareForm(false);
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);

      setTimeout(() => {
        document
          .getElementById("guided-create-city-step")
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

  if (isExperienceMode) {
    router.push(`/places/${place.id}/experiences`);
    return;
  }

  router.push(`/places/${place.id}`);
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
    resetStructuredRatings();
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageDisplayMode("cover");
    setImageCaption("");
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
    setShowShareForm(false);
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
    setTitle("");
    setComment("");
    setRating(null);
    resetStructuredRatings();
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageDisplayMode("cover");
    setImageCaption("");
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
    setShowShareForm(false);
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

  setSafetyRating(sharedExperience.safety_rating || null);
  setCostRating(sharedExperience.cost_rating || null);
  setAccessibilityRating(sharedExperience.accessibility_rating || null);
  setConvenienceRating(sharedExperience.convenience_rating || null);

  setImageFile(null);
  setImagePreviewUrl(null);
  setImageDisplayMode(sharedExperience.image_display_mode || "cover");
  setImageCaption(sharedExperience.image_caption || "");
  setTripContext(sharedExperience.trip_context || "prefer_not_to_say");
  setTripStyle(sharedExperience.trip_style || "prefer_not_to_say");
  setExperienceShared(false);
  setEditingExperience(true);
};

const requestPracticalRatingsConfirmation = (action: "create" | "update") => {
  setPendingExperienceAction(action);
  setShowPracticalRatingsConfirm(true);
};

const cancelPracticalRatingsConfirmation = () => {
  setShowPracticalRatingsConfirm(false);
  setPendingExperienceAction(null);
  setSkipPracticalRatingsConfirm(false);
  skipPracticalRatingsConfirmRef.current = false;
};

const clearExperienceFormError = () => {
  setExperienceFormError("");
};

const continueWithoutPracticalRatings = () => {
  setShowPracticalRatingsConfirm(false);
  setPendingExperienceAction(null);
  setSkipPracticalRatingsConfirm(true);
  skipPracticalRatingsConfirmRef.current = true;

  setTimeout(() => {
    const form = document.getElementById("experience-share-form") as HTMLFormElement | null;
    form?.requestSubmit();
  }, 0);
};


  // =========================
  // Submit experience
  // =========================
  const handleSubmitExperience = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlace) return;

    if (!title.trim()) {
      setExperienceFormError("Please add a short title.");
      return;
    }

    if (!rating) {
      setExperienceFormError("Please select a rating.");
      return;
    }

    if (!comment.trim()) {
      setExperienceFormError("Please write your experience.");
      return;
    }

    const shouldSkipPracticalRatingsConfirm =
      skipPracticalRatingsConfirm || skipPracticalRatingsConfirmRef.current;

    clearExperienceFormError();

    if (!hasAnyPracticalRating && !shouldSkipPracticalRatingsConfirm) {
      requestPracticalRatingsConfirmation("create");
      return;
    }

    setSkipPracticalRatingsConfirm(false);
    skipPracticalRatingsConfirmRef.current = false;

    setSubmittingExperience(true);

    try {
      const formData = new FormData();

formData.append("place", String(selectedPlace.id));
formData.append("title", title.trim());
formData.append("rating", String(rating));
formData.append("comment", comment.trim());

if (safetyRating) {
  formData.append("safety_rating", String(safetyRating));
}

if (costRating) {
  formData.append("cost_rating", String(costRating));
}

if (accessibilityRating) {
  formData.append("accessibility_rating", String(accessibilityRating));
}

if (convenienceRating) {
  formData.append("convenience_rating", String(convenienceRating));
}

formData.append("trip_context", tripContext);
formData.append("trip_style", tripStyle);


if (imageFile) {
  formData.append("image", imageFile);
}

formData.append("image_display_mode", imageDisplayMode);
formData.append("image_caption", imageCaption.trim());

const res = await fetch(`${API_URL}/api/experiences/`, {

  method: "POST",
  credentials: "include",
  body: formData,
});

      const data = await res.json();

      if (!res.ok) {
          console.error("Experience error:", data);
          setExperienceFormError(data.detail || "Could not share this experience.");
          return;
      }

      setSharedExperience(data);
      setTitle("");
      setComment("");
      setRating(null);
      resetStructuredRatings();
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageDisplayMode("cover");
      setImageCaption("");
      setExperienceShared(true);
      setTripContext("prefer_not_to_say");
      setTripStyle("prefer_not_to_say");
    } catch (error) {
      console.error("Share experience failed:", error);
      setExperienceFormError("Could not share this experience.");
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
      setExperienceFormError("Please add a short title.");
      return;
  }

  if (!rating) {
      setExperienceFormError("Please select a rating.");
      return;
  }

  if (!comment.trim()) {
      setExperienceFormError("Please write your experience.");
      return;
  }

    const shouldSkipPracticalRatingsConfirm =
      skipPracticalRatingsConfirm || skipPracticalRatingsConfirmRef.current;

    clearExperienceFormError();

    if (!hasAnyPracticalRating && !shouldSkipPracticalRatingsConfirm) {
      requestPracticalRatingsConfirmation("update");
      return;
    }

    setSkipPracticalRatingsConfirm(false);
    skipPracticalRatingsConfirmRef.current = false;

  setSubmittingExperience(true);

  try {
    const formData = new FormData();

    formData.append("place", String(selectedPlace.id));
    formData.append("title", title.trim());
    formData.append("rating", String(rating));
    formData.append("comment", comment.trim());

    if (safetyRating) {
      formData.append("safety_rating", String(safetyRating));
    }

    if (costRating) {
      formData.append("cost_rating", String(costRating));
    }

    if (accessibilityRating) {
      formData.append("accessibility_rating", String(accessibilityRating));
    }

    if (convenienceRating) {
      formData.append("convenience_rating", String(convenienceRating));
    }

    formData.append("trip_context", tripContext);
    formData.append("trip_style", tripStyle);

    if (imageFile) {
      formData.append("image", imageFile);
    }

    formData.append("image_display_mode", imageDisplayMode);
    formData.append("image_caption", imageCaption.trim());

    const res = await fetch(`${API_URL}/api/experiences/${sharedExperience.id}/`, {

      method: "PATCH",
      credentials: "include",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Update experience error:", data);
      setExperienceFormError(data.detail || "Could not update this experience.");
      return;
    }

    setSharedExperience(data);
    setTitle("");
    setComment("");
    setRating(null);
    resetStructuredRatings();
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageDisplayMode("cover");
    setImageCaption("");
    setEditingExperience(false);
    setExperienceShared(true);
    setTripContext("prefer_not_to_say");
    setTripStyle("prefer_not_to_say");
  } catch (error) {
      console.error("Update experience failed:", error);
      setExperienceFormError("Could not update this experience.");
  } finally {
    setSubmittingExperience(false);
  }
};

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>

    {showPracticalRatingsConfirm && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "460px",
            background: "white",
            borderRadius: "18px",
            padding: "22px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>
            Practical ratings
          </div>

          <h2 style={{ margin: "0 0 10px 0", fontSize: "22px" }}>
            You have not added practical ratings yet
          </h2>

          <p style={{ color: "#555", lineHeight: 1.5, marginBottom: "18px" }}>
            Safety, cost, accessibility and convenience help other travelers compare
            experiences. You can still publish now and add them later.
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={cancelPracticalRatingsConfirmation}
              style={secondaryButton}
            >
              Go back and add ratings
            </button>

            <button
              type="button"
              onClick={continueWithoutPracticalRatings}
              style={primaryButton}
            >
              {pendingExperienceAction === "update" ? "Save anyway" : "Publish anyway"}
            </button>
          </div>
        </div>
      </div>
    )}

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
          Search for the exact place first. If it does not exist yet, Trust Travel will
          guide you through the correct hierarchy: country → city/region → specific
          place. This helps avoid duplicates and keeps city/region experiences separate
          from reviews about restaurants, hotels, attractions and nature spots.
        </p>

        <div style={{ marginBottom: "22px" }}>

        </div>

        <input
          value={searchTerm}
          onChange={(e) => {
              const value = e.target.value;

              setSearchTerm(value);
              setCreateFlowOpen(false);
              setCreateFlowError("");
              setCreateSelectedCountry(null);

              if (placeType === "country") {
              }

              if (selectedCountryPlace) {
                setSelectedCountryPlace(null);
              }

              if (selectedPlace) {
                setSelectedPlace(null);
                setTitle("");
                setComment("");
                setRating(null);
                resetStructuredRatings();
                setExperienceShared(false);
                setSharedExperience(null);
                setEditingExperience(false);
                setTripContext("prefer_not_to_say");
                setTripStyle("prefer_not_to_say");
              }
            }}
        placeholder="Search country, city, beach, hotel, restaurant or attraction..."
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

    ) : !searchTerm.trim() ? null

      : filteredPlaces.length > 0 && !selectedCountryPlace && !selectedPlace ? (
      <section style={{ display: "grid", gap: "18px", maxWidth: "620px" }}>

        <p style={{ color: "#666", margin: 0, lineHeight: 1.5 }}>
          We found existing places related to your search. Check the type,
          city/region and country before selecting the correct result.
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
                    : "Choose actions for this country →"}
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
                    : "Choose actions for this city/region →"}
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
                    : "Choose actions for this place →"}
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
          We did not find this place in the current Trust Travel database. If this is a
          restaurant, hotel, beach, attraction or nature spot, choose the country first,
          then choose the matching city or locality. After that, you can add the specific
          place in the final step.
        </p>

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

        {!createFlowOpen ? (
          <button
            type="button"
            onClick={openGuidedCreateFlow}
            style={primaryButton}
          >
            Create a new place
          </button>
        ) : (
          <div style={guidedCreateBox}>
            <div>
              <div style={guidedCreateStepLabel}>Step 1</div>

              <h3 style={guidedCreateTitle}>Choose the country</h3>

              <p style={guidedCreateText}>
                Start with the country where this place belongs. Search by country
                name, common alternative name, or country code.
              </p>

              <input
                value={createCountrySearch}
                onChange={(event) => {
                  setCreateCountrySearch(event.target.value);
                  setCreateFlowError("");
                }}
                placeholder="Country, e.g. Indonesia, Mexico, Italy"
                style={input}
              />

              {createCountryCandidates.length > 0 && (
                  <div style={guidedCreateResults}>
                    {createCountryCandidates.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => selectCreateFlowCountryFromCatalog(country)}
                        disabled={creatingCreateFlowCountry}
                        style={{
                          ...guidedCreateResultButton,
                          opacity: creatingCreateFlowCountry ? 0.5 : 1,
                          cursor: creatingCreateFlowCountry
                            ? "not-allowed"
                            : "pointer",
                        }}
                      >
                        <span>
                          <strong>{country.canonical_name}</strong>
                          <br />
                          <span style={{ color: "#666", fontSize: "13px" }}>
                            Country · {country.code}
                          </span>
                        </span>

                        <span>Choose →</span>
                      </button>
                    ))}
                  </div>
              )}

              {createCountrySearch.trim() &&
                  createCountryCandidates.length === 0 && (
                    <p style={{ ...guidedCreateText, marginBottom: 0 }}>
                      No country found in the country catalog. Try another name or
                      country code.
                    </p>
                  )}
            </div>

            {createSelectedCountry && (
              <div id="guided-create-city-step">
                <div style={guidedCreateStepLabel}>Step 2</div>

                <h3 style={guidedCreateTitle}>
                  Choose the city or locality inside {createSelectedCountry.name}
                </h3>

                <p style={guidedCreateText}>
                  Search for the city or locality where this place belongs, then choose the
                  matching geographic result. Do not use this step for restaurants, hotels,
                  beaches, alerts or event titles.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "stretch",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    value={createCitySearch}
                    onChange={(event) => {
                      setCreateCitySearch(event.target.value);
                      setCreateFlowError("");
                      setGeographyCitySearchError("");
                      setGeographyCityResults([]);
                    }}
                    placeholder="City or locality, e.g. Recife, Rome, Antwerp"
                    style={{
                      ...input,
                      flex: "1 1 260px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      void handleSearchCreateFlowCities();
                    }}
                    disabled={geographyCitySearchLoading}
                    style={{
                      ...secondaryButton,
                      flex: "0 0 auto",
                      opacity: geographyCitySearchLoading ? 0.5 : 1,
                      cursor: geographyCitySearchLoading
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {geographyCitySearchLoading ? "Searching..." : "Search"}
                  </button>
                </div>

                {geographyCitySearchError && (
                  <div style={createFlowErrorBox}>
                    {geographyCitySearchError}
                  </div>
                )}

                {!geographyCitySearchLoading &&
                  geographyCityResults.length > 0 && (
                    <div style={guidedCreateResults}>
                      {geographyCityResults.map((cityResult) => (
                        <button
                          key={`${cityResult.external_source}-${cityResult.external_id}`}
                          type="button"
                          onClick={() =>
                            void selectGeographyCityForFlow(cityResult)
                          }
                          disabled={creatingCreateFlowCity}
                          style={{
                            ...guidedCreateResultButton,
                            opacity: creatingCreateFlowCity ? 0.5 : 1,
                            cursor: creatingCreateFlowCity
                              ? "not-allowed"
                              : "pointer",
                          }}
                        >
                          <span>
                            <strong>{cityResult.canonical_name}</strong>
                            <br />

                            <span
                              style={{
                                color: "#666",
                                fontSize: "13px",
                              }}
                            >
                              City / Locality
                              {cityResult.admin_name
                                ? ` · ${cityResult.admin_name}`
                                : ""}
                              {cityResult.population > 0
                                ? ` · Population ${cityResult.population.toLocaleString()}`
                                : ""}
                            </span>
                          </span>

                          <span>
                            {creatingCreateFlowCity
                              ? "Choosing..."
                              : "Choose →"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                {!geographyCitySearchLoading &&
                  createCitySearch.trim().length >= 2 &&
                  !geographyCitySearchError &&
                  geographyCityResults.length === 0 && (
                    <p style={guidedCreateText}>
                      Click Search to look for matching geographic places.
                    </p>
                  )}

                {createSelectedCountry && createSelectedCity && (
                  <div id="guided-create-specific-step">
                    <div style={guidedCreateStepLabel}>Step 3</div>

                    <h3 style={guidedCreateTitle}>
                      Choose the specific place type
                    </h3>

                    <p style={guidedCreateText}>
                      Now choose what kind of specific place you want to add inside{" "}
                      {createSelectedCity.name}. This keeps restaurants, hotels, attractions and
                      nature spots separated from city-level experiences.
                    </p>

                    <select
                      value={createSpecificPlaceType}
                      onChange={(event) =>
                        setCreateSpecificPlaceType(
                          event.target.value as
                            | "attraction"
                            | "hotel"
                            | "restaurant"
                            | "nature"
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

                    <div
                      style={{
                        marginTop: "18px",
                        padding: "14px",
                        border: "1px solid #d7f0df",
                        borderRadius: "14px",
                        background: "#f2fbf5",
                      }}
                    >
                      <div style={guidedCreateStepLabel}>Step 4 — Final step</div>

                      <h3 style={guidedCreateTitle}>
                        Create the specific place
                      </h3>

                      <p style={guidedCreateText}>
                        This is the final step. The place has not been created yet. Confirm the
                        exact name below to create it inside {createSelectedCity.name}.
                      </p>

                      <input
                        value={createSpecificPlaceName}
                        onChange={(event) => {
                          setCreateSpecificPlaceName(event.target.value);
                          setCreateFlowError("");
                        }}
                        placeholder="Specific place name, e.g. restaurant, beach, hotel, museum..."
                        style={input}
                      />

                      <button
                        type="button"
                        onClick={createSpecificPlaceForFlow}
                        disabled={
                          creatingCreateFlowSpecificPlace || !createSpecificPlaceName.trim()
                        }
                        style={{
                          ...primaryButton,
                          width: "fit-content",
                          marginTop: "12px",
                          opacity:
                            creatingCreateFlowSpecificPlace || !createSpecificPlaceName.trim()
                              ? 0.5
                              : 1,
                          cursor:
                            creatingCreateFlowSpecificPlace || !createSpecificPlaceName.trim()
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {creatingCreateFlowSpecificPlace
                          ? "Creating specific place..."
                          : `Create this ${getPlaceTypeLabel(createSpecificPlaceType)} inside ${createSelectedCity.name}`}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {createFlowError && (
              <div style={createFlowErrorBox}>
                {createFlowError}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                  setCreateFlowOpen(false);
                  setCreateFlowError("");
                  setCreateSelectedCountry(null);
                  setCreateSelectedCity(null);
                  setCreateCountrySearch("");
                  setCreateCitySearch("");
                  setCreateSpecificPlaceType("nature");
                  setCreateSpecificPlaceName("");
              }}
              style={secondaryButton}
            >
              Cancel
            </button>
          </div>
        )}
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

                {searchTerm.trim() && searchTerm.trim().length < 4 && (
                  <p
                    style={{
                      marginTop: "8px",
                      color: "#777",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    Type at least 4 characters to search for a country, city/region or specific place.
                  </p>
                )}

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

                    {[
                      ["Safety", sharedExperience.safety_rating],
                      ["Cost", sharedExperience.cost_rating],
                      ["Accessibility", sharedExperience.accessibility_rating],
                      ["Convenience", sharedExperience.convenience_rating],
                    ].some(([, value]) => value) && (
                      <div style={structuredRatingsPreviewBox}>
                        <strong>Practical ratings</strong>

                        <div style={structuredRatingsPreviewGrid}>
                          {[
                            ["Safety", sharedExperience.safety_rating],
                            ["Cost", sharedExperience.cost_rating],
                            ["Accessibility", sharedExperience.accessibility_rating],
                            ["Convenience", sharedExperience.convenience_rating],
                          ]
                            .filter(([, value]) => value)
                            .map(([label, value]) => (
                              <span key={label} style={structuredRatingsPreviewBadge}>
                                {label}: {"★".repeat(Number(value))}
                                {"☆".repeat(5 - Number(value))}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

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
                            `/experiences/${sharedExperience.id}`
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
                  id="experience-share-form"
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

                               <section
                  style={{
                    padding: "16px",
                    border: "1px solid #ddd",
                    borderRadius: "14px",
                    backgroundColor: "#fafafa",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#555",
                        marginBottom: "4px",
                      }}
                    >
                      Required rating
                    </div>

                    <strong style={{ fontSize: "18px" }}>Your overall rating</strong>

                    <p
                      style={{
                        margin: "8px 0 0 0",
                        color: "#666",
                        lineHeight: 1.5,
                      }}
                    >
                      Give this exact place an overall rating from 1 to 5. This is the
                      main rating used in averages, comparisons and Trust Travel insights.
                    </p>
                  </div>

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
                    placeholder="Overall rating from 1 to 5"
                    style={input}
                  />
                </section>

                <section style={structuredRatingsBox}>
                  <div>
                    <strong>Optional practical ratings</strong>

                    <p style={structuredRatingsIntro}>
                      These ratings are optional. They help future travelers compare places by
                      practical criteria, without replacing your overall rating.
                    </p>
                  </div>

                  <div style={structuredRatingsGrid}>
                    <label style={structuredRatingField}>
                      Safety
                      <select
                        value={safetyRating ?? ""}
                        onChange={(e) =>
                          handleOptionalRatingChange(e.target.value, setSafetyRating)
                        }
                        style={input}
                      >
                        <option value="">Not rated</option>
                        <option value="1">1 — Poor</option>
                        <option value="2">2 — Limited</option>
                        <option value="3">3 — Okay</option>
                        <option value="4">4 — Good</option>
                        <option value="5">5 — Excellent</option>
                      </select>
                    </label>

                    <label style={structuredRatingField}>
                      Cost
                      <select
                        value={costRating ?? ""}
                        onChange={(e) =>
                          handleOptionalRatingChange(e.target.value, setCostRating)
                        }
                        style={input}
                      >
                        <option value="">Not rated</option>
                        <option value="1">1 — Very expensive / poor value</option>
                        <option value="2">2 — Expensive</option>
                        <option value="3">3 — Fair</option>
                        <option value="4">4 — Good value</option>
                        <option value="5">5 — Excellent value</option>
                      </select>
                    </label>

                    <label style={structuredRatingField}>
                      Accessibility
                      <select
                        value={accessibilityRating ?? ""}
                        onChange={(e) =>
                          handleOptionalRatingChange(e.target.value, setAccessibilityRating)
                        }
                        style={input}
                      >
                        <option value="">Not rated</option>
                        <option value="1">1 — Very difficult</option>
                        <option value="2">2 — Difficult</option>
                        <option value="3">3 — Acceptable</option>
                        <option value="4">4 — Easy</option>
                        <option value="5">5 — Very easy</option>
                      </select>
                    </label>

                    <label style={structuredRatingField}>
                      Convenience
                      <select
                        value={convenienceRating ?? ""}
                        onChange={(e) =>
                          handleOptionalRatingChange(e.target.value, setConvenienceRating)
                        }
                        style={input}
                      >
                        <option value="">Not rated</option>
                        <option value="1">1 — Poor</option>
                        <option value="2">2 — Limited</option>
                        <option value="3">3 — Okay</option>
                        <option value="4">4 — Convenient</option>
                        <option value="5">5 — Very convenient</option>
                      </select>
                    </label>
                  </div>
                </section>

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

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={{ fontSize: "13px", color: "#666" }}>
                    {editingExperience ? "Replace or add image" : "Optional image"}
                  </label>

                  <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;

                        if (imagePreviewUrl) {
                          URL.revokeObjectURL(imagePreviewUrl);
                        }

                        setImageFile(file);
                        setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
                      }}
                      style={input}
                    />

                    {imagePreviewUrl && (
                      <img
                        src={imagePreviewUrl}
                        alt="Selected main photo preview"
                        style={{
                          width: "100%",
                          maxHeight: "260px",
                          objectFit: imageDisplayMode,
                          borderRadius: "12px",
                          border: "1px solid #eee",
                          background: "#f5f5f5",
                          marginTop: "8px",
                        }}
                      />
                    )}

                    <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                      <label style={{ fontSize: "13px", color: "#666", fontWeight: 600 }}>
                        Photo frame
                      </label>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setImageDisplayMode("contain")}
                          style={{
                            ...secondaryButton,
                            border:
                              imageDisplayMode === "contain"
                                ? "1px solid #111"
                                : secondaryButton.border,
                          }}
                        >
                          Full photo
                        </button>

                        <button
                          type="button"
                          onClick={() => setImageDisplayMode("cover")}
                          style={{
                            ...secondaryButton,
                            border:
                              imageDisplayMode === "cover"
                                ? "1px solid #111"
                                : secondaryButton.border,
                          }}
                        >
                          Fill frame
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                      <label style={{ fontSize: "13px", color: "#666", fontWeight: 600 }}>
                        Main photo caption
                      </label>

                      <input
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="Optional short caption for the main photo..."
                        maxLength={160}
                        style={input}
                      />
                    </div>

                  <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.4 }}>
                    {editingExperience
                      ? "You can replace the main photo, adjust its frame and update its caption here."
                      : "You can add a main photo now. Extra gallery photos can be added later in My posts."}
                  </div>
                </div>

                {experienceFormError && (
                  <div style={experienceFormErrorBox}>
                    {experienceFormError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingExperience}
                  style={{
                    ...primaryButton,
                    opacity: submittingExperience ? 0.5 : 1,
                    cursor: submittingExperience ? "not-allowed" : "pointer",
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

export default function DestinationsPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
          Loading...
        </main>
      }
    >
      <DestinationsPageContent />
    </Suspense>
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

const guidedCreateBox = {
  display: "grid",
  gap: "18px",
  marginTop: "16px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
};

const guidedCreateStepLabel = {
  fontSize: "12px",
  color: "#777",
  fontWeight: 700,
  marginBottom: "4px",
};

const guidedCreateTitle = {
  margin: "0 0 8px 0",
  fontSize: "16px",
};

const guidedCreateText = {
  margin: "0 0 12px 0",
  color: "#666",
  lineHeight: 1.5,
  fontSize: "13px",
};

const guidedCreateResults = {
  display: "grid",
  gap: "8px",
  marginTop: "10px",
};

const guidedCreateResultButton = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  textAlign: "left" as const,
  cursor: "pointer",
};

const createFlowErrorBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#991b1b",
  fontSize: "13px",
};

const structuredRatingsBox = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  display: "grid",
  gap: "12px",
};

const structuredRatingsIntro = {
  margin: "6px 0 0 0",
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.5,
};

const structuredRatingsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
};

const structuredRatingField = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  color: "#555",
  fontWeight: 600,
};

const structuredRatingsPreviewBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eee",
  background: "white",
  display: "grid",
  gap: "8px",
  color: "#555",
  fontSize: "13px",
};

const structuredRatingsPreviewGrid = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const structuredRatingsPreviewBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #eee",
  background: "#fafafa",
  fontSize: "12px",
};

const createPlaceErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
};

const experienceFormErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
};