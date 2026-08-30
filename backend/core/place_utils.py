import unicodedata
import json
from pathlib import Path

COUNTRIES_DATA_PATH = Path(__file__).resolve().parent / "data" / "countries.json"

def load_country_catalog():
    with COUNTRIES_DATA_PATH.open(encoding="utf-8") as file:
        countries = json.load(file)

    return countries


def get_country_catalog_by_code():
    return {
        country["code"].strip().upper(): country
        for country in load_country_catalog()
        if country.get("code")
    }

def normalize_place_text(value):
    value = str(value or "").strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = " ".join(value.split())
    return value


def get_place_name_identity_values(
    name="",
    canonical_name="",
    aliases=None,
):
    values = {
        normalize_place_text(name),
        normalize_place_text(canonical_name),
        *[
            normalize_place_text(alias)
            for alias in (aliases or [])
            if str(alias or "").strip()
        ],
    }

    values.discard("")

    return values


def get_matching_places_by_name_identity(
    candidates,
    name="",
    canonical_name="",
    aliases=None,
):
    requested_values = get_place_name_identity_values(
        name,
        canonical_name,
        aliases,
    )

    if not requested_values:
        return []

    matching_places = []

    for candidate in candidates:
        candidate_values = get_place_name_identity_values(
            candidate.name,
            candidate.canonical_name,
            candidate.aliases,
        )

        if requested_values.intersection(candidate_values):
            matching_places.append(candidate)

    return matching_places


def get_country_catalog_identity_values(country):
    if not country:
        return set()

    values = {
        normalize_place_text(country.get("code")),
        normalize_place_text(country.get("canonical_name")),
        *[
            normalize_place_text(alias)
            for alias in (country.get("aliases") or [])
            if alias
        ],
    }

    values.discard("")

    return values


def resolve_country_catalog_entry(value="", code=""):
    normalized_code = str(code or "").strip().upper()[:2]

    if normalized_code:
        country = get_country_catalog_by_code().get(normalized_code)

        if country:
            return country

    normalized_value = normalize_place_text(value)

    if not normalized_value:
        return None

    for country in load_country_catalog():
        if normalized_value in get_country_catalog_identity_values(country):
            return country

    return None

def get_country_identity_values(country):
    if not country:
        return set()

    values = {
        normalize_place_text(country.code),
        normalize_place_text(country.canonical_name),
        *[
            normalize_place_text(alias)
            for alias in (country.aliases or [])
            if alias
        ],
    }

    values.discard("")

    return values

def get_country_search_values(value="", code=""):
    normalized_value = normalize_place_text(value)

    values = set()

    catalog_country = resolve_country_catalog_entry(
        value=value,
        code=code,
    )

    if catalog_country:
        values.update(
            get_country_catalog_identity_values(catalog_country)
        )

    country = resolve_country(
        value=value,
        code=code,
    )

    if country:
        values.update(
            get_country_identity_values(country)
        )

    if normalized_value:
        values.add(normalized_value)

    values.discard("")

    return values


def resolve_country(value="", code=""):
    from .models import Country

    normalized_code = str(code or "").strip().upper()[:2]

    if normalized_code:
        country = Country.objects.filter(
            code__iexact=normalized_code,
        ).first()

        if country:
            return country

    normalized_value = normalize_place_text(value)

    if not normalized_value:
        return None

    country = Country.objects.filter(
        canonical_name__iexact=str(value).strip(),
    ).first()

    if country:
        return country

    for candidate in Country.objects.all():
        if normalized_value in get_country_identity_values(candidate):
            return candidate

    catalog_country = resolve_country_catalog_entry(
        value=value,
        code=code,
    )

    if catalog_country:
        country = Country.objects.filter(
            code__iexact=catalog_country["code"],
        ).first()

        if country:
            return country

    return None


def get_or_create_country(value="", code="", aliases=None):

    from .models import Country

    country = resolve_country(value=value, code=code)

    if country:
        return country

    catalog_country = resolve_country_catalog_entry(
        value=value,
        code=code,
    )

    if catalog_country:
        normalized_code = catalog_country["code"].strip().upper()
        canonical_name = catalog_country["canonical_name"].strip()
        catalog_aliases = catalog_country.get("aliases") or []
    else:
        normalized_code = str(code or "").strip().upper()[:2]
        canonical_name = str(value or "").strip()
        catalog_aliases = []

    if len(normalized_code) != 2 or not canonical_name:
        return None

    clean_aliases = {
        str(alias).strip()
        for alias in [
            *catalog_aliases,
            *(aliases or []),
        ]
        if str(alias).strip()
    }

    clean_aliases = sorted(clean_aliases)

    country, _ = Country.objects.get_or_create(
        code=normalized_code,
        defaults={
            "canonical_name": canonical_name,
            "aliases": clean_aliases,
        },
    )

    return country
