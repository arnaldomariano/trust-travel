import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


class FoursquareConfigurationError(RuntimeError):
    pass


class FoursquareRequestError(RuntimeError):
    pass


TT_POI_CATEGORY_IDS = {
    "hotel": [
        "4bf58dd8d48988d1fa931735",  # Hotel
    ],
    "restaurant": [
        "4d4b7105d754a06374d81259",  # Restaurants
        "4bf58dd8d48988d1e0931735",  # Coffee Shop
    ],
    "attraction": [
        "4d4b7104d754a06370d81259",  # Arts & Entertainment
        "50aaa49e4b90af0d42d5de11",  # Castle
        "4deefb944765f83613cdba6e",  # Historic and Protected Site
        "4bf58dd8d48988d12d941735",  # Monument
        "4bf58dd8d48988d132941735",  # Church
        "69d41dd556ec6a4ded8e8264",  # Fort
    ],
    "nature": [
        "4bf58dd8d48988d1e2941735",  # Beach
        "4bf58dd8d48988d163941735",  # Park
        "4bf58dd8d48988d159941735",  # Hiking Trail
        "56aa371be4b08b9a8d573560",  # Waterfall
        "52e81612bcbc57f1066b7a13",  # Nature Preserve
        "4bf58dd8d48988d165941735",  # Scenic Lookout
        "52e81612bcbc57f1066b7a22",  # Botanical Garden
    ],
}


def get_foursquare_service_key():
    service_key = (
        getattr(settings, "FOURSQUARE_SERVICE_KEY", "")
        or ""
    ).strip()

    if not service_key:
        raise FoursquareConfigurationError(
            "FOURSQUARE_SERVICE_KEY is not configured."
        )

    return service_key


def normalize_poi_result(item):
    location = item.get("location") or {}
    categories = item.get("categories") or []
    chains = item.get("chains") or []

    normalized_categories = []

    for category in categories:
        category_id = str(
            category.get("fsq_category_id") or ""
        ).strip()

        category_name = (
            category.get("name") or ""
        ).strip()

        if not category_id and not category_name:
            continue

        normalized_categories.append(
            {
                "external_id": category_id,
                "name": category_name,
            }
        )

    normalized_chains = []

    for chain in chains:
        chain_id = str(
            chain.get("fsq_chain_id") or ""
        ).strip()

        chain_name = (
            chain.get("name") or ""
        ).strip()

        if not chain_id and not chain_name:
            continue

        normalized_chains.append(
            {
                "external_id": chain_id,
                "name": chain_name,
            }
        )

    return {
        "name": (item.get("name") or "").strip(),
        "canonical_name": (item.get("name") or "").strip(),
        "aliases": [],
        "country_code": (
            location.get("country") or ""
        ).strip().upper(),
        "latitude": item.get("latitude"),
        "longitude": item.get("longitude"),
        "address": (
            location.get("formatted_address")
            or location.get("address")
            or ""
        ).strip(),
        "locality": (
            location.get("locality") or ""
        ).strip(),
        "region": (
            location.get("region") or ""
        ).strip(),
        "postcode": (
            location.get("postcode") or ""
        ).strip(),
        "categories": normalized_categories,
        "chains": normalized_chains,
        "distance": item.get("distance"),
        "external_source": "foursquare",
        "external_id": str(
            item.get("fsq_place_id") or ""
        ).strip(),
    }


def get_poi(external_id):
    external_id = str(external_id or "").strip()

    if not external_id:
        raise ValueError(
            "A Foursquare place ID is required."
        )

    service_key = get_foursquare_service_key()

    url = (
        "https://places-api.foursquare.com/places/"
        + external_id
    )

    request = Request(
        url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "X-Places-Api-Version": "2025-06-17",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError) as error:
        raise FoursquareRequestError(
            "Foursquare POI lookup failed."
        ) from error

    normalized = normalize_poi_result(payload)

    if (
        not normalized["external_id"]
        or not normalized["name"]
    ):
        raise FoursquareRequestError(
            "Foursquare returned an invalid POI."
        )

    return normalized


def search_pois(
    query,
    latitude,
    longitude,
    radius=10000,
    limit=10,
    place_type=None,
    category_ids=None,
):
    query = str(query or "").strip()

    if len(query) < 2:
        return []

    if latitude is None or longitude is None:
        raise ValueError(
            "Latitude and longitude are required for POI search."
        )

    service_key = get_foursquare_service_key()

    params = {
        "query": query,
        "ll": f"{latitude},{longitude}",
        "radius": radius,
        "limit": limit,
        "sort": "RELEVANCE",
    }

    if place_type and not category_ids:
        category_ids = TT_POI_CATEGORY_IDS.get(
            place_type,
        )

    if category_ids:
        params["fsq_category_ids"] = ",".join(
            str(category_id).strip()
            for category_id in category_ids
            if str(category_id).strip()
        )

    url = (
        "https://places-api.foursquare.com/places/search?"
        + urlencode(params)
    )

    request = Request(
        url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "X-Places-Api-Version": "2025-06-17",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError) as error:
        raise FoursquareRequestError(
            "Foursquare POI search failed."
        ) from error

    results = []

    for item in payload.get("results", []):
        normalized = normalize_poi_result(item)

        if (
            normalized["external_id"]
            and normalized["name"]
        ):
            results.append(normalized)

    return results


def poi_matches_place_type(
    poi_result,
    place_type,
):
    place_type = str(place_type or "").strip()

    if place_type == "other":
        return True

    if place_type not in TT_POI_CATEGORY_IDS:
        return False

    external_id = str(
        poi_result.get("external_id") or ""
    ).strip()

    name = str(
        poi_result.get("name") or ""
    ).strip()

    latitude = poi_result.get("latitude")
    longitude = poi_result.get("longitude")

    if (
        not external_id
        or not name
        or latitude is None
        or longitude is None
    ):
        return False

    results = search_pois(
        query=name,
        latitude=latitude,
        longitude=longitude,
        radius=1000,
        limit=10,
        place_type=place_type,
    )

    return any(
        str(result.get("external_id") or "").strip()
        == external_id
        for result in results
    )
