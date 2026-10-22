type PoiResolutionError = {
  code?: string;
  reason?: string;
  detail?: string;
  candidate_place_ids?: number[];
};

export function getPoiMaterializationError(
  status: number,
  data: PoiResolutionError,
  fallbackMessage = "Could not add this specific place."
): string {
  if (status !== 409 || data?.code !== "poi_resolution_required") {
    return data?.detail || fallbackMessage;
  }

  if (data.reason === "unresolved_identity") {
    return (
      "A place with a matching name may already exist here. " +
      "Please check the existing place before creating another one."
    );
  }

  if (data.reason === "external_identity_context_conflict") {
    return (
      "This place is already associated with a different location " +
      "or category. It cannot be added here automatically."
    );
  }

  return "This place needs confirmation before it can be added.";
}
