"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

const TripPlanMap = dynamic(
  () => import("../../components/TripPlanMap"),
  {
    ssr: false,
  }
);

type SavedItem = {
  id: number;
  trip_plan_id: number;
  experience_id: number;
  title: string;
  comment: string;
  rating: number | null;
  trip_context: string;
  trip_style: string;
  image_url: string | null;
  place: string;
  place_id: number;
  destination: string;
  latitude: string | null;
  longitude: string | null;
  saved_at: string;
  experience_created_at: string;
};

type SavedPlace = {
  id: number;
  trip_plan_id: number;
  place_id: number;
  name: string;
  place_type: string;
  city: string;
  destination: string;
  destination_country: string;
  destination_city: string;
  latitude: string | null;
  longitude: string | null;
  note: string;
  saved_at: string;
  related_experiences_count: number;
  related_updates_count: number;
  has_related_content: boolean;
};

type SavedUpdate = {
  id: number;
  trip_plan_id: number;
  update_id: number;
  type: "event" | "alert" | "info" | string;
  category: string;
  title: string;
  text: string;
  event_date: string | null;
  external_link: string;
  source_name: string;
  source_url: string;
  priority: string;
  place_id: number | null;
  place: string;
  destination: string;
  latitude: string | null;
  longitude: string | null;
  saved_at: string;
  update_created_at: string;
};

type TripPlanResource = {
  id: number;
  trip_plan_id: number;
  title: string;
  url: string;
  note: string;
  category:
    | "official_info"
    | "tickets_booking"
    | "restaurant"
    | "transport"
    | "accommodation"
    | "attraction"
    | "other"
    | string;
  place_id: number | null;
  place: string;
  destination: string;
  added_by_user_id: number | null;
  added_by_username: string;
  added_by_display_name: string;
  created_at: string;
  updated_at: string;
};

type TripPlanDestination = {
  id: number;
  place: number;
  place_name: string;
  place_type: string;
  place_city?: string;
  destination_name?: string;
  destination_country?: string;
  role: "primary" | "secondary";
  position: number;
  created_at: string;
};

type TripPlanDetail = {
  id: number;
  is_owner: boolean;
  title: string;
  destination_text: string;
  description: string;
  destinations: TripPlanDestination[];
  primary_destination: TripPlanDestination | null;
  start_date: string | null;
  end_date: string | null;
  saved_count: number;
  saved_items_count?: number;
  saved_places_count?: number;
  saved_updates_count?: number;
  resources_count?: number;
  created_at: string;
  updated_at: string;
  saved_items: SavedItem[];
  saved_places: SavedPlace[];
  saved_updates: SavedUpdate[];
  resources: TripPlanResource[];
};

type TripPlanMember = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  role: "collaborator" | string;
  joined_at: string;
};

type RadarPlace = {
  id: number;
  name: string;
  place_type: string;
  city: string;
  destination_id?: number;
  destination_name: string;
  destination_country: string;
  latitude?: string | null;
  longitude?: string | null;
  is_saved?: boolean;
  created_at?: string;
};

type RadarExperience = {
  id: number;
  title: string;
  comment: string;
  rating: number | null;
  place_id: number;
  place_name: string;
  destination_name: string;
  destination_country: string;
  user: string;
  created_at: string;
  is_saved: boolean;
};

type RadarUpdate = {
  id: number;
  type: string;
  category: string;
  title: string;
  text: string;
  priority: string;
  event_date: string | null;
  external_link: string;
  source_name: string;
  source_url: string;
  place_id: number;
  place_name: string;
  destination_name: string;
  destination_country: string;
  created_at: string;
};

type TripRadar = {
  query: string;
  destination_text?: string;
  watch_mode?:
  | "structured_destinations"
  | "legacy_destination_text"
  | "empty";
  watched_places_count?: number;
  explicit_watched_places_count?: number;
  saved_places_count?: number;
  watched_places?: RadarPlace[];
  related_experiences_count: number;
  related_places_count: number;
  related_updates_count: number;
  has_related_content: boolean;
  saved_experience_ids: number[];
  saved_place_ids: number[];
  related_places: RadarPlace[];
  recommended_experiences: RadarExperience[];
  related_updates: RadarUpdate[];
};

type PlaceSearchResult = {
  id: number;
  name: string;
  place_type: string;
  city?: string;
  destination?: string | number;
  destination_name?: string;
  destination_country?: string;
  destination_city?: string;
};

type TripPlanSearchPlace = {
  place_id: number;
  name: string;
  place_type: string;
  city: string;
  destination: string;
  destination_country: string;
  destination_city: string;
  already_saved_place: boolean;
  already_has_saved_experience: boolean;
  already_in_trip_plan: boolean;
};

type TripPlanSearchExperience = {
  experience_id: number;
  title: string;
  comment: string;
  rating: number | null;
  image_url: string | null;
  place: string;
  place_id: number | null;
  place_type: string;
  destination: string;
  created_at: string;
  already_saved: boolean;
};

type TripPlanSearchUpdate = {
  id: number;
  type: "event" | "alert" | "info" | string;
  category: string;
  title: string;
  text: string;
  event_date: string | null;
  place: string;
  place_id: number;
  already_saved: boolean;
};

type TripPlanContentSearchResults = {
  matched_places: TripPlanSearchPlace[];
  experiences: TripPlanSearchExperience[];
  updates: TripPlanSearchUpdate[];
};

