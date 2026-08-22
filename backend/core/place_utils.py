import unicodedata


COUNTRY_ALIAS_GROUPS = [
    {
        "brazil",
        "brasil",
        "br",
    },
    {
        "netherlands",
        "the netherlands",
        "holland",
        "holanda",
        "paises baixos",
        "países baixos",
        "nl",
    },
    {
        "united states",
        "united states of america",
        "usa",
        "us",
        "eua",
        "estados unidos",
    },
    {
        "united kingdom",
        "uk",
        "great britain",
        "reino unido",
        "gb",
    },
    {
        "germany",
        "deutschland",
        "alemanha",
        "de",
    },
    {
        "italy",
        "italia",
        "itália",
        "it",
    },
    {
        "spain",
        "espanha",
        "espana",
        "españa",
        "es",
    },
    {
        "france",
        "franca",
        "frança",
        "fr",
    },
    {
        "greece",
        "grecia",
        "grécia",
        "gr",
    },
]


def normalize_place_text(value):
    value = str(value or "").strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = " ".join(value.split())
    return value


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

        return None

def get_or_create_country(value="", code="", aliases=None):

    from .models import Country

    country = resolve_country(value=value, code=code)

    if country:
        return country

    normalized_code = str(code or "").strip().upper()[:2]
    canonical_name = str(value or "").strip()

    if len(normalized_code) != 2 or not canonical_name:
        return None

    clean_aliases = [
        str(alias).strip()
        for alias in (aliases or [])
        if str(alias).strip()
    ]

    country, _ = Country.objects.get_or_create(
        code=normalized_code,
        defaults={
            "canonical_name": canonical_name,
            "aliases": clean_aliases,
        },
    )

    return country


def get_country_alias_values(value):
    normalized_value = normalize_place_text(value)

    if not normalized_value:
        return set()

    values = {normalized_value}

    for alias_group in COUNTRY_ALIAS_GROUPS:
        normalized_group = {
            normalize_place_text(alias)
            for alias in alias_group
            if alias
        }

        if normalized_value in normalized_group:
            values.update(normalized_group)

    values.discard("")

    return values
