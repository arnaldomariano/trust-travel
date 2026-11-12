"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import UpdateForm from "../components/UpdateForm";
import { API_URL } from "../lib/api";

type CountryCatalogItem = {
  code: string;
  canonical_name: string;
  aliases: string[];
};

type CountryRefinementOption = {
  country_code: string;
};

type GeographyPlaceResult = {
  name: string;
  canonical_name: string;
  aliases: string[];
  country_code: string;
  place_type: "city";
  geographic_type: string;
  latitude: string | null;
  longitude: string | null;
  feature_code: string;
  population: number;
  admin_name: string;
  admin_context?: {
    level: number;
    name: string;
    code: string;
    external_id: string;
    iso_code: string;
  }[];
  external_source?: string;
  external_id?: string;
  existing_place_id: number | null;
  can_open: boolean;
  can_explore: boolean;
};

type ExternalGeographicDetail = {
  name: string;
  canonical_name: string;
  aliases: string[];
  country_code: string;
  latitude: string | number | null;
  longitude: string | number | null;
  geographic_type: string;
  feature_class: string;
  feature_code: string;
  population: number;
  admin_name: string;
  admin_context: {
    level: number;
    name: string;
    code: string;
    external_id: string;
    iso_code: string;
  }[];
  external_source: "geonames" | "google_places";
  external_id: string;
  spatial_extent?: {
    kind: "bounding_box";
    north: string | number;
    south: string | number;
    east: string | number;
    west: string | number;
  } | null;
  primary_type?: string;
  formatted_address?: string;
  location_context?: {
    type: string;
    name: string;
    short_name: string;
  }[];
};

function getGeographicAdminLabel(result: GeographyPlaceResult): string {
  const entries = [...(result.admin_context || [])]
    .filter((entry) => entry.name?.trim())
    .sort((a, b) => a.level - b.level);

  const names: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const name = entry.name.trim();
    const key = name.toLocaleLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }

  if (names.length > 0) {
    return names.join(" · ");
  }

  return result.admin_name?.trim() || "";
}

function getGeographicTypeLabel(geographicType: string) {
  const labels: Record<string, string> = {
    settlement: "City / Settlement",
    administrative_area: "Administrative area",
    region: "Region",
    island: "Island",
    archipelago: "Archipelago",
    river: "River",
    lake: "Lake",
    mountain: "Mountain",
    valley: "Valley",
    desert: "Desert",
  };

  return labels[geographicType] || "Geographic place";
}

function DestinationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeFromUrl = searchParams.get("place");
  const shouldOpenShareForm = searchParams.get("share") === "true";

  const poiSourceFromUrl = searchParams.get("poi_source");
  const poiIdFromUrl = searchParams.get("poi_id");
  const poiTypeFromUrl = searchParams.get("poi_type");
  const poiCityPlaceIdFromUrl = searchParams.get("city_place_id");
  const poiCitySourceFromUrl = searchParams.get("city_source");
  const poiCityIdFromUrl = searchParams.get("city_id");

  const manualPOINameFromUrl = searchParams.get("manual_poi_name");
  const manualPOITypeFromUrl = searchParams.get("manual_poi_type");
  const manualCityPlaceIdFromUrl = searchParams.get("manual_city_place_id");

  const validManualPOITypes = [
    "attraction",
    "hotel",
    "restaurant",
    "nature",
    "other",
  ] as const;

  const manualPOIType = validManualPOITypes.find(
    (type) => type === manualPOITypeFromUrl
  );

  const manualCityPlaceId =
    manualCityPlaceIdFromUrl &&
    /^[1-9][0-9]*$/.test(manualCityPlaceIdFromUrl)
      ? Number(manualCityPlaceIdFromUrl)
      : null;

  const hasValidManualCityPlaceId =
    manualCityPlaceId !== null &&
    Number.isSafeInteger(manualCityPlaceId);

  const hasManualPOIUrlParameters =
    manualPOINameFromUrl !== null ||
    manualPOITypeFromUrl !== null ||
    manualCityPlaceIdFromUrl !== null;

  const hasValidExternalCityReference =
    (poiCitySourceFromUrl === "geonames" ||
      poiCitySourceFromUrl === "google_places") &&
    Boolean(poiCityIdFromUrl?.trim());

  const validExternalPOITypes = [
    "attraction",
    "hotel",
    "restaurant",
    "nature",
    "other",
  ] as const;

  const externalPOITypeFromUrl = validExternalPOITypes.find(
    (type) => type === poiTypeFromUrl
  );

  const externalPOICityIdFromUrl =
    poiCityPlaceIdFromUrl &&
    /^[1-9][0-9]*$/.test(poiCityPlaceIdFromUrl)
      ? Number(poiCityPlaceIdFromUrl)
      : null;

  const hasValidExternalPOICityId =
    externalPOICityIdFromUrl !== null &&
    Number.isSafeInteger(externalPOICityIdFromUrl);

  const mode = searchParams.get("mode");
  const isExperienceMode = mode === "experience";
  const isUpdateMode = mode === "update";

  const [places, setPlaces] = useState<any[]>([]);
  const [placesLoadedSuccessfully, setPlacesLoadedSuccessfully] = useState(false);
  const [countryCatalog, setCountryCatalog] = useState<CountryCatalogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Generic external geographic results used by the main search.
  // This is intentionally separate from the legacy guided creation flow.
  const [mainGeographyResults, setMainGeographyResults] = useState<
    GeographyPlaceResult[]
  >([]);
  const [
    selectedMainGeographyResult,
    setSelectedMainGeographyResult,
  ] = useState<GeographyPlaceResult | null>(null);
  const [
    externalGeographicDetail,
    setExternalGeographicDetail,
  ] = useState<ExternalGeographicDetail | null>(null);
  const [
    externalGeographicDetailLoading,
    setExternalGeographicDetailLoading,
  ] = useState(false);
  const [
    externalGeographicDetailError,
    setExternalGeographicDetailError,
  ] = useState<"not_found" | "unavailable" | null>(null);
  const externalGeographicDetailRequestId = useRef(0);

  const [mainGeographySearchLoading, setMainGeographySearchLoading] =
    useState(false);
  const [mainGeographySearchError, setMainGeographySearchError] = useState("");
  const [mainGeographyCompletedQuery, setMainGeographyCompletedQuery] = useState("");
  const [
    mainGeographyMeaningfulAmbiguity,
    setMainGeographyMeaningfulAmbiguity,
  ] = useState(false);
  const [
    mainGeographyCountryRefinementOptions,
    setMainGeographyCountryRefinementOptions,
  ] = useState<CountryRefinementOption[]>([]);
  const [
    mainGeographyCountryRefinement,
    setMainGeographyCountryRefinement,
  ] = useState<string | null>(null);
  const [placeType, setPlaceType] = useState<
  "country" | "city" | "attraction" | "hotel" | "restaurant" | "nature" | "other"
  >("country");

  const [selectedCountryPlace, setSelectedCountryPlace] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [selectedManualPOI, setSelectedManualPOI] = useState<{
    name: string;
    place_type: "attraction" | "hotel" | "restaurant" | "nature" | "other";
    city_place_id: number;
  } | null>(null);
  const [selectedExternalPOI, setSelectedExternalPOI] = useState<(
    {
      name: string;
      external_id: string;
      place_type: "attraction" | "hotel" | "restaurant" | "nature" | "other";
    } & (
      {
        city_place_id: number;
        city_source?: never;
        city_id?: never;
      } | {
        city_place_id?: never;
        city_source: "geonames" | "google_places";
        city_id: string;
      }
    )
  ) | null>(null);
  const [showShareForm, setShowShareForm] = useState(false);
  const [showRelatedPlaces, setShowRelatedPlaces] = useState(false);
  const [relatedPlaceSearch, setRelatedPlaceSearch] = useState("");

  const [createFlowOpen, setCreateFlowOpen] = useState(false);
  const [createCountrySearch, setCreateCountrySearch] = useState("");
  const [createCitySearch, setCreateCitySearch] = useState("");

  const [geographyCityResults, setGeographyCityResults] = useState<
    GeographyPlaceResult[]
  >([]);
  const [geographyCitySearchLoading, setGeographyCitySearchLoading] =
    useState(false);
  const [geographyCitySearchError, setGeographyCitySearchError] = useState("");
  const [geographyCityHasSearched, setGeographyCityHasSearched] = useState(false);
  const geographyCitySearchRequestId = useRef(0);

  const [manualGeographicDiagnostic, setManualGeographicDiagnostic] = useState<{
    results: GeographyPlaceResult[];
    providers: Record<string, { state: "success" | "empty" | "error" }>;
    complete: boolean;
    other_country_codes: string[];
    has_country_mismatch: boolean;
    manual_creation_eligible: boolean;
  } | null>(null);
  const [manualGeographicDiagnosticLoading, setManualGeographicDiagnosticLoading] =
    useState(false);
  const [manualGeographicDiagnosticError, setManualGeographicDiagnosticError] =
    useState("");
  const manualGeographicDiagnosticRequestId = useRef(0);

  const [createSelectedCountry, setCreateSelectedCountry] = useState<any>(null);
  const [createSelectedCity, setCreateSelectedCity] = useState<any>(null);
  const [createSpecificPlaceType, setCreateSpecificPlaceType] = useState<
    "attraction" | "hotel" | "restaurant" | "nature" | "other"
  >("nature");
  const [createSpecificPlaceName, setCreateSpecificPlaceName] = useState("");

  const [createSpecificPlaceSearchResults, setCreateSpecificPlaceSearchResults] =
    useState<any[]>([]);
  const [createSpecificPlaceSearchLoading, setCreateSpecificPlaceSearchLoading] =
    useState(false);
  const [createSpecificPlaceHasSearched, setCreateSpecificPlaceHasSearched] =
    useState(false);

  const [creatingCreateFlowCountry, setCreatingCreateFlowCountry] = useState(false);
  const [creatingCreateFlowCity, setCreatingCreateFlowCity] = useState(false);

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
  const [externalPOISelectionError, setExternalPOISelectionError] = useState("");
  const externalPOISelectionRequestId = useRef(0);
  const dismissedExternalPOIUrl = useRef<string | null>(null);
  const dismissedManualPOIUrl = useRef<string | null>(null);
  const initializedManualPOIUrl = useRef<string | null>(null);
  const currentExternalPOIUrl = searchParams.toString();

  const leaveExternalPOISelection = () => {
    externalPOISelectionRequestId.current += 1;

    if (poiSourceFromUrl) {
      dismissedExternalPOIUrl.current = currentExternalPOIUrl;
    }

    if (hasManualPOIUrlParameters) {
      dismissedManualPOIUrl.current = currentExternalPOIUrl;
      initializedManualPOIUrl.current = null;
    }

    if (poiSourceFromUrl || hasManualPOIUrlParameters) {
      router.replace(
        isExperienceMode ? "/destinations?mode=experience" : "/destinations"
      );
    }

    setSelectedExternalPOI(null);
    setExternalPOISelectionError("");
  };

  const [experienceFormError, setExperienceFormError] = useState("");
  const [experienceShared, setExperienceShared] = useState(false);
  const [sharedExperience, setSharedExperience] = useState<any>(null);
  const [editingExperience, setEditingExperience] = useState(false);

  const [showPracticalRatingsConfirm, setShowPracticalRatingsConfirm] = useState(false);
  const [pendingExperienceAction, setPendingExperienceAction] = useState<"create" | "update" | null>(null);
  const [skipPracticalRatingsConfirm, setSkipPracticalRatingsConfirm] = useState(false);
  const skipPracticalRatingsConfirmRef = useRef(false);
  const experienceSubmissionGenerationRef = useRef(0);

  const invalidatePendingExperienceSubmission = () => {
    experienceSubmissionGenerationRef.current += 1;
    setShowPracticalRatingsConfirm(false);
    setPendingExperienceAction(null);
    setSkipPracticalRatingsConfirm(false);
    skipPracticalRatingsConfirmRef.current = false;
  };

  // =========================
  // Load places and country catalog
  // =========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [placesRes, countriesRes] = await Promise.all([
          fetch(`${API_URL}/api/places/`),
          fetch(`${API_URL}/api/countries/`),
        ]);

        if (!placesRes.ok) {
          console.error("Failed to load places");
          return;
        }

        const placesData = await placesRes.json();

        if (!Array.isArray(placesData)) {
          console.error("Unexpected places response format");
          return;
        }

        setPlaces(placesData);
        setPlacesLoadedSuccessfully(true);

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
  if (
    !placeFromUrl ||
    places.length === 0 ||
    hasManualPOIUrlParameters ||
    poiSourceFromUrl !== null ||
    poiIdFromUrl !== null ||
    poiTypeFromUrl !== null ||
    poiCityPlaceIdFromUrl !== null ||
    poiCitySourceFromUrl !== null ||
    poiCityIdFromUrl !== null
  ) {
    return;
  }

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
}, [
  placeFromUrl,
  shouldOpenShareForm,
  places,
  hasManualPOIUrlParameters,
  poiSourceFromUrl,
  poiIdFromUrl,
  poiTypeFromUrl,
  poiCityPlaceIdFromUrl,
  poiCitySourceFromUrl,
  poiCityIdFromUrl,
]);

