from unittest.mock import patch

from django.test import TestCase

from .models import Country
from .place_utils import (
    get_or_create_country,
    resolve_country,
    resolve_country_catalog_entry,
)


class CountryIdentityTests(TestCase):
    def test_country_catalog_resolves_alias_to_canonical_identity(self):
        country = resolve_country_catalog_entry(value="Brasil")

        self.assertIsNotNone(country)
        self.assertEqual(country["code"], "BR")
        self.assertEqual(country["canonical_name"], "Brazil")

    def test_country_catalog_resolves_iso_code(self):
        country = resolve_country_catalog_entry(code="BR")

        self.assertIsNotNone(country)
        self.assertEqual(country["code"], "BR")
        self.assertEqual(country["canonical_name"], "Brazil")

    def test_get_or_create_country_uses_canonical_identity_for_alias(self):
        country = get_or_create_country(value="Brasil")

        self.assertIsNotNone(country)
        self.assertEqual(country.code, "BR")
        self.assertEqual(country.canonical_name, "Brazil")
        self.assertEqual(Country.objects.count(), 1)

    def test_alias_canonical_name_and_code_resolve_same_country(self):
        created_country = get_or_create_country(value="Brasil")

        by_alias = resolve_country(value="Brasil")
        by_canonical_name = resolve_country(value="Brazil")
        by_code = resolve_country(code="BR")

        self.assertIsNotNone(created_country)
        self.assertEqual(by_alias.pk, created_country.pk)
        self.assertEqual(by_canonical_name.pk, created_country.pk)
        self.assertEqual(by_code.pk, created_country.pk)
        self.assertEqual(Country.objects.count(), 1)


class PlaceSearchIdentityTests(TestCase):
    def setUp(self):
        from .models import Destination, Place

        self.country = get_or_create_country(value="Brazil")

        self.destination = Destination.objects.create(
            name="Brazil",
            country="Brazil",
        )

        self.place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            name="Brazil",
            canonical_name="Brazil",
            aliases=["Brasil"],
            country_code="BR",
            place_type="country",
        )

    def test_country_alias_search_returns_canonical_country_place(self):
        response = self.client.get(
            "/api/places/search/",
            {"q": "Brasil"},
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["count"], 1)
        self.assertEqual(len(data["results"]), 1)
        self.assertEqual(data["results"][0]["id"], self.place.id)
        self.assertEqual(data["results"][0]["name"], "Brazil")
        self.assertEqual(
            data["results"][0]["canonical_name"],
            "Brazil",
        )

    def test_country_alias_filter_returns_place_from_canonical_country(self):
        from .models import Place

        city = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.place,
            name="Belo Horizonte",
            canonical_name="Belo Horizonte",
            aliases=[],
            country_code="BR",
            place_type="city",
            city="Belo Horizonte",
        )

        response = self.client.get(
            "/api/places/search/",
            {
                "q": "Belo Horizonte",
                "country": "Brasil",
            },
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["count"], 1)
        self.assertEqual(len(data["results"]), 1)
        self.assertEqual(data["results"][0]["id"], city.id)
        self.assertEqual(
            data["results"][0]["canonical_name"],
            "Belo Horizonte",
        )


class GeographicRegistrySearchTests(TestCase):
    def test_registry_search_finds_materialized_place_by_alias(self):
        from .geography.registry import search_registry_places
        from .models import Destination, Place

        country = get_or_create_country(value="Brazil")

        destination = Destination.objects.create(
            name="Brazil",
            country="Brazil",
        )

        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Brazil",
            canonical_name="Brazil",
            aliases=["Brasil"],
            country_code="BR",
            place_type="country",
        )

        results = search_registry_places(
            query="Brasil",
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].pk, place.pk)

    def test_registry_search_filters_by_country_alias(self):
        from .geography.registry import search_registry_places
        from .models import Destination, Place

        brazil = get_or_create_country(value="Brazil")
        portugal = get_or_create_country(value="Portugal")

        brazil_destination = Destination.objects.create(
            name="Brazil",
            country="Brazil",
        )
        portugal_destination = Destination.objects.create(
            name="Portugal",
            country="Portugal",
        )

        brazil_place = Place.objects.create(
            destination=brazil_destination,
            country_ref=brazil,
            name="Estoril",
            canonical_name="Estoril",
            aliases=[],
            country_code="BR",
            place_type="city",
            city="Estoril",
        )

        Place.objects.create(
            destination=portugal_destination,
            country_ref=portugal,
            name="Estoril",
            canonical_name="Estoril",
            aliases=[],
            country_code="PT",
            place_type="city",
            city="Estoril",
        )

        results = search_registry_places(
            query="Estoril",
            country="Brasil",
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].pk, brazil_place.pk)

    def test_registry_place_normalizes_as_existing_discovery_candidate(self):
        from .geography.registry import normalize_registry_discovery_result
        from .models import Destination, Place

        country = get_or_create_country(value="Italy")

        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )

        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Lago di Como",
            canonical_name="Lake Como",
            aliases=["Como Lake"],
            country_code="IT",
            place_type="city",
            geographic_type="lake",
            latitude="46.016048",
            longitude="9.257167",
            city="Lago di Como",
        )

        result = normalize_registry_discovery_result(place)

        self.assertEqual(result["name"], "Lago di Como")
        self.assertEqual(result["canonical_name"], "Lake Como")
        self.assertEqual(result["aliases"], ["Como Lake"])
        self.assertEqual(result["country_code"], "IT")
        self.assertEqual(result["place_type"], "city")
        self.assertEqual(result["geographic_type"], "lake")
        self.assertEqual(result["existing_place_id"], place.id)
        self.assertNotIn("external_source", result)
        self.assertNotIn("external_id", result)