export default function TripPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [plan, setPlan] = useState<TripPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<TripPlanMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [collaboratorCode, setCollaboratorCode] = useState("");
  const [addingCollaborator, setAddingCollaborator] = useState(false);
  const [pendingCollaboratorRemove, setPendingCollaboratorRemove] =
    useState<TripPlanMember | null>(null);
  const [removingCollaboratorId, setRemovingCollaboratorId] =
    useState<number | null>(null);

  const [radar, setRadar] = useState<TripRadar | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);

  const [radarPlaceSearch, setRadarPlaceSearch] = useState("");
  const [radarPlaceResults, setRadarPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [radarPlaceSearchLoading, setRadarPlaceSearchLoading] = useState(false);
  const [radarPlaceHasSearched, setRadarPlaceHasSearched] = useState(false);
  const [radarPlaceHasOutOfScopeMatches, setRadarPlaceHasOutOfScopeMatches] = useState(false);
  const [watchingPlaceId, setWatchingPlaceId] = useState<number | null>(null);
  const [unwatchingPlaceId, setUnwatchingPlaceId] = useState<number | null>(null);
  const [pendingRadarRemove, setPendingRadarRemove] = useState<RadarPlace | null>(null);

  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SavedItem | null>(null);

  const [removingPlaceId, setRemovingPlaceId] = useState<number | null>(null);
  const [pendingPlaceRemove, setPendingPlaceRemove] =
    useState<SavedPlace | null>(null);

  const [removingUpdateId, setRemovingUpdateId] = useState<number | null>(null);
  const [pendingUpdateRemove, setPendingUpdateRemove] =
    useState<SavedUpdate | null>(null);

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceNote, setResourceNote] = useState("");
  const [resourceCategory, setResourceCategory] = useState("other");
  const [savingResource, setSavingResource] = useState(false);
  const [removingResourceId, setRemovingResourceId] =
    useState<number | null>(null);
  const [pendingResourceRemove, setPendingResourceRemove] =
    useState<TripPlanResource | null>(null);

  const [tripPlanContentSearch, setTripPlanContentSearch] = useState("");
  const [tripPlanContentResults, setTripPlanContentResults] =
    useState<TripPlanContentSearchResults | null>(null);
  const [tripPlanContentSearchLoading, setTripPlanContentSearchLoading] =
    useState(false);
  const [tripPlanContentHasSearched, setTripPlanContentHasSearched] =
    useState(false);
  const [savingTripPlanContentKey, setSavingTripPlanContentKey] =
    useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [showDeletePlanConfirm, setShowDeletePlanConfirm] = useState(false);

  const [editingPlan, setEditingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDestinationSearch, setEditDestinationSearch] = useState("");
  const [editDestinationResults, setEditDestinationResults] =
    useState<PlaceSearchResult[]>([]);
  const [editSelectedDestination, setEditSelectedDestination] =
    useState<PlaceSearchResult | null>(null);
  const [searchingEditDestinations, setSearchingEditDestinations] =
  useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const savedExperiencesCount =
    plan?.saved_items_count ?? plan?.saved_items.length ?? 0;

  const savedPlacesCount =
    plan?.saved_places_count ?? plan?.saved_places.length ?? 0;

  const savedUpdatesCount =
    plan?.saved_updates_count ?? plan?.saved_updates.length ?? 0;

  const resourcesCount =
    plan?.resources_count ?? plan?.resources.length ?? 0;

  const watchedPlaces = radar?.watched_places ?? [];

  const tripPlanMapPoints = (() => {
    const points = new Map<
      number,
      {
        place_id: number;
        name: string;
        latitude: number;
        longitude: number;
        context?: string;
        sources: string[];
      }
    >();

    const addPoint = ({
      place_id,
      name,
      latitude,
      longitude,
      context,
      source,
    }: {
      place_id: number | null | undefined;
      name: string;
      latitude: string | null | undefined;
      longitude: string | null | undefined;
      context?: string;
      source: string;
    }) => {
      if (!place_id || !latitude || !longitude) {
        return;
      }

      const latitudeNumber = Number(latitude);
      const longitudeNumber = Number(longitude);

      if (
        !Number.isFinite(latitudeNumber)
        || !Number.isFinite(longitudeNumber)
      ) {
        return;
      }

      const existing = points.get(place_id);

      if (existing) {
        if (!existing.sources.includes(source)) {
          existing.sources.push(source);
        }

        return;
      }

      points.set(place_id, {
        place_id,
        name,
        latitude: latitudeNumber,
        longitude: longitudeNumber,
        context,
        sources: [source],
      });
    };

    plan?.saved_places.forEach((savedPlace) => {
      addPoint({
        place_id: savedPlace.place_id,
        name: savedPlace.name,
        latitude: savedPlace.latitude,
        longitude: savedPlace.longitude,
        context:
          savedPlace.destination_country
          || savedPlace.destination
          || savedPlace.city,
        source: "saved place",
      });
    });

    plan?.saved_items.forEach((savedItem) => {
      addPoint({
        place_id: savedItem.place_id,
        name: savedItem.place,
        latitude: savedItem.latitude,
        longitude: savedItem.longitude,
        context: savedItem.destination,
        source: "experience",
      });
    });

    plan?.saved_updates.forEach((savedUpdate) => {
      addPoint({
        place_id: savedUpdate.place_id,
        name: savedUpdate.place,
        latitude: savedUpdate.latitude,
        longitude: savedUpdate.longitude,
        context: savedUpdate.destination,
        source: "event/info",
      });
    });

    watchedPlaces.forEach((watchedPlace) => {
      addPoint({
        place_id: watchedPlace.id,
        name: watchedPlace.name,
        latitude: watchedPlace.latitude,
        longitude: watchedPlace.longitude,
        context:
          watchedPlace.destination_country
          || watchedPlace.destination_name
          || watchedPlace.city,
        source: "Radar",
      });
    });

    return Array.from(points.values());
  })();

  const clearActionFeedback = () => {
    setActionMessage("");
    setActionError("");
  };

  const normalizeText = (value: string | number | null | undefined) =>
    String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const getPlaceContextLabel = (
      placeName?: string,
      placeCity?: string,
      destinationCountry?: string,
      destinationName?: string
  ) => {
      const normalizedPlaceName = normalizeText(placeName);
      const normalizedPlaceCity = normalizeText(placeCity);

      const values = [
        placeName,
        normalizedPlaceCity &&
        normalizedPlaceCity !== normalizedPlaceName
          ? placeCity
          : "",
        destinationCountry || destinationName,
      ];

      return values.filter(Boolean).join(" · ");
  };

  const getPlaceDestinationLabel = (place: PlaceSearchResult | RadarPlace) => {
    const destinationName =
      "destination_name" in place ? place.destination_name : "";
    const destinationCountry =
      "destination_country" in place ? place.destination_country : "";

    if (destinationName && destinationCountry && destinationName !== destinationCountry) {
      return `${destinationName} · ${destinationCountry}`;
    }

    return destinationName || destinationCountry || "";
  };

  const isPlaceWatched = (placeId: number) =>
    watchedPlaces.some((place) => place.id === placeId);

  const loadPlan = async () => {
    if (!id) return;

    try {
      const res = await fetch(`${API_URL}/api/trip-plans/${id}/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load trip plan:", res.status, text);
        return;
      }

      const data = await res.json();
      setPlan(data);
    } catch (error) {
      console.error("Trip plan detail fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchTripPlanContent = async () => {
    if (!plan) return;

    clearActionFeedback();

    const query = tripPlanContentSearch.trim();

    if (query.length < 2) {
      setActionError("Type at least 2 characters to search.");
      return;
    }

    setTripPlanContentSearchLoading(true);
    setTripPlanContentHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: query,
      });

      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/suggestions/?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setActionError(
          data.detail || "Could not search trip content right now."
        );
        setTripPlanContentResults(null);
        return;
      }

      setTripPlanContentResults({
        matched_places: Array.isArray(data.matched_places)
          ? data.matched_places
          : [],
        experiences: Array.isArray(data.experiences)
          ? data.experiences
          : [],
        updates: Array.isArray(data.updates)
          ? data.updates
          : [],
      });
    } catch (error) {
      console.error("Trip plan content search error:", error);
      setActionError("Could not search trip content right now.");
      setTripPlanContentResults(null);
    } finally {
      setTripPlanContentSearchLoading(false);
    }
  };

  const saveTripPlanSearchResult = async (
    contentType: "place" | "experience" | "update",
    contentId: number,
    labelText: string
  ) => {
    if (!plan) return;

    clearActionFeedback();

    const contentKey = `${contentType}-${contentId}`;
    setSavingTripPlanContentKey(contentKey);

    const endpointSegment =
      contentType === "place"
        ? "places"
        : contentType === "experience"
          ? "experiences"
          : "updates";

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/${endpointSegment}/${contentId}/`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setActionError(
          data.detail || "Could not save this content to the trip plan."
        );
        return;
      }

      setTripPlanContentResults((prev) => {
        if (!prev) return prev;

        if (contentType === "place") {
          return {
            ...prev,
            matched_places: prev.matched_places.map((place) =>
              place.place_id === contentId
                ? {
                    ...place,
                    already_saved_place: true,
                    already_in_trip_plan: true,
                  }
                : place
            ),
          };
        }

        if (contentType === "experience") {
          return {
            ...prev,
            experiences: prev.experiences.map((experience) =>
              experience.experience_id === contentId
                ? {
                    ...experience,
                    already_saved: true,
                  }
                : experience
            ),
          };
        }

        return {
          ...prev,
          updates: prev.updates.map((update) =>
            update.id === contentId
              ? {
                  ...update,
                  already_saved: true,
                }
              : update
          ),
        };
      });

      await loadPlan();

      setActionMessage(
        data.created === false
          ? `${labelText} is already saved in this trip plan.`
          : `${labelText} saved to this trip plan.`
      );
    } catch (error) {
      console.error("Save trip plan search result error:", error);
      setActionError("Could not save this content to the trip plan.");
    } finally {
      setSavingTripPlanContentKey(null);
    }
  };

  const loadMembers = async () => {
    if (!id) return;

    setMembersLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${id}/members/`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        setMembers([]);
        return;
      }

      const data = await res.json();

      setMembers(
        Array.isArray(data.members)
          ? data.members
          : []
      );
    } catch (error) {
      console.error("Trip plan members fetch error:", error);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const addCollaborator = async () => {
    if (!plan || !plan.is_owner) return;

    clearActionFeedback();

    const publicCode = collaboratorCode.trim();

    if (!publicCode) {
      setActionError("Enter a public code to add a collaborator.");
      return;
    }

    setAddingCollaborator(true);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/members/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            public_code: publicCode,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setActionError(
          data.detail || "Could not add this collaborator."
        );
        return;
      }

      if (data.member) {
        setMembers((prev) => {
          const exists = prev.some(
            (member) => member.id === data.member.id
          );

          return exists
            ? prev
            : [...prev, data.member];
        });
      }

      setCollaboratorCode("");

      setActionMessage(
        data.created === false
          ? "This person is already a collaborator."
          : "Collaborator added successfully."
      );
    } catch (error) {
      console.error("Add collaborator error:", error);
      setActionError(
        "Something went wrong while adding this collaborator."
      );
    } finally {
      setAddingCollaborator(false);
    }
  };

  const removeCollaborator = async (member: TripPlanMember) => {
    if (!plan || !plan.is_owner) return;

    clearActionFeedback();
    setRemovingCollaboratorId(member.user_id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/members/${member.user_id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      let data: { detail?: string } = {};

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setActionError(
          data.detail || "Could not remove this collaborator."
        );
        return;
      }

      setMembers((prev) =>
        prev.filter(
          (item) => item.user_id !== member.user_id
        )
      );

      setActionMessage("Collaborator removed successfully.");
    } catch (error) {
      console.error("Remove collaborator error:", error);
      setActionError(
        "Something went wrong while removing this collaborator."
      );
    } finally {
      setRemovingCollaboratorId(null);
    }
  };

  const loadRadar = async () => {
    if (!id) return;

    setRadarLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/trip-plans/${id}/radar/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load Trust Radar:", res.status, text);
        setRadar(null);
        return;
      }

      const data = await res.json();
      setRadar(data);
    } catch (error) {
      console.error("Trust Radar fetch error:", error);
      setRadar(null);
    } finally {
      setRadarLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
    loadRadar();
  }, [id]);

  useEffect(() => {
    if (!plan?.is_owner) {
      setMembers([]);
      return;
    }

    loadMembers();
  }, [id, plan?.is_owner]);

  const startEditingPlan = () => {
    if (!plan) return;

    clearActionFeedback();

    setEditTitle(plan.title || "");

    if (plan.primary_destination) {
      setEditSelectedDestination({
        id: plan.primary_destination.place,
        name: plan.primary_destination.place_name,
        place_type: plan.primary_destination.place_type,
        city: plan.primary_destination.place_city,
        destination_name: plan.primary_destination.destination_name,
        destination_country: plan.primary_destination.destination_country,
      });

      setEditDestinationSearch(plan.primary_destination.place_name);
    } else {
      setEditSelectedDestination(null);
      setEditDestinationSearch("");
    }

    setEditDestinationResults([]);
    setEditDescription(plan.description || "");
    setEditStartDate(plan.start_date || "");
    setEditEndDate(plan.end_date || "");

    setEditingPlan(true);
  };

  const cancelEditingPlan = () => {
    setEditingPlan(false);
    clearActionFeedback();
  };

  const searchPlacesForEditDestination = async () => {
      clearActionFeedback();

      const query = editDestinationSearch.trim();

      if (query.length < 2) {
        setEditDestinationResults([]);
        setRadarPlaceHasOutOfScopeMatches(false);
        setActionError("Type at least 2 characters to search for a destination.");
        return;
      }

      setSearchingEditDestinations(true);

      try {
        const params = new URLSearchParams({
          q: query,
        });

        const searchUrl = `${API_URL}/api/places/search/?${params.toString()}`;

        const res = await fetch(searchUrl, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(
            "Failed to search edit destinations:",
            res.status,
            text
          );
          setActionError("Could not search destinations right now.");
          setEditDestinationResults([]);
          return;
        }

        const data = await res.json();

        const places: PlaceSearchResult[] = Array.isArray(data.results)
          ? data.results
          : [];

        setEditDestinationResults(places);
      } catch (error) {
        console.error("Edit destination search error:", error);
        setActionError("Could not search destinations right now.");
        setEditDestinationResults([]);
      } finally {
        setSearchingEditDestinations(false);
      }
    };

  const searchPlacesForRadar = async () => {
      if (!plan) return;

    clearActionFeedback();

    const query = radarPlaceSearch.trim();

    setRadarPlaceHasSearched(true);

    if (query.length < 2) {
      setRadarPlaceResults([]);
      setRadarPlaceHasOutOfScopeMatches(false);
      setActionError("Type at least 2 characters to search for a place.");
      return;
    }

    setRadarPlaceSearchLoading(true);

    try {
      const params = new URLSearchParams({
        q: query,
      });

      const searchUrl =
        `${API_URL}/api/trip-plans/${plan.id}/radar-place-search/?${params.toString()}`;


      const res = await fetch(searchUrl, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to search places:", res.status, text);
        setActionError("Could not search places right now.");
        setRadarPlaceResults([]);
        return;
      }

      const data = await res.json();

      setRadarPlaceHasOutOfScopeMatches(
        Boolean(data.has_out_of_scope_matches)
      );

      const places: PlaceSearchResult[] = Array.isArray(data.results)
        ? data.results
        : [];

      setRadarPlaceResults(places.slice(0, 8));

      if (places.length === 0) {
        setActionMessage("");
      }
    } catch (error) {
      console.error("Place search error:", error);
      setActionError("Could not search places right now.");
      setRadarPlaceResults([]);
    } finally {
      setRadarPlaceSearchLoading(false);
    }
  };

const watchRadarPlace = async (place: { id: number; name: string }) => {
    if (!plan) return;

    clearActionFeedback();
    setWatchingPlaceId(place.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/watched-places/${place.id}/`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await res.json();

            if (!res.ok) {
        setActionError(data.detail || "Error adding place to Radar watchlist.");
        return;
      }

      await loadRadar();

      setRadarPlaceSearch("");
      setRadarPlaceResults([]);
      setActionMessage(`${place.name} added to your Radar watchlist.`);
    } catch (error) {
      console.error("Failed to watch radar place:", error);
      setActionError("Error adding place to Radar watchlist.");
    } finally {
      setWatchingPlaceId(null);
    }
  };

  const removeRadarWatchedPlace = async (place: { id: number; name: string }) => {
    if (!plan) return;

    clearActionFeedback();
    setUnwatchingPlaceId(place.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/watched-places/${place.id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Remove radar watched place error:", data);
        setActionError(data.detail || "Error removing place from Radar watchlist.");
        return;
      }

      await loadRadar();

      setActionMessage(`${place.name} removed from your Radar watchlist.`);
    } catch (error) {
      console.error("Failed to remove radar watched place:", error);
      setActionError("Error removing place from Radar watchlist.");
    } finally {
      setUnwatchingPlaceId(null);
    }
  };

  const removeExperienceFromPlan = async (item: SavedItem) => {
    if (!plan) return;

    clearActionFeedback();
    setRemovingItemId(item.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/experiences/${item.experience_id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Remove from trip plan error:", data);
        setActionError(data.detail || "Error removing experience from plan.");
        return;
      }

      setPlan((prev) => {
        if (!prev) return prev;

        const updatedItems = prev.saved_items.filter(
          (savedItem) => savedItem.id !== item.id
        );

        return {
          ...prev,
          saved_items: updatedItems,
          saved_items_count: updatedItems.length,
          saved_count:
            updatedItems.length
            + (prev.saved_places?.length || 0)
            + (prev.saved_updates?.length || 0)
            + (prev.resources?.length || 0),
        };
      });

      setActionMessage("Experience removed from this trip plan.");
    } catch (error) {
      console.error("Failed to remove experience from trip plan:", error);
      setActionError("Error removing experience from plan.");
    } finally {
      setRemovingItemId(null);
    }
  };

  const confirmPendingRemove = async () => {
    if (!pendingRemove) return;

    const itemToRemove = pendingRemove;
    setPendingRemove(null);

    await removeExperienceFromPlan(itemToRemove);
  };

  const cancelPendingRemove = () => {
    setPendingRemove(null);
  };

  const removePlaceFromPlan = async (savedPlace: SavedPlace) => {
    if (!plan) return;

    clearActionFeedback();
    setRemovingPlaceId(savedPlace.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/places/${savedPlace.place_id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Remove place from trip plan error:", data);
        setActionError(data.detail || "Error removing place from plan.");
        return;
      }

      setPlan((prev) => {
        if (!prev) return prev;

        const updatedSavedPlaces = prev.saved_places.filter(
          (item) => item.id !== savedPlace.id
        );

        return {
          ...prev,
          saved_places: updatedSavedPlaces,
          saved_places_count: updatedSavedPlaces.length,
          saved_count:
            (prev.saved_items?.length || 0)
            + updatedSavedPlaces.length
            + (prev.saved_updates?.length || 0)
            + (prev.resources?.length || 0),
        };
      });

      setActionMessage("Place removed from this trip plan.");
    } catch (error) {
      console.error("Failed to remove place from trip plan:", error);
      setActionError("Error removing place from plan.");
    } finally {
      setRemovingPlaceId(null);
    }
  };

  const confirmPendingPlaceRemove = async () => {
    if (!pendingPlaceRemove) return;

    const placeToRemove = pendingPlaceRemove;
    setPendingPlaceRemove(null);

    await removePlaceFromPlan(placeToRemove);
  };

  const cancelPendingPlaceRemove = () => {
    setPendingPlaceRemove(null);
  };

  const removeUpdateFromPlan = async (savedUpdate: SavedUpdate) => {
    if (!plan) return;

    clearActionFeedback();
    setRemovingUpdateId(savedUpdate.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/updates/${savedUpdate.update_id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Remove update from trip plan error:", data);
        setActionError(data.detail || "Error removing update from plan.");
        return;
      }

      setPlan((prev) => {
        if (!prev) return prev;

        const updatedSavedUpdates = prev.saved_updates.filter(
          (item) => item.id !== savedUpdate.id
        );

        return {
          ...prev,
          saved_updates: updatedSavedUpdates,
          saved_updates_count: updatedSavedUpdates.length,
          saved_count:
            (prev.saved_items?.length || 0)
            + (prev.saved_places?.length || 0)
            + updatedSavedUpdates.length
            + (prev.resources?.length || 0),
        };
      });

      setActionMessage("Update removed from this trip plan.");
    } catch (error) {
      console.error("Failed to remove update from trip plan:", error);
      setActionError("Error removing update from plan.");
    } finally {
      setRemovingUpdateId(null);
    }
  };

  const confirmPendingUpdateRemove = async () => {
    if (!pendingUpdateRemove) return;

    const updateToRemove = pendingUpdateRemove;
    setPendingUpdateRemove(null);

    await removeUpdateFromPlan(updateToRemove);
  };

  const cancelPendingUpdateRemove = () => {
    setPendingUpdateRemove(null);
  };

  const addResourceToPlan = async () => {
    if (!plan) return;

    clearActionFeedback();

    const title = resourceTitle.trim();
    const url = resourceUrl.trim();
    const note = resourceNote.trim();

    if (!title) {
      setActionError("Resource title is required.");
      return;
    }

    if (!url) {
      setActionError("Resource URL is required.");
      return;
    }

    setSavingResource(true);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/resources/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            url,
            note,
            category: resourceCategory,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const urlError = Array.isArray(data.url)
          ? data.url[0]
          : "";

        setActionError(
          urlError
          || data.detail
          || "Error adding resource to trip plan."
        );
        return;
      }

      await loadPlan();

      setResourceTitle("");
      setResourceUrl("");
      setResourceNote("");
      setResourceCategory("other");
      setShowResourceForm(false);

      setActionMessage(
        data.created
          ? "Resource added to this trip plan."
          : "This resource is already in the trip plan."
      );
    } catch (error) {
      console.error("Failed to add resource to trip plan:", error);
      setActionError("Error adding resource to trip plan.");
    } finally {
      setSavingResource(false);
    }
  };

  const removeResourceFromPlan = async (
    resource: TripPlanResource
  ) => {
    if (!plan) return;

    clearActionFeedback();
    setRemovingResourceId(resource.id);

    try {
      const res = await fetch(
        `${API_URL}/api/trip-plans/${plan.id}/resources/${resource.id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Remove resource from trip plan error:", data);
        setActionError(
          data.detail || "Error removing resource from trip plan."
        );
        return;
      }

      await loadPlan();

      setActionMessage("Resource removed from this trip plan.");
    } catch (error) {
      console.error("Failed to remove resource from trip plan:", error);
      setActionError("Error removing resource from trip plan.");
    } finally {
      setRemovingResourceId(null);
    }
  };

  const confirmPendingResourceRemove = async () => {
    if (!pendingResourceRemove) return;

    const resourceToRemove = pendingResourceRemove;
    setPendingResourceRemove(null);

    await removeResourceFromPlan(resourceToRemove);
  };

  const cancelPendingResourceRemove = () => {
    setPendingResourceRemove(null);
  };

  const saveTripPlanChanges = async () => {
    if (!plan) return;

    clearActionFeedback();

    const title = editTitle.trim();

    if (!title) {
      setActionError("Trip plan title is required.");
      return;
    }

    if (!editSelectedDestination) {
      setActionError("Please select a primary destination.");
      return;
    }

    setSavingPlan(true);

    try {
      const res = await fetch(`${API_URL}/api/trip-plans/${plan.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: editDescription.trim(),
          start_date: editStartDate || null,
          end_date: editEndDate || null,
          destinations: [
            {
              place_id: editSelectedDestination.id,
              role: "primary",
              position: 0,
            },
          ],
         }),
       });
      const data = await res.json();

      if (!res.ok) {
        console.error("Update trip plan error:", data);
        setActionError(data.detail || "Could not update this trip plan.");
        return;
      }

      setPlan((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          title: data.title,
          destination_text: data.destination_text,
          destinations: data.destinations,
          primary_destination: data.primary_destination,
          description: data.description,
          start_date: data.start_date,
          end_date: data.end_date,
          updated_at: data.updated_at,
        };
      });

      setEditingPlan(false);
      setActionMessage("Trip plan updated successfully.");
    } catch (error) {
      console.error("Failed to update trip plan:", error);
      setActionError("Something went wrong while updating this trip plan.");
    } finally {
      setSavingPlan(false);
    }
  };

  const deleteTripPlan = async () => {
    if (!plan) return;

    clearActionFeedback();
    setDeletingPlan(true);

    try {
      const res = await fetch(`${API_URL}/api/trip-plans/${plan.id}/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        let data: { detail?: string } = {};

        try {
          data = await res.json();
        } catch {
          data = {};
        }

        console.error("Delete trip plan error:", data);
        setActionError(data.detail || "Could not delete this trip plan.");
        setShowDeletePlanConfirm(false);
        return;
      }

      router.push("/trip-plans");
    } catch (error) {
      console.error("Failed to delete trip plan:", error);
      setActionError("Something went wrong while deleting this trip plan.");
      setShowDeletePlanConfirm(false);
    } finally {
      setDeletingPlan(false);
    }
  };

  if (loading) {
    return (
      <main style={page}>
        <p style={muted}>Loading trip plan...</p>
      </main>
    );
  }

  if (!plan) {
    return (
      <main style={page}>
        <p style={muted}>Trip plan not found.</p>
        <Link href="/trip-plans" style={secondaryLink}>
          Back to trip plans
        </Link>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        /{" "}
        <Link href="/trip-plans" style={breadcrumbLink}>
          Trip plans
        </Link>{" "}
        / <span>{plan.title}</span>
      </div>

      <section style={heroCard}>
        <div style={label}>Trip plan</div>

        <h1 style={titleStyle}>{plan.title}</h1>

        {plan.primary_destination ? (
          <p style={destinationText}>
            {getPlaceContextLabel(
              plan.primary_destination.place_name,
              plan.primary_destination.place_city,
              plan.primary_destination.destination_country,
              plan.primary_destination.destination_name
            )}
          </p>
        ) : (
          plan.destination_text && (
            <p style={destinationText}>{plan.destination_text}</p>
          )
        )}

        {plan.description && <p style={descriptionText}>{plan.description}</p>}

        <div style={metaRow}>
          <span>
            {savedExperiencesCount} saved experience
            {savedExperiencesCount === 1 ? "" : "s"}
          </span>

          <span>
            {savedPlacesCount} saved place
            {savedPlacesCount === 1 ? "" : "s"}
          </span>

          <span>
            {savedUpdatesCount} saved event/info
            {savedUpdatesCount === 1 ? "" : "s"}
          </span>

          <span>
            {resourcesCount} external resource
            {resourcesCount === 1 ? "" : "s"}
          </span>

          {plan.start_date && (
            <span>From {new Date(plan.start_date).toLocaleDateString()}</span>
          )}

          {plan.end_date && (
            <span>To {new Date(plan.end_date).toLocaleDateString()}</span>
          )}
        </div>

        <div style={actions}>
          <Link href="/trip-plans" style={secondaryLink}>
            Back to plans
          </Link>

          <button
            type="button"
            onClick={() => router.push("/")}
            style={primaryButton}
          >
            Explore feed
          </button>

          {plan.is_owner && (
            <>
              <button
                type="button"
                onClick={startEditingPlan}
                style={secondaryButton}
              >
                Edit trip plan
              </button>

              <button
                type="button"
                onClick={() => {
                  clearActionFeedback();
                  setShowDeletePlanConfirm(true);
                }}
                disabled={deletingPlan}
                style={{
                  ...dangerButton,
                  opacity: deletingPlan ? 0.5 : 1,
                  cursor: deletingPlan ? "not-allowed" : "pointer",
                }}
              >
                Delete trip plan
              </button>
            </>
          )}
        </div>
      </section>

      {plan.is_owner && showDeletePlanConfirm && (
          <section style={deleteConfirmBox}>
            <div>
              <strong>Delete this trip plan?</strong>

              <p style={deleteConfirmText}>
                This will remove <strong>{plan.title}</strong> and all saved items inside it.
              </p>
            </div>

            <div style={actions}>
              <button
                type="button"
                onClick={() => setShowDeletePlanConfirm(false)}
                disabled={deletingPlan}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteTripPlan}
                disabled={deletingPlan}
                style={{
                  ...dangerButton,
                  opacity: deletingPlan ? 0.5 : 1,
                  cursor: deletingPlan ? "not-allowed" : "pointer",
                }}
              >
                {deletingPlan ? "Deleting..." : "Delete plan"}
              </button>
            </div>
          </section>
        )}

      {plan.is_owner && (
        <section style={section}>
          <h2 style={sectionTitle}>Collaborators</h2>

          <p style={mutedSmall}>
            People you add here can contribute places, experiences, useful
            updates and Trust Radar choices to this trip plan.
          </p>

          <form
            style={radarSearchRow}
            onSubmit={(event) => {
              event.preventDefault();
              addCollaborator();
            }}
          >
            <input
              type="text"
              value={collaboratorCode}
              onChange={(event) => {
                setCollaboratorCode(event.target.value);
                clearActionFeedback();
              }}
              placeholder="Enter public code"
              style={radarSearchInput}
            />

            <button
              type="submit"
              disabled={addingCollaborator}
              style={{
                ...secondaryButton,
                opacity: addingCollaborator ? 0.5 : 1,
                cursor: addingCollaborator
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {addingCollaborator
                ? "Adding..."
                : "Add collaborator"}
            </button>
          </form>

          {membersLoading ? (
            <p style={mutedSmall}>Loading collaborators...</p>
          ) : members.length === 0 ? (
            <div style={emptyBox}>
              No collaborators yet.
            </div>
          ) : (
            <div style={list}>
              {members.map((member) => (
                <div key={member.id} style={compactActions}>
                  <span>
                    {member.display_name || member.username} · Collaborator
                  </span>

                  <button
                    type="button"
                    onClick={() => setPendingCollaboratorRemove(member)}
                    disabled={removingCollaboratorId === member.user_id}
                    style={{
                      ...dangerButton,
                      opacity:
                        removingCollaboratorId === member.user_id ? 0.5 : 1,
                      cursor:
                        removingCollaboratorId === member.user_id
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {removingCollaboratorId === member.user_id
                      ? "Removing..."
                      : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {pendingCollaboratorRemove && (
        <div style={removeConfirmOverlay}>
          <section style={removeConfirmBox}>
            <div>
              <div style={removeConfirmEyebrow}>
                Remove collaborator
              </div>

              <h2 style={removeConfirmTitle}>
                Remove this collaborator?
              </h2>

              <p style={removeConfirmText}>
                This person will lose access to this shared trip plan.
                Content they already added will remain in the plan.
              </p>

              <p style={removeConfirmItem}>
                {pendingCollaboratorRemove.display_name
                  || pendingCollaboratorRemove.username}
              </p>
            </div>

            <div style={actions}>
              <button
                type="button"
                onClick={() => setPendingCollaboratorRemove(null)}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  const memberToRemove = pendingCollaboratorRemove;
                  setPendingCollaboratorRemove(null);
                  await removeCollaborator(memberToRemove);
                }}
                style={dangerButton}
              >
                Remove collaborator
              </button>
            </div>
          </section>
        </div>
      )}

      <section style={radarBox}>
        <div style={radarHeaderRow}>
          <div>
            <div style={radarEyebrow}>Trust Radar</div>
            <h2 style={radarTitle}>Watching this trip</h2>
          </div>

          {radarLoading && <span style={radarMutedText}>Checking...</span>}
        </div>

        <p style={radarText}>
          Trust Radar monitors selected places for this trip and lets you know
          when new activity appears.
        </p>

        {radar?.has_related_content ? (
          <p style={radarText}>
            There is activity in your monitored places. Open a watched place to
            review what is new, then save only what is useful to this trip plan.
          </p>
        ) : (
          <p style={radarText}>
            No new activity found yet. When travelers share experiences, alerts,
            events or useful information about places in your Radar watchlist,
            Trust Radar will notify you.
          </p>
        )}

        <div style={radarSubsection}>
          <h3 style={radarSubsectionTitle}>Places monitored by Radar</h3>

          {watchedPlaces.length === 0 ? (
            <p style={mutedSmall}>
              No places monitored yet.
            </p>
          ) : (
            <div style={radarPlacesCompactBox}>
              {watchedPlaces.map((place) => (
                <div key={place.id} style={radarPlaceChip}>
                  <span>{place.name}</span>

                    <Link
                      href={`/places/${place.id}`}
                      style={radarPlaceChipLink}
                    >
                      Open
                    </Link>

                    <button
                      type="button"
                      onClick={() => setPendingRadarRemove(place)}
                      disabled={unwatchingPlaceId === place.id}
                      style={{
                        ...radarPlaceChipButton,
                        opacity: unwatchingPlaceId === place.id ? 0.5 : 1,
                        cursor:
                          unwatchingPlaceId === place.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {unwatchingPlaceId === place.id ? "..." : "×"}
                    </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={radarSubsection}>
          <h3 style={radarSubsectionTitle}>Add place to Radar</h3>

          <form
            style={radarSearchRow}
            onSubmit={(event) => {
              event.preventDefault();
              searchPlacesForRadar();
            }}
          >
                        <input
              type="text"
              value={radarPlaceSearch}
              onChange={(event) => {
                setRadarPlaceSearch(event.target.value);
                setRadarPlaceResults([]);
                setRadarPlaceHasSearched(false);
                setRadarPlaceHasOutOfScopeMatches(false);
                setActionMessage("");
                setActionError("");
              }}
              placeholder="Search place to monitor..."
              style={radarSearchInput}
            />

            <button
              type="submit"
              disabled={radarPlaceSearchLoading}
              style={{
                ...secondaryButton,
                opacity: radarPlaceSearchLoading ? 0.5 : 1,
                cursor: radarPlaceSearchLoading ? "not-allowed" : "pointer",
              }}
            >
              {radarPlaceSearchLoading ? "Searching..." : "Search"}
            </button>
          </form>

            {radarPlaceHasSearched &&
              radarPlaceSearch.trim().length >= 2 &&
              !radarPlaceSearchLoading &&
              radarPlaceResults.length === 0 && (
                <div style={radarCreateBox}>
                  {radarPlaceHasOutOfScopeMatches ? (
                    <>
                      <span>
                        This place exists, but it is outside the destinations defined for this trip plan.
                      </span>

                      <p style={{ margin: 0, color: "#666", fontSize: "13px", lineHeight: 1.5 }}>
                        Radar can only monitor places that belong to the current trip plan scope.
                      </p>
                    </>
                 ) : (
                   <>
                     <span>
                        No existing place found for “{radarPlaceSearch.trim()}”.
                     </span>

                     <p style={{ margin: 0, color: "#666", fontSize: "13px", lineHeight: 1.5 }}>
                        To avoid duplicate or wrongly structured places, create the place first using
                        the guided place creation flow. After that, return here and add it to Radar.
                     </p>

                     <Link
                       href="/destinations"
                       style={smallPrimaryButton}
                     >
                       Create place with guided flow
                     </Link>
                   </>
                 )}
              </div>
            )}

          {radarPlaceResults.length > 0 && (
            <div style={radarSearchResultsBox}>
              {radarPlaceResults.map((place) => {
                const destinationLabel = getPlaceDestinationLabel(place);
                const alreadyWatched = isPlaceWatched(place.id);

                return (
                  <div key={place.id} style={radarSearchResultRow}>
                    <div>
                      <strong>{place.name}</strong>

                      <div style={mutedSmall}>
                        {place.place_type}
                        {destinationLabel ? ` · ${destinationLabel}` : ""}
                      </div>
                    </div>

                    <div style={compactActions}>
                      <Link
                          href={`/places/${place.id}`}
                          style={smallSecondaryLink}
                      >
                          Open
                      </Link>

                      {alreadyWatched ? (
                        <span style={smallSuccessBadge}>
                          Monitored
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => watchRadarPlace(place)}
                          disabled={watchingPlaceId === place.id}
                          style={{
                            ...smallPrimaryButton,
                            opacity: watchingPlaceId === place.id ? 0.5 : 1,
                            cursor:
                              watchingPlaceId === place.id
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {watchingPlaceId === place.id ? "Adding..." : "Monitor"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {editingPlan && (
        <section style={editPlanBox}>
          <div>
            <h2 style={sectionTitle}>Edit trip plan</h2>
            <p style={helperText}>Update the basic details of this trip plan.</p>
          </div>

          <label style={formLabel}>
              Title
              <input
                type="text"
                value={editTitle}
                onChange={(event) => {
                  setEditTitle(event.target.value);
                  setActionError("");
                }}
                placeholder="Trip plan title"
                style={textInput}
              />
            </label>

            <label style={formLabel}>
              Primary destination
              <input
                type="text"
                value={editDestinationSearch}
                onChange={(event) => {
                  setEditDestinationSearch(event.target.value);
                  setEditSelectedDestination(null);
                  setActionError("");
                }}
                placeholder="Search a country, city or specific place"
                style={textInput}
              />
            </label>

            <div style={compactActions}>
              <button
                type="button"
                onClick={searchPlacesForEditDestination}
                disabled={searchingEditDestinations}
                style={{
                  ...smallPrimaryButton,
                  opacity: searchingEditDestinations ? 0.5 : 1,
                  cursor: searchingEditDestinations ? "not-allowed" : "pointer",
                }}
              >
                {searchingEditDestinations
                  ? "Searching..."
                  : "Search destination"}
              </button>
            </div>

            {editDestinationResults.length > 0 && (
              <div style={{ display: "grid", gap: "8px" }}>
                {editDestinationResults.map((place) => {
                  const contextLabel = getPlaceContextLabel(
                    undefined,
                    place.city,
                    place.destination_country,
                    place.destination_name
                  );

                  return (
                    <div key={place.id} style={radarSearchResultRow}>
                      <div>
                        <strong>{place.name}</strong>

                        <div style={mutedSmall}>
                          {place.place_type}
                          {contextLabel ? ` · ${contextLabel}` : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditSelectedDestination(place);
                          setEditDestinationSearch(place.name);
                          setEditDestinationResults([]);
                          setActionError("");
                        }}
                        style={smallPrimaryButton}
                      >
                        Select
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {editSelectedDestination && (
              <div style={radarSearchResultRow}>
                <div>
                  <strong>{editSelectedDestination.name}</strong>

                  <div style={mutedSmall}>
                    {editSelectedDestination.place_type}

                    {getPlaceContextLabel(
                      undefined,
                      editSelectedDestination.city,
                      editSelectedDestination.destination_country,
                      editSelectedDestination.destination_name
                    )
                      ? ` · ${getPlaceContextLabel(
                          undefined,
                          editSelectedDestination.city,
                          editSelectedDestination.destination_country,
                          editSelectedDestination.destination_name
                        )}`
                      : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditSelectedDestination(null);
                    setEditDestinationSearch("");
                    setEditDestinationResults([]);
                  }}
                  style={secondaryButton}
                >
                  Change
                </button>
              </div>
            )}

          <label style={formLabel}>
            Description
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Optional notes about this trip..."
              rows={4}
              style={textareaInput}
            />
          </label>

          <div style={dateGrid}>
            <label style={formLabel}>
              Start date
              <input
                type="date"
                value={editStartDate}
                onChange={(event) => setEditStartDate(event.target.value)}
                style={textInput}
              />
            </label>

            <label style={formLabel}>
              End date
              <input
                type="date"
                value={editEndDate}
                onChange={(event) => setEditEndDate(event.target.value)}
                style={textInput}
              />
            </label>
          </div>

          <div style={actions}>
            <button
              type="button"
              onClick={saveTripPlanChanges}
              disabled={savingPlan}
              style={{
                ...primaryButton,
                opacity: savingPlan ? 0.5 : 1,
                cursor: savingPlan ? "not-allowed" : "pointer",
              }}
            >
              {savingPlan ? "Saving..." : "Save changes"}
            </button>

            <button type="button" onClick={cancelEditingPlan} style={secondaryButton}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {actionMessage && <div style={successBox}>{actionMessage}</div>}

      {actionError && <div style={errorBox}>{actionError}</div>}

      <section style={section}>
        <h2 style={sectionTitle}>Find something for this trip</h2>

        <p style={mutedSmall}>
          Search Trust Travel for places, experiences, events, alerts or useful
          information and save what matters to this trip.
        </p>

        <form
          style={radarSearchRow}
          onSubmit={(event) => {
            event.preventDefault();
            searchTripPlanContent();
          }}
        >
          <input
            type="text"
            value={tripPlanContentSearch}
            onChange={(event) => {
              setTripPlanContentSearch(event.target.value);
              clearActionFeedback();
            }}
            placeholder="Search places, experiences, events or useful info..."
            style={radarSearchInput}
          />

          <button
            type="submit"
            disabled={tripPlanContentSearchLoading}
            style={{
              ...secondaryButton,
              opacity: tripPlanContentSearchLoading ? 0.5 : 1,
              cursor: tripPlanContentSearchLoading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {tripPlanContentSearchLoading ? "Searching..." : "Search"}
          </button>
        </form>

        {tripPlanContentHasSearched
          && !tripPlanContentSearchLoading
          && tripPlanContentResults
          && tripPlanContentResults.matched_places.length === 0
          && tripPlanContentResults.experiences.length === 0
          && tripPlanContentResults.updates.length === 0 && (
            <div style={emptyBox}>
              No matching content found.
            </div>
          )}

        {tripPlanContentResults
          && tripPlanContentResults.matched_places.length > 0 && (
            <div style={{ display: "grid", gap: "10px" }}>
              <h3 style={experienceTitle}>Places</h3>

              {tripPlanContentResults.matched_places.map((place) => {
                const contentKey = `place-${place.place_id}`;
                const saving = savingTripPlanContentKey === contentKey;

                return (
                  <article key={contentKey} style={experienceCard}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={label}>Place · {place.place_type}</div>

                      <h3 style={experienceTitle}>{place.name}</h3>

                      <div style={placeText}>
                        {[place.city, place.destination_country]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>

                      <div style={actions}>
                        <Link
                          href={`/places/${place.place_id}`}
                          style={primaryLink}
                        >
                          View place
                        </Link>

                        <button
                          type="button"
                          disabled={place.already_in_trip_plan || saving}
                          onClick={() =>
                            saveTripPlanSearchResult(
                              "place",
                              place.place_id,
                              place.name
                            )
                          }
                          style={{
                            ...secondaryButton,
                            opacity:
                              place.already_in_trip_plan || saving ? 0.5 : 1,
                            cursor:
                              place.already_in_trip_plan || saving
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {place.already_in_trip_plan
                            ? "Saved"
                            : saving
                              ? "Saving..."
                              : "Save to plan"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

        {tripPlanContentResults
          && tripPlanContentResults.experiences.length > 0 && (
            <div style={{ display: "grid", gap: "10px" }}>
              <h3 style={experienceTitle}>Experiences</h3>

              {tripPlanContentResults.experiences.map((experience) => {
                const contentKey = `experience-${experience.experience_id}`;
                const saving = savingTripPlanContentKey === contentKey;

                return (
                  <article key={contentKey} style={experienceCard}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={label}>Experience</div>

                      <h3 style={experienceTitle}>
                        {experience.title || experience.place || "Experience"}
                      </h3>

                      <div style={placeText}>
                        {experience.place}
                        {experience.destination
                          && experience.destination !== experience.place
                          ? ` · ${experience.destination}`
                          : ""}
                      </div>

                      {experience.comment && (
                        <p style={commentText}>{experience.comment}</p>
                      )}

                      <div style={actions}>
                        <Link
                          href={`/experiences/${experience.experience_id}`}
                          style={primaryLink}
                        >
                          View experience
                        </Link>

                        <button
                          type="button"
                          disabled={experience.already_saved || saving}
                          onClick={() =>
                            saveTripPlanSearchResult(
                              "experience",
                              experience.experience_id,
                              experience.title || "Experience"
                            )
                          }
                          style={{
                            ...secondaryButton,
                            opacity:
                              experience.already_saved || saving ? 0.5 : 1,
                            cursor:
                              experience.already_saved || saving
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {experience.already_saved
                            ? "Saved"
                            : saving
                              ? "Saving..."
                              : "Save to plan"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

        {tripPlanContentResults
          && tripPlanContentResults.updates.length > 0 && (
            <div style={{ display: "grid", gap: "10px" }}>
              <h3 style={experienceTitle}>Events & info</h3>

              {tripPlanContentResults.updates.map((update) => {
                const contentKey = `update-${update.id}`;
                const saving = savingTripPlanContentKey === contentKey;

                return (
                  <article key={contentKey} style={experienceCard}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={label}>
                        {update.type === "event"
                          ? "Event"
                          : update.type === "alert"
                            ? "Alert"
                            : "Useful info"}
                      </div>

                      <h3 style={experienceTitle}>
                        {update.title || update.place || "Update"}
                      </h3>

                      {update.place && (
                        <div style={placeText}>{update.place}</div>
                      )}

                      {update.text && (
                        <p style={commentText}>{update.text}</p>
                      )}

                      <div style={actions}>
                        <Link
                          href={`/updates/${update.id}`}
                          style={primaryLink}
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          disabled={update.already_saved || saving}
                          onClick={() =>
                            saveTripPlanSearchResult(
                              "update",
                              update.id,
                              update.title || "Update"
                            )
                          }
                          style={{
                            ...secondaryButton,
                            opacity:
                              update.already_saved || saving ? 0.5 : 1,
                            cursor:
                              update.already_saved || saving
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {update.already_saved
                            ? "Saved"
                            : saving
                              ? "Saving..."
                              : "Save to plan"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </section>

      <section style={section}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={sectionTitle}>External resources</h2>

            <p style={helperText}>
              Keep useful links, booking pages, official information and other
              planning resources together with this trip.
            </p>

            <div style={mutedSmall}>
              {resourcesCount} {resourcesCount === 1 ? "resource" : "resources"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowResourceForm((current) => !current);
              clearActionFeedback();
            }}
            style={secondaryButton}
          >
            {showResourceForm ? "Close form" : "Add resource"}
          </button>
        </div>

        {showResourceForm && (
          <div
            style={{
              display: "grid",
              gap: "14px",
              marginTop: "18px",
            }}
          >
            <label style={formLabel}>
              Title
              <input
                type="text"
                value={resourceTitle}
                onChange={(event) => {
                  setResourceTitle(event.target.value);
                  setActionError("");
                }}
                placeholder="Example: Official museum tickets"
                style={textInput}
              />
            </label>

            <label style={formLabel}>
              URL
              <input
                type="url"
                value={resourceUrl}
                onChange={(event) => {
                  setResourceUrl(event.target.value);
                  setActionError("");
                }}
                placeholder="https://..."
                style={textInput}
              />
            </label>

            <label style={formLabel}>
              Category
              <select
                value={resourceCategory}
                onChange={(event) => {
                  setResourceCategory(event.target.value);
                  setActionError("");
                }}
                style={textInput}
              >
                <option value="official_info">Official information</option>
                <option value="tickets_booking">Tickets / booking</option>
                <option value="restaurant">Restaurant</option>
                <option value="transport">Transport</option>
                <option value="accommodation">Accommodation</option>
                <option value="attraction">Attraction</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label style={formLabel}>
              Note
              <textarea
                value={resourceNote}
                onChange={(event) => {
                  setResourceNote(event.target.value);
                  setActionError("");
                }}
                placeholder="Optional note about why this link matters for the trip..."
                rows={3}
                style={textareaInput}
              />
            </label>

            <div style={actions}>
              <button
                type="button"
                onClick={addResourceToPlan}
                disabled={savingResource}
                style={{
                  ...primaryButton,
                  opacity: savingResource ? 0.5 : 1,
                  cursor: savingResource ? "not-allowed" : "pointer",
                }}
              >
                {savingResource ? "Saving..." : "Save resource"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowResourceForm(false);
                  setResourceTitle("");
                  setResourceUrl("");
                  setResourceNote("");
                  setResourceCategory("other");
                  setActionError("");
                }}
                style={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {plan.resources.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This trip does not have any external resources yet.
            </p>

            <p style={helperText}>
              Add useful links so important planning information does not get
              lost across messages, tabs or different websites.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "12px",
              marginTop: "18px",
            }}
          >
            {plan.resources.map((resource) => {
              const categoryLabel =
                resource.category === "official_info"
                  ? "Official information"
                  : resource.category === "tickets_booking"
                    ? "Tickets / booking"
                    : resource.category === "restaurant"
                      ? "Restaurant"
                      : resource.category === "transport"
                        ? "Transport"
                        : resource.category === "accommodation"
                          ? "Accommodation"
                          : resource.category === "attraction"
                            ? "Attraction"
                            : "Other";

              const contributor =
                resource.added_by_display_name
                || resource.added_by_username;

              return (
                <article key={resource.id} style={experienceCard}>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={label}>{categoryLabel}</div>

                    <h3 style={experienceTitle}>{resource.title}</h3>

                    {(resource.place || resource.destination) && (
                      <div style={mutedSmall}>
                        {[resource.place, resource.destination]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}

                    {resource.note && (
                      <p style={helperText}>{resource.note}</p>
                    )}

                    {contributor && (
                      <div style={mutedSmall}>
                        Added by {contributor}
                      </div>
                    )}

                    <div style={actions}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        style={primaryLink}
                      >
                        Open resource
                      </a>

                      <button
                        type="button"
                        onClick={() => setPendingResourceRemove(resource)}
                        disabled={removingResourceId === resource.id}
                        style={{
                          ...dangerButton,
                          opacity:
                            removingResourceId === resource.id ? 0.5 : 1,
                          cursor:
                            removingResourceId === resource.id
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {removingResourceId === resource.id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Saved places</h2>

        {plan.saved_places.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This plan does not have any saved places yet.
            </p>

            <p style={helperText}>
              Save places you want to keep as part of this trip. Monitoring a
              place with Trust Radar is separate from saving it to the plan.
            </p>

            <Link href="/destinations" style={primaryLink}>
              Find places
            </Link>
          </div>
        ) : (
          <div style={list}>
            {plan.saved_places.map((savedPlace) => {
              const locationParts = [
                savedPlace.city,
                savedPlace.destination_country || savedPlace.destination,
              ].filter(Boolean);

              const uniqueLocationParts = locationParts.filter(
                (value, index, values) =>
                  values.findIndex(
                    (candidate) =>
                      candidate.trim().toLowerCase()
                      === value.trim().toLowerCase()
                  ) === index
              );

              return (
                <article key={savedPlace.id} style={experienceCard}>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={label}>Saved place</div>

                    <h3 style={experienceTitle}>
                      {savedPlace.name || "Place"}
                    </h3>

                    {uniqueLocationParts.length > 0 && (
                      <div style={placeText}>
                        {uniqueLocationParts.join(" · ")}
                      </div>
                    )}

                    {savedPlace.note?.trim() && (
                      <p style={commentText}>{savedPlace.note}</p>
                    )}

                    <div style={metaRow}>
                      <span>
                        {savedPlace.related_experiences_count} related{" "}
                        {savedPlace.related_experiences_count === 1
                          ? "experience"
                          : "experiences"}
                      </span>

                      <span>
                        {savedPlace.related_updates_count} related{" "}
                        {savedPlace.related_updates_count === 1
                          ? "update"
                          : "updates"}
                      </span>
                    </div>

                    <div style={metaRow}>
                      <span>
                        Saved{" "}
                        {new Date(savedPlace.saved_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={actions}>
                      <Link
                        href={`/places/${savedPlace.place_id}`}
                        style={primaryLink}
                      >
                        View place
                      </Link>

                      <button
                        type="button"
                        onClick={() => setPendingPlaceRemove(savedPlace)}
                        disabled={removingPlaceId === savedPlace.id}
                        style={{
                          ...dangerButton,
                          opacity:
                            removingPlaceId === savedPlace.id ? 0.5 : 1,
                          cursor:
                            removingPlaceId === savedPlace.id
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {removingPlaceId === savedPlace.id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Saved experiences</h2>

        {plan.saved_items.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This plan does not have any saved experiences yet.
            </p>

            <p style={helperText}>
              Search for places or experiences, then save only what is useful to
              this trip plan.
            </p>

            <Link href="/destinations" style={primaryLink}>
              Search places and experiences
            </Link>
          </div>
        ) : (
          <div style={list}>
            {plan.saved_items.map((item) => (
              <article key={item.id} style={experienceCard}>
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title || "Saved experience"}
                    style={image}
                  />
                )}

                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={label}>Saved experience</div>

                  <h3 style={experienceTitle}>
                    {item.title || item.place || "Experience"}
                  </h3>

                  <div style={placeText}>
                    {item.place}
                    {item.destination && item.destination !== item.place
                      ? ` · ${item.destination}`
                      : ""}
                  </div>

                  {item.rating && (
                    <div style={rating}>
                      {"★".repeat(item.rating)}
                      {"☆".repeat(5 - item.rating)}
                    </div>
                  )}

                  <p style={commentText}>{item.comment}</p>

                  <div style={metaRow}>
                    <span>
                      Saved {new Date(item.saved_at).toLocaleDateString()}
                    </span>

                    <span>
                      Experience{" "}
                      {new Date(item.experience_created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={actions}>
                    <Link
                      href={`/experiences/${item.experience_id}`}
                      style={primaryLink}
                    >
                      View experience
                    </Link>

                    <button
                      type="button"
                      onClick={() => setPendingRemove(item)}
                      disabled={removingItemId === item.id}
                      style={{
                        ...dangerButton,
                        opacity: removingItemId === item.id ? 0.5 : 1,
                        cursor:
                          removingItemId === item.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {removingItemId === item.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Saved events & info</h2>

        {plan.saved_updates.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This plan does not have any saved events, alerts or useful
              information yet.
            </p>

            <p style={helperText}>
              Save useful updates when they matter to this trip, so they stay
              together with the places and experiences you are planning.
            </p>
          </div>
        ) : (
          <div style={list}>
            {plan.saved_updates.map((savedUpdate) => (
              <article key={savedUpdate.id} style={experienceCard}>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={label}>
                    {savedUpdate.type === "event"
                      ? "🎭 Saved event"
                      : savedUpdate.type === "alert"
                        ? "⚠️ Saved alert"
                        : "ℹ️ Saved info"}
                  </div>

                  <h3 style={experienceTitle}>
                    {savedUpdate.title?.trim()
                      || savedUpdate.place
                      || "Saved update"}
                  </h3>

                  {savedUpdate.place && (
                    <div style={placeText}>
                      {savedUpdate.place}
                      {savedUpdate.destination
                      && savedUpdate.destination !== savedUpdate.place
                        ? ` · ${savedUpdate.destination}`
                        : ""}
                    </div>
                  )}

                  <p style={commentText}>{savedUpdate.text}</p>

                  {savedUpdate.event_date && (
                    <div style={metaRow}>
                      <span>
                        Related date:{" "}
                        {new Date(savedUpdate.event_date).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div style={metaRow}>
                    <span>
                      Saved{" "}
                      {new Date(savedUpdate.saved_at).toLocaleDateString()}
                    </span>

                    <span>
                      Published{" "}
                      {new Date(
                        savedUpdate.update_created_at
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={actions}>
                    <Link
                      href={`/updates/${savedUpdate.update_id}`}
                      style={primaryLink}
                    >
                      View update
                    </Link>

                    <button
                      type="button"
                      onClick={() => setPendingUpdateRemove(savedUpdate)}
                      disabled={removingUpdateId === savedUpdate.id}
                      style={{
                        ...dangerButton,
                        opacity:
                          removingUpdateId === savedUpdate.id ? 0.5 : 1,
                        cursor:
                          removingUpdateId === savedUpdate.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {removingUpdateId === savedUpdate.id
                        ? "Removing..."
                        : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Trip map</h2>

        <p style={helperText}>
          See the places connected to this trip through saved places,
          experiences, events, useful information and Trust Radar.
        </p>

        <div style={mutedSmall}>
          {tripPlanMapPoints.length}{" "}
          {tripPlanMapPoints.length === 1
            ? "place mapped"
            : "places mapped"}
        </div>

        {tripPlanMapPoints.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              There are no mapped places in this trip yet.
            </p>

            <p style={helperText}>
              Places need geographic coordinates before they can appear on the
              map.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: "18px" }}>
            <TripPlanMap points={tripPlanMapPoints} />
          </div>
        )}

        {tripPlanMapPoints.length > 0 && (
          <p style={mutedSmall}>
            Some saved content may not appear on the map yet if its place does
            not have geographic coordinates.
          </p>
        )}
      </section>

        {pendingRadarRemove && (
          <div style={removeConfirmOverlay}>
            <section style={removeConfirmBox}>
              <div>
                <div style={removeConfirmEyebrow}>
                  Remove from Radar
                </div>

                <h2 style={removeConfirmTitle}>
                  Stop monitoring this place?
                </h2>

                <p style={removeConfirmText}>
                  Trust Radar will stop monitoring this place for this trip. The place
                  itself and any experiences about it will remain available on Trust Travel.
                </p>

                <p style={removeConfirmItem}>
                  {pendingRadarRemove.name}
                </p>
              </div>

              <div style={actions}>
                <button
                  type="button"
                  onClick={() => setPendingRadarRemove(null)}
                  style={secondaryButton}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const placeToRemove = pendingRadarRemove;
                    setPendingRadarRemove(null);
                    await removeRadarWatchedPlace(placeToRemove);
                  }}
                  style={dangerButton}
                >
                  Remove from Radar
                </button>
              </div>
            </section>
          </div>
        )}

      {pendingResourceRemove && (
        <div style={removeConfirmOverlay}>
          <section style={removeConfirmBox}>
            <div>
              <div style={removeConfirmEyebrow}>Remove from trip plan</div>

              <h2 style={removeConfirmTitle}>
                Remove this resource from your trip?
              </h2>

              <p style={removeConfirmText}>
                This will remove the saved link from this trip plan. The
                external website or page itself will not be affected.
              </p>

              <p style={removeConfirmItem}>
                {pendingResourceRemove.title || "Saved resource"}
              </p>
            </div>

            <div style={actions}>
              <button
                type="button"
                onClick={cancelPendingResourceRemove}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPendingResourceRemove}
                style={dangerButton}
              >
                Remove from plan
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingPlaceRemove && (
        <div style={removeConfirmOverlay}>
          <section style={removeConfirmBox}>
            <div>
              <div style={removeConfirmEyebrow}>Remove from trip plan</div>

              <h2 style={removeConfirmTitle}>
                Remove this place from your trip?
              </h2>

              <p style={removeConfirmText}>
                This will only remove the saved place from this trip plan. The
                place itself, its experiences and its updates will remain
                available on Trust Travel.
              </p>

              <p style={removeConfirmItem}>
                {pendingPlaceRemove.name || "Saved place"}
              </p>
            </div>

            <div style={actions}>
              <button
                type="button"
                onClick={cancelPendingPlaceRemove}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPendingPlaceRemove}
                style={dangerButton}
              >
                Remove from plan
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingUpdateRemove && (
        <div style={removeConfirmOverlay}>
          <section style={removeConfirmBox}>
            <div>
              <div style={removeConfirmEyebrow}>Remove from trip plan</div>

              <h2 style={removeConfirmTitle}>
                Remove this update from your trip?
              </h2>

              <p style={removeConfirmText}>
                This will only remove the saved update from this trip plan. The
                original event, alert or information post will remain available
                on Trust Travel.
              </p>

              <p style={removeConfirmItem}>
                {pendingUpdateRemove.title
                  || pendingUpdateRemove.place
                  || "Saved update"}
              </p>
            </div>

            <div style={actions}>
              <button
                type="button"
                onClick={cancelPendingUpdateRemove}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPendingUpdateRemove}
                style={dangerButton}
              >
                Remove from plan
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingRemove && (
        <div style={removeConfirmOverlay}>
          <section style={removeConfirmBox}>
            <div>
              <div style={removeConfirmEyebrow}>Remove from trip plan</div>

              <h2 style={removeConfirmTitle}>
                Remove this experience from your trip?
              </h2>

              <p style={removeConfirmText}>
                This will only remove the experience from this trip plan. The
                original experience will remain available on Trust Travel.
              </p>

              <p style={removeConfirmItem}>
                {pendingRemove.title || pendingRemove.place || "Saved experience"}
              </p>
            </div>

            <div style={actions}>
              <button type="button" onClick={cancelPendingRemove} style={secondaryButton}>
                Cancel
              </button>

              <button type="button" onClick={confirmPendingRemove} style={dangerButton}>
                Remove from plan
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const page = {
  maxWidth: "860px",
  margin: "0 auto",
  padding: "40px",
};

const breadcrumb = {
  marginBottom: "20px",
  color: "#666",
  fontSize: "14px",
};

const breadcrumbLink = {
  color: "#666",
  textDecoration: "none",
};

const heroCard = {
  padding: "24px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "white",
  marginBottom: "28px",
};

const label = {
  fontSize: "13px",
  color: "#777",
};

const titleStyle = {
  margin: "6px 0 0 0",
  fontSize: "30px",
};

const destinationText = {
  margin: "10px 0 0 0",
  color: "#555",
  fontWeight: 600,
};

const descriptionText = {
  margin: "12px 0 0 0",
  color: "#555",
  lineHeight: 1.6,
};

const metaRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  marginTop: "12px",
  color: "#777",
  fontSize: "13px",
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "18px",
};

const primaryButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const primaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const secondaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  textDecoration: "none",
};

const secondaryButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  cursor: "pointer",
};

const dangerButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #f3d1d1",
  background: "#fff5f5",
  color: "#9f1239",
};

const section = {
  display: "grid",
  gap: "14px",
};

const sectionTitle = {
  margin: 0,
  fontSize: "22px",
};

const emptyBox = {
  padding: "22px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
};

const successBox = {
  marginBottom: "18px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "14px",
};

const errorBox = {
  marginBottom: "18px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
  fontSize: "14px",
};

const radarBox = {
  display: "grid",
  gap: "12px",
  padding: "18px",
  borderRadius: "18px",
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  marginBottom: "18px",
};

const radarHeaderRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
};

const radarEyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
  marginBottom: "4px",
};

const radarTitle = {
  margin: 0,
  fontSize: "20px",
};

const radarText = {
  margin: 0,
  color: "#555",
  lineHeight: 1.5,
  fontSize: "14px",
};

const radarMutedText = {
  color: "#777",
  fontSize: "13px",
};

const radarSubsection = {
  display: "grid",
  gap: "10px",
  marginTop: "8px",
};

const radarSubsectionTitle = {
  margin: 0,
  fontSize: "17px",
};

const radarPlacesCompactBox = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const radarPlaceChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 10px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  fontSize: "14px",
};

const radarPlaceChipLink = {
  color: "black",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: "13px",
};

const radarPlaceChipButton = {
  border: "none",
  background: "transparent",
  color: "#9f1239",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "15px",
  padding: 0,
};

const radarSearchRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const radarSearchInput = {
  flex: 1,
  minWidth: "220px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  background: "white",
};

const radarCreateBox = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "white",
  color: "#333",
  fontSize: "14px",
};

const radarSearchResultsBox = {
  display: "grid",
  gap: "8px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "white",
};

const radarSearchResultRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  padding: "8px 0",
  borderBottom: "1px solid #f3f4f6",
};

const compactActions = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const smallPrimaryButton = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
  fontSize: "13px",
};

const smallSecondaryLink = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  color: "black",
  background: "white",
  textDecoration: "none",
  fontSize: "13px",
};

const smallSuccessBadge = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "13px",
  fontWeight: 700,
};

const editPlanBox = {
  display: "grid",
  gap: "14px",
  padding: "20px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "#fafafa",
  marginBottom: "18px",
};

const formLabel = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#444",
};

const textInput = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  background: "white",
};

const textareaInput = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
  background: "white",
  resize: "vertical" as const,
};

const dateGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const helperText = {
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};

const list = {
  display: "grid",
  gap: "16px",
};

const experienceCard = {
  padding: "20px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  display: "grid",
  gap: "14px",
};

const image = {
  width: "100%",
  maxHeight: "260px",
  objectFit: "cover" as const,
  borderRadius: "12px",
  border: "1px solid #eee",
};

const experienceTitle = {
  margin: 0,
  fontSize: "20px",
};

const placeText = {
  color: "#666",
  fontSize: "14px",
};

const rating = {
  color: "#f5b50a",
  fontSize: "18px",
};

const commentText = {
  color: "#222",
  lineHeight: 1.6,
  margin: 0,
};

const muted = {
  color: "#666",
};

const mutedSmall = {
  color: "#666",
  fontSize: "13px",
};

const removeConfirmBox = {
  width: "100%",
  maxWidth: "520px",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #f3c2c2",
  background: "white",
  display: "grid",
  gap: "14px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
};

const removeConfirmEyebrow = {
  fontSize: "13px",
  color: "#991b1b",
  fontWeight: 700,
  marginBottom: "4px",
};

const removeConfirmTitle = {
  margin: 0,
  fontSize: "20px",
  color: "#111",
};

const removeConfirmText = {
  margin: "8px 0 0 0",
  color: "#555",
  lineHeight: 1.5,
  fontSize: "14px",
};

const removeConfirmItem = {
  margin: "10px 0 0 0",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "white",
  border: "1px solid #f3d1d1",
  color: "#111",
  fontWeight: 700,
};

const removeConfirmOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0, 0, 0, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1000,
};

const deleteConfirmBox = {
  padding: "14px",
  border: "1px solid #fecaca",
  borderRadius: "12px",
  backgroundColor: "#fff7f7",
  color: "#7f1d1d",
  fontSize: "13px",
  lineHeight: 1.4,
  marginBottom: "18px",
  display: "grid",
  gap: "12px",
};

const deleteConfirmText = {
  margin: "6px 0 0 0",
  color: "#7f1d1d",
};