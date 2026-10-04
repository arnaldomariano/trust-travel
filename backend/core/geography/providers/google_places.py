import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


class GooglePlacesConfigurationError(RuntimeError):
    pass


class GooglePlacesRequestError(RuntimeError):
    pass


GOOGLE_PLACES_SEARCH_URL = (
    "https://places.googleapis.com/v1/places:searchText"
)

GOOGLE_PLACES_DETAILS_URL = (
    "https://places.googleapis.com/v1/places/"
)

GOOGLE_GEOGRAPHIC_TYPES = {
    "mountain_peak": "mountain",
    "island": "island",
    "lake": "lake",
}


def get_google_places_api_key():
    api_key = (
        getattr(settings, "GOOGLE_PLACES_API_KEY", "") or ""
    ).strip()

    if not api_key:
        raise GooglePlacesConfigurationError(
            "GOOGLE_PLACES_API_KEY is not configured."
        )

    return api_key


def classify_google_geographic_place(types):
    types = {
        str(place_type or "").strip()
        for place_type in (types or [])
        if str(place_type or "").strip()
    }

    for google_type, geographic_type in (
        GOOGLE_GEOGRAPHIC_TYPES.items()
    ):
        if google_type in types:
            return geographic_type

    return None


def normalize_google_discovery_result(item):
    provider_types = [
        str(place_type or "").strip()
        for place_type in (item.get("types") or [])
        if str(place_type or "").strip()
    ]

    geographic_type = classify_google_geographic_place(
        provider_types
    )

    display_name = item.get("displayName") or {}

    canonical_name = str(
        display_name.get("text") or ""
    ).strip()

    place_id = str(
        item.get("id") or ""
    ).strip()

    location = item.get("location") or {}
    address_components = item.get("addressComponents") or []

    country_code = ""
    location_context = []

    context_types = (
        "sublocality_level_1",
        "sublocality_level_2",
        "sublocality_level_3",
        "sublocality_level_4",
        "sublocality_level_5",
        "locality",
        "administrative_area_level_3",
        "administrative_area_level_2",
        "administrative_area_level_1",
        "country",
    )

    for component in address_components:
        component_types = component.get("types") or []

        context_type = next(
            (
                place_type
                for place_type in context_types
                if place_type in component_types
            ),
            None,
        )

        if context_type:
            location_context.append(
                {
                    "type": context_type,
                    "name": str(
                        component.get("longText") or ""
                    ).strip(),
                    "short_name": str(
                        component.get("shortText") or ""
                    ).strip(),
                }
            )

        if "country" in component_types:
            country_code = str(
                component.get("shortText") or ""
            ).strip().upper()

    if not canonical_name or not place_id:
        return None

    return {
        "name": canonical_name,
        "canonical_name": canonical_name,
        "aliases": [],
        "country_code": country_code,
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "feature_class": "",
        "feature_code": "",
        "geographic_type": geographic_type,
        "population": 0,
        "admin_name": "",
        "admin_context": [],
        "external_source": "google_places",
        "external_id": place_id,
        "provider_types": provider_types,
        "primary_type": str(
            item.get("primaryType") or ""
        ).strip(),
        "formatted_address": str(
            item.get("formattedAddress") or ""
        ).strip(),
        "location_context": location_context,
    }


def geographic_result_can_materialize(result):
    """
    Return whether a normalized Google discovery result can use the current
    Trust Travel geographic hub materialization flow.
    """
    provider_types = result.get("provider_types") or []

    return (
        classify_google_geographic_place(provider_types)
        is not None
    )


def normalize_google_geographic_result(item):
    result = normalize_google_discovery_result(item)

    if not result or not result.get("geographic_type"):
        return None

    result.pop("provider_types", None)

    return result


def get_google_geographic_place(external_id):
    external_id = str(external_id or "").strip()

    if not external_id:
        raise ValueError(
            "A Google Places external ID is required."
        )

    api_key = get_google_places_api_key()

    request = Request(
        GOOGLE_PLACES_DETAILS_URL + external_id,
        headers={
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": (
                "id,"
                "displayName,"
                "types,"
                "primaryType,"
                "formattedAddress,"
                "location,"
                "addressComponents"
            ),
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError) as error:
        raise GooglePlacesRequestError(
            "Google Places geographic lookup failed."
        ) from error

    normalized = normalize_google_geographic_result(
        payload
    )

    if not normalized:
        raise GooglePlacesRequestError(
            "Google Places result is not a supported geographic place."
        )

    return normalized


def _request_google_places_text_search(
    query,
    max_results=10,
):
    api_key = get_google_places_api_key()

    payload = json.dumps(
        {
            "textQuery": query,
            "pageSize": max_results,
        }
    ).encode("utf-8")

    request = Request(
        GOOGLE_PLACES_SEARCH_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": (
                "places.id,"
                "places.displayName,"
                "places.types,"
                "places.primaryType,"
                "places.formattedAddress,"
                "places.location,"
                "places.addressComponents"
            ),
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=5) as response:
            response_payload = json.load(response)
    except (HTTPError, URLError, TimeoutError) as error:
        raise GooglePlacesRequestError(
            "Google Places text search failed."
        ) from error

    return response_payload.get("places", [])


def search_google_geographic_places(
    query,
    max_results=10,
):
    query = str(query or "").strip()

    if len(query) < 2:
        return []

    items = _request_google_places_text_search(
        query=query,
        max_results=max_results,
    )

    results = []

    for item in items:
        normalized = normalize_google_geographic_result(
            item
        )

        if normalized:
            results.append(normalized)

    return results


def search_google_discovery_places(
    query,
    max_results=10,
):
    query = str(query or "").strip()

    if len(query) < 2:
        return []

    items = _request_google_places_text_search(
        query=query,
        max_results=max_results,
    )

    results = []

    for item in items:
        normalized = normalize_google_discovery_result(
            item
        )

        if normalized:
            results.append(normalized)

    return results
