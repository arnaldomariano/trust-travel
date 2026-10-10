from math import atan2, cos, radians, sin, sqrt

from ..place_utils import (
    get_place_name_identity_values,
    normalize_place_text,
)


def discovery_candidates_have_admin_context_conflict(
    first_candidate,
    second_candidate,
):
    """
    Return whether shared administrative levels contain conflicting names.

    Missing administrative levels do not establish a conflict.
    """
    first_context = {
        entry.get("level"): normalize_place_text(
            entry.get("name")
        )
        for entry in (
            first_candidate.get("admin_context") or []
        )
        if (
            entry.get("level") is not None
            and normalize_place_text(entry.get("name"))
        )
    }
    second_context = {
        entry.get("level"): normalize_place_text(
            entry.get("name")
        )
        for entry in (
            second_candidate.get("admin_context") or []
        )
        if (
            entry.get("level") is not None
            and normalize_place_text(entry.get("name"))
        )
    }

    shared_levels = (
        first_context.keys()
        & second_context.keys()
    )

    return any(
        first_context[level] != second_context[level]
        for level in shared_levels
    )


def discovery_candidate_expands_query_identity(
    candidate,
    query,
):
    """
    Return whether a candidate identity adds tokens to the full query.

    Query expansion is suggestion evidence only. It does not establish
    entity identity, geographic correspondence, or materialization safety.
    """
    normalized_query = normalize_place_text(query)

    if not normalized_query:
        return False

    query_tokens = set(normalized_query.split())

    candidate_values = get_place_name_identity_values(
        candidate.get("name"),
        candidate.get("canonical_name"),
        candidate.get("aliases"),
    )

    return any(
        query_tokens < set(candidate_value.split())
        for candidate_value in candidate_values
    )


def discovery_candidates_share_admin_context_evidence(
    first_candidate,
    second_candidate,
):
    """
    Return whether a shared administrative level has the same name.

    Missing or non-overlapping administrative levels do not establish
    positive context evidence.
    """
    first_context = {
        entry.get("level"): normalize_place_text(
            entry.get("name")
        )
        for entry in (
            first_candidate.get("admin_context") or []
        )
        if (
            entry.get("level") is not None
            and normalize_place_text(entry.get("name"))
        )
    }
    second_context = {
        entry.get("level"): normalize_place_text(
            entry.get("name")
        )
        for entry in (
            second_candidate.get("admin_context") or []
        )
        if (
            entry.get("level") is not None
            and normalize_place_text(entry.get("name"))
        )
    }

    shared_levels = (
        first_context.keys()
        & second_context.keys()
    )

    return any(
        first_context[level] == second_context[level]
        for level in shared_levels
    )


def discovery_candidate_is_suggestion_for_anchor(
    candidate,
    anchor,
    query,
):
    """
    Return whether a candidate is a plausible refinement of an anchor.

    The anchor is expected to have been validated by the discovery layer.
    This relation is suggestion evidence only and does not establish entity
    identity, materialization safety, or presentation actionability.
    """
    return (
        discovery_candidate_expands_query_identity(
            candidate,
            query,
        )
        and discovery_candidates_share_admin_context_evidence(
            candidate,
            anchor,
        )
        and not discovery_candidates_have_admin_context_conflict(
            candidate,
            anchor,
        )
    )


def group_known_reference_evidence(candidates):
    """Group evidence already linked to the same Trust Travel Place.

    Only an existing Place ID establishes membership in a reference evidence
    group. This function does not infer identity from names or other evidence.
    """
    groups = {}

    for candidate in candidates:
        existing_place_id = candidate.get(
            "existing_place_id"
        )

        if existing_place_id is None:
            continue

        groups.setdefault(
            existing_place_id,
            [],
        ).append(candidate)

    return groups


def get_candidate_evaluation_strategies(candidate):
    """
    Return evidence-evaluation strategies activated by candidate classification.

    Strategies guide resolution behavior. They are not persisted place types
    and do not establish entity identity or materialization eligibility.
    Multiple classification signals may activate multiple strategies.
    """
    strategies = set()

    geographic_type = str(
        candidate.get("geographic_type") or ""
    ).strip().lower()

    if geographic_type == "settlement":
        strategies.add("localized")

    provider_types = {
        str(provider_type or "").strip().lower()
        for provider_type in (
            candidate.get("provider_types") or []
        )
        if str(provider_type or "").strip()
    }

    if "natural_feature" in provider_types:
        strategies.update(
            {
                "feature",
                "area",
            }
        )

    return strategies


def get_admin_context_evidence_observation(
    candidate,
    reference,
):
    """
    Describe comparable administrative evidence without interpreting identity.

    Evidence is preserved by administrative level so evaluation strategies can
    decide later whether agreement or divergence is meaningful for the entity.
    Missing or non-overlapping levels produce no comparable evidence.
    """
    candidate_context = {
        entry.get("level"): normalize_place_text(
            entry.get("name")
        )
        for entry in (candidate.get("admin_context") or [])
        if (
            entry.get("level") is not None
            and normalize_place_text(entry.get("name"))
        )
    }
    reference_context = {
        entry.get("level"): normalize_place_text(
            entry.get("name")
        )
        for entry in (reference.get("admin_context") or [])
        if (
            entry.get("level") is not None
            and normalize_place_text(entry.get("name"))
        )
    }

    shared_levels = sorted(
        candidate_context.keys()
        & reference_context.keys()
    )

    compatible_levels = []
    divergent_levels = []

    for level in shared_levels:
        if (
            candidate_context[level]
            == reference_context[level]
        ):
            compatible_levels.append(level)
        else:
            divergent_levels.append(level)

    return {
        "compatible_levels": compatible_levels,
        "divergent_levels": divergent_levels,
    }