class CountryMaterializationTests(TestCase):
    def test_materialize_country_place_creates_canonical_structure_once(self):
        from .geography.services import materialize_country_place
        from .models import Destination, Place

        country_entry = resolve_country_catalog_entry(code="AR")

        self.assertIsNotNone(country_entry)

        place, created = materialize_country_place(
            country_entry=country_entry,
            user=None,
        )

        self.assertTrue(created)
        self.assertEqual(place.name, "Argentina")
        self.assertEqual(place.canonical_name, "Argentina")
        self.assertEqual(place.country_code, "AR")
        self.assertEqual(place.place_type, "country")
        self.assertIsNotNone(place.country_ref)
        self.assertEqual(place.country_ref.code, "AR")
        self.assertEqual(
            place.destination.name,
            "Argentina",
        )
        self.assertEqual(
            place.destination.country,
            "Argentina",
        )

        self.assertEqual(
            Country.objects.filter(code="AR").count(),
            1,
        )
        self.assertEqual(
            Destination.objects.filter(
                name="Argentina",
                country="Argentina",
            ).count(),
            1,
        )
        self.assertEqual(
            Place.objects.filter(
                place_type="country",
                country_ref=place.country_ref,
            ).count(),
            1,
        )

        same_place, created_again = materialize_country_place(
            country_entry=country_entry,
            user=None,
        )

        self.assertFalse(created_again)
        self.assertEqual(same_place.pk, place.pk)

        self.assertEqual(
            Country.objects.filter(code="AR").count(),
            1,
        )
        self.assertEqual(
            Destination.objects.filter(
                name="Argentina",
                country="Argentina",
            ).count(),
            1,
        )
        self.assertEqual(
            Place.objects.filter(
                place_type="country",
                country_ref=place.country_ref,
            ).count(),
            1,
        )


class CountryMaterializationAPITests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        self.user = User.objects.create_user(
            username="country-materialization-user",
            password="test-password",
        )

        self.access_token = str(
            AccessToken.for_user(self.user)
        )

        self.url = "/api/geography/countries/materialize/"

    def test_country_materialization_requires_authentication(self):
        response = self.client.post(
            self.url,
            data={"country_code": "AR"},
            content_type="application/json",
        )

        self.assertIn(
            response.status_code,
            [401, 403],
        )

    def test_country_materialization_endpoint_is_idempotent(self):
        from .models import Destination, Place

        authorization = f"Bearer {self.access_token}"

        first_response = self.client.post(
            self.url,
            data={"country_code": "AR"},
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(
            first_response.status_code,
            201,
            first_response.content,
        )

        first_data = first_response.json()

        self.assertEqual(first_data["name"], "Argentina")
        self.assertEqual(
            first_data["canonical_name"],
            "Argentina",
        )
        self.assertEqual(first_data["country_code"], "AR")
        self.assertEqual(first_data["place_type"], "country")

        first_place_id = first_data["id"]

        second_response = self.client.post(
            self.url,
            data={"country_code": "AR"},
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(
            second_response.status_code,
            200,
            second_response.content,
        )

        second_data = second_response.json()

        self.assertEqual(
            second_data["id"],
            first_place_id,
        )

        country = Country.objects.get(code="AR")

        self.assertEqual(
            Country.objects.filter(code="AR").count(),
            1,
        )

        self.assertEqual(
            Destination.objects.filter(
                name="Argentina",
                country="Argentina",
            ).count(),
            1,
        )

        self.assertEqual(
            Place.objects.filter(
                place_type="country",
                country_ref=country,
            ).count(),
            1,
        )

        place = Place.objects.get(pk=first_place_id)

        self.assertEqual(
            place.created_by_id,
            self.user.id,
        )


class GeographicPlaceReconciliationTests(TestCase):
    def setUp(self):
        from .models import Destination, Place, PlaceExternalIdentity

        self.country = get_or_create_country(value="Italy")

        self.destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )

        self.country_place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            name="Italy",
            canonical_name="Italy",
            aliases=[],
            country_code="IT",
            place_type="country",
        )

        self.lake = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Lago di Como",
            canonical_name="Lago di Como",
            aliases=["Lake Como", "Lago Como"],
            country_code="IT",
            place_type="city",
            geographic_type="lake",
            city="Lago di Como",
            latitude="46.007930",
            longitude="9.260790",
        )

        PlaceExternalIdentity.objects.create(
            place=self.lake,
            external_source="geonames",
            external_id="3178228",
            geographic_type="lake",
        )

    def test_cross_provider_result_matches_existing_geographic_place(self):
        from .geography.services import find_existing_city_place

        google_result = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
            "latitude": 46.016049,
            "longitude": 9.257168,
        }

        matched_place = find_existing_city_place(
            city_result=google_result,
            resolved_country=self.country,
            country_code="IT",
        )

        self.assertIsNotNone(matched_place)
        self.assertEqual(
            matched_place.pk,
            self.lake.pk,
        )

    def test_cross_provider_result_does_not_match_different_geographic_type(self):
        from .geography.services import find_existing_city_place

        different_type_result = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "google-settlement-lake-como",
            "latitude": 46.016049,
            "longitude": 9.257168,
        }

        matched_place = find_existing_city_place(
            city_result=different_type_result,
            resolved_country=self.country,
            country_code="IT",
        )

        self.assertIsNone(matched_place)

    def test_deduplication_collapses_results_for_same_existing_place(self):
        from .geography.services import (
            deduplicate_geographic_results_by_existing_place,
        )

        results = [
            {
                "name": "Lago di Como",
                "external_source": "geonames",
                "external_id": "3178228",
                "existing_place_id": self.lake.pk,
            },
            {
                "name": "Lake Como",
                "external_source": "google_places",
                "external_id": "google-lake-como",
                "existing_place_id": self.lake.pk,
            },
        ]

        deduplicated_results = (
            deduplicate_geographic_results_by_existing_place(
                results
            )
        )

        self.assertEqual(
            len(deduplicated_results),
            1,
        )
        self.assertEqual(
            deduplicated_results[0]["existing_place_id"],
            self.lake.pk,
        )

    def test_deduplication_keeps_unresolved_provider_results_separate(self):
        from .geography.services import (
            deduplicate_geographic_results_by_existing_place,
        )

        results = [
            {
                "name": "Springfield",
                "external_source": "geonames",
                "external_id": "geonames-springfield",
                "existing_place_id": None,
            },
            {
                "name": "Springfield",
                "external_source": "google_places",
                "external_id": "google-springfield",
                "existing_place_id": None,
            },
        ]

        deduplicated_results = (
            deduplicate_geographic_results_by_existing_place(
                results
            )
        )

        self.assertEqual(
            len(deduplicated_results),
            2,
        )


