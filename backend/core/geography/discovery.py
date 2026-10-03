from .providers.geonames import (
    GeoNamesRequestError,
    search_geonames_discovery_places,
)
from .providers.google_places import (
    GooglePlacesRequestError,
    search_google_discovery_places,
)


def search_global_discovery_places(query):
    """
    Collect global discovery candidates without forcing them into the
    Trust Travel geographic ontology.
    """
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

    return [
        *geonames_results,
        *google_results,
    ]