def get_reference_evidence_identity_relation(
    candidate,
    reference_evidence,
):
    """Return the deterministic identity relation to known reference evidence.

    An exact non-empty external source and ID match establishes the same
    entity. Other identity evidence remains unresolved rather than proving
    that the candidate is a distinct entity.
    """
    candidate_source = str(
        candidate.get("external_source") or ""
    ).strip()
    candidate_id = str(
        candidate.get("external_id") or ""
    ).strip()

    if not candidate_source or not candidate_id:
        return "unresolved"

    for reference in reference_evidence:
        reference_source = str(
            reference.get("external_source") or ""
        ).strip()
        reference_id = str(
            reference.get("external_id") or ""
        ).strip()

        if (
            candidate_source == reference_source
            and candidate_id == reference_id
        ):
            return "same"

    return "unresolved"


def evaluate_existing_reference_gate(
    candidate,
    reference_evidence,
):
    """Return identity relation and the automatic reconciliation action."""
    identity_relation = get_reference_evidence_identity_relation(
        candidate,
        reference_evidence,
    )

    return {
        "identity_relation": identity_relation,
        "reconciliation_action": (
            "reuse"
            if identity_relation == "same"
            else "preserve"
        ),
    }


def observe_candidate_admin_against_reference_evidence(
    candidate,
    reference_evidence,
):
    """Collect administrative observations for each reference evidence item.

    Reference evidence remains separate so provider provenance and missing
    evidence are preserved instead of being merged into a synthetic candidate.
    """
    return [
        {
            "reference": reference,
            "observation": get_admin_context_evidence_observation(
                candidate,
                reference,
            ),
        }
        for reference in reference_evidence
    ]


def interpret_localized_admin_evidence(observation):
    """
    Interpret administrative evidence for a localized geographic entity.

    Compatible administrative levels corroborate a plausible relation, while
    divergent levels discriminate between alternatives. Neither observation
    establishes entity identity or resolution sufficiency by itself.
    """
    return {
        "corroborating_levels": list(
            observation.get("compatible_levels") or []
        ),
        "discriminating_levels": list(
            observation.get("divergent_levels") or []
        ),
    }



def summarize_localized_reference_admin_evidence(
    candidate,
    reference_evidence,
):
    """Summarize localized admin evidence while preserving provenance.

    Informative observations remain attached to their reference evidence.
    Missing comparable admin context is uninformative rather than evidence
    for or against entity identity.
    """
    summary = {
        "corroborating": [],
        "discriminating": [],
        "uninformative": [],
    }

    observations = (
        observe_candidate_admin_against_reference_evidence(
            candidate,
            reference_evidence,
        )
    )

    for item in observations:
        reference = item["reference"]
        interpretation = interpret_localized_admin_evidence(
            item["observation"]
        )

        corroborating_levels = interpretation[
            "corroborating_levels"
        ]
        discriminating_levels = interpretation[
            "discriminating_levels"
        ]

        if corroborating_levels:
            summary["corroborating"].append(
                {
                    "reference": reference,
                    "levels": corroborating_levels,
                }
            )

        if discriminating_levels:
            summary["discriminating"].append(
                {
                    "reference": reference,
                    "levels": discriminating_levels,
                }
            )

        if (
            not corroborating_levels
            and not discriminating_levels
        ):
            summary["uninformative"].append(reference)

    return summary


def get_spatial_evidence_observation(
    candidate,
    reference,
):
    """
    Describe pairwise spatial evidence without interpreting entity identity.

    Missing coordinates produce unknown spatial evidence. A calculated
    distance is a factual observation whose meaning depends on the active
    evaluation strategy.
    """
    candidate_latitude = candidate.get("latitude")
    candidate_longitude = candidate.get("longitude")
    reference_latitude = reference.get("latitude")
    reference_longitude = reference.get("longitude")

    if any(
        value is None
        for value in (
            candidate_latitude,
            candidate_longitude,
            reference_latitude,
            reference_longitude,
        )
    ):
        return {
            "distance_km": None,
        }

    latitude_1 = float(candidate_latitude)
    longitude_1 = float(candidate_longitude)
    latitude_2 = float(reference_latitude)
    longitude_2 = float(reference_longitude)

    earth_radius_km = 6371.0088

    latitude_delta = radians(
        latitude_2 - latitude_1
    )
    longitude_delta = radians(
        longitude_2 - longitude_1
    )

    latitude_1 = radians(latitude_1)
    latitude_2 = radians(latitude_2)

    haversine_value = (
        sin(latitude_delta / 2) ** 2
        + cos(latitude_1)
        * cos(latitude_2)
        * sin(longitude_delta / 2) ** 2
    )

    haversine_value = min(
        1,
        max(0, haversine_value),
    )

    angular_distance = 2 * atan2(
        sqrt(haversine_value),
        sqrt(1 - haversine_value),
    )

    return {
        "distance_km": earth_radius_km * angular_distance,
    }
