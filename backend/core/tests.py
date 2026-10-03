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