// =========================
// Select external Foursquare POI from URL
// =========================
useEffect(() => {
  if (!poiSourceFromUrl || !isExperienceMode) {
    dismissedExternalPOIUrl.current = null;
    return;
  }

  if (dismissedExternalPOIUrl.current === currentExternalPOIUrl) return;
  dismissedExternalPOIUrl.current = null;

  if (loading) return;

  if (hasManualPOIUrlParameters) {
    externalPOISelectionRequestId.current += 1;
    setSelectedExternalPOI(null);
    setSelectedManualPOI(null);
    setShowShareForm(false);
    setExternalPOISelectionError(
      "Conflicting place references. Please choose one place again."
    );
    return;
  }

  if (poiSourceFromUrl !== "foursquare") {
    setSelectedExternalPOI(null);
    setShowShareForm(false);
    setExternalPOISelectionError(
      "This external place provider is not supported."
    );
    return;
  }

  let active = true;
  const requestId = ++externalPOISelectionRequestId.current;

  const selectExternalPOI = async () => {
    setExternalPOISelectionError("");
    setSelectedExternalPOI(null);
    setSelectedPlace(null);
    setSelectedManualPOI(null);
    setSelectedMainGeographyResult(null);
    setSelectedCountryPlace(null);
    setShowShareForm(false);

    if (
      !placesLoadedSuccessfully ||
      !poiIdFromUrl?.trim() ||
      !externalPOITypeFromUrl ||
      (hasValidExternalPOICityId === hasValidExternalCityReference) ||
      (poiCityPlaceIdFromUrl !== null &&
        (poiCitySourceFromUrl !== null || poiCityIdFromUrl !== null)) ||
      ((poiCitySourceFromUrl !== null || poiCityIdFromUrl !== null) &&
        !hasValidExternalCityReference)
    ) {
      setExternalPOISelectionError(
        "This external place cannot be selected for sharing right now."
      );
      return;
    }

    if (hasValidExternalPOICityId) {
      const cityPlace = places.find(
        (place) =>
          Number(place.id) === externalPOICityIdFromUrl &&
          place.place_type === "city"
      );

      if (!cityPlace) {
        setExternalPOISelectionError(
          "The selected city is not registered in Trust Travel."
        );
        return;
      }
    }

    try {
      const params = new URLSearchParams({
        external_source: "foursquare",
        external_id: poiIdFromUrl.trim(),
      });

      const response = await fetch(
        `${API_URL}/api/geography/pois/external-detail/?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("External place detail unavailable");
      }

      const detail = await response.json();

      if (
        detail.external_source !== "foursquare" ||
        detail.external_id !== poiIdFromUrl.trim() ||
        typeof detail.name !== "string" ||
        !detail.name.trim()
      ) {
        throw new Error("Invalid external place detail");
      }

      if (!active || requestId !== externalPOISelectionRequestId.current) return;

      const selectedPOIBase = {
        name: detail.name.trim(),
        external_id: detail.external_id,
        place_type: externalPOITypeFromUrl,
      };

      if (hasValidExternalPOICityId) {
        setSelectedExternalPOI({
          ...selectedPOIBase,
          city_place_id: externalPOICityIdFromUrl!,
        });
      } else {
        setSelectedExternalPOI({
          ...selectedPOIBase,
          city_source: poiCitySourceFromUrl as "geonames" | "google_places",
          city_id: poiCityIdFromUrl!.trim(),
        });
      }
      setSearchTerm(detail.name.trim());
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);
      setExperienceFormError("");
      setShowShareForm(shouldOpenShareForm);
    } catch (error) {
      if (!active || requestId !== externalPOISelectionRequestId.current) return;
      console.error("External POI selection failed:", error);
      setExternalPOISelectionError(
        "Could not load this external place. Please return to the search."
      );
    }
  };

  void selectExternalPOI();

  return () => {
    active = false;
  };
}, [
  currentExternalPOIUrl,
  poiSourceFromUrl,
  hasManualPOIUrlParameters,
  poiIdFromUrl,
  externalPOITypeFromUrl,
  externalPOICityIdFromUrl,
  hasValidExternalPOICityId,
  poiCityPlaceIdFromUrl,
  poiCitySourceFromUrl,
  poiCityIdFromUrl,
  hasValidExternalCityReference,
  isExperienceMode,
  shouldOpenShareForm,
  loading,
  placesLoadedSuccessfully,
  places,
]);

  // =========================
  // Select manual POI from URL without materialization
  // =========================
  useEffect(() => {
    if (!hasManualPOIUrlParameters || !isExperienceMode) {
      dismissedManualPOIUrl.current = null;
      initializedManualPOIUrl.current = null;
      return;
    }

    if (dismissedManualPOIUrl.current === currentExternalPOIUrl) return;
    if (initializedManualPOIUrl.current === currentExternalPOIUrl) return;
    if (loading) return;

    // A manual selection must not coexist with another place reference.
    if (
      placeFromUrl !== null ||
      poiSourceFromUrl !== null ||
      poiIdFromUrl !== null ||
      poiTypeFromUrl !== null ||
      poiCityPlaceIdFromUrl !== null ||
      poiCitySourceFromUrl !== null ||
      poiCityIdFromUrl !== null
    ) {
      setSelectedManualPOI(null);
      setSelectedExternalPOI(null);
      setSelectedPlace(null);
      setShowShareForm(false);
      setExternalPOISelectionError(
        "Conflicting place references. Please choose one place again."
      );
      return;
    }

    setSelectedManualPOI(null);
    setSelectedExternalPOI(null);
    setSelectedPlace(null);
    setSelectedMainGeographyResult(null);
    setSelectedCountryPlace(null);
    setShowShareForm(false);

    const name = manualPOINameFromUrl?.trim() || "";

    if (
      !placesLoadedSuccessfully ||
      !name ||
      name.length > 200 ||
      !manualPOIType ||
      !hasValidManualCityPlaceId
    ) {
      setExternalPOISelectionError(
        "This manually entered place cannot be selected for sharing right now."
      );
      return;
    }

    const cityPlace = places.find(
      (candidate) =>
        Number(candidate.id) === manualCityPlaceId &&
        candidate.place_type === "city"
    );

    if (!cityPlace) {
      setExternalPOISelectionError(
        "The selected city is not registered in Trust Travel."
      );
      return;
    }

    initializedManualPOIUrl.current = currentExternalPOIUrl;
    setExternalPOISelectionError("");
    setSelectedManualPOI({
      name,
      place_type: manualPOIType,
      city_place_id: manualCityPlaceId!,
    });
    setSearchTerm(name);
    setExperienceShared(false);
    setSharedExperience(null);
    setEditingExperience(false);
    setExperienceFormError("");
    setShowShareForm(shouldOpenShareForm);
  }, [
    hasManualPOIUrlParameters,
    isExperienceMode,
    currentExternalPOIUrl,
    loading,
    placeFromUrl,
    poiSourceFromUrl,
    poiIdFromUrl,
    poiTypeFromUrl,
    poiCityPlaceIdFromUrl,
    poiCitySourceFromUrl,
    poiCityIdFromUrl,
    manualPOINameFromUrl,
    manualPOIType,
    manualCityPlaceId,
    hasValidManualCityPlaceId,
    placesLoadedSuccessfully,
    places,
    shouldOpenShareForm,
  ]);

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

const placeBelongsToSelectedCountry = (place: any) => {
  if (!selectedCountryPlace) return true;

  const selectedCountryCode = String(
    selectedCountryPlace.country_code || ""
  )
    .trim()
    .toUpperCase();

  const placeCountryCode = String(place.country_code || "")
    .trim()
    .toUpperCase();

  if (selectedCountryCode && placeCountryCode) {
    return placeCountryCode === selectedCountryCode;
  }

  const selectedCountryNames = getNormalizedPlaceSearchNames(
    selectedCountryPlace
  );

  const placeCountryName = normalizeText(
    place.destination_country || ""
  );

  return selectedCountryNames.includes(placeCountryName);
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
      if (!placeBelongsToSelectedCountry(place)) return 0;
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

const getUnifiedSearchScore = (place: any) => {
  const search = normalizeText(searchTerm);

  if (!search) return 0;

  // Allow short direct name searches such as "Bar",
  // while still avoiding results from a single typed character.
  if (search.length < 2) return 0;

  const searchableNames = getNormalizedPlaceSearchNames(place);
  const city = normalizeText(place.city || "");
  const type = normalizeText(place.place_type || "");

  if (searchableNames.some((value) => value === search)) {
    return 100;
  }

  if (searchableNames.some((value) => value.startsWith(search))) {
    return 90;
  }

  const matchesWordPrefix = searchableNames.some((value) =>
    value
      .split(/\s+/)
      .some((word) => word.startsWith(search))
  );

  const matchesOnlySpecificPlaceCityPrefix =
    place.place_type !== "country" &&
    place.place_type !== "city" &&
    city.startsWith(search);

  if (
    search.length >= 2 &&
    matchesWordPrefix &&
    !matchesOnlySpecificPlaceCityPrefix
  ) {
    return 85;
  }

  if (
    search.length >= 4 &&
    searchableNames.some((value) => value.includes(search))
  ) {
    return 80;
  }

  // Only geographic hub records should match by geographic place name.
  // Specific places should appear only when the user searches their own name,
  // alias or canonical name.
  if (
    place.place_type === "city" &&
    search.length >= 4 &&
    city.includes(search)
  ) {
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

const normalizedMainSearch = normalizeText(searchTerm);

const mainSearchCountryCatalogMatches = normalizedMainSearch.length >= 2
  ? countryCatalog
      .filter((country) => {
        const searchableNames = [
          country.code,
          country.canonical_name,
          ...(country.aliases || []),
        ].map((value) => normalizeText(value));

        return searchableNames.some((value) => {
          if (value === normalizedMainSearch) return true;

          if (value.startsWith(normalizedMainSearch)) return true;

          if (
            normalizedMainSearch.length >= 4 &&
            value.includes(normalizedMainSearch)
          ) {
            return true;
          }

          return false;
        });
      })
      .filter((country) => {
        return !places.some((place) => {
          if (place.place_type !== "country") return false;

          const placeCountryCode = (place.country_code || "")
            .trim()
            .toUpperCase();

          return placeCountryCode === country.code.toUpperCase();
        });
      })
      .sort((a, b) =>
        a.canonical_name.localeCompare(b.canonical_name)
      )
      .slice(0, 6)
  : [];

const placesInsideSelectedCountry = selectedCountryPlace
  ? places
      .filter((place) => {
        if (place.place_type === "country") return false;

        return placeBelongsToSelectedCountry(place);
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
      const searchableNames = getNormalizedPlaceSearchNames(place);
      const city = normalizeText(place.city || place.destination_name);

      return (
        searchableNames.some((value) =>
          value.includes(normalizedRelatedPlaceSearch)
        ) ||
        city.includes(normalizedRelatedPlaceSearch)
      );
    })
  : [];

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

const getPlaceDisplayTypeLabel = (place: any) => {
  if (!place) return "Place";

  // place_type defines the structural role of a geographic hub, while
  // geographic_type describes what that place actually is to the traveler.
  // Keep the legacy City / Region label when older records have no type yet.
  if (place.place_type === "city" && place.geographic_type) {
    return getGeographicTypeLabel(place.geographic_type);
  }

  return getPlaceTypeLabel(place.place_type);
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

const selectedExperienceTarget =
  selectedPlace ||
  (isExperienceMode
    ? selectedExternalPOI || selectedManualPOI || selectedMainGeographyResult
    : null);

const selectedExperienceTargetName =
  selectedPlace?.name ||
  (isExperienceMode
    ? selectedExternalPOI?.name ||
      selectedManualPOI?.name ||
      selectedMainGeographyResult?.canonical_name
    : "") ||
  "";

const isManualExperienceSelection =
  isExperienceMode &&
  !!selectedManualPOI &&
  !!showShareForm;

const selectedManualPOICity = selectedManualPOI
  ? places.find(
      (candidate) =>
        candidate.place_type === "city" &&
        Number(candidate.id) === selectedManualPOI.city_place_id
    )
  : null;

const selectedPlaceReviewsCount =
  Number(selectedPlace?.reviews_count ?? selectedPlace?.average_rating_count ?? 0);

const selectedPlaceParentCountryName = selectedPlace
  ? getParentCountryName(selectedPlace)
  : "";

const selectedPlaceParentCountryPlace = selectedPlace
  ? places.find((place) => {
      if (!isCountryPlace(place)) return false;

      const selectedPlaceCountryCode = String(
        selectedPlace.country_code || ""
      )
        .trim()
        .toUpperCase();

      const candidateCountryCode = String(
        place.country_code || ""
      )
        .trim()
        .toUpperCase();

      if (selectedPlaceCountryCode && candidateCountryCode) {
        return candidateCountryCode === selectedPlaceCountryCode;
      }

      const candidateNames = getNormalizedPlaceSearchNames(place);

      return candidateNames.includes(
        normalizeText(selectedPlaceParentCountryName)
      );
    })
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

const visibleMainGeographyResults = mainGeographyCountryRefinement
  ? mainGeographyResults.filter(
      (result) =>
        result.country_code.toUpperCase() ===
        mainGeographyCountryRefinement
    )
  : mainGeographyResults;

const canContinueAfterMainSearch =
  !mainGeographySearchLoading &&
  !mainGeographySearchError &&
  mainGeographyCompletedQuery.length >= 2 &&
  mainGeographyCompletedQuery === searchTerm.trim() &&
  !selectedCountryPlace &&
  !selectedPlace &&
  !selectedMainGeographyResult &&
  !selectedExternalPOI &&
  !selectedManualPOI;


const handleMainGeographySearch = async () => {
  setMainGeographyCompletedQuery("");
  setSelectedManualPOI(null);
  const query = searchTerm.trim();

  // Invalidate external details when a new search begins.
  clearExternalGeographicDetail();
  setSelectedMainGeographyResult(null);

  if (query.length < 2) {
    setMainGeographyResults([]);
    setMainGeographySearchError("");
    setMainGeographyMeaningfulAmbiguity(false);
    setMainGeographyCountryRefinementOptions([]);
    setMainGeographyCountryRefinement(null);

    return;
  }

  setMainGeographySearchLoading(true);
  setMainGeographySearchError("");
  setMainGeographyCountryRefinement(null);

  try {
    const params = new URLSearchParams({
      q: query,
    });

    const res = await fetch(
      `${API_URL}/api/geography/places/search/?${params.toString()}`
    );

    const data = await res.json();

    if (!res.ok) {
      setMainGeographyResults([]);
      setMainGeographyMeaningfulAmbiguity(false);
      setMainGeographyCountryRefinementOptions([]);
      setMainGeographySearchError(
        data.detail || "Could not search geographic places."
      );
      return;
    }

    setMainGeographyResults(
      Array.isArray(data.results) ? data.results : []
    );
    setMainGeographyCompletedQuery(query);
    setMainGeographyMeaningfulAmbiguity(
      data.meaningful_ambiguity === true
    );
    setMainGeographyCountryRefinementOptions(
      Array.isArray(data.country_refinement_options)
        ? data.country_refinement_options
        : []
    );
  } catch (error) {
    console.error("Main geographic search failed:", error);
    setMainGeographyResults([]);
    setMainGeographyMeaningfulAmbiguity(false);
    setMainGeographyCountryRefinementOptions([]);
    setMainGeographyCountryRefinement(null);
    setMainGeographySearchError(
      "Could not search geographic places."
    );
  } finally {
    setMainGeographySearchLoading(false);
  }
};

const resetGeographyCitySearch = () => {
  geographyCitySearchRequestId.current += 1;
  setGeographyCityResults([]);
  setGeographyCitySearchError("");
  setGeographyCitySearchLoading(false);
  setGeographyCityHasSearched(false);

  manualGeographicDiagnosticRequestId.current += 1;
  setManualGeographicDiagnostic(null);
  setManualGeographicDiagnosticLoading(false);
  setManualGeographicDiagnosticError("");
};

const openGuidedCreateFlow = () => {
  leaveExternalPOISelection();
  setSelectedManualPOI(null);
  setCreateFlowOpen(true);
  setCreateFlowError("");
  setCreateSelectedCountry(null);
  setCreateSelectedCity(null);
  setCreateCountrySearch("");
  setCreateCitySearch("");
  resetGeographyCitySearch();
  setCreateSpecificPlaceType("nature");
  setCreateSpecificPlaceName("");
  setCreateSpecificPlaceSearchResults([]);
  setCreateSpecificPlaceHasSearched(false);
};

const selectCreateFlowCountry = (countryPlace: any) => {
  setSelectedManualPOI(null);
  setCreateSelectedCountry(countryPlace);
  setCreateSelectedCity(null);
  setCreateFlowError("");
  setCreateCitySearch("");
  resetGeographyCitySearch();
  setCreateSpecificPlaceType("nature");
  setCreateSpecificPlaceName("");
  setCreateSpecificPlaceSearchResults([]);
  setCreateSpecificPlaceHasSearched(false);

  setTimeout(() => {
    document
      .getElementById("guided-create-city-step")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

const handleSearchCreateFlowCities = async () => {
  resetGeographyCitySearch();

  if (!createSelectedCountry) {
    setCreateFlowError("Please choose a country first.");
    return;
  }

  const query = createCitySearch.trim();
  const countryCode = (
    createSelectedCountry.country_code || ""
  ).trim().toUpperCase();

  if (query.length < 2) {
    setGeographyCitySearchError(
      "Type at least 2 characters to search."
    );
    return;
  }

  if (!countryCode) {
    setGeographyCitySearchError(
      "Could not identify the country code for this place."
    );
    return;
  }

  const requestId = geographyCitySearchRequestId.current;

  setGeographyCitySearchLoading(true);
  setCreateFlowError("");

  try {
    const params = new URLSearchParams({
      q: query,
      country_code: countryCode,
    });

    const res = await fetch(
      `${API_URL}/api/geography/cities/search/?${params.toString()}`
    );

    const data = await res.json();

    if (requestId !== geographyCitySearchRequestId.current) {
      return;
    }

    if (!res.ok) {
      setGeographyCitySearchError(
        data.detail || "Could not search for cities or localities."
      );
      return;
    }

    setGeographyCityResults(
      Array.isArray(data.results) ? data.results : []
    );
    setGeographyCityHasSearched(true);
  } catch (error) {
    if (requestId !== geographyCitySearchRequestId.current) {
      return;
    }

    console.error("Guided geographic city search failed:", error);
    setGeographyCitySearchError(
      "Could not search for cities or localities."
    );
  } finally {
    if (requestId === geographyCitySearchRequestId.current) {
      setGeographyCitySearchLoading(false);
    }
  }
};

const handleManualGeographicDiagnostic = async () => {
  manualGeographicDiagnosticRequestId.current += 1;
  const requestId = manualGeographicDiagnosticRequestId.current;

  setManualGeographicDiagnostic(null);
  setManualGeographicDiagnosticError("");

  const query = createCitySearch.trim();
  const countryCode = String(
    createSelectedCountry?.country_code || ""
  ).trim().toUpperCase();

  if (query.length < 2 || !/^[A-Z]{2}$/.test(countryCode)) {
    setManualGeographicDiagnosticError(
      "Enter a locality name and select a valid country first."
    );
    return;
  }

  setManualGeographicDiagnosticLoading(true);

  try {
    const params = new URLSearchParams({
      q: query,
      country_code: countryCode,
    });

    const response = await fetch(
      `${API_URL}/api/geography/places/manual-diagnostic/?${params.toString()}`
    );

    const data = await response.json();

    if (requestId !== manualGeographicDiagnosticRequestId.current) {
      return;
    }

    if (!response.ok) {
      setManualGeographicDiagnosticError(
        data.detail || "Could not complete the geographic diagnostic."
      );
      return;
    }

    setManualGeographicDiagnostic(data);
  } catch (error) {
    if (requestId !== manualGeographicDiagnosticRequestId.current) {
      return;
    }

    console.error("Manual geographic diagnostic failed:", error);
    setManualGeographicDiagnosticError(
      "Could not complete the geographic diagnostic."
    );
  } finally {
    if (requestId === manualGeographicDiagnosticRequestId.current) {
      setManualGeographicDiagnosticLoading(false);
    }
  }
};

const selectCreateFlowCity = (cityPlace: any) => {
  manualGeographicDiagnosticRequestId.current += 1;
  setManualGeographicDiagnostic(null);
  setManualGeographicDiagnosticLoading(false);
  setManualGeographicDiagnosticError("");

  setSelectedManualPOI(null);
  setCreateSelectedCity(cityPlace);
  setCreateFlowError("");
  setCreateSpecificPlaceType("nature");
  setCreateSpecificPlaceName("");
  setCreateSpecificPlaceSearchResults([]);
  setCreateSpecificPlaceHasSearched(false);

  setTimeout(() => {
    document
      .getElementById("guided-create-specific-step")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

const selectGeographyCityForFlow = (
  cityResult: GeographyPlaceResult
) => {
  if (!createSelectedCountry) {
    setCreateFlowError("Please choose a country first.");
    return;
  }

  const countryCode = String(
    createSelectedCountry.country_code || ""
  ).trim().toUpperCase();

  if (!countryCode || cityResult.country_code !== countryCode) {
    setCreateFlowError(
      "The selected geographic place does not match the chosen country."
    );
    return;
  }

  const existingPlaceId = cityResult.existing_place_id;

  if (existingPlaceId != null) {
    const existingCity = places.find(
      (place) => place.id === existingPlaceId
    );

    if (existingCity) {
      setCreateCitySearch(cityResult.canonical_name);
      selectCreateFlowCity(existingCity);
      return;
    }
  }

  const externalSource = String(
    cityResult.external_source || ""
  ).trim();

  const externalId = String(
    cityResult.external_id || ""
  ).trim();

  if (
    !["geonames", "google_places"].includes(externalSource) ||
    !externalId
  ) {
    setCreateFlowError(
      "This geographic place does not have a valid external reference."
    );
    return;
  }

  setCreateCitySearch(cityResult.canonical_name);

  selectCreateFlowCity({
    ...cityResult,
    name: cityResult.canonical_name,
    external_source: externalSource,
    external_id: externalId,
    existing_place_id: existingPlaceId,
  });
};

const handleSearchCreateFlowSpecificPlaces = async () => {
  if (!createSelectedCity) {
    setCreateFlowError("Please choose a geographic place first.");
    return;
  }

  const query = createSpecificPlaceName.trim();

  if (query.length < 2) {
    setCreateSpecificPlaceSearchResults([]);
    setCreateSpecificPlaceHasSearched(false);
    setCreateFlowError(
      "Type at least 2 characters to search for a specific place."
    );
    return;
  }

  setCreateSpecificPlaceSearchLoading(true);
  setCreateSpecificPlaceHasSearched(true);
  setCreateSpecificPlaceSearchResults([]);
  setCreateFlowError("");

  try {
    const params = new URLSearchParams({
      q: query,
      place_type: createSpecificPlaceType,
    });

    if (createSelectedCity.id != null) {
      params.set(
        "city_place_id",
        String(createSelectedCity.id)
      );
    } else {
      const externalSource = String(
        createSelectedCity.external_source || ""
      ).trim();

      const externalId = String(
        createSelectedCity.external_id || ""
      ).trim();

      if (
        !["geonames", "google_places"].includes(externalSource) ||
        !externalId
      ) {
        setCreateFlowError(
          "This geographic place does not have a valid reference."
        );
        return;
      }

      params.set("external_source", externalSource);
      params.set("external_id", externalId);
    }

    const res = await fetch(
      `${API_URL}/api/geography/pois/search/?${params.toString()}`,
      {
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const errorDetail = String(data.detail || "");

      if (
        res.status === 400 &&
        errorDetail ===
          "This geographic place does not have geographic coordinates."
      ) {
        setCreateSpecificPlaceSearchResults([]);
        setCreateFlowError(
          "Nearby place discovery is not available for this geographic place yet."
        );
        return;
      }

      setCreateFlowError(
        errorDetail || "Could not search for specific places."
      );
      return;
    }

    setCreateSpecificPlaceSearchResults(
      Array.isArray(data.results) ? data.results : []
    );
  } catch (error) {
    console.error(
      "Guided specific place search failed:",
      error
    );
    setCreateFlowError(
      "Something went wrong while searching for specific places."
    );
  } finally {
    setCreateSpecificPlaceSearchLoading(false);
  }
};

const handleSelectCreateFlowSpecificPlace = (
  specificPlaceResult: any
) => {
  if (!createSelectedCity) {
    setCreateFlowError("Please choose a geographic place first.");
    return;
  }

  setCreateFlowError("");

  if (specificPlaceResult.existing_place_id) {
    router.push(`/places/${specificPlaceResult.existing_place_id}`);
    return;
  }

  const externalSource = String(
    specificPlaceResult.external_source || ""
  ).trim();

  const externalId = String(
    specificPlaceResult.external_id || ""
  ).trim();

  if (externalSource !== "foursquare" || !externalId) {
    setCreateFlowError(
      "Could not identify this external place."
    );
    return;
  }

  const params = new URLSearchParams({
    source: externalSource,
    id: externalId,
    poi_type: createSpecificPlaceType,
  });

  const cityPlaceId = Number(createSelectedCity.id);

  if (
    createSelectedCity.place_type === "city" &&
    Number.isSafeInteger(cityPlaceId) &&
    cityPlaceId > 0
  ) {
    params.set("city_place_id", String(cityPlaceId));
  }

  router.push(`/explore/poi?${params.toString()}`);
};

const selectCreateFlowCountryFromCatalog = (
  country: CountryCatalogItem
) => {
  setCreateFlowError("");

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

  const selectedCountry = existingCountryPlace || {
    name: country.canonical_name,
    canonical_name: country.canonical_name,
    country_code: country.code.toUpperCase(),
    place_type: "country",
  };

  setCreateCountrySearch(country.canonical_name);
  selectCreateFlowCountry(selectedCountry);
};

const createSpecificPlaceForFlow = () => {
  const specificPlaceName = formatPlaceNameForCreation(createSpecificPlaceName);

  if (!createSelectedCountry || !createSelectedCity) {
    setCreateFlowError("Please choose a country and geographic place first.");
    return;
  }

  if (!specificPlaceName) {
    setCreateFlowError("Please type the specific place name first.");
    return;
  }

  const cityPlaceId = Number(createSelectedCity.id);

  if (
    !Number.isSafeInteger(cityPlaceId) ||
    cityPlaceId <= 0 ||
    createSelectedCity.place_type !== "city"
  ) {
    setCreateFlowError(
      "Manual place sharing currently requires a geographic place already registered as a city on Trust Travel. External geographic references are not supported for manual place sharing yet."
    );
    return;
  }

  setSelectedExternalPOI(null);
  setExternalPOISelectionError("");
  setSelectedManualPOI({
    name: specificPlaceName,
    place_type: createSpecificPlaceType,
    city_place_id: cityPlaceId,
  });
  setSelectedPlace(null);
  setSelectedMainGeographyResult(null);
  setSelectedCountryPlace(null);
  setExperienceShared(false);
  setSharedExperience(null);
  setEditingExperience(false);
  setExperienceFormError("");
  setCreateFlowError("");
  setCreateFlowOpen(false);
  resetGeographyCitySearch();
  setShowShareForm(true);

  if (!isExperienceMode) {
    router.push("/destinations?mode=experience");
  }

  setTimeout(() => {
    document
      .getElementById("share-experience-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

    // =========================
    // Select country as search context
    // =========================
    const handleSelectCountry = (place: any) => {
      leaveExternalPOISelection();
      setSelectedManualPOI(null);
      // In normal exploration mode, opening a country should go directly
      // to the country experiences page.
      if (!isExperienceMode && !isUpdateMode) {
          router.push(`/places/${place.id}`);
          return;
      }

      // In creation modes, keep the country as context so the user can decide
      // whether to share/post about the country or choose a place inside it.
      setSelectedCountryPlace(place);
      setSelectedPlace(null);
      if (isUpdateMode) {
        clearExternalGeographicDetail();
        setSelectedMainGeographyResult(null);
      }
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
      setSelectedManualPOI(null);
      if (!selectedCountryPlace) return;

      setSelectedPlace(selectedCountryPlace);
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
    // Open geographic place selection inside selected country
    // =========================
    const openCreateCityInSelectedCountry = () => {
      if (!selectedCountryPlace) return;

      setSelectedManualPOI(null);
      setCreateFlowOpen(true);
      setCreateFlowError("");
      setCreateSelectedCountry(selectedCountryPlace);
      setCreateSelectedCity(null);
      setCreateCountrySearch(selectedCountryPlace.name || "");
      setCreateCitySearch("");
      resetGeographyCitySearch();
      setCreateSpecificPlaceType("nature");
      setCreateSpecificPlaceName("");
      setCreateSpecificPlaceSearchResults([]);
      setCreateSpecificPlaceHasSearched(false);

      setSelectedPlace(null);
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

  // Invalidate pending external detail requests and clear their state.
  const clearExternalGeographicDetail = () => {
    externalGeographicDetailRequestId.current += 1;
    setExternalGeographicDetail(null);
    setExternalGeographicDetailError(null);
    setExternalGeographicDetailLoading(false);
  };

  // Load external geographic evidence without materializing a Place.
  const loadExternalGeographicDetail = async (
    externalSource: string,
    externalId: string
  ) => {
    const requestId = ++externalGeographicDetailRequestId.current;

    setExternalGeographicDetail(null);
    setExternalGeographicDetailError(null);
    setExternalGeographicDetailLoading(true);

    try {
      const params = new URLSearchParams({
        external_source: externalSource,
        external_id: externalId,
      });

      const response = await fetch(
        `${API_URL}/api/geography/places/external-detail/?${params.toString()}`
      );

      if (requestId !== externalGeographicDetailRequestId.current) {
        return;
      }

      if (!response.ok) {
        setExternalGeographicDetailError(
          response.status === 404 ? "not_found" : "unavailable"
        );
        return;
      }

      const data: ExternalGeographicDetail = await response.json();

      if (
        !data ||
        data.external_source !== externalSource ||
        data.external_id !== externalId ||
        !data.canonical_name ||
        !data.geographic_type ||
        !Array.isArray(data.admin_context) ||
        !data.admin_context.every(
          (item) => item && typeof item.name === "string"
        )
      ) {
        setExternalGeographicDetailError("unavailable");
        return;
      }

      if (requestId === externalGeographicDetailRequestId.current) {
        setExternalGeographicDetail(data);
      }
    } catch (error) {
      if (requestId === externalGeographicDetailRequestId.current) {
        console.error("External geographic detail lookup failed:", error);
        setExternalGeographicDetailError("unavailable");
      }
    } finally {
      if (requestId === externalGeographicDetailRequestId.current) {
        setExternalGeographicDetailLoading(false);
      }
    }
  };

  // =========================
  // Handle a geographic place selected from main search
  // =========================
  const handleSelectMainGeographyResult = async (
    result: GeographyPlaceResult
  ) => {
    const canSelect = isExperienceMode || isUpdateMode
      ? result.can_open
      : result.can_explore;

    if (!canSelect) {
      return;
    }

    leaveExternalPOISelection();
    setSelectedManualPOI(null);

    // Invalidate details from any previous external selection.
    clearExternalGeographicDetail();

    if (result.existing_place_id) {
      handleSelectExistingPlace({
        id: result.existing_place_id,
      });
      return;
    }

    if (!result.external_source || !result.external_id) {
      setMainGeographySearchError(
        "This geographic place cannot be opened right now."
      );
      return;
    }

    if (!isExperienceMode && !isUpdateMode) {
      const params = new URLSearchParams({
        source: result.external_source,
        id: result.external_id,
      });

      router.push(`/explore/geographic?${params.toString()}`);
      return;
    }

    if (isExperienceMode) {
      setSelectedMainGeographyResult(result);
      setSelectedPlace(null);
      setShowShareForm(true);
      setExperienceShared(false);
      setSharedExperience(null);
      setEditingExperience(false);
      setMainGeographySearchError("");
      return;
    }

    // Keep the external reference transient until the Update is published.
    setSelectedMainGeographyResult(result);
    setSelectedPlace(null);
    setShowShareForm(true);
    setMainGeographySearchError("");
  };

  // =========================
  // Select an existing place
  // =========================
  const handleSelectExistingPlace = (place: any) => {
  if (isUpdateMode) {
    router.push(`/places/${place.id}?share=update`);
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
    invalidatePendingExperienceSubmission();
    leaveExternalPOISelection();
    setSelectedCountryPlace(null);
    setSelectedPlace(null);
    setSelectedManualPOI(null);
    setSelectedExternalPOI(null);
    setSearchTerm("");
    setMainGeographyResults([]);
    setMainGeographySearchError("");
    clearExternalGeographicDetail();
    setSelectedMainGeographyResult(null);
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
    invalidatePendingExperienceSubmission();
    leaveExternalPOISelection();
    setSelectedCountryPlace(null);
    setSelectedPlace(null);
    setSelectedManualPOI(null);
    setSelectedExternalPOI(null);
    clearExternalGeographicDetail();
    setSelectedMainGeographyResult(null);
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

  const submissionGeneration = experienceSubmissionGenerationRef.current;

  setTimeout(() => {
    if (submissionGeneration !== experienceSubmissionGenerationRef.current) {
      return;
    }

    const form = document.getElementById("experience-share-form") as HTMLFormElement | null;
    form?.requestSubmit();
  }, 0);
};


  // =========================
  // Submit experience
  // =========================
  const handleSubmitExperience = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedExperienceTarget) return;

    if (
      !selectedPlace &&
      !selectedExternalPOI &&
      !selectedManualPOI &&
      (!selectedMainGeographyResult?.external_source ||
        !selectedMainGeographyResult.external_id)
    ) {
      setExperienceFormError(
        "This geographic place cannot be shared right now."
      );
      return;
    }

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

      if (selectedPlace) {
        formData.append("place", String(selectedPlace.id));
      } else if (selectedExternalPOI) {
        formData.append("external_source", "foursquare");
        formData.append("external_id", selectedExternalPOI.external_id);
        formData.append("external_poi_type", selectedExternalPOI.place_type);
        if (selectedExternalPOI.city_place_id !== undefined) {
          formData.append(
            "external_city_place_id",
            String(selectedExternalPOI.city_place_id)
          );
        } else {
          formData.append(
            "external_city_source",
            selectedExternalPOI.city_source
          );
          formData.append(
            "external_city_id",
            selectedExternalPOI.city_id
          );
        }
      } else if (selectedManualPOI) {
        formData.append("manual_poi_name", selectedManualPOI.name);
        formData.append("manual_poi_type", selectedManualPOI.place_type);
        formData.append(
          "manual_city_place_id",
          String(selectedManualPOI.city_place_id)
        );
      } else if (
        selectedMainGeographyResult?.external_source &&
        selectedMainGeographyResult.external_id
      ) {
        formData.append(
          "external_source",
          selectedMainGeographyResult.external_source
        );
        formData.append(
          "external_id",
          selectedMainGeographyResult.external_id
        );
      }

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

        if (
          res.status === 409 &&
          data.code === "poi_resolution_required"
        ) {
          setExperienceFormError(
            "This place may already exist or needs further geographic verification. " +
            "Your experience has not been published. Please review the place selection " +
            "before trying again."
          );
          return;
        }

        if (
          res.status === 409 &&
          data.code === "geographic_resolution_required"
        ) {
          setExperienceFormError(
            "This geographic place needs confirmation before your experience " +
            "can be published. Your experience has not been published. " +
            "Please review the place selection before trying again."
          );
          return;
        }

        setExperienceFormError(
          typeof data.detail === "string"
            ? data.detail
            : "Could not share this experience."
        );
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

      {externalPOISelectionError && (
        <div
          role="alert"
          style={{
            padding: "16px",
            marginBottom: "20px",
            border: "1px solid #f0c5c5",
            borderRadius: "10px",
            background: "#fff5f5",
            color: "#8b2424",
            lineHeight: 1.5,
          }}
        >
          {externalPOISelectionError}
        </div>
      )}

      <div style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          Home
        </Link>{" "}
        / <span>Explore</span>
      </div>

      {isManualExperienceSelection && selectedManualPOI ? (
        <section style={{ ...helperCard, marginBottom: "24px" }}>
          <h1 style={{ marginTop: 0 }}>Share your experience</h1>

          <div style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
            Selected place
          </div>

          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            {selectedManualPOI.name}
          </div>

          <p style={{ color: "#666", margin: "8px 0 12px" }}>
            {getPlaceTypeLabel(selectedManualPOI.place_type)}
            {selectedManualPOICity ? ` · ${selectedManualPOICity.name}` : ""}
          </p>

          <p style={{ color: "#666", lineHeight: 1.5 }}>
            This place will only be registered when your experience is
            successfully published.
          </p>

          <button
            type="button"
            onClick={handleChangePlace}
            style={secondaryButton}
          >
            Change place
          </button>
        </section>
      ) : (
        <>
      <h1>
          {isExperienceMode
            ? "Find a place to share your experience"
            : isUpdateMode
            ? "Find a place to share event, alert or info"
            : "Find a destination or place"}
        </h1>

        <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "24px" }}>
          Search for the exact place first. If it does not exist yet, Trust Travel will
          guide you through the correct hierarchy: country → geographic place → specific
          place. This helps avoid duplicates and keeps broader geographic experiences separate
          from reviews about restaurants, hotels, attractions and nature spots.
        </p>

        <div style={{ marginBottom: "22px" }}>

        </div>

        <input
          value={searchTerm}
          onChange={(e) => {
              const value = e.target.value;

              leaveExternalPOISelection();

              setSearchTerm(value);
              setMainGeographyCompletedQuery("");
              setSelectedManualPOI(null);
              setShowShareForm(false);
              setMainGeographyResults([]);
              setMainGeographySearchError("");
              if (isUpdateMode) {
                clearExternalGeographicDetail();
                setSelectedMainGeographyResult(null);
                setShowShareForm(false);
              }
              setCreateFlowOpen(false);
              setCreateFlowError("");
              setCreateSelectedCountry(null);
              resetGeographyCitySearch();

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
        placeholder="Search country, city, island, river, beach, hotel, restaurant or attraction..."
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "12px 14px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          fontSize: "14px",
          marginBottom: "10px",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => {
            void handleMainGeographySearch();
          }}
          disabled={
            mainGeographySearchLoading ||
            searchTerm.trim().length < 2
          }
          style={{
            ...primaryButton,
            opacity:
              mainGeographySearchLoading ||
              searchTerm.trim().length < 2
                ? 0.5
                : 1,
            cursor:
              mainGeographySearchLoading ||
              searchTerm.trim().length < 2
                ? "not-allowed"
                : "pointer",
          }}
        >
          {mainGeographySearchLoading ? "Searching..." : "Search"}
        </button>

        {mainGeographySearchError && (
          <span style={{ color: "#a33", fontSize: "13px" }}>
            {mainGeographySearchError}
          </span>
        )}
      </div>

        </>
      )}

      {!mainGeographySearchLoading &&
        mainGeographyResults.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "10px",
              maxWidth: "620px",
              marginBottom: "24px",
            }}
          >
            {mainGeographyMeaningfulAmbiguity &&
            mainGeographyCountryRefinementOptions.length > 0 &&
            mainGeographyCountryRefinement === null ? (
              <>
                <div
                  style={{
                    color: "#666",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Which country do you mean?
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  {mainGeographyCountryRefinementOptions.map((option) => {
                    const countryCode =
                      option.country_code.toUpperCase();

                    const countryName =
                      countryCatalog.find(
                        (item) =>
                          item.code.toUpperCase() === countryCode
                      )?.canonical_name || option.country_code;

                    return (
                      <button
                        key={option.country_code}
                        type="button"
                        onClick={() => {
                          setMainGeographyCountryRefinement(countryCode);
                        }}
                        style={{
                          padding: "12px 14px",
                          border: "1px solid #ddd",
                          borderRadius: "12px",
                          background: "white",
                          color: "#111",
                          cursor: "pointer",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        {countryName} →
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {mainGeographyMeaningfulAmbiguity &&
                  mainGeographyCountryRefinement && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          color: "#666",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        Results in{" "}
                        {countryCatalog.find(
                          (item) =>
                            item.code.toUpperCase() ===
                            mainGeographyCountryRefinement
                        )?.canonical_name ||
                          mainGeographyCountryRefinement}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMainGeographyCountryRefinement(null);
                        }}
                        style={{
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          color: "#555",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        ← Change country
                      </button>
                    </div>
                  )}

                <div
                  style={{
                    color: "#666",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Geographic matches
                </div>

                {!selectedMainGeographyResult &&
                  visibleMainGeographyResults.map((result) => {
                  const country =
                    countryCatalog.find(
                      (item) =>
                        item.code.toUpperCase() ===
                        result.country_code.toUpperCase()
                    )?.canonical_name || result.country_code;

                  const resultKey = result.existing_place_id
                    ? `place-${result.existing_place_id}`
                    : `${result.external_source}-${result.external_id}`;

                  const canSelect = isExperienceMode || isUpdateMode
                    ? result.can_open
                    : result.can_explore;

                  if (!canSelect) {
                    return (
                      <div
                        key={resultKey}
                        style={{
                          padding: "14px",
                          border: "1px solid #ddd",
                          borderRadius: "12px",
                          background: "white",
                          color: "#111",
                        }}
                      >
                        <strong>{result.canonical_name}</strong>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#666",
                            fontSize: "13px",
                          }}
                        >
                          {getGeographicTypeLabel(result.geographic_type)}
                          {getGeographicAdminLabel(result)
                            ? ` · ${getGeographicAdminLabel(result)}`
                            : ""}
                          {country ? ` · ${country}` : ""}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={resultKey}
                      type="button"
                      onClick={() => {
                        void handleSelectMainGeographyResult(result);
                      }}
                      disabled={mainGeographySearchLoading}
                      style={{
                        padding: "14px",
                        border: "1px solid #ddd",
                        borderRadius: "12px",
                        background: "white",
                        color: "#111",
                        textAlign: "left",
                        cursor: mainGeographySearchLoading
                          ? "not-allowed"
                          : "pointer",
                        opacity: mainGeographySearchLoading ? 0.6 : 1,
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
                        <strong>{result.canonical_name}</strong>

                        <span
                          style={{
                            fontSize: "13px",
                            color: "#555",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open →
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#666",
                          fontSize: "13px",
                        }}
                      >
                        {getGeographicTypeLabel(result.geographic_type)}
                        {getGeographicAdminLabel(result)
                          ? ` · ${getGeographicAdminLabel(result)}`
                          : ""}
                        {country ? ` · ${country}` : ""}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {selectedMainGeographyResult &&
          !isExperienceMode &&
          !isUpdateMode && (
            <section
              style={{
                marginTop: "22px",
                padding: "22px",
                border: "1px solid #eee",
                borderRadius: "16px",
                background: "white",
                maxWidth: "620px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {selectedMainGeographyResult.canonical_name}
              </h2>

              {externalGeographicDetailLoading && (
                <div role="status" style={helperNote}>
                  Loading geographic details...
                </div>
              )}

              {externalGeographicDetailError === "not_found" && (
                <div role="alert" style={helperNote}>
                  This external geographic reference could not be found.
                  You can return to the search and select another result.
                </div>
              )}

              {externalGeographicDetailError === "unavailable" && (
                <div role="alert" style={helperNote}>
                  <p style={{ margin: "0 0 12px" }}>
                    Geographic details are temporarily unavailable.
                    This does not mean the place does not exist.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        selectedMainGeographyResult.external_source &&
                        selectedMainGeographyResult.external_id
                      ) {
                        void loadExternalGeographicDetail(
                          selectedMainGeographyResult.external_source,
                          selectedMainGeographyResult.external_id
                        );
                      }
                    }}
                    style={secondaryButton}
                  >
                    Retry geographic details
                  </button>
                </div>
              )}

              <p style={{ color: "#666", lineHeight: 1.5 }}>
                {getGeographicTypeLabel(
                  selectedMainGeographyResult.geographic_type
                )}
                {selectedMainGeographyResult.admin_name
                  ? ` · ${selectedMainGeographyResult.admin_name}`
                  : ""}
                {selectedMainGeographyResult.country_code
                  ? ` · ${selectedMainGeographyResult.country_code}`
                  : ""}
              </p>

              {externalGeographicDetail && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    background: "#f9fafb",
                  }}
                >
                  <p style={{ margin: "0 0 12px", fontWeight: 600 }}>
                    Geographic reference information
                  </p>

                  {externalGeographicDetail.formatted_address && (
                    <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                      <strong>Address:</strong>{" "}
                      {externalGeographicDetail.formatted_address}
                    </p>
                  )}

                  {externalGeographicDetail.admin_context.length > 0 && (
                    <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                      <strong>Administrative context:</strong>{" "}
                      {externalGeographicDetail.admin_context
                        .map((item) => item.name)
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {externalGeographicDetail.country_code && (
                    <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                      <strong>Country:</strong>{" "}
                      {externalGeographicDetail.country_code}
                    </p>
                  )}

                  {externalGeographicDetail.latitude != null &&
                    externalGeographicDetail.longitude != null && (
                      <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                        <strong>Coordinates:</strong>{" "}
                        {externalGeographicDetail.latitude},{" "}
                        {externalGeographicDetail.longitude}
                      </p>
                    )}

                  <p
                    style={{
                      margin: 0,
                      color: "#666",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    Geographic information supplied by an external reference
                    provider. It is not a Trust Travel community review.
                  </p>
                </div>
              )}

              <div style={helperNote}>
                This selection is not currently linked to a Trust Travel place.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowShareForm(true);
                    router.push("/destinations?mode=experience");
                  }}
                  style={primaryButton}
                >
                  Share an experience
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearExternalGeographicDetail();
                    setSelectedMainGeographyResult(null);
                  }}
                  style={secondaryButton}
                >
                  Change selection
                </button>
              </div>
            </section>
          )}

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
      <p
        style={{
          color: "#777",
          fontSize: "13px",
          lineHeight: 1.5,
          maxWidth: "520px",
          margin: "-10px 0 0 0",
        }}
      >
        Search first for the exact place. If you cannot find it, Trust Travel
        will help you add it using the correct country and geographic context.
      </p>
    )

      : (filteredPlaces.length > 0 ||
          mainSearchCountryCatalogMatches.length > 0) &&
        !selectedCountryPlace &&
        !selectedPlace ? (
      <section style={{ display: "grid", gap: "18px", maxWidth: "620px" }}>

        <p style={{ color: "#666", margin: 0, lineHeight: 1.5 }}>
          We found existing places related to your search. Check the type,
          geographic type and country before selecting the correct result.
        </p>

        {mainSearchCountryCatalogMatches.length > 0 && (
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>
              Countries
            </div>

            {mainSearchCountryCatalogMatches.map((country) => (
              <div
                key={`catalog-country-${country.code}`}
                style={{
                  padding: "18px",
                  border: "1px solid #d7f0df",
                  borderRadius: "14px",
                  background: "white",
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
                  <strong>{country.canonical_name}</strong>

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
                    Country
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  Country · {country.code}
                </div>
              </div>
            ))}
          </div>
        )}

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
              Geographic places
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
                    {getPlaceDisplayTypeLabel(place)}
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
                    ? "Post alert, event or info about this geographic place →"
                    : isExperienceMode
                    ? "Share experience about this geographic place →"
                    : "Choose actions for this geographic place →"}
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

        <div
          style={{
            marginTop: "8px",
            paddingTop: "16px",
            borderTop: "1px solid #eee",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "6px",
            }}
          >
            Not the place you were looking for?
          </div>

          <p
            style={{
              color: "#666",
              margin: "0",
              lineHeight: 1.5,
              fontSize: "14px",
            }}
          >
            Check the results above. If you found the right country, select
            it to explore cities and localities within it. Otherwise, try
            another spelling, a local name or translation, or a more specific
            search.
          </p>
        </div>
      </section>
    ) : null}

    {canContinueAfterMainSearch && (
      <section style={helperCard}>
        {createFlowOpen && (
          <>
            <strong>Find the place by country and city</strong>
            <p
              style={{
                margin: "10px 0 16px 0",
                color: "#666",
                lineHeight: 1.5,
              }}
            >
              Choose the country, then the city or region, and check for
              the specific place before continuing.
            </p>
          </>
        )}

        {createFlowOpen && similarPlaces.length > 0 && (
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

        {isUpdateMode ? (
          <p style={helperNote}>
            Try another search or select an existing place above.
            Geographic results can be used directly when publishing an update.
          </p>
        ) : !createFlowOpen ? (
          <button
            type="button"
            onClick={openGuidedCreateFlow}
            style={primaryButton}
          >
            None of these places matches
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
                  Choose the geographic place inside {createSelectedCountry.name}
                </h3>

                <p style={guidedCreateText}>
                  Search for the city, region, island or other geographic place where this
                  specific place belongs, then choose the matching geographic result. Do not
                  use this step for restaurants, hotels, alerts or event titles.
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
                      resetGeographyCitySearch();
                    }}
                    placeholder="City, region, island or locality, e.g. Recife, Sicily, Nias"
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
                              {getGeographicTypeLabel(
                                  cityResult.geographic_type
                                )}
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
                  geographyCityHasSearched &&
                  geographyCityResults.length > 0 &&
                  !geographyCitySearchError && (
                    <p style={guidedCreateText}>
                      None of these places matches your location? Try another
                      spelling, a local name or translation, or a nearby
                      municipality or region. Check that the selected country
                      is correct before trying again.
                    </p>
                  )}

                {!geographyCitySearchLoading &&
                  createCitySearch.trim().length >= 2 &&
                  !geographyCitySearchError &&
                  geographyCityResults.length === 0 && (
                    geographyCityHasSearched ? (
                      <div style={guidedCreateText}>
                        <strong>No matching geographic places were returned.</strong>
                        <p>
                          Try another spelling, a local name or translation.
                          Check the selected country, or search for a nearby
                          municipality or region.
                        </p>
                        <p>
                          This does not necessarily mean the place does not exist.
                          Try refining your search before creating a new place.
                        </p>
                      </div>
                    ) : (
                      <p style={guidedCreateText}>
                        Click Search to look for matching geographic places.
                      </p>
                    )
                  )}

                {!geographyCitySearchLoading &&
                  geographyCityHasSearched &&
                  !geographyCitySearchError &&
                  createCitySearch.trim().length >= 2 &&
                  !createSelectedCity && (
                    <div style={{ marginTop: "12px", marginBottom: "16px" }}>
                      <p style={guidedCreateText}>
                        Still cannot find the right geographic place?
                        Check additional geographic references before considering
                        a new locality.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void handleManualGeographicDiagnostic();
                        }}
                        disabled={manualGeographicDiagnosticLoading}
                        style={{
                          ...secondaryButton,
                          opacity: manualGeographicDiagnosticLoading ? 0.5 : 1,
                          cursor: manualGeographicDiagnosticLoading
                            ? "not-allowed"
                            : "pointer",
                        }}
                      >
                        {manualGeographicDiagnosticLoading
                          ? "Checking references..."
                          : "Check geographic references"}
                      </button>
                      {manualGeographicDiagnosticError && (
                        <div style={createFlowErrorBox}>
                          {manualGeographicDiagnosticError}
                        </div>
                      )}

                      {manualGeographicDiagnostic && (
                        <div
                          style={{
                            ...guidedCreateText,
                            marginTop: "14px",
                            padding: "14px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                          }}
                        >
                          <strong>Geographic reference diagnostic</strong>

                          <p>
                            This check provides additional evidence. It does not
                            confirm that a locality is missing or authorize
                            creating a new geographic place.
                          </p>

                          <p>
                            Sources checked:
                            {Object.entries(
                              manualGeographicDiagnostic.providers
                            ).map(([provider, information]) => (
                              <span key={provider} style={{ display: "block" }}>
                                {provider === "registry"
                                  ? "Trust Travel registry"
                                  : provider === "geonames"
                                    ? "GeoNames"
                                    : provider === "google_places"
                                      ? "Google Places"
                                      : provider}
                                : {information.state}
                              </span>
                            ))}
                          </p>

                          {!manualGeographicDiagnostic.complete && (
                            <p>
                              Some geographic sources could not be checked.
                              Their failure must not be interpreted as no results.
                              Please try again later.
                            </p>
                          )}

                          {manualGeographicDiagnostic.results.length > 0 ? (
                            <div>
                              <strong>
                                Additional references in the selected country:
                              </strong>
                              <ul>
                                {manualGeographicDiagnostic.results.map(
                                  (result, index) => (
                                    <li
                                      key={`${result.external_source}-${result.external_id}-${index}`}
                                    >
                                      {result.canonical_name}
                                      {result.admin_name
                                        ? ` · ${result.admin_name}`
                                        : ""}
                                    </li>
                                  )
                                )}
                              </ul>
                              <p>
                                If one of these references matches your
                                locality, refine the main search and select
                                the appropriate geographic result.
                              </p>
                            </div>
                          ) : (
                            <p>
                              No additional references were returned for the
                              selected country. This does not establish that
                              the locality does not exist.
                            </p>
                          )}

                          {manualGeographicDiagnostic.has_country_mismatch && (
                            <p>
                              References were also found in other countries:
                              {" "}
                              {manualGeographicDiagnostic.other_country_codes.join(", ")}.
                              Check that you selected the correct country.
                            </p>
                          )}

                          <p>
                            Try alternative spellings, local names,
                            translations, or a nearby municipality or region.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {createSelectedCountry && createSelectedCity && (
                  <div id="guided-create-specific-step">
                    {isExperienceMode && (
                      <div
                        style={{
                          marginBottom: "20px",
                          padding: "16px",
                          border: "1px solid #d7f0df",
                          borderRadius: "14px",
                          background: "#f7fcf8",
                        }}
                      >
                        <strong>
                          Did your experience happen around {createSelectedCity.name}?
                        </strong>

                        <p style={{ ...guidedCreateText, marginTop: "8px" }}>
                          You can share your experience at this location now,
                          or continue below if you want to identify a more specific place.
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedManualPOI(null);
                            if (createSelectedCity.external_source &&
                                createSelectedCity.external_id &&
                                !createSelectedCity.id) {
                              setSelectedMainGeographyResult(createSelectedCity);
                              setSelectedPlace(null);
                            } else if (createSelectedCity.id) {
                              setSelectedMainGeographyResult(null);
                              setSelectedPlace(createSelectedCity);
                            } else {
                              setCreateFlowError(
                                "This geographic place cannot be shared right now."
                              );
                              return;
                            }

                            setExperienceShared(false);
                            setSharedExperience(null);
                            setEditingExperience(false);
                            setExperienceFormError("");
                            setShowShareForm(true);

                            setTimeout(() => {
                              document
                                .getElementById("share-experience-form")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }, 0);
                          }}
                          style={primaryButton}
                        >
                          Share experience here
                        </button>

                        <p
                          style={{
                            margin: "10px 0 0 0",
                            color: "#777",
                            fontSize: "12px",
                            lineHeight: 1.5,
                          }}
                        >
                          A photo can help place your experience more precisely on the map.
                          <br />
                          Your photo&apos;s location is only used with your permission.
                        </p>
                      </div>
                    )}

                    <div style={guidedCreateStepLabel}>Step 3</div>

                    <h3 style={guidedCreateTitle}>
                      Choose the specific place type
                    </h3>

                    <p style={guidedCreateText}>
                      Continue only if you want to identify a more specific place inside{" "}
                      {createSelectedCity.name}. This keeps restaurants, hotels, attractions and
                      nature spots separated from broader geographic experiences.
                    </p>

                    <select
                      value={createSpecificPlaceType}
                      onChange={(event) => {
                        setCreateSpecificPlaceType(
                          event.target.value as
                            | "attraction"
                            | "hotel"
                            | "restaurant"
                            | "nature"
                            | "other"
                        );
                        setCreateSpecificPlaceSearchResults([]);
                        setCreateSpecificPlaceHasSearched(false);
                        setCreateFlowError("");
                      }}
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
                        Find or add the specific place
                      </h3>

                      <p style={guidedCreateText}>
                        Search for the exact place inside {createSelectedCity.name} before creating
                        a new one. This helps avoid duplicate hotels, restaurants, attractions and
                        nature spots.
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          value={createSpecificPlaceName}
                          onChange={(event) => {
                            setCreateSpecificPlaceName(event.target.value);
                            setCreateSpecificPlaceSearchResults([]);
                            setCreateSpecificPlaceHasSearched(false);
                            setCreateFlowError("");
                          }}
                          placeholder="Specific place name, e.g. hotel, restaurant, museum..."
                          style={{
                            ...input,
                            flex: "1 1 280px",
                          }}
                        />

                        <button
                          type="button"
                          onClick={handleSearchCreateFlowSpecificPlaces}
                          disabled={
                            createSpecificPlaceSearchLoading ||
                            createSpecificPlaceName.trim().length < 2
                          }
                          style={{
                            ...primaryButton,
                            width: "fit-content",
                            opacity:
                              createSpecificPlaceSearchLoading ||
                              createSpecificPlaceName.trim().length < 2
                                ? 0.5
                                : 1,
                            cursor:
                              createSpecificPlaceSearchLoading ||
                              createSpecificPlaceName.trim().length < 2
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {createSpecificPlaceSearchLoading
                            ? "Searching..."
                            : "Search"}
                        </button>
                      </div>

                      {createSpecificPlaceHasSearched &&
                        !createSpecificPlaceSearchLoading &&
                        createSpecificPlaceSearchResults.length > 0 && (
                          <div
                            style={{
                              display: "grid",
                              gap: "10px",
                              marginTop: "16px",
                            }}
                          >
                            {createSpecificPlaceSearchResults.map(
                              (specificPlaceResult: any) => (
                                <div
                                  key={
                                    specificPlaceResult.existing_place_id
                                      ? `tt-${specificPlaceResult.existing_place_id}`
                                      : `external-${specificPlaceResult.external_id}`
                                  }
                                  style={{
                                    padding: "12px 14px",
                                    border: "1px solid #ddd",
                                    borderRadius: "12px",
                                    background: "#fff",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "#777",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {specificPlaceResult.existing_place_id
                                      ? "Already in Trust Travel"
                                      : getPlaceTypeLabel(createSpecificPlaceType)}
                                  </div>

                                  <strong>{specificPlaceResult.name}</strong>

                                  {(specificPlaceResult.address ||
                                    specificPlaceResult.locality) && (
                                    <div
                                      style={{
                                        color: "#666",
                                        fontSize: "13px",
                                        marginTop: "4px",
                                      }}
                                    >
                                      {specificPlaceResult.address ||
                                        specificPlaceResult.locality}
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      marginTop: "10px",
                                    }}
                                  >
                                    {specificPlaceResult.existing_place_id ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSelectCreateFlowSpecificPlace(
                                            specificPlaceResult
                                          )
                                        }
                                        style={{
                                          ...secondaryButton,
                                          fontSize: "13px",
                                          padding: "8px 10px",
                                        }}
                                      >
                                        Open this place
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSelectCreateFlowSpecificPlace(
                                            specificPlaceResult
                                          )
                                        }
                                        style={{
                                          ...secondaryButton,
                                          fontSize: "13px",
                                          padding: "8px 10px",
                                        }}
                                      >
                                        Explore this place
                                      </button>
                                    )}
                                  </div>

                                </div>
                              )
                            )}
                          </div>
                        )}

                      {createSpecificPlaceHasSearched &&
                        !createSpecificPlaceSearchLoading &&
                        createSpecificPlaceSearchResults.length === 0 && (
                          <p
                            style={{
                              ...guidedCreateText,
                              marginTop: "14px",
                            }}
                          >
                            No matching specific places were found.
                          </p>
                        )}

                      {createSpecificPlaceHasSearched && (
                        <div
                          style={{
                            marginTop: "18px",
                            paddingTop: "16px",
                            borderTop: "1px solid #d7f0df",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              marginBottom: "6px",
                            }}
                          >
                            Still not listed?
                          </div>

                          <p style={guidedCreateText}>
                            If this is a genuinely different place, you can identify it manually.
                            Trust Travel will add it only when your experience is successfully published.
                          </p>

                          <button
                            type="button"
                            onClick={createSpecificPlaceForFlow}
                            disabled={!createSpecificPlaceName.trim()}
                            style={{
                              ...secondaryButton,
                              width: "fit-content",
                              opacity: !createSpecificPlaceName.trim() ? 0.5 : 1,
                              cursor: !createSpecificPlaceName.trim()
                                ? "not-allowed"
                                : "pointer",
                            }}
                          >
                            {`Share an experience about this ${getPlaceTypeLabel(
                              createSpecificPlaceType
                            )}`}
                          </button>
                        </div>
                      )}
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
                  resetGeographyCitySearch();
                  setCreateSpecificPlaceType("nature");
                  setCreateSpecificPlaceName("");
                  setCreateSpecificPlaceSearchResults([]);
                  setCreateSpecificPlaceHasSearched(false);
              }}
              style={secondaryButton}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    )}

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
            ? "Start with the country, then choose a geographic place inside it. You can also share an experience about the country in general."
            : isUpdateMode
            ? "Start with the country, then choose a geographic place inside it. You can also post an alert, event or useful information about the country in general."
            : "Read country-level experiences, choose a geographic place, or create another place inside this country."}
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
              type="button"
              onClick={() => {
                if (isUpdateMode) {
                  router.push(`/places/${selectedCountryPlace.id}?share=update`);
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

          {!isUpdateMode && (
            <button
              type="button"
              onClick={openCreateCityInSelectedCountry}
              style={secondaryButton}
            >
              Choose another geographic place in {selectedCountryPlace.name}
            </button>
          )}

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
              Places already listed in {selectedCountryPlace.name}
            </div>

            <p style={{ margin: 0, color: "#555", fontSize: "14px", lineHeight: 1.5 }}>
              Keep the country experience general, or open the list below if you want to
              share about a more specific place.
            </p>

            <button
              type="button"
              onClick={() => setShowRelatedPlaces((current) => !current)}
              style={secondaryButton}
            >
              {showRelatedPlaces
                ? "Hide places"
                : `Show places in ${selectedCountryPlace.name} (${placesInsideSelectedCountry.length})`}
            </button>

            {showRelatedPlaces && (
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  value={relatedPlaceSearch}
                  onChange={(e) => setRelatedPlaceSearch(e.target.value)}
                  placeholder={`Search places in ${selectedCountryPlace.name}`}
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
                    Type at least 4 characters to search for a country, geographic place or specific place.
                  </p>
                )}

                {!relatedPlaceSearch.trim() ? (
                  <div style={helperNote}>
                    Start typing a place already listed in {selectedCountryPlace.name}.
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
                    No matching place found inside {selectedCountryPlace.name}. You can search for another geographic place.
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
              onClick={() => router.push(`/places/${selectedPlace.id}?share=update`)}
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

        {selectedExperienceTarget && showShareForm && (
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
              {experienceShared
                ? `Experience shared in ${sharedExperience?.place_name || selectedExperienceTargetName}`
                : `Share your experience about ${selectedExperienceTargetName}`}
            </h2>

            {experienceShared ? (
              <div>
                <p style={{ color: "#555", lineHeight: 1.5 }}>
                  Your experience was shared successfully.
                </p>

                {sharedExperience?.place && (
                  <div style={helperCard}>
                    <div style={{ fontSize: "13px", color: "#666" }}>
                      Your experience was published in
                    </div>

                    <div style={{ fontWeight: 600, marginTop: "6px" }}>
                      {sharedExperience.place_name}
                    </div>

                    {sharedExperience.destination_name && (
                      <div style={{ color: "#666", marginTop: "4px" }}>
                        {sharedExperience.destination_name}
                      </div>
                    )}

                    <div style={{ marginTop: "8px", color: "#267347" }}>
                      ✓ Saved on Trust Travel
                    </div>
                  </div>
                )}

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
                    onClick={() => {
                      if (sharedExperience) {
                        router.push(`/experiences/${sharedExperience.id}`);
                      }
                    }}
                    style={primaryButton}
                  >
                    View your experience
                  </button>

                  {sharedExperience?.place && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/places/${sharedExperience.place}/experiences`
                        )
                      }
                      style={secondaryButton}
                    >
                      View place
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      resetShareFlow();
                      setMainGeographyResults([]);
                      setMainGeographySearchError("");
                      setMainGeographyMeaningfulAmbiguity(false);
                      setMainGeographyCountryRefinementOptions([]);
                      setMainGeographyCountryRefinement(null);
                    }}
                    style={secondaryButton}
                  >
                    Search for another place
                  </button>

                  <button onClick={() => router.push("/")} style={secondaryButton}>
                    Back to feed
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

        {isUpdateMode &&
          showShareForm &&
          !selectedPlace &&
          !selectedCountryPlace &&
          selectedMainGeographyResult?.external_source &&
          selectedMainGeographyResult?.external_id && (
            <section
              id="share-update-form"
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
                Share an update about {selectedMainGeographyResult.canonical_name}
              </h2>

              <UpdateForm
                externalSource={selectedMainGeographyResult.external_source}
                externalId={selectedMainGeographyResult.external_id}
                placeName={selectedMainGeographyResult.canonical_name}
                onSuccess={(update) => {
                  const placeId = update.place_id;

                  if (typeof placeId === "number" && placeId > 0) {
                    router.push(`/places/${placeId}`);
                  }
                }}
              />
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

const experienceFormErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
};