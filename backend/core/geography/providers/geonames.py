import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings

class GeoNamesConfigurationError(RuntimeError):
    pass

class GeoNamesRequestError(RuntimeError):
    pass

def get_geonames_username():
    username = (settings.GEONAMES_USERNAME or "").strip()

    if not username:
        raise GeoNamesConfigurationError(
            "GEONAMES_USERNAME is not configured."
        )

    return username


def normalize_city_result(item):
    canonical_name = (
        item.get("toponymName")
        or item.get("asciiName")
        or item.get("name")
        or ""
    ).strip()

    excluded_alias_languages = {
        "iata",
        "link",
        "post",
        "unlc",
        "wkdt",
    }

    aliases = []
    seen_aliases = {canonical_name.casefold()} if canonical_name else set()

    for alternate_name in item.get("alternateNames") or []:
        alias = (alternate_name.get("name") or "").strip()
        language = (alternate_name.get("lang") or "").strip().lower()

        if not alias:
            continue

        if language in excluded_alias_languages:
            continue

        alias_key = alias.casefold()

        if alias_key in seen_aliases:
            continue

        seen_aliases.add(alias_key)
        aliases.append(alias)

    return {
        "name": canonical_name,
        "canonical_name": canonical_name,
        "aliases": aliases,
        "country_code": (item.get("countryCode") or "").strip().upper(),
        "place_type": "city",
        "latitude": item.get("lat"),
        "longitude": item.get("lng"),
        "feature_code": (item.get("fcode") or "").strip(),
        "population": item.get("population") or 0,
        "admin_name": (item.get("adminName1") or "").strip(),
        "external_source": "geonames",
        "external_id": str(item.get("geonameId") or "").strip(),
    }

def search_cities(query, country_code, max_rows=8):
    query = str(query or "").strip()
    country_code = str(country_code or "").strip().upper()

    if len(query) < 2:
        return []

    if len(country_code) != 2:
        raise ValueError(
            "A valid two-letter country code is required."
        )

    username = get_geonames_username()

    params = {
        "name_startsWith": query,
        "country": country_code,
        "featureClass": "P",
        "maxRows": max_rows,
        "style": "FULL",
        "username": username,
    }

    url = (
        "https://secure.geonames.org/searchJSON?"
        + urlencode(params)
    )

    try:
        with urlopen(url, timeout=5) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError) as error:
        raise GeoNamesRequestError(
            "GeoNames city search failed."
        ) from error

    status = payload.get("status")

    if status:
        raise GeoNamesRequestError(
            status.get("message")
            or "GeoNames returned an error."
        )

    results = []

    for item in payload.get("geonames", []):
        normalized = normalize_city_result(item)

        if (
            normalized["external_id"]
            and normalized["name"]
            and normalized["country_code"] == country_code
        ):
            results.append(normalized)

    return results