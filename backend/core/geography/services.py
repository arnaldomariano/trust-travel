from django.db.models import Q

from ..models import Place
from ..place_utils import normalize_place_text


def annotate_existing_city_places(results, country_code):
    external_ids = [
        result["external_id"]
        for result in results
        if result.get("external_id")
    ]

    existing_places_by_external_id = {
        place.external_id: place.id
        for place in Place.objects.filter(
            external_source="geonames",
            external_id__in=external_ids,
        )
    }

    country_places = list(
        Place.objects.filter(
            place_type="city",
        )
        .filter(
            Q(country_ref__code=country_code)
            | Q(country_code=country_code)
        )
        .distinct()
    )

    places_by_identity_value = {}

    for place in country_places:
        place_values = {
            normalize_place_text(value)
            for value in [
                place.name,
                place.canonical_name,
                *(place.aliases or []),
            ]
            if str(value or "").strip()
        }

        for value in place_values:
            places_by_identity_value.setdefault(
                value,
                set(),
            ).add(place.id)

    for result in results:
        external_match_id = (
            existing_places_by_external_id.get(
                result.get("external_id")
            )
        )

        if external_match_id is not None:
            result["existing_place_id"] = external_match_id
            continue

        result_values = {
            normalize_place_text(value)
            for value in [
                result.get("name"),
                result.get("canonical_name"),
                *(result.get("aliases") or []),
            ]
            if str(value or "").strip()
        }

        candidate_place_ids = set()

        for value in result_values:
            candidate_place_ids.update(
                places_by_identity_value.get(
                    value,
                    set(),
                )
            )

        if len(candidate_place_ids) == 1:
            result["existing_place_id"] = next(
                iter(candidate_place_ids)
            )
        else:
            result["existing_place_id"] = None

    return results
