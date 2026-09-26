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


def normalize_google_geographic_result(item):
    geographic_type = classify_google_geographic_place(
        item.get("types")
    )

    if not geographic_type:
        return None

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

    for component in address_components:
        component_types = component.get("types") or []

        if "country" in component_types:
            country_code = str(
                component.get("shortText") or ""
            ).strip().upper()
            break

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
    }

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

def search_google_geographic_places(
    query,
    max_results=10,
):
    query = str(query or "").strip()

    if len(query) < 2:
        return []

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
            "Google Places geographic search failed."
        ) from error

    results = []

    for item in response_payload.get("places", []):
        normalized = normalize_google_geographic_result(
            item
        )

        if normalized:
            results.append(normalized)

    return results