class GeographicDiscoveryOrchestrationTests(TestCase):
    def test_global_discovery_preserves_candidates_from_multiple_providers(self):
        from unittest.mock import patch

        from .geography.discovery import search_global_discovery_places

        geonames_result = {
            "name": "Chapada Diamantina",
            "canonical_name": "Chapada Diamantina",
            "aliases": [],
            "country_code": "BR",
            "latitude": -12.5,
            "longitude": -41.5,
            "feature_class": "T",
            "feature_code": "UPLD",
            "geographic_type": None,
            "external_source": "geonames",
            "external_id": "3466307",
        }

        google_result = {
            "name": "Chapada Diamantina",
            "canonical_name": "Chapada Diamantina",
            "aliases": [],
            "country_code": "BR",
            "latitude": -12.5,
            "longitude": -41.5,
            "provider_types": [
                "natural_feature",
                "establishment",
            ],
            "geographic_type": None,
            "external_source": "google_places",
            "external_id": "google-chapada-diamantina",
        }

        with (
            patch(
                "core.geography.discovery.search_geonames_discovery_places",
                return_value=[geonames_result],
            ) as geonames_search,
            patch(
                "core.geography.discovery.search_google_discovery_places",
                return_value=[google_result],
            ) as google_search,
        ):
            results = search_global_discovery_places(
                query="Chapada Diamantina",
            )

        geonames_search.assert_called_once_with(
            query="Chapada Diamantina",
        )
        google_search.assert_called_once_with(
            query="Chapada Diamantina",
        )

        self.assertEqual(len(results), 2)
        self.assertEqual(
            [result["external_source"] for result in results],
            ["geonames", "google_places"],
        )
        self.assertIsNone(results[0]["geographic_type"])
        self.assertIsNone(results[1]["geographic_type"])
        self.assertEqual(
            results[0]["feature_code"],
            "UPLD",
        )
        self.assertEqual(
            results[1]["provider_types"],
            ["natural_feature", "establishment"],
        )

    def test_global_discovery_includes_materialized_registry_places(self):
        from unittest.mock import patch

        from .geography.discovery import search_global_discovery_places
        from .models import Destination, Place

        country = get_or_create_country(value="Italy")

        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )

        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Lago di Como",
            canonical_name="Lake Como",
            aliases=["Como Lake"],
            country_code="IT",
            place_type="city",
            geographic_type="lake",
            latitude="46.016048",
            longitude="9.257167",
            city="Lago di Como",
        )

        geonames_result = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": [],
            "country_code": "IT",
            "latitude": 46.016048,
            "longitude": 9.257167,
            "feature_class": "H",
            "feature_code": "LK",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }

        google_result = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "latitude": 46.016048,
            "longitude": 9.257167,
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
            "provider_types": ["lake"],
        }

        with (
            patch(
                "core.geography.discovery.search_registry_places",
                return_value=[place],
            ) as registry_search,
            patch(
                "core.geography.discovery.search_geonames_discovery_places",
                return_value=[geonames_result],
            ),
            patch(
                "core.geography.discovery.search_google_discovery_places",
                return_value=[google_result],
            ),
        ):
            results = search_global_discovery_places(
                query="Lake Como",
            )

        registry_search.assert_called_once_with(
            query="Lake Como",
        )

        self.assertEqual(len(results), 3)

        registry_result = results[0]

        self.assertEqual(
            registry_result["existing_place_id"],
            place.id,
        )
        self.assertEqual(
            registry_result["place_type"],
            "city",
        )
        self.assertEqual(
            registry_result["geographic_type"],
            "lake",
        )
        self.assertNotIn(
            "external_source",
            registry_result,
        )

        self.assertEqual(
            results[1]["external_source"],
            "geonames",
        )
        self.assertEqual(
            results[2]["external_source"],
            "google_places",
        )

    def test_global_discovery_keeps_google_results_when_geonames_fails(self):
        from unittest.mock import patch

        from .geography.discovery import search_global_discovery_places
        from .geography.providers.geonames import GeoNamesRequestError

        google_result = {
            "name": "Chapada Diamantina",
            "canonical_name": "Chapada Diamantina",
            "aliases": [],
            "country_code": "BR",
            "latitude": -12.5,
            "longitude": -41.5,
            "provider_types": [
                "natural_feature",
                "establishment",
            ],
            "geographic_type": None,
            "external_source": "google_places",
            "external_id": "google-chapada-diamantina",
        }

        with (
            patch(
                "core.geography.discovery.search_geonames_discovery_places",
                side_effect=GeoNamesRequestError(
                    "GeoNames search failed."
                ),
            ),
            patch(
                "core.geography.discovery.search_google_discovery_places",
                return_value=[google_result],
            ),
        ):
            results = search_global_discovery_places(
                query="Chapada Diamantina",
            )

        self.assertEqual(results, [google_result])

    def test_global_discovery_keeps_geonames_results_when_google_fails(self):
        from unittest.mock import patch

        from .geography.discovery import search_global_discovery_places
        from .geography.providers.google_places import (
            GooglePlacesRequestError,
        )

        geonames_result = {
            "name": "Chapada Diamantina",
            "canonical_name": "Chapada Diamantina",
            "aliases": [],
            "country_code": "BR",
            "latitude": -12.5,
            "longitude": -41.5,
            "feature_class": "T",
            "feature_code": "UPLD",
            "geographic_type": None,
            "external_source": "geonames",
            "external_id": "3466307",
        }

        with (
            patch(
                "core.geography.discovery.search_geonames_discovery_places",
                return_value=[geonames_result],
            ),
            patch(
                "core.geography.discovery.search_google_discovery_places",
                side_effect=GooglePlacesRequestError(
                    "Google Places search failed."
                ),
            ),
        ):
            results = search_global_discovery_places(
                query="Chapada Diamantina",
            )

        self.assertEqual(results, [geonames_result])

    def test_global_discovery_does_not_hide_geonames_configuration_error(self):
        from unittest.mock import patch

        from .geography.discovery import search_global_discovery_places
        from .geography.providers.geonames import (
            GeoNamesConfigurationError,
        )

        with (
            patch(
                "core.geography.discovery.search_geonames_discovery_places",
                side_effect=GeoNamesConfigurationError(
                    "GEONAMES_USERNAME is not configured."
                ),
            ),
            patch(
                "core.geography.discovery.search_google_discovery_places",
                return_value=[],
            ),
        ):
            with self.assertRaises(GeoNamesConfigurationError):
                search_global_discovery_places(
                    query="Chapada Diamantina",
                )


