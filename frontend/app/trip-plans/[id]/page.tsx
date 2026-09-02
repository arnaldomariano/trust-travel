"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";

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
  saved_at: string;
  update_created_at: string;
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
  created_at: string;
  updated_at: string;
  saved_items: SavedItem[];
  saved_places: SavedPlace[];
  saved_updates: SavedUpdate[];
};

type RadarPlace = {
  id: number;
  name: string;
  place_type: string;
  city: string;
  destination_id?: number;
  destination_name: string;
  destination_country: string;
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

export default function TripPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [plan, setPlan] = useState<TripPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  const [removingUpdateId, setRemovingUpdateId] = useState<number | null>(null);
  const [pendingUpdateRemove, setPendingUpdateRemove] =
    useState<SavedUpdate | null>(null);

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

  const savedUpdatesCount =
    plan?.saved_updates_count ?? plan?.saved_updates.length ?? 0;

  const watchedPlaces = radar?.watched_places ?? [];

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
            + (prev.saved_updates?.length || 0),
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
            + updatedSavedUpdates.length,
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
            {savedUpdatesCount} saved event/info
            {savedUpdatesCount === 1 ? "" : "s"}
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

          <button type="button" onClick={startEditingPlan} style={secondaryButton}>
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
        </div>
      </section>

      {showDeletePlanConfirm && (
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