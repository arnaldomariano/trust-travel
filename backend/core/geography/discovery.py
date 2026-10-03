from ..models import PlaceExternalIdentity
from ..place_utils import (
    get_place_name_identity_values,
    normalize_place_text,
)
from .registry import (
    normalize_registry_discovery_result,
    search_registry_places,
)

from .providers.geonames import (
    GeoNamesRequestError,
    search_geonames_discovery_places,
)
from .providers.google_places import (
    GooglePlacesRequestError,
    search_google_discovery_places,
)


def interpret_discovery_candidates(candidates):
    """
    Preserve discovery candidates and describe pairwise correspondence
    evidence without transforming or asserting identity between them.
    """
    return {
        "candidates": candidates,
        "correspondence_pairs": find_discovery_correspondence_pairs(
            candidates
        ),
        "country_alternative_pairs": find_discovery_country_alternative_pairs(
            candidates
        ),
    }


def apply_discovery_country_refinement(
    candidates,
    country_code,
):
    """
    Keep discovery candidates whose known country matches the selected
    country refinement without inferring geographic identity.
    """
    normalized_country_code = str(
        country_code or ""
    ).strip().upper()

    if not normalized_country_code:
        return candidates

    return [
        candidate
        for candidate in candidates
        if str(
            candidate.get("country_code") or ""
        ).strip().upper() == normalized_country_code
    ]


def build_discovery_country_refinement_options(
    interpretation,
):
    """
    Build unique country refinement options from query-relevant country
    alternatives without deciding how the UI should present them.
    """
    options = []
    seen_country_codes = set()

    for first_candidate, second_candidate in interpretation.get(
        "query_relevant_country_alternative_pairs",
        [],
    ):
        for candidate in (
            first_candidate,
            second_candidate,
        ):
            country_code = str(
                candidate.get("country_code") or ""
            ).strip().upper()

            if (
                not country_code
                or country_code in seen_country_codes
            ):
                continue

            seen_country_codes.add(country_code)
            options.append(
                {
                    "country_code": country_code,
                }
            )

    return options


def discovery_has_meaningful_ambiguity(
    interpretation,
):
    """
    Return whether the current discovery interpretation contains evidence
    of meaningful ambiguity without deciding how the UI should resolve it.
    """
    return bool(
        interpretation.get(
            "query_relevant_country_alternative_pairs",
            []
        )
    )


def find_query_relevant_country_alternative_pairs(
    candidates,
    query,
):
    """
    Return each country alternative pair that directly matches the query
    exactly once without grouping or modifying the candidates.
    """
    pairs = []

    for index, candidate in enumerate(candidates):
        for other_candidate in candidates[index + 1:]:
            if discovery_country_alternative_is_query_relevant(
                candidate,
                other_candidate,
                query,
            ):
                pairs.append(
                    (
                        candidate,
                        other_candidate,
                    )
                )

    return pairs


def find_discovery_country_alternative_pairs(candidates):
    """
    Return each pair with country alternative evidence exactly once
    without grouping or modifying the candidates.
    """
    pairs = []

    for index, candidate in enumerate(candidates):
        for other_candidate in candidates[index + 1:]:
            if discovery_candidates_have_country_alternative_evidence(
                candidate,
                other_candidate,
            ):
                pairs.append(
                    (
                        candidate,
                        other_candidate,
                    )
                )

    return pairs


def find_discovery_correspondence_pairs(candidates):
    """
    Return each pair of discovery candidates with correspondence evidence
    exactly once without grouping or modifying the candidates.
    """
    pairs = []

    for index, candidate in enumerate(candidates):
        for other_candidate in candidates[index + 1:]:
            if discovery_candidates_have_correspondence_evidence(
                candidate,
                other_candidate,
            ):
                pairs.append(
                    (
                        candidate,
                        other_candidate,
                    )
                )

    return pairs


def find_discovery_candidate_correspondences(
    candidate,
    candidates,
):
    """
    Return other discovery candidates with correspondence evidence while
    preserving each candidate as an independent result.
    """
    return [
        other_candidate
        for other_candidate in candidates
        if (
            other_candidate is not candidate
            and discovery_candidates_have_correspondence_evidence(
                candidate,
                other_candidate,
            )
        )
    ]


def discovery_candidates_have_correspondence_evidence(
    first_candidate,
    second_candidate,
):
    """
    Return whether two discovery candidates have compatible evidence of
    possible correspondence without asserting that they are the same entity.
    """
    return (
        discovery_candidates_share_name_identity(
            first_candidate,
            second_candidate,
        )
        and discovery_candidates_have_compatible_countries(
            first_candidate,
            second_candidate,
        )
        and discovery_candidates_have_compatible_geographic_types(
            first_candidate,
            second_candidate,
        )
    )


def discovery_candidates_have_compatible_geographic_types(
    first_candidate,
    second_candidate,
):
    """
    Treat known different geographic types as conflicting discovery
    evidence. Missing classification does not establish a conflict.
    """
    first_geographic_type = str(
        first_candidate.get("geographic_type") or ""
    ).strip()
    second_geographic_type = str(
        second_candidate.get("geographic_type") or ""
    ).strip()

    if not first_geographic_type or not second_geographic_type:
        return True

    return first_geographic_type == second_geographic_type