class GooglePlacesDiscoveryTests(TestCase):
    def test_unclassified_google_result_is_preserved_for_discovery(self):
        from .geography.providers.google_places import (
            normalize_google_discovery_result,
        )

        item = {
            "id": "google-chapada-diamantina",
            "displayName": {
                "text": "Chapada Diamantina",
            },
            "types": [
                "natural_feature",
                "establishment",
            ],
            "location": {
                "latitude": -12.8801668,
                "longitude": -41.3721853,
            },
            "addressComponents": [
                {
                    "shortText": "BR",
                    "types": ["country"],
                },
            ],
        }

        result = normalize_google_discovery_result(item)

        self.assertIsNotNone(result)
        self.assertEqual(
            result["canonical_name"],
            "Chapada Diamantina",
        )
        self.assertEqual(
            result["external_source"],
            "google_places",
        )
        self.assertEqual(
            result["external_id"],
            "google-chapada-diamantina",
        )
        self.assertEqual(
            result["country_code"],
            "BR",
        )
        self.assertEqual(
            result["provider_types"],
            [
                "natural_feature",
                "establishment",
            ],
        )
        self.assertIsNone(result["geographic_type"])

    def test_google_provider_types_are_preserved_for_unclassified_place(self):
        from .geography.providers.google_places import (
            normalize_google_discovery_result,
        )

        item = {
            "id": "google-serra-da-capivara-national-park",
            "displayName": {
                "text": "Serra da Capivara National Park",
            },
            "types": [
                "national_park",
                "tourist_attraction",
                "park",
                "point_of_interest",
                "establishment",
            ],
            "location": {
                "latitude": -9.0096408,
                "longitude": -42.6931918,
            },
            "addressComponents": [
                {
                    "shortText": "BR",
                    "types": ["country"],
                },
            ],
        }

        result = normalize_google_discovery_result(item)

        self.assertIsNotNone(result)
        self.assertEqual(
            result["provider_types"],
            [
                "national_park",
                "tourist_attraction",
                "park",
                "point_of_interest",
                "establishment",
            ],
        )
        self.assertIsNone(result["geographic_type"])

    def test_known_google_type_keeps_geographic_interpretation(self):
        from .geography.providers.google_places import (
            normalize_google_discovery_result,
        )

        item = {
            "id": "google-lake-como",
            "displayName": {
                "text": "Lake Como",
            },
            "types": [
                "lake",
                "natural_feature",
                "establishment",
            ],
            "location": {
                "latitude": 46.016049,
                "longitude": 9.257168,
            },
            "addressComponents": [
                {
                    "shortText": "IT",
                    "types": ["country"],
                },
            ],
        }

        result = normalize_google_discovery_result(item)

        self.assertIsNotNone(result)
        self.assertEqual(
            result["provider_types"],
            [
                "lake",
                "natural_feature",
                "establishment",
            ],
        )
        self.assertEqual(
            result["geographic_type"],
            "lake",
        )
        self.assertEqual(
            result["country_code"],
            "IT",
        )

    def test_legacy_geographic_normalizer_still_rejects_unclassified_result(self):
        from .geography.providers.google_places import (
            normalize_google_discovery_result,
            normalize_google_geographic_result,
        )

        item = {
            "id": "google-chapada-diamantina",
            "displayName": {
                "text": "Chapada Diamantina",
            },
            "types": [
                "natural_feature",
                "establishment",
            ],
            "location": {
                "latitude": -12.8801668,
                "longitude": -41.3721853,
            },
            "addressComponents": [
                {
                    "shortText": "BR",
                    "types": ["country"],
                },
            ],
        }

        discovery_result = normalize_google_discovery_result(item)
        geographic_result = normalize_google_geographic_result(item)

        self.assertIsNotNone(discovery_result)
        self.assertIsNone(geographic_result)

    def test_google_discovery_search_keeps_unclassified_result(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.google_places import (
            search_google_discovery_places,
        )

        response_payload = {
            "places": [
                {
                    "id": "google-chapada-diamantina",
                    "displayName": {
                        "text": "Chapada Diamantina",
                    },
                    "types": [
                        "natural_feature",
                        "establishment",
                    ],
                    "location": {
                        "latitude": -12.8801668,
                        "longitude": -41.3721853,
                    },
                    "addressComponents": [
                        {
                            "shortText": "BR",
                            "types": ["country"],
                        },
                    ],
                },
            ],
        }

        response = io.BytesIO(
            json.dumps(response_payload).encode("utf-8")
        )

        with (
            patch(
                "core.geography.providers.google_places."
                "get_google_places_api_key",
                return_value="test-api-key",
            ),
            patch(
                "core.geography.providers.google_places.urlopen",
                return_value=response,
            ),
        ):
            results = search_google_discovery_places(
                "Chapada Diamantina"
            )

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0]["canonical_name"],
            "Chapada Diamantina",
        )
        self.assertEqual(
            results[0]["provider_types"],
            [
                "natural_feature",
                "establishment",
            ],
        )
        self.assertIsNone(
            results[0]["geographic_type"]
        )

    def test_legacy_google_geographic_search_still_filters_unclassified_result(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.google_places import (
            search_google_geographic_places,
        )

        response_payload = {
            "places": [
                {
                    "id": "google-chapada-diamantina",
                    "displayName": {
                        "text": "Chapada Diamantina",
                    },
                    "types": [
                        "natural_feature",
                        "establishment",
                    ],
                    "location": {
                        "latitude": -12.8801668,
                        "longitude": -41.3721853,
                    },
                    "addressComponents": [
                        {
                            "shortText": "BR",
                            "types": ["country"],
                        },
                    ],
                },
            ],
        }

        response = io.BytesIO(
            json.dumps(response_payload).encode("utf-8")
        )

        with (
            patch(
                "core.geography.providers.google_places."
                "get_google_places_api_key",
                return_value="test-api-key",
            ),
            patch(
                "core.geography.providers.google_places.urlopen",
                return_value=response,
            ),
        ):
            results = search_google_geographic_places(
                "Chapada Diamantina"
            )

        self.assertEqual(results, [])


class GeoNamesDiscoveryTests(TestCase):
    def test_geonames_discovery_search_keeps_unclassified_result(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.geonames import (
            search_geonames_discovery_places,
        )

        response_payload = {
            "geonames": [
                {
                    "geonameId": 3466295,
                    "name": "Chapada Diamantina",
                    "toponymName": "Chapada Diamantina",
                    "countryCode": "BR",
                    "lat": "-12.8802",
                    "lng": "-41.3722",
                    "fcl": "T",
                    "fcode": "UPLD",
                    "population": 0,
                    "alternateNames": [],
                },
            ],
        }

        response = io.BytesIO(
            json.dumps(response_payload).encode("utf-8")
        )

        with (
            patch(
                "core.geography.providers.geonames."
                "get_geonames_username",
                return_value="test-user",
            ),
            patch(
                "core.geography.providers.geonames.urlopen",
                return_value=response,
            ),
        ):
            results = search_geonames_discovery_places(
                "Chapada Diamantina"
            )

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0]["canonical_name"],
            "Chapada Diamantina",
        )
        self.assertEqual(
            results[0]["external_source"],
            "geonames",
        )
        self.assertEqual(
            results[0]["feature_class"],
            "T",
        )
        self.assertEqual(
            results[0]["feature_code"],
            "UPLD",
        )
        self.assertEqual(
            results[0]["country_code"],
            "BR",
        )
        self.assertIsNone(
            results[0]["geographic_type"]
        )

    def test_legacy_geonames_geographic_search_still_filters_unclassified_result(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.geonames import (
            search_geographic_places,
        )

        response_payload = {
            "geonames": [
                {
                    "geonameId": 3466295,
                    "name": "Chapada Diamantina",
                    "toponymName": "Chapada Diamantina",
                    "countryCode": "BR",
                    "lat": "-12.8802",
                    "lng": "-41.3722",
                    "fcl": "T",
                    "fcode": "UPLD",
                    "population": 0,
                    "alternateNames": [],
                },
            ],
        }

        response = io.BytesIO(
            json.dumps(response_payload).encode("utf-8")
        )

        with (
            patch(
                "core.geography.providers.geonames."
                "get_geonames_username",
                return_value="test-user",
            ),
            patch(
                "core.geography.providers.geonames.urlopen",
                return_value=response,
            ),
        ):
            results = search_geographic_places(
                "Chapada Diamantina"
            )

        self.assertEqual(results, [])


class GeographicDiscoveryIdentityTests(TestCase):
    def test_discovery_candidate_matches_known_external_identity(self):
        from .geography.discovery import annotate_known_external_identities
        from .models import Destination, Place, PlaceExternalIdentity

        country = get_or_create_country(value="Italy")

        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )

        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Lago di Como",
            canonical_name="Lake Como",
            country_code="IT",
            place_type="city",
            geographic_type="lake",
        )

        PlaceExternalIdentity.objects.create(
            place=place,
            external_source="geonames",
            external_id="3178228",
            geographic_type="lake",
        )

        results = [
            {
                "name": "Lago di Como",
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "geonames",
                "external_id": "3178228",
            }
        ]

        annotated_results = annotate_known_external_identities(
            results
        )

        self.assertEqual(
            annotated_results[0]["existing_place_id"],
            place.id,
        )

    def test_discovery_candidate_does_not_match_by_name_alone(self):
        from .geography.discovery import annotate_known_external_identities
        from .models import Destination, Place

        country = get_or_create_country(value="Italy")

        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )

        Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Lago di Como",
            canonical_name="Lake Como",
            aliases=["Como Lake"],
            country_code="IT",
            place_type="city",
            geographic_type="lake",
        )

        results = [
            {
                "name": "Lago di Como",
                "canonical_name": "Lake Como",
                "aliases": ["Como Lake"],
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "geonames",
                "external_id": "3178228",
            }
        ]

        annotated_results = annotate_known_external_identities(
            results
        )

        self.assertIsNone(
            annotated_results[0]["existing_place_id"]
        )

    def test_discovery_identity_annotation_preserves_registry_identity(self):
        from .geography.discovery import annotate_known_external_identities

        results = [
            {
                "name": "Lago di Como",
                "country_code": "IT",
                "place_type": "city",
                "geographic_type": "lake",
                "existing_place_id": 121,
            },
            {
                "name": "Lake Como",
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "google_places",
                "external_id": "unknown-google-place",
            },
        ]

        annotated_results = annotate_known_external_identities(
            results
        )

        self.assertEqual(
            annotated_results[0]["existing_place_id"],
            121,
        )


