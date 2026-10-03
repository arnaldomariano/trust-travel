from ..models import Place
from ..place_utils import (
    get_country_search_values,
    get_place_search_identity_context,
    get_place_search_rank,
    normalize_place_text,
    place_matches_search_identity,
    resolve_country,
)


def normalize_registry_discovery_result(place):
    """
    Normalize a materialized Trust Travel Place for discovery without
    representing the registry itself as an external provider.
    """
    return {
        "name": place.name,
        "canonical_name": place.canonical_name,
        "aliases": list(place.aliases or []),
        "country_code": place.country_code or "",
        "latitude": place.latitude,
        "longitude": place.longitude,
        "feature_class": "",
        "feature_code": "",
        "geographic_type": place.geographic_type or "",
        "population": 0,
        "admin_name": "",
        "admin_context": [],
        "place_type": place.place_type,
        "existing_place_id": place.id,
    }


def search_registry_places(
    query,
    country="",
    limit=20,
):
    """
    Search places already materialized in the Trust Travel registry.
    """
    search_context = get_place_search_identity_context(
        query
    )

    resolved_filter_country = resolve_country(
        value=country
    )
    country_values = get_country_search_values(
        country
    )

    places_queryset = Place.objects.select_related(
        "destination",
        "country_ref",
    ).all()

    def matches_country(place):
        if resolved_filter_country:
            return (
                place.country_ref_id
                == resolved_filter_country.id
            )

        if not country_values:
            return True

        destination = place.destination

        values = [
            destination.name if destination else "",
            destination.country if destination else "",
            destination.city if destination else "",
        ]

        if place.place_type == "country":
            values.extend(
                [
                    place.name,
                    place.canonical_name,
                    *(place.aliases or []),
                ]
            )

        normalized_values = {
            normalize_place_text(value)
            for value in values
            if value
        }

        normalized_values.discard("")

        return bool(
            country_values.intersection(
                normalized_values
            )
        )

    places = [
        place
        for place in places_queryset
        if (
            place_matches_search_identity(
                place,
                search_context,
            )
            and matches_country(place)
        )
    ]

    places = sorted(
        places,
        key=lambda place: (
            get_place_search_rank(
                place,
                search_context,
            ),
            place.place_type or "",
            place.name or "",
        ),
    )

    return places[:limit]