def discovery_candidates_have_country_alternative_evidence(
    first_candidate,
    second_candidate,
):
    """
    Return whether shared name identity points to candidates in different
    known countries without treating either candidate as the intended one.
    """
    if not discovery_candidates_share_name_identity(
        first_candidate,
        second_candidate,
    ):
        return False

    first_country_code = str(
        first_candidate.get("country_code") or ""
    ).strip().upper()
    second_country_code = str(
        second_candidate.get("country_code") or ""
    ).strip().upper()

    if not first_country_code or not second_country_code:
        return False

    return first_country_code != second_country_code


def discovery_candidates_have_compatible_countries(
    first_candidate,
    second_candidate,
):
    """
    Treat known different country codes as conflicting discovery evidence.
    Missing country information does not establish a conflict.
    """
    first_country_code = str(
        first_candidate.get("country_code") or ""
    ).strip().upper()
    second_country_code = str(
        second_candidate.get("country_code") or ""
    ).strip().upper()

    if not first_country_code or not second_country_code:
        return True

    return first_country_code == second_country_code


def discovery_country_alternative_is_query_relevant(
    first_candidate,
    second_candidate,
    query,
):
    """
    Return whether a country alternative pair is directly relevant to the
    query because both candidates exactly match the searched identity.
    """
    if not discovery_candidates_have_country_alternative_evidence(
        first_candidate,
        second_candidate,
    ):
        return False

    return (
        discovery_candidate_exactly_matches_query(
            first_candidate,
            query,
        )
        and discovery_candidate_exactly_matches_query(
            second_candidate,
            query,
        )
    )


def discovery_candidate_exactly_matches_query(
    candidate,
    query,
):
    """
    Return whether the query exactly matches a normalized candidate name,
    canonical name, or alias without asserting entity identity.
    """
    normalized_query = normalize_place_text(query)

    if not normalized_query:
        return False

    candidate_values = get_place_name_identity_values(
        candidate.get("name"),
        candidate.get("canonical_name"),
        candidate.get("aliases"),
    )

    return normalized_query in candidate_values


def discovery_candidates_share_name_identity(
    first_candidate,
    second_candidate,
):
    """
    Return whether two discovery candidates share an exact normalized
    name, canonical name, or alias without asserting entity identity.
    """
    first_values = get_place_name_identity_values(
        first_candidate.get("name"),
        first_candidate.get("canonical_name"),
        first_candidate.get("aliases"),
    )
    second_values = get_place_name_identity_values(
        second_candidate.get("name"),
        second_candidate.get("canonical_name"),
        second_candidate.get("aliases"),
    )

    return bool(
        first_values.intersection(second_values)
    )


def annotate_known_external_identities(results):
    """
    Annotate discovery candidates only when Trust Travel already knows
    their exact external provider identity.
    """
    external_identities = {
        (
            str(result.get("external_source") or "").strip(),
            str(result.get("external_id") or "").strip(),
        )
        for result in results
        if (
            str(result.get("external_source") or "").strip()
            and str(result.get("external_id") or "").strip()
        )
    }

    if not external_identities:
        return results

    external_sources = {
        external_source
        for external_source, _ in external_identities
    }
    external_ids = {
        external_id
        for _, external_id in external_identities
    }

    known_place_ids = {
        (
            identity.external_source,
            identity.external_id,
        ): identity.place_id
        for identity in PlaceExternalIdentity.objects.filter(
            external_source__in=external_sources,
            external_id__in=external_ids,
        )
    }

    for result in results:
        external_source = str(
            result.get("external_source") or ""
        ).strip()
        external_id = str(
            result.get("external_id") or ""
        ).strip()

        if not external_source or not external_id:
            continue

        result["existing_place_id"] = known_place_ids.get(
            (external_source, external_id)
        )

    return results


def search_global_discovery_places(query):
    """
    Collect global discovery candidates without forcing them into the
    Trust Travel geographic ontology.
    """
    registry_places = search_registry_places(
        query=query,
    )
    registry_results = [
        normalize_registry_discovery_result(place)
        for place in registry_places
    ]

    try:
        geonames_results = search_geonames_discovery_places(
            query=query,
        )
    except GeoNamesRequestError:
        # Discovery should degrade gracefully when one provider
        # is temporarily unavailable.
        geonames_results = []

    try:
        google_results = search_google_discovery_places(
            query=query,
        )
    except GooglePlacesRequestError:
        # Discovery should degrade gracefully when one provider
        # is temporarily unavailable.
        google_results = []

    results = [
        *registry_results,
        *geonames_results,
        *google_results,
    ]

    return annotate_known_external_identities(
        results
    )


def search_interpreted_global_discovery_places(
    query,
    country_refinement=None,
):
    """
    Collect global discovery candidates and add query-dependent interpretation
    without making ranking or entity identity decisions.
    """
    candidates = search_global_discovery_places(
        query
    )
    interpretation = interpret_discovery_candidates(
        candidates
    )

    interpretation[
        "query_relevant_country_alternative_pairs"
    ] = find_query_relevant_country_alternative_pairs(
        candidates,
        query,
    )
    interpretation[
        "meaningful_ambiguity"
    ] = discovery_has_meaningful_ambiguity(
        interpretation
    )
    interpretation[
        "country_refinement_options"
    ] = build_discovery_country_refinement_options(
        interpretation
    )
    interpretation[
        "refined_candidates"
    ] = apply_discovery_country_refinement(
        candidates,
        country_refinement,
    )

    return interpretation