class GeographicDiscoveryIdentityOrchestrationTests(TestCase):
    def test_global_discovery_annotates_only_known_external_identities(self):
        from unittest.mock import patch

        from .geography.discovery import search_global_discovery_places
        from .models import Destination, Place, PlaceExternalIdentity

        country = get_or_create_country(value="Italy")

        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )

        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Lago di Como",
            canonical_name="Lake Como",
            country_code="IT",
            place_type="city",
            geographic_type="lake",
        )

        PlaceExternalIdentity.objects.create(
            place=place,
            external_source="geonames",
            external_id="3178228",
            geographic_type="lake",
        )

        registry_result = {
            "name": "Lago di Como",
            "country_code": "IT",
            "place_type": "city",
            "geographic_type": "lake",
            "existing_place_id": place.id,
        }

        geonames_result = {
            "name": "Lago di Como",
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }

        google_result = {
            "name": "Lake Como",
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "unknown-google-place",
        }

        with (
            patch(
                "core.geography.discovery.search_registry_places",
                return_value=[place],
            ),
            patch(
                "core.geography.discovery.normalize_registry_discovery_result",
                return_value=registry_result,
            ),
            patch(
                "core.geography.discovery.search_geonames_discovery_places",
                return_value=[geonames_result],
            ),
            patch(
                "core.geography.discovery.search_google_discovery_places",
                return_value=[google_result],
            ),
        ):
            results = search_global_discovery_places(
                query="Lake Como",
            )

        self.assertEqual(
            results[0]["existing_place_id"],
            place.id,
        )
        self.assertEqual(
            results[1]["existing_place_id"],
            place.id,
        )
        self.assertIsNone(
            results[2]["existing_place_id"]
        )


