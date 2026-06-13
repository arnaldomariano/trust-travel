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

type TripPlanDetail = {
  id: number;
  title: string;
  destination_text: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  saved_count: number;
  saved_items_count?: number;
  saved_places_count?: number;
  created_at: string;
  updated_at: string;
  saved_items: SavedItem[];
  saved_places: SavedPlace[];
};

type TripSuggestion = {
  experience_id: number;
  title: string;
  comment: string;
  rating: number | null;
  image_url: string | null;
  place: string;
  place_id: number;
  place_type: string;
  destination: string;
  created_at: string;
  already_saved: boolean;
};

type RelatedPlace = {
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
  already_saved_in_plan: boolean;
};

type RadarPlace = {
  id: number;
  name: string;
  place_type: string;
  city: string;
  destination_id: number;
  destination_name: string;
  destination_country: string;
  is_saved: boolean;
  created_at: string;
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

export default function TripPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [plan, setPlan] = useState<TripPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);

  const [pendingRemove, setPendingRemove] = useState<{
    type: "experience" | "place";
    item: SavedItem | SavedPlace;
  } | null>(null);

  const [suggestions, setSuggestions] = useState<TripSuggestion[]>([]);
  const [relatedPlaces, setRelatedPlaces] = useState<RelatedPlace[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);


  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaceType, setSelectedPlaceType] = useState("");
  const [addingSuggestionId, setAddingSuggestionId] = useState<number | null>(null);

  const [savingPlaceId, setSavingPlaceId] = useState<number | null>(null);
  const [removingPlaceId, setRemovingPlaceId] = useState<number | null>(null);

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [radar, setRadar] = useState<TripRadar | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarFilter, setRadarFilter] = useState<
    "all" | "experiences" | "places" | "updates"
  >("all");

  const [editingPlan, setEditingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDestinationText, setEditDestinationText] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const availableSuggestions = suggestions.filter(
  (suggestion) => !suggestion.already_saved
  );

  const clearActionFeedback = () => {
    setActionMessage("");
    setActionError("");
  };

  const startEditingPlan = () => {
    if (!plan) return;

    clearActionFeedback();

    setEditTitle(plan.title || "");
    setEditDestinationText(plan.destination_text || "");
    setEditDescription(plan.description || "");
    setEditStartDate(plan.start_date || "");
    setEditEndDate(plan.end_date || "");

    setEditingPlan(true);
  };

  const cancelEditingPlan = () => {
    setEditingPlan(false);
    clearActionFeedback();
  };

  const placeTypeFilters = [
      { value: "", label: "All" },
      { value: "country", label: "Countries" },
      { value: "city", label: "Cities" },
      { value: "attraction", label: "Attractions" },
      { value: "hotel", label: "Hotels" },
      { value: "restaurant", label: "Restaurants" },
      { value: "nature", label: "Nature" },
    ];

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

const loadSuggestions = async () => {
  if (!id) return;

  setSuggestionsLoading(true);

  try {
    const params = new URLSearchParams();

    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }

    if (selectedPlaceType) {
      params.set("place_type", selectedPlaceType);
    }

    const queryString = params.toString();
    const url = `${API_URL}/api/trip-plans/${id}/suggestions/${
      queryString ? `?${queryString}` : ""
    }`;

    const res = await fetch(url, {
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load trip suggestions:", res.status, text);
      setSuggestions([]);
      setRelatedPlaces([]);
      return;
    }

    const data = await res.json();

    setSuggestions(Array.isArray(data.experiences) ? data.experiences : []);
    setRelatedPlaces(Array.isArray(data.places) ? data.places : []);

  } catch (error) {
    console.error("Trip suggestions fetch error:", error);
    setSuggestions([]);
    setRelatedPlaces([]);
  } finally {
    setSuggestionsLoading(false);
  }
};

  useEffect(() => {
  loadPlan();
  loadRadar();
}, [id]);

    useEffect(() => {
      if (!id) return;
      loadSuggestions();
    }, [id, selectedPlaceType]);

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
          saved_count: updatedItems.length + (prev.saved_places?.length || 0),
        };
      });

      setActionMessage("Experience removed from this trip plan.");

      await loadSuggestions();

    } catch (error) {
      console.error("Failed to remove experience from trip plan:", error);
      setActionError("Error removing experience from plan.");
    } finally {
      setRemovingItemId(null);
    }
  };

