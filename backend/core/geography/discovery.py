from ..models import PlaceExternalIdentity
from ..place_utils import get_place_name_identity_values
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