class GeographicDiscoveryCandidateEvidenceTests(TestCase):
    def test_candidates_share_exact_name_identity(self):
        from .geography.discovery import (
            discovery_candidates_share_name_identity,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": ["Como Lake"],
            "country_code": "IT",
            "place_type": "city",
            "geographic_type": "lake",
            "existing_place_id": 121,
        }

        external_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        self.assertTrue(
            discovery_candidates_share_name_identity(
                registry_candidate,
                external_candidate,
            )
        )

    def test_candidates_do_not_share_name_identity_by_partial_match(self):
        from .geography.discovery import (
            discovery_candidates_share_name_identity,
        )

        geographic_candidate = {
            "name": "Serra da Capivara",
            "canonical_name": "Serra da Capivara",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": None,
            "external_source": "geonames",
            "external_id": "geonames-serra-capivara",
        }

        park_candidate = {
            "name": "Serra da Capivara National Park",
            "canonical_name": "Serra da Capivara National Park",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": None,
            "external_source": "google_places",
            "external_id": "google-serra-capivara-park",
        }

        self.assertFalse(
            discovery_candidates_share_name_identity(
                geographic_candidate,
                park_candidate,
            )
        )

    def test_candidates_with_different_known_countries_are_incompatible(self):
        from .geography.discovery import (
            discovery_candidates_have_compatible_countries,
        )

        portugal_candidate = {
            "name": "Estoril",
            "country_code": "PT",
        }

        brazil_candidate = {
            "name": "Estoril",
            "country_code": "BR",
        }

        self.assertFalse(
            discovery_candidates_have_compatible_countries(
                portugal_candidate,
                brazil_candidate,
            )
        )

    def test_candidates_with_missing_country_are_not_incompatible(self):
        from .geography.discovery import (
            discovery_candidates_have_compatible_countries,
        )

        known_country_candidate = {
            "name": "Lake Como",
            "country_code": "IT",
        }

        unknown_country_candidate = {
            "name": "Lake Como",
            "country_code": "",
        }

        self.assertTrue(
            discovery_candidates_have_compatible_countries(
                known_country_candidate,
                unknown_country_candidate,
            )
        )

    def test_candidates_with_different_known_geographic_types_are_incompatible(self):
        from .geography.discovery import (
            discovery_candidates_have_compatible_geographic_types,
        )

        lake_candidate = {
            "name": "Example Place",
            "geographic_type": "lake",
        }

        mountain_candidate = {
            "name": "Example Place",
            "geographic_type": "mountain",
        }

        self.assertFalse(
            discovery_candidates_have_compatible_geographic_types(
                lake_candidate,
                mountain_candidate,
            )
        )

    def test_candidates_with_missing_geographic_type_are_not_incompatible(self):
        from .geography.discovery import (
            discovery_candidates_have_compatible_geographic_types,
        )

        classified_candidate = {
            "name": "Example Place",
            "geographic_type": "lake",
        }

        unclassified_candidate = {
            "name": "Example Place",
            "geographic_type": None,
        }

        self.assertTrue(
            discovery_candidates_have_compatible_geographic_types(
                classified_candidate,
                unclassified_candidate,
            )
        )

    def test_candidates_have_correspondence_evidence_when_exact_name_and_context_are_compatible(self):
        from .geography.discovery import (
            discovery_candidates_have_correspondence_evidence,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": ["Como Lake"],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 121,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        self.assertTrue(
            discovery_candidates_have_correspondence_evidence(
                registry_candidate,
                google_candidate,
            )
        )

    def test_candidates_do_not_have_correspondence_evidence_when_countries_conflict(self):
        from .geography.discovery import (
            discovery_candidates_have_correspondence_evidence,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        self.assertFalse(
            discovery_candidates_have_correspondence_evidence(
                portugal_candidate,
                brazil_candidate,
            )
        )

    def test_candidates_do_not_have_correspondence_evidence_when_geographic_types_conflict(self):
        from .geography.discovery import (
            discovery_candidates_have_correspondence_evidence,
        )

        lake_candidate = {
            "name": "Example Place",
            "canonical_name": "Example Place",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        mountain_candidate = {
            "name": "Example Place",
            "canonical_name": "Example Place",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "mountain",
        }

        self.assertFalse(
            discovery_candidates_have_correspondence_evidence(
                lake_candidate,
                mountain_candidate,
            )
        )

    def test_find_corresponding_candidates_returns_only_other_candidates_with_evidence(self):
        from .geography.discovery import (
            find_discovery_candidate_correspondences,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": ["Como Lake"],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 121,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        unrelated_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
            "external_source": "geonames",
            "external_id": "geonames-estoril",
        }

        results = find_discovery_candidate_correspondences(
            registry_candidate,
            [
                registry_candidate,
                google_candidate,
                unrelated_candidate,
            ],
        )

        self.assertEqual(
            results,
            [google_candidate],
        )

    def test_find_corresponding_candidates_keeps_distinct_equal_candidate_objects(self):
        from .geography.discovery import (
            find_discovery_candidate_correspondences,
        )

        first_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        second_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        self.assertIsNot(
            first_candidate,
            second_candidate,
        )
        self.assertEqual(
            first_candidate,
            second_candidate,
        )

        results = find_discovery_candidate_correspondences(
            first_candidate,
            [
                first_candidate,
                second_candidate,
            ],
        )

        self.assertEqual(
            len(results),
            1,
        )
        self.assertIs(
            results[0],
            second_candidate,
        )

    def test_correspondence_evidence_is_not_assumed_to_be_transitive(self):
        from .geography.discovery import (
            discovery_candidates_have_correspondence_evidence,
        )

        first_candidate = {
            "name": "Lake Alpha",
            "canonical_name": "Lake Alpha",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        bridge_candidate = {
            "name": "Lake Alpha",
            "canonical_name": "Lake Alpha",
            "aliases": ["Lake Beta"],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        third_candidate = {
            "name": "Lake Beta",
            "canonical_name": "Lake Beta",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        self.assertTrue(
            discovery_candidates_have_correspondence_evidence(
                first_candidate,
                bridge_candidate,
            )
        )
        self.assertTrue(
            discovery_candidates_have_correspondence_evidence(
                bridge_candidate,
                third_candidate,
            )
        )
        self.assertFalse(
            discovery_candidates_have_correspondence_evidence(
                first_candidate,
                third_candidate,
            )
        )

    def test_find_discovery_correspondence_pairs_returns_each_pair_once(self):
        from .geography.discovery import (
            find_discovery_correspondence_pairs,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 121,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        unrelated_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        pairs = find_discovery_correspondence_pairs(
            [
                registry_candidate,
                google_candidate,
                unrelated_candidate,
            ]
        )

        self.assertEqual(
            pairs,
            [
                (
                    registry_candidate,
                    google_candidate,
                )
            ],
        )

    def test_correspondence_pairs_do_not_create_transitive_pair(self):
        from .geography.discovery import (
            find_discovery_correspondence_pairs,
        )

        first_candidate = {
            "name": "Lake Alpha",
            "canonical_name": "Lake Alpha",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        bridge_candidate = {
            "name": "Lake Alpha",
            "canonical_name": "Lake Alpha",
            "aliases": ["Lake Beta"],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        third_candidate = {
            "name": "Lake Beta",
            "canonical_name": "Lake Beta",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        pairs = find_discovery_correspondence_pairs(
            [
                first_candidate,
                bridge_candidate,
                third_candidate,
            ]
        )

        self.assertEqual(
            pairs,
            [
                (
                    first_candidate,
                    bridge_candidate,
                ),
                (
                    bridge_candidate,
                    third_candidate,
                ),
            ],
        )


class GeographicDiscoveryInterpretationTests(TestCase):
    def test_interpretation_preserves_discovery_candidates(self):
        from .geography.discovery import (
            interpret_discovery_candidates,
        )

        candidates = [
            {
                "name": "Lake Como",
                "country_code": "IT",
                "geographic_type": "lake",
            },
            {
                "name": "Estoril",
                "country_code": "PT",
                "geographic_type": "settlement",
            },
        ]

        interpretation = interpret_discovery_candidates(
            candidates
        )

        self.assertIs(
            interpretation["candidates"],
            candidates,
        )

    def test_interpretation_includes_correspondence_pairs(self):
        from .geography.discovery import (
            interpret_discovery_candidates,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": ["Como Lake"],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 121,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        unrelated_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        interpretation = interpret_discovery_candidates(
            [
                registry_candidate,
                google_candidate,
                unrelated_candidate,
            ]
        )

        self.assertEqual(
            interpretation["correspondence_pairs"],
            [
                (
                    registry_candidate,
                    google_candidate,
                )
            ],
        )

    def test_interpretation_preserves_candidates_when_no_correspondence_exists(self):
        from .geography.discovery import (
            interpret_discovery_candidates,
        )

        lake_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        estoril_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        candidates = [
            lake_candidate,
            estoril_candidate,
        ]

        interpretation = interpret_discovery_candidates(
            candidates
        )

        self.assertIs(
            interpretation["candidates"],
            candidates,
        )
        self.assertEqual(
            interpretation["correspondence_pairs"],
            [],
        )


class GeographicDiscoveryInterpretedSearchTests(TestCase):
    @patch("core.geography.discovery.interpret_discovery_candidates")
    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_composes_collection_and_interpretation(
        self,
        mock_search_global_discovery_places,
        mock_interpret_discovery_candidates,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        candidates = [
            {
                "name": "Lake Como",
                "country_code": "IT",
                "geographic_type": "lake",
            },
            {
                "name": "Estoril",
                "country_code": "PT",
                "geographic_type": "settlement",
            },
        ]
        interpretation = {
            "candidates": candidates,
            "correspondence_pairs": [],
        }

        mock_search_global_discovery_places.return_value = candidates
        mock_interpret_discovery_candidates.return_value = interpretation

        result = search_interpreted_global_discovery_places(
            "Lake Como"
        )

        mock_search_global_discovery_places.assert_called_once_with(
            "Lake Como"
        )
        mock_interpret_discovery_candidates.assert_called_once_with(
            candidates
        )
        self.assertIs(
            result,
            interpretation,
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_returns_real_correspondence_evidence(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 121,
        }

        provider_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        candidates = [
            registry_candidate,
            provider_candidate,
        ]

        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Lake Como"
        )

        self.assertIs(
            result["candidates"],
            candidates,
        )
        self.assertEqual(
            result["correspondence_pairs"],
            [
                (
                    registry_candidate,
                    provider_candidate,
                )
            ],
        )


class GeographicDiscoveryAlternativeEvidenceTests(TestCase):
    def test_same_name_in_different_known_countries_is_alternative_evidence(self):
        from .geography.discovery import (
            discovery_candidates_have_country_alternative_evidence,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        self.assertTrue(
            discovery_candidates_have_country_alternative_evidence(
                portugal_candidate,
                brazil_candidate,
            )
        )

    def test_country_alternative_evidence_requires_shared_name_and_known_country_conflict(self):
        from .geography.discovery import (
            discovery_candidates_have_country_alternative_evidence,
        )

        base_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        cases = [
            (
                "same country",
                {
                    "name": "Estoril",
                    "canonical_name": "Estoril",
                    "aliases": [],
                    "country_code": "PT",
                    "geographic_type": "settlement",
                },
            ),
            (
                "missing country",
                {
                    "name": "Estoril",
                    "canonical_name": "Estoril",
                    "aliases": [],
                    "country_code": "",
                    "geographic_type": "settlement",
                },
            ),
            (
                "different name",
                {
                    "name": "Santos",
                    "canonical_name": "Santos",
                    "aliases": [],
                    "country_code": "BR",
                    "geographic_type": "settlement",
                },
            ),
        ]

        for label, other_candidate in cases:
            with self.subTest(label=label):
                self.assertFalse(
                    discovery_candidates_have_country_alternative_evidence(
                        base_candidate,
                        other_candidate,
                    )
                )

    def test_interpretation_includes_country_alternative_pairs(self):
        from .geography.discovery import (
            interpret_discovery_candidates,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        unrelated_candidate = {
            "name": "Santos",
            "canonical_name": "Santos",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        interpretation = interpret_discovery_candidates(
            [
                portugal_candidate,
                brazil_candidate,
                unrelated_candidate,
            ]
        )

        self.assertEqual(
            interpretation["country_alternative_pairs"],
            [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        )

    def test_country_alternative_pair_is_not_also_correspondence_pair(self):
        from .geography.discovery import (
            interpret_discovery_candidates,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        candidates = [
            portugal_candidate,
            brazil_candidate,
        ]

        interpretation = interpret_discovery_candidates(
            candidates
        )

        self.assertEqual(
            interpretation["country_alternative_pairs"],
            [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        )
        self.assertEqual(
            interpretation["correspondence_pairs"],
            [],
        )


class GeographicDiscoveryQueryEvidenceTests(TestCase):
    def test_candidate_exact_query_match_uses_name_canonical_name_and_aliases(self):
        from .geography.discovery import (
            discovery_candidate_exactly_matches_query,
        )

        candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": [
                "Como Lake",
            ],
            "country_code": "IT",
            "geographic_type": "lake",
        }

        cases = [
            ("Lago di Como", True),
            ("lake como", True),
            ("COMO LAKE", True),
            ("Lake Como National Park", False),
            ("Como", False),
            ("", False),
        ]

        for query, expected in cases:
            with self.subTest(query=query):
                self.assertEqual(
                    discovery_candidate_exactly_matches_query(
                        candidate,
                        query,
                    ),
                    expected,
                )

    def test_country_alternative_is_query_relevant_only_when_both_candidates_exactly_match(self):
        from .geography.discovery import (
            discovery_country_alternative_is_query_relevant,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        parque_candidate = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "park",
        }

        self.assertTrue(
            discovery_country_alternative_is_query_relevant(
                portugal_candidate,
                brazil_candidate,
                "Estoril",
            )
        )

        self.assertFalse(
            discovery_country_alternative_is_query_relevant(
                portugal_candidate,
                parque_candidate,
                "Estoril",
            )
        )

    def test_country_alternative_query_relevance_accepts_exact_alias_matches(self):
        from .geography.discovery import (
            discovery_country_alternative_is_query_relevant,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": ["Estoril Coast"],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril do Sul",
            "canonical_name": "Estoril do Sul",
            "aliases": ["Estoril Coast"],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        self.assertTrue(
            discovery_country_alternative_is_query_relevant(
                portugal_candidate,
                brazil_candidate,
                "estoril coast",
            )
        )

    def test_finds_only_query_relevant_country_alternative_pairs(self):
        from .geography.discovery import (
            find_query_relevant_country_alternative_pairs,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        unrelated_candidate = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "park",
        }

        self.assertEqual(
            find_query_relevant_country_alternative_pairs(
                [
                    portugal_candidate,
                    brazil_candidate,
                    unrelated_candidate,
                ],
                "Estoril",
            ),
            [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_includes_query_relevant_country_alternatives(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        candidates = [
            portugal_candidate,
            brazil_candidate,
        ]

        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Estoril"
        )

        self.assertIs(
            result["candidates"],
            candidates,
        )
        self.assertEqual(
            result["country_alternative_pairs"],
            [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        )
        self.assertEqual(
            result["query_relevant_country_alternative_pairs"],
            [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        )


class GeographicDiscoveryMeaningfulAmbiguityTests(TestCase):
    def test_query_relevant_country_alternatives_are_meaningfully_ambiguous(self):
        from .geography.discovery import (
            discovery_has_meaningful_ambiguity,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        interpretation = {
            "candidates": [
                portugal_candidate,
                brazil_candidate,
            ],
            "correspondence_pairs": [],
            "country_alternative_pairs": [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
            "query_relevant_country_alternative_pairs": [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        }

        self.assertTrue(
            discovery_has_meaningful_ambiguity(
                interpretation
            )
        )

    def test_corresponding_candidates_are_not_meaningfully_ambiguous(self):
        from .geography.discovery import (
            discovery_has_meaningful_ambiguity,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 42,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "lake-como-google",
        }

        interpretation = {
            "candidates": [
                registry_candidate,
                google_candidate,
            ],
            "correspondence_pairs": [
                (
                    registry_candidate,
                    google_candidate,
                )
            ],
            "country_alternative_pairs": [],
            "query_relevant_country_alternative_pairs": [],
        }

        self.assertFalse(
            discovery_has_meaningful_ambiguity(
                interpretation
            )
        )

    def test_multiple_independent_candidates_are_not_meaningfully_ambiguous(self):
        from .geography.discovery import (
            discovery_has_meaningful_ambiguity,
        )

        candidates = [
            {
                "name": "Sahara",
                "country_code": "DZ",
                "geographic_type": "desert",
            },
            {
                "name": "Sahara Hotel",
                "country_code": "MA",
                "geographic_type": "hotel",
            },
            {
                "name": "Sahara Restaurant",
                "country_code": "TN",
                "geographic_type": "restaurant",
            },
        ]

        interpretation = {
            "candidates": candidates,
            "correspondence_pairs": [],
            "country_alternative_pairs": [],
            "query_relevant_country_alternative_pairs": [],
        }

        self.assertFalse(
            discovery_has_meaningful_ambiguity(
                interpretation
            )
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_reports_meaningful_ambiguity(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        mock_search_global_discovery_places.return_value = [
            portugal_candidate,
            brazil_candidate,
        ]

        result = search_interpreted_global_discovery_places(
            "Estoril"
        )

        self.assertTrue(
            result["meaningful_ambiguity"]
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_does_not_report_correspondence_as_ambiguity(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 42,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "lake-como-google",
        }

        mock_search_global_discovery_places.return_value = [
            registry_candidate,
            google_candidate,
        ]

        result = search_interpreted_global_discovery_places(
            "Lake Como"
        )

        self.assertEqual(
            result["correspondence_pairs"],
            [
                (
                    registry_candidate,
                    google_candidate,
                )
            ],
        )
        self.assertEqual(
            result["query_relevant_country_alternative_pairs"],
            [],
        )
        self.assertFalse(
            result["meaningful_ambiguity"]
        )


class GeographicDiscoveryRefinementTests(TestCase):
    def test_builds_country_refinement_options_from_relevant_alternatives(self):
        from .geography.discovery import (
            build_discovery_country_refinement_options,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        interpretation = {
            "query_relevant_country_alternative_pairs": [
                (
                    portugal_candidate,
                    brazil_candidate,
                )
            ],
        }

        self.assertEqual(
            build_discovery_country_refinement_options(
                interpretation
            ),
            [
                {"country_code": "PT"},
                {"country_code": "BR"},
            ],
        )

    def test_country_refinement_options_are_unique_and_require_relevant_alternatives(self):
        from .geography.discovery import (
            build_discovery_country_refinement_options,
        )

        portugal_registry_candidate = {
            "name": "Estoril",
            "country_code": "PT",
        }

        portugal_provider_candidate = {
            "name": "Estoril",
            "country_code": "PT",
        }

        brazil_candidate = {
            "name": "Estoril",
            "country_code": "BR",
        }

        cases = [
            (
                "deduplicates repeated countries",
                {
                    "query_relevant_country_alternative_pairs": [
                        (
                            portugal_registry_candidate,
                            brazil_candidate,
                        ),
                        (
                            portugal_provider_candidate,
                            brazil_candidate,
                        ),
                    ],
                },
                [
                    {"country_code": "PT"},
                    {"country_code": "BR"},
                ],
            ),
            (
                "returns no options without relevant alternatives",
                {
                    "query_relevant_country_alternative_pairs": [],
                },
                [],
            ),
        ]

        for label, interpretation, expected in cases:
            with self.subTest(label=label):
                self.assertEqual(
                    build_discovery_country_refinement_options(
                        interpretation
                    ),
                    expected,
                )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_includes_country_refinement_options(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
        }

        brazil_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
        }

        mock_search_global_discovery_places.return_value = [
            portugal_candidate,
            brazil_candidate,
        ]

        result = search_interpreted_global_discovery_places(
            "Estoril"
        )

        self.assertTrue(
            result["meaningful_ambiguity"]
        )
        self.assertEqual(
            result["country_refinement_options"],
            [
                {"country_code": "PT"},
                {"country_code": "BR"},
            ],
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_has_no_country_refinement_for_correspondence(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        registry_candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "existing_place_id": 42,
        }

        google_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "lake-como-google",
        }

        mock_search_global_discovery_places.return_value = [
            registry_candidate,
            google_candidate,
        ]

        result = search_interpreted_global_discovery_places(
            "Lake Como"
        )

        self.assertFalse(
            result["meaningful_ambiguity"]
        )
        self.assertEqual(
            result["country_refinement_options"],
            [],
        )
