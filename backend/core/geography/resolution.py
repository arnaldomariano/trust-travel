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
