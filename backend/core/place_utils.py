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