const addSuggestionToPlan = async (suggestion: TripSuggestion) => {
  if (!plan) return;

  clearActionFeedback();

  setAddingSuggestionId(suggestion.experience_id);

  try {
    const res = await fetch(
      `${API_URL}/api/trip-plans/${plan.id}/experiences/${suggestion.experience_id}/`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Add suggestion to trip plan error:", data);
      setActionError(data.detail || "Error adding experience to plan.");
      return;
    }

    await loadPlan();
    await loadSuggestions();
    await loadRadar();

    setActionMessage("Experience added to this trip plan.");

    } catch (error) {
    console.error("Failed to add suggestion to trip plan:", error);
    setActionError("Error adding experience to plan.");
    } finally {
    setAddingSuggestionId(null);
  }
};

const savePlaceToPlan = async (place: RelatedPlace) => {
  if (!plan) return;

  clearActionFeedback();
  setSavingPlaceId(place.place_id);

  try {
    const res = await fetch(
      `${API_URL}/api/trip-plans/${plan.id}/places/${place.place_id}/`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Save place to trip plan error:", data);
      setActionError(data.detail || "Error saving place to this trip plan.");
      return;
    }

    await loadPlan();
    await loadSuggestions();
    await loadRadar();

    setActionMessage(`${place.name} saved to this trip plan.`);
  } catch (error) {
    console.error("Failed to save place to trip plan:", error);
    setActionError("Error saving place to this trip plan.");
  } finally {
    setSavingPlaceId(null);
  }
};

const saveRadarExperienceToPlan = async (experience: RadarExperience) => {
  if (!plan) return;

  clearActionFeedback();
  setAddingSuggestionId(experience.id);

  try {
    const res = await fetch(
      `${API_URL}/api/trip-plans/${plan.id}/experiences/${experience.id}/`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Add radar experience to trip plan error:", data);
      setActionError(data.detail || "Error adding experience to this trip plan.");
      return;
    }

    await loadPlan();
    await loadSuggestions();
    await loadRadar();

    setActionMessage("Experience added to this trip plan.");
  } catch (error) {
    console.error("Failed to add radar experience to trip plan:", error);
    setActionError("Error adding experience to this trip plan.");
  } finally {
    setAddingSuggestionId(null);
  }
};

const saveRadarPlaceToPlan = async (place: RadarPlace) => {
  if (!plan) return;

  clearActionFeedback();
  setSavingPlaceId(place.id);

  try {
    const res = await fetch(
      `${API_URL}/api/trip-plans/${plan.id}/places/${place.id}/`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Save radar place to trip plan error:", data);
      setActionError(data.detail || "Error saving place to this trip plan.");
      return;
    }

    await loadPlan();
    await loadSuggestions();
    await loadRadar();

    setActionMessage(`${place.name} saved to this trip plan.`);
  } catch (error) {
    console.error("Failed to save radar place to trip plan:", error);
    setActionError("Error saving place to this trip plan.");
  } finally {
    setSavingPlaceId(null);
  }
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
      setActionError(data.detail || "Error removing place from this trip plan.");
      return;
    }

    setPlan((prev) => {
      if (!prev) return prev;

      const updatedPlaces = (prev.saved_places || []).filter(
        (place) => place.id !== savedPlace.id
      );

      return {
        ...prev,
        saved_places: updatedPlaces,
        saved_places_count: updatedPlaces.length,
        saved_count: (prev.saved_items?.length || 0) + updatedPlaces.length,
      };
    });

    await loadSuggestions();
    await loadRadar();

    setActionMessage("Place removed from this trip plan.");
  } catch (error) {
    console.error("Failed to remove place from trip plan:", error);
    setActionError("Error removing place from this trip plan.");
  } finally {
    setRemovingPlaceId(null);
  }
};

const confirmPendingRemove = async () => {
  if (!pendingRemove) return;

  const itemToRemove = pendingRemove;
  setPendingRemove(null);

  if (itemToRemove.type === "experience") {
    await removeExperienceFromPlan(itemToRemove.item as SavedItem);
    return;
  }

  if (itemToRemove.type === "place") {
    await removePlaceFromPlan(itemToRemove.item as SavedPlace);
  }
};

const cancelPendingRemove = () => {
  setPendingRemove(null);
};

const saveTripPlanChanges = async () => {
  if (!plan) return;

  clearActionFeedback();

  const title = editTitle.trim();

  if (!title) {
    setActionError("Trip plan title is required.");
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
        destination_text: editDestinationText.trim(),
        description: editDescription.trim(),
        start_date: editStartDate || null,
        end_date: editEndDate || null,
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

  const confirmed = window.confirm(
    "Delete this trip plan? This will remove the plan and all saved items inside it."
  );

  if (!confirmed) return;

  clearActionFeedback();
  setDeletingPlan(true);

  try {
    const res = await fetch(`${API_URL}/api/trip-plans/${plan.id}/`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Delete trip plan error:", data);
      setActionError(data.detail || "Could not delete this trip plan.");
      return;
    }

    router.push("/trip-plans");
  } catch (error) {
    console.error("Failed to delete trip plan:", error);
    setActionError("Something went wrong while deleting this trip plan.");
  } finally {
    setDeletingPlan(false);
  }
};

const resetSuggestionsSearch = async () => {
  setSearchQuery("");
  setSelectedPlaceType("");

  setTimeout(() => {
    loadSuggestions();
  }, 0);
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

        {plan.destination_text && (
          <p style={destinationText}>{plan.destination_text}</p>
        )}

        {plan.description && <p style={descriptionText}>{plan.description}</p>}

        <div style={metaRow}>
         <span>
          {plan.saved_count} saved item{plan.saved_count === 1 ? "" : "s"}
        </span>

        <span>
          {plan.saved_items_count ?? plan.saved_items.length} experience
          {(plan.saved_items_count ?? plan.saved_items.length) === 1 ? "" : "s"}
        </span>

        <span>
          {plan.saved_places_count ?? plan.saved_places?.length ?? 0} place
          {(plan.saved_places_count ?? plan.saved_places?.length ?? 0) === 1 ? "" : "s"}
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

          <button
            type="button"
            onClick={startEditingPlan}
            style={secondaryButton}
          >
            Edit trip plan
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
            {deletingPlan ? "Deleting..." : "Delete trip plan"}
          </button>
        </div>


      </section>

<section style={radarBox}>
  <div style={radarHeaderRow}>
    <div>
      <div style={radarEyebrow}>Trust Radar</div>
      <h2 style={radarTitle}>Watching this trip</h2>
    </div>

    {radarLoading && <span style={radarMutedText}>Checking...</span>}
  </div>

  {radar && radar.query ? (
    <>
      <p style={radarText}>
        Trust Radar is watching <strong>{radar.query}</strong> for related
        experiences, places, alerts and updates.
      </p>

      {radar.has_related_content ? (
       <div style={radarStatsRow}>
          <button
            type="button"
            onClick={() => setRadarFilter("all")}
            style={{
              ...radarStatButton,
              ...(radarFilter === "all" ? radarStatButtonActive : {}),
            }}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setRadarFilter("experiences")}
            style={{
              ...radarStatButton,
              ...(radarFilter === "experiences" ? radarStatButtonActive : {}),
            }}
          >
            {radar.related_experiences_count} experiences
          </button>

          <button
            type="button"
            onClick={() => setRadarFilter("places")}
            style={{
              ...radarStatButton,
              ...(radarFilter === "places" ? radarStatButtonActive : {}),
            }}
          >
            {radar.related_places_count} places
          </button>

          <button
            type="button"
            onClick={() => setRadarFilter("updates")}
            style={{
              ...radarStatButton,
              ...(radarFilter === "updates" ? radarStatButtonActive : {}),
            }}
          >
            {radar.related_updates_count} updates
          </button>
        </div>
      ) : (
        <p style={radarText}>
          No related content found yet. When travelers share experiences, alerts,
          events or useful information about this trip, Trust Radar will help
          surface it here.
        </p>
      )}

      {(radarFilter === "all" || radarFilter === "experiences") &&
        radar.recommended_experiences?.length > 0 && (
        <div style={radarSubsection}>
          <h3 style={radarSubsectionTitle}>Recommended experiences</h3>

          <p style={radarSmallText}>
            Experiences related to this trip that are not saved in your plan yet.
          </p>

          <div style={radarMiniList}>
            {radar.recommended_experiences.slice(0, 4).map((experience) => (
              <article key={experience.id} style={radarMiniCard}>
                <div style={label}>Experience</div>

                <h4 style={radarMiniTitle}>
                  {experience.title || experience.place_name || "Experience"}
                </h4>

                <div style={placeText}>
                  {experience.place_name}
                  {experience.destination_name &&
                  experience.destination_name !== experience.place_name
                    ? ` · ${experience.destination_name}`
                    : ""}
                </div>

                {experience.rating && (
                  <div style={rating}>
                    {"★".repeat(experience.rating)}
                    {"☆".repeat(5 - experience.rating)}
                  </div>
                )}

                <p style={radarMiniText}>
                  {(experience.comment || "").slice(0, 180)}
                  {(experience.comment || "").length > 180 ? "..." : ""}
                </p>

                <div style={actions}>
                  <Link
                    href={`/experiences/${experience.id}`}
                    style={secondaryLink}
                  >
                    View experience
                  </Link>

                  <Link
                    href={`/places/${experience.place_id}/experiences?highlight=${experience.id}`}
                    style={secondaryLink}
                  >
                    View in place
                  </Link>

                  {experience.is_saved ? (
                    <span style={alreadySavedBadge}>
                      Already saved
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => saveRadarExperienceToPlan(experience)}
                      disabled={addingSuggestionId === experience.id}
                      style={{
                        ...primaryButton,
                        opacity: addingSuggestionId === experience.id ? 0.5 : 1,
                        cursor:
                          addingSuggestionId === experience.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {addingSuggestionId === experience.id
                        ? "Adding..."
                        : "Add to this trip"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {(radarFilter === "all" || radarFilter === "places") &&
          radar.related_places?.length > 0 && (
        <div style={radarSubsection}>
          <h3 style={radarSubsectionTitle}>Places to watch</h3>

          <p style={radarSmallText}>
            Places related to this trip. Save the ones you may want to follow.
          </p>

              <div style={radarMiniList}>
                  {radar.related_places.slice(0, 6).map((place) => {
                    const savedPlaceForRadarPlace = plan.saved_places?.find(
                      (savedPlace) => savedPlace.place_id === place.id
                    );

                    return (
                      <article key={place.id} style={radarMiniCard}>
                        <div style={label}>Place</div>

                        <h4 style={radarMiniTitle}>{place.name}</h4>

                        <div style={placeText}>
                          {place.place_type}
                          {place.destination_name && place.destination_name !== place.name
                            ? ` · ${place.destination_name}`
                            : ""}
                          {place.destination_country
                            ? ` · ${place.destination_country}`
                            : ""}
                        </div>

                        <div style={actions}>
                          <Link
                            href={`/places/${place.id}/experiences`}
                            style={primaryLink}
                          >
                            View experiences
                          </Link>

                          {place.is_saved ? (
                            <>
                              <span style={alreadySavedBadge}>
                                Already saved
                              </span>

                              {savedPlaceForRadarPlace && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingRemove({
                                      type: "place",
                                      item: savedPlaceForRadarPlace,
                                    })
                                  }
                                  disabled={removingPlaceId === savedPlaceForRadarPlace.id}
                                  style={{
                                    ...dangerButton,
                                    opacity:
                                      removingPlaceId === savedPlaceForRadarPlace.id ? 0.5 : 1,
                                    cursor:
                                      removingPlaceId === savedPlaceForRadarPlace.id
                                        ? "not-allowed"
                                        : "pointer",
                                  }}
                                >
                                  {removingPlaceId === savedPlaceForRadarPlace.id
                                    ? "Removing..."
                                    : "Remove from trip"}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => saveRadarPlaceToPlan(place)}
                              disabled={savingPlaceId === place.id}
                              style={{
                                ...secondaryButton,
                                opacity: savingPlaceId === place.id ? 0.5 : 1,
                                cursor:
                                  savingPlaceId === place.id
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              {savingPlaceId === place.id
                                ? "Saving..."
                                : "Save place"}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
            </div>
          )}

          {(radarFilter === "all" || radarFilter === "updates") &&
            radar.related_updates?.length > 0 && (
            <div style={radarSubsection}>
              <h3 style={radarSubsectionTitle}>Alerts, events and useful info</h3>

              <p style={radarSmallText}>
                Updates related to this trip destination.
              </p>

              <div style={radarMiniList}>
                {radar.related_updates.slice(0, 4).map((update) => (
                  <article key={update.id} style={radarMiniCard}>
                    <div style={label}>
                      {update.type} · {update.category}
                    </div>

                    <h4 style={radarMiniTitle}>
                      {update.title || update.place_name || "Update"}
                    </h4>

                    <div style={placeText}>
                      {update.place_name}
                      {update.destination_name &&
                      update.destination_name !== update.place_name
                        ? ` · ${update.destination_name}`
                        : ""}
                    </div>

                    <p style={radarMiniText}>
                      {(update.text || "").slice(0, 180)}
                      {(update.text || "").length > 180 ? "..." : ""}
                    </p>

                    {update.event_date && (
                      <div style={radarSmallText}>
                        Date: {new Date(update.event_date).toLocaleDateString()}
                      </div>
                    )}

                    <div style={actions}>
                      <Link
                        href={`/places/${update.place_id}/experiences`}
                        style={secondaryLink}
                      >
                        Open place
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={radarText}>
          Add a destination or theme to this trip plan so Trust Radar can watch for
          related experiences, places, alerts and updates.
        </p>
      )}
    </section>



      {editingPlan && (
        <section style={editPlanBox}>
          <div>
            <h2 style={sectionTitle}>Edit trip plan</h2>
            <p style={helperText}>
              Update the basic details of this trip plan.
            </p>
          </div>

          <label style={formLabel}>
            Title
            <input
              type="text"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="Trip plan title"
              style={textInput}
            />
          </label>

          <label style={formLabel}>
            Destination
            <input
              type="text"
              value={editDestinationText}
              onChange={(event) => setEditDestinationText(event.target.value)}
              placeholder="Destination, city or country"
              style={textInput}
            />
          </label>

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

            <button
              type="button"
              onClick={cancelEditingPlan}
              style={secondaryButton}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {actionMessage && (
        <div style={successBox}>
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div style={errorBox}>
          {actionError}
        </div>
      )}

      <section style={section}>
        <h2 style={sectionTitle}>Saved experiences</h2>

        {plan.saved_items.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This plan does not have any saved experiences yet.
            </p>

            <p style={helperText}>
              Open a place or experience and add useful recommendations to this
              trip plan.
            </p>

            <button
              type="button"
              onClick={() => {
                const element = document.getElementById("trip-ideas");
                element?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={primaryButton}
            >
              Explore ideas for this trip
            </button>
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
                      {new Date(
                        item.experience_created_at
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={actions}>
                    <Link
                      href={`/experiences/${item.experience_id}`}
                      style={primaryLink}
                    >
                      View experience
                    </Link>

                    <Link
                      href={`/places/${item.place_id}/experiences?highlight=${item.experience_id}`}
                      style={secondaryLink}
                    >
                      View in place
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        setPendingRemove({
                          type: "experience",
                          item,
                        })
                      }
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
        <h2 style={sectionTitle}>Saved places</h2>

        {!plan.saved_places || plan.saved_places.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              This plan does not have any saved places yet.
            </p>

            <p style={helperText}>
              Save places you may want to visit, even before there are experiences about
              them. Trust Radar will help you notice when related content appears.
            </p>
          </div>
        ) : (
          <div style={list}>
            {plan.saved_places.map((savedPlace) => (
              <article key={savedPlace.id} style={placeSuggestionCard}>
                <div style={label}>Saved place</div>

                <h3 style={experienceTitle}>{savedPlace.name}</h3>

                <div style={placeText}>
                  {savedPlace.place_type}
                  {savedPlace.destination && savedPlace.destination !== savedPlace.name
                    ? ` · ${savedPlace.destination}`
                    : ""}
                  {savedPlace.destination_country
                    ? ` · ${savedPlace.destination_country}`
                    : ""}
                </div>

                {savedPlace.has_related_content ? (
                  <div style={alreadyRelatedText}>
                    Trust Radar found {savedPlace.related_experiences_count} related experience
                    {savedPlace.related_experiences_count === 1 ? "" : "s"} and{" "}
                    {savedPlace.related_updates_count} update
                    {savedPlace.related_updates_count === 1 ? "" : "s"} for this place.
                  </div>
                ) : (
                  <div style={watchingPlaceText}>
                      No related content yet. Trust Radar is watching this place for future
                      experiences, alerts and updates.
                    </div>
                )}

                <div style={actions}>
                  <Link
                    href={`/places/${savedPlace.place_id}`}
                    style={secondaryLink}
                  >
                    View place
                  </Link>

                  <Link
                    href={`/places/${savedPlace.place_id}/experiences`}
                    style={primaryLink}
                  >
                    View experiences
                  </Link>

                  <button
                      type="button"
                      onClick={() =>
                        setPendingRemove({
                          type: "place",
                          item: savedPlace,
                        })
                      }
                      disabled={removingPlaceId === savedPlace.id}
                      style={{
                        ...dangerButton,
                        opacity: removingPlaceId === savedPlace.id ? 0.5 : 1,
                        cursor:
                          removingPlaceId === savedPlace.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {removingPlaceId === savedPlace.id ? "Removing..." : "Remove"}
                    </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="trip-ideas" style={suggestionsSection}>
        <div>
          <h2 style={sectionTitle}>Find ideas for this trip</h2>
          <p style={helperText}>
            Search destinations, places, restaurants, attractions or travel
            experiences and add useful ideas directly to this plan.
          </p>
        </div>

        <div style={searchRow}>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              plan.destination_text
                ? `Search ideas for ${plan.destination_text}`
                : "Search destination, place or keyword"
            }
            style={searchInput}
          />

          <button
            type="button"
            onClick={loadSuggestions}
            style={primaryButton}
          >
            Search
          </button>
        </div>

        <div style={filterRow}>
          {placeTypeFilters.map((filter) => {
            const isActive = selectedPlaceType === filter.value;

            return (
              <button
                key={filter.value || "all"}
                type="button"
                onClick={() => setSelectedPlaceType(filter.value)}
                style={{
                  ...filterButton,
                  ...(isActive ? activeFilterButton : {}),
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {suggestionsLoading ? (
          <div style={emptyBox}>Loading suggestions...</div>
        ) : availableSuggestions.length === 0 && relatedPlaces.length === 0 ? (
          <div style={emptyBox}>
            <p style={{ marginTop: 0 }}>
              No new suggestions found.
            </p>

            <p style={helperText}>
              Everything found for this search may already be saved in this trip plan,
              or Trust Radar has not found matching experiences or places yet.
            </p>

            <div style={actions}>
              <button
                type="button"
                onClick={resetSuggestionsSearch}
                style={secondaryLink}
              >
                Reset search
              </button>

              <Link href="/" style={primaryLink}>
                Explore feed
              </Link>
            </div>
          </div>
       ) : (
          <div style={list}>
            {availableSuggestions.length > 0 && (
              <div style={suggestionGroup}>
                <h3 style={suggestionGroupTitle}>Suggested experiences for this trip</h3>
                <p style={suggestionGroupIntro}>
                  Experiences already shared by travelers that may help you decide what to add
                  to this plan.
                </p>

                {availableSuggestions.map((suggestion) => (
                  <article key={suggestion.experience_id} style={experienceCard}>
                    {suggestion.image_url && (
                      <img
                        src={suggestion.image_url}
                        alt={suggestion.title || "Trip suggestion"}
                        style={image}
                      />
                    )}

                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={label}>Experience suggestion</div>

                      <h3 style={experienceTitle}>
                        {suggestion.title || suggestion.place || "Experience"}
                      </h3>

                      <div style={placeText}>
                        {suggestion.place}
                        {suggestion.destination &&
                        suggestion.destination !== suggestion.place
                          ? ` · ${suggestion.destination}`
                          : ""}
                      </div>

                      {suggestion.rating && (
                        <div style={rating}>
                          {"★".repeat(suggestion.rating)}
                          {"☆".repeat(5 - suggestion.rating)}
                        </div>
                      )}

                      <p style={commentText}>{suggestion.comment}</p>

                      <div style={actions}>
                        <Link
                          href={`/experiences/${suggestion.experience_id}`}
                          style={secondaryLink}
                        >
                          View experience
                        </Link>

                        <Link
                          href={`/places/${suggestion.place_id}/experiences?highlight=${suggestion.experience_id}`}
                          style={secondaryLink}
                        >
                          View in place
                        </Link>

                        <button
                          type="button"
                          onClick={() => addSuggestionToPlan(suggestion)}
                          disabled={addingSuggestionId === suggestion.experience_id}
                          style={{
                            ...primaryButton,
                            opacity:
                              addingSuggestionId === suggestion.experience_id
                                ? 0.5
                                : 1,
                            cursor:
                              addingSuggestionId === suggestion.experience_id
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {addingSuggestionId === suggestion.experience_id
                            ? "Adding..."
                            : "Add to this trip"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {relatedPlaces.length > 0 && (
              <div style={suggestionGroup}>
                <h3 style={suggestionGroupTitle}>Places to watch with Trust Radar</h3>

                <p style={watchPlacesIntro}>
                  Save places you may want to visit, even if they do not have experiences yet.
                  Trust Radar will watch for future experiences, alerts, events and useful updates.
                </p>

                {relatedPlaces.map((place) => (
                  <article key={place.place_id} style={placeSuggestionCard}>
                    <div style={label}>Place monitored by Trust Radar</div>

                    <h3 style={experienceTitle}>{place.name}</h3>

                    <div style={placeText}>
                      {place.place_type}
                      {place.destination && place.destination !== place.name
                        ? ` · ${place.destination}`
                        : ""}
                      {place.destination_country
                        ? ` · ${place.destination_country}`
                        : ""}
                    </div>

                    {place.already_saved_place && (
                      <div style={alreadyRelatedText}>
                        This place is already saved in this trip plan.
                      </div>
                    )}

                    {place.already_saved_in_plan ? (
                      <div style={alreadyRelatedText}>
                        Already saved in this trip.
                      </div>
                    ) : place.already_has_saved_experience ? (
                      <div style={alreadyRelatedText}>
                        You already saved an experience from this place.
                      </div>
                    ) : null}

                    <div style={actions}>
                      <Link
                        href={`/places/${place.place_id}`}
                        style={secondaryLink}
                      >
                        View place
                      </Link>

                      <Link
                        href={`/places/${place.place_id}/experiences`}
                        style={primaryLink}
                      >
                        View experiences
                      </Link>

                      {place.already_in_trip_plan ? (
                          <span style={alreadySavedBadge}>
                            Already in this trip
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => savePlaceToPlan(place)}
                            disabled={savingPlaceId === place.place_id}
                            style={{
                              ...secondaryButton,
                              opacity: savingPlaceId === place.place_id ? 0.5 : 1,
                              cursor:
                                savingPlaceId === place.place_id
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {savingPlaceId === place.place_id
                              ? "Saving..."
                              : "Save place to this trip"}
                          </button>
                        )}

                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

        {pendingRemove && (
          <div style={removeConfirmOverlay}>
            <section style={removeConfirmBox}>
              <div>
                <div style={removeConfirmEyebrow}>
                  Remove from trip plan
                </div>

                <h2 style={removeConfirmTitle}>
                  {pendingRemove.type === "experience"
                    ? "Remove this experience from your trip?"
                    : "Remove this place from your trip?"}
                </h2>

                <p style={removeConfirmText}>
                  {pendingRemove.type === "experience"
                    ? "This will only remove the experience from this trip plan. The original experience will remain available on Trust Travel."
                    : "This will only remove the place from this trip plan. The place and its related experiences will remain available on Trust Travel."}
                </p>

                <p style={removeConfirmItem}>
                  {pendingRemove.type === "experience"
                    ? (pendingRemove.item as SavedItem).title ||
                      (pendingRemove.item as SavedItem).place ||
                      "Saved experience"
                    : (pendingRemove.item as SavedPlace).name || "Saved place"}
                </p>
              </div>

              <div style={actions}>
                <button
                  type="button"
                  onClick={cancelPendingRemove}
                  style={secondaryButton}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmPendingRemove}
                  style={dangerButton}
                >
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

const radarStatsRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const radarStatButton = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  color: "#333",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const radarStatButtonActive = {
  background: "black",
  color: "white",
  border: "1px solid black",
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

const radarSmallText = {
  margin: 0,
  color: "#666",
  fontSize: "13px",
  lineHeight: 1.5,
};

const radarMiniList = {
  display: "grid",
  gap: "10px",
};

const radarMiniCard = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "white",
  display: "grid",
  gap: "8px",
};

const radarMiniTitle = {
  margin: 0,
  fontSize: "16px",
};

const radarMiniText = {
  margin: 0,
  color: "#333",
  fontSize: "14px",
  lineHeight: 1.5,
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

const suggestionsSection = {
  display: "grid",
  gap: "14px",
  padding: "20px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "#fafafa",
  marginBottom: "28px",
};

const suggestionGroup = {
  display: "grid",
  gap: "12px",
};

const suggestionGroupTitle = {
  margin: "4px 0 0 0",
  fontSize: "18px",
};

const suggestionGroupIntro = {
  margin: "0 0 4px 0",
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};

const watchPlacesIntro = {
  margin: "0 0 4px 0",
  color: "#666",
  fontSize: "14px",
  lineHeight: 1.5,
};

const placeSuggestionCard = {
  padding: "18px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  display: "grid",
  gap: "8px",
};

const alreadyRelatedText = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "13px",
};

const searchRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const searchInput = {
  flex: 1,
  minWidth: "240px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const filterRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const filterButton = {
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  color: "#444",
  cursor: "pointer",
  fontSize: "13px",
};

const activeFilterButton = {
  background: "black",
  color: "white",
  border: "1px solid black",
};

const watchingPlaceText = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#555",
  fontSize: "13px",
};

const alreadySavedBadge = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  fontSize: "14px",
  fontWeight: 700,
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