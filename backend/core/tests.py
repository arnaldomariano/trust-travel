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



class GeographicPlaceMaterializationAPITests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        self.user = User.objects.create_user(
            username="geographic-place-materialization-user",
            password="test-password",
        )
        self.access_token = str(
            AccessToken.for_user(self.user)
        )
        self.url = "/api/geography/places/materialize/"

    @patch("core.views.materialize_city_place")
    @patch("core.views.get_google_geographic_place")
    def test_preserve_returns_resolution_required_without_internal_evidence(
        self,
        mock_get_google_geographic_place,
        mock_materialize_city_place,
    ):
        from .models import Destination, Place

        country = get_or_create_country(value="United States")
        destination = Destination.objects.create(
            name="United States",
            country="United States",
        )
        reference_place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Springfield",
            canonical_name="Springfield",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )

        mock_get_google_geographic_place.return_value = {
            "name": "Springfield",
            "canonical_name": "Springfield",
            "aliases": [],
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
            "country_code": "US",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "preserve",
            "place": None,
            "created": False,
            "evaluations": [
                {
                    "place": reference_place,
                    "identity_relation": "unresolved",
                    "reconciliation_action": "preserve",
                }
            ],
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "google_places",
                "external_id": "springfield-massachusetts",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )

        data = response.json()

        self.assertEqual(
            data["code"],
            "geographic_resolution_required",
        )
        self.assertEqual(
            data["detail"],
            "This geographic place needs confirmation before it can be added.",
        )
        self.assertEqual(
            data["references"],
            [
                {
                    "id": reference_place.id,
                    "name": "Springfield",
                    "country_code": "US",
                    "country_name": "United States",
                    "geographic_type": "settlement",
                }
            ],
        )
        self.assertNotIn("evaluations", data)
        self.assertNotIn("identity_relation", str(data))
        self.assertNotIn("reconciliation_action", str(data))


    @patch("core.views.materialize_city_place")
    @patch("core.views.get_google_geographic_place")
    def test_reuse_returns_existing_place_with_200(
        self,
        mock_get_google_geographic_place,
        mock_materialize_city_place,
    ):
        from .models import Destination, Place

        country = get_or_create_country(value="Italy")
        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )
        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="Lake Como",
            canonical_name="Lake Como",
            country_code="IT",
            place_type="city",
            geographic_type="lake",
        )

        mock_get_google_geographic_place.return_value = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "external_source": "google_places",
            "external_id": "lake-como-google",
            "country_code": "IT",
            "geographic_type": "lake",
        }
        mock_materialize_city_place.return_value = {
            "state": "reuse",
            "place": place,
            "created": False,
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "google_places",
                "external_id": "lake-como-google",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            200,
            response.content,
        )
        self.assertEqual(response.json()["id"], place.id)
        self.assertEqual(response.json()["name"], "Lake Como")

    @patch("core.views.materialize_city_place")
    @patch("core.views.get_google_geographic_place")
    def test_created_returns_new_place_with_201(
        self,
        mock_get_google_geographic_place,
        mock_materialize_city_place,
    ):
        from .models import Destination, Place

        country = get_or_create_country(value="Italy")
        destination = Destination.objects.create(
            name="Italy",
            country="Italy",
        )
        place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="New Geographic Place",
            canonical_name="New Geographic Place",
            country_code="IT",
            place_type="city",
            geographic_type="settlement",
        )

        mock_get_google_geographic_place.return_value = {
            "name": "New Geographic Place",
            "canonical_name": "New Geographic Place",
            "aliases": [],
            "external_source": "google_places",
            "external_id": "new-geographic-place",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "created",
            "place": place,
            "created": True,
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "google_places",
                "external_id": "new-geographic-place",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            201,
            response.content,
        )
        self.assertEqual(response.json()["id"], place.id)
        self.assertEqual(
            response.json()["name"],
            "New Geographic Place",
        )



    @patch("core.views.materialize_city_place")
    @patch("core.views.get_google_geographic_place")
    def test_unknown_materialization_state_fails_closed(
        self,
        mock_get_google_geographic_place,
        mock_materialize_city_place,
    ):
        mock_get_google_geographic_place.return_value = {
            "name": "Future Geographic Place",
            "canonical_name": "Future Geographic Place",
            "aliases": [],
            "external_source": "google_places",
            "external_id": "future-geographic-place",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "escalate",
            "place": None,
            "created": False,
            "evaluations": [],
        }

        with self.assertRaisesRegex(
            ValueError,
            "Unsupported geographic materialization state: escalate",
        ):
            self.client.post(
                self.url,
                data={
                    "external_source": "google_places",
                    "external_id": "future-geographic-place",
                },
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
            )


class GeographicCityMaterializationAPITests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken
        from .models import Destination, Place

        self.user = User.objects.create_user(
            username="geographic-city-materialization-user",
            password="test-password",
        )
        self.access_token = str(
            AccessToken.for_user(self.user)
        )
        self.url = "/api/geography/cities/materialize/"

        self.country = get_or_create_country(
            value="United States"
        )
        self.destination = Destination.objects.create(
            name="United States",
            country="United States",
        )
        self.country_place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            name="United States",
            canonical_name="United States",
            country_code="US",
            place_type="country",
        )

    @patch("core.views.materialize_city_place")
    @patch("core.views.get_geographic_place")
    def test_preserve_returns_resolution_required_without_internal_evidence(
        self,
        mock_get_geographic_place,
        mock_materialize_city_place,
    ):
        from .models import Place

        reference_place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Springfield",
            canonical_name="Springfield",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )

        mock_get_geographic_place.return_value = {
            "name": "Springfield",
            "canonical_name": "Springfield",
            "aliases": [],
            "external_source": "geonames",
            "external_id": "springfield-massachusetts",
            "country_code": "US",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "preserve",
            "place": None,
            "created": False,
            "evaluations": [
                {
                    "place": reference_place,
                    "identity_relation": "unresolved",
                    "reconciliation_action": "preserve",
                }
            ],
        }

        response = self.client.post(
            self.url,
            data={
                "external_id": "springfield-massachusetts",
                "country_code": "US",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )

        data = response.json()

        self.assertEqual(
            data["code"],
            "geographic_resolution_required",
        )
        self.assertEqual(
            data["references"],
            [
                {
                    "id": reference_place.id,
                    "name": "Springfield",
                    "country_code": "US",
                    "country_name": "United States",
                    "geographic_type": "settlement",
                }
            ],
        )
        self.assertNotIn("evaluations", data)
        self.assertNotIn("identity_relation", str(data))
        self.assertNotIn("reconciliation_action", str(data))


    @patch("core.views.materialize_city_place")
    @patch("core.views.get_geographic_place")
    def test_reuse_returns_existing_place_with_200(
        self,
        mock_get_geographic_place,
        mock_materialize_city_place,
    ):
        from .models import Place

        place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Springfield",
            canonical_name="Springfield",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )

        mock_get_geographic_place.return_value = {
            "name": "Springfield",
            "canonical_name": "Springfield",
            "aliases": [],
            "external_source": "geonames",
            "external_id": "springfield-existing",
            "country_code": "US",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "reuse",
            "place": place,
            "created": False,
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_id": "springfield-existing",
                "country_code": "US",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            200,
            response.content,
        )
        self.assertEqual(response.json()["id"], place.id)
        self.assertEqual(response.json()["name"], "Springfield")

    @patch("core.views.materialize_city_place")
    @patch("core.views.get_geographic_place")
    def test_created_returns_new_place_with_201(
        self,
        mock_get_geographic_place,
        mock_materialize_city_place,
    ):
        from .models import Place

        place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="New Geographic Place",
            canonical_name="New Geographic Place",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )

        mock_get_geographic_place.return_value = {
            "name": "New Geographic Place",
            "canonical_name": "New Geographic Place",
            "aliases": [],
            "external_source": "geonames",
            "external_id": "new-geographic-place",
            "country_code": "US",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "created",
            "place": place,
            "created": True,
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_id": "new-geographic-place",
                "country_code": "US",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            201,
            response.content,
        )
        self.assertEqual(response.json()["id"], place.id)
        self.assertEqual(
            response.json()["name"],
            "New Geographic Place",
        )


    @patch("core.views.materialize_city_place")
    @patch("core.views.get_geographic_place")
    def test_unknown_materialization_state_fails_closed(
        self,
        mock_get_geographic_place,
        mock_materialize_city_place,
    ):
        mock_get_geographic_place.return_value = {
            "name": "Future Geographic Place",
            "canonical_name": "Future Geographic Place",
            "aliases": [],
            "external_source": "geonames",
            "external_id": "future-geographic-place",
            "country_code": "US",
            "geographic_type": "settlement",
        }
        mock_materialize_city_place.return_value = {
            "state": "escalate",
            "place": None,
            "created": False,
            "evaluations": [],
        }

        with self.assertRaisesRegex(
            ValueError,
            "Unsupported geographic materialization state: escalate",
        ):
            self.client.post(
                self.url,
                data={
                    "external_id": "future-geographic-place",
                    "country_code": "US",
                },
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
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

    def test_candidate_reference_discovery_returns_plausible_existing_place(self):
        from .geography.services import (
            find_candidate_city_reference_places,
        )

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

        references = find_candidate_city_reference_places(
            city_result=google_result,
            resolved_country=self.country,
            country_code="IT",
        )

        self.assertEqual(
            [place.pk for place in references],
            [self.lake.pk],
        )

    @patch("core.geography.services.get_geographic_place")
    def test_reference_evidence_reconstruction_fetches_known_geonames_identity(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import reconstruct_place_reference_evidence

        provider_evidence = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": ["Lake Como"],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
            "latitude": 46.00793,
            "longitude": 9.26079,
            "admin_context": [
                {"level": 1, "name": "Lombardy"},
            ],
        }
        mock_get_geographic_place.return_value = provider_evidence

        evidence = reconstruct_place_reference_evidence(self.lake)

        mock_get_geographic_place.assert_called_once_with("3178228")
        self.assertEqual(evidence, [provider_evidence])
        self.assertIs(evidence[0], provider_evidence)

    @patch("core.geography.services.get_geographic_place")
    def test_reference_evidence_reconstruction_does_not_hide_provider_failure(
        self,
        mock_get_geographic_place,
    ):
        from .geography.providers.geonames import GeoNamesRequestError
        from .geography.services import reconstruct_place_reference_evidence

        mock_get_geographic_place.side_effect = GeoNamesRequestError(
            "GeoNames geographic place lookup failed."
        )

        with self.assertRaises(GeoNamesRequestError):
            reconstruct_place_reference_evidence(self.lake)

    @patch("core.geography.services.get_geographic_place")
    def test_reference_evidence_reconstruction_rejects_unsupported_identity_source(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import reconstruct_place_reference_evidence
        from .models import PlaceExternalIdentity

        PlaceExternalIdentity.objects.create(
            place=self.lake,
            external_source="foursquare",
            external_id="fsq-lake-como",
            geographic_type="lake",
        )
        mock_get_geographic_place.return_value = {
            "external_source": "geonames",
            "external_id": "3178228",
        }

        with self.assertRaisesRegex(
            ValueError,
            "Unsupported reference evidence source: foursquare",
        ):
            reconstruct_place_reference_evidence(self.lake)

    @patch("core.geography.services.get_google_geographic_place")
    @patch("core.geography.services.get_geographic_place")
    def test_reference_evidence_reconstruction_fetches_each_supported_identity(
        self,
        mock_get_geographic_place,
        mock_get_google_geographic_place,
    ):
        from .geography.services import reconstruct_place_reference_evidence
        from .models import PlaceExternalIdentity

        PlaceExternalIdentity.objects.create(
            place=self.lake,
            external_source="google_places",
            external_id="google-lake-como",
            geographic_type="lake",
        )

        geonames_evidence = {
            "name": "Lago di Como",
            "external_source": "geonames",
            "external_id": "3178228",
            "geographic_type": "lake",
        }
        google_evidence = {
            "name": "Lake Como",
            "external_source": "google_places",
            "external_id": "google-lake-como",
            "geographic_type": "lake",
        }
        mock_get_geographic_place.return_value = geonames_evidence
        mock_get_google_geographic_place.return_value = google_evidence

        evidence = reconstruct_place_reference_evidence(self.lake)

        mock_get_geographic_place.assert_called_once_with("3178228")
        mock_get_google_geographic_place.assert_called_once_with(
            "google-lake-como"
        )
        self.assertEqual(len(evidence), 2)
        self.assertIn(geonames_evidence, evidence)
        self.assertIn(google_evidence, evidence)

    @patch("core.geography.services.get_geographic_place")
    def test_exact_provider_identity_resolves_reconstructed_reference_as_same(
        self,
        mock_get_geographic_place,
    ):
        from .geography.resolution import (
            get_reference_evidence_identity_relation,
        )
        from .geography.services import (
            find_candidate_city_reference_places,
            reconstruct_place_reference_evidence,
        )

        candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }
        provider_evidence = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": ["Lake Como"],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }
        mock_get_geographic_place.return_value = provider_evidence

        references = find_candidate_city_reference_places(
            city_result=candidate,
            resolved_country=self.country,
            country_code="IT",
        )
        self.assertEqual(
            [place.pk for place in references],
            [self.lake.pk],
        )

        reference_evidence = reconstruct_place_reference_evidence(
            references[0]
        )
        relation = get_reference_evidence_identity_relation(
            candidate,
            reference_evidence,
        )

        mock_get_geographic_place.assert_called_once_with("3178228")
        self.assertEqual(relation, "same")

    def test_candidate_reference_discovery_preserves_multiple_plausible_places(self):
        from .geography.services import (
            find_candidate_city_reference_places,
        )
        from .models import Destination, Place

        country = get_or_create_country(value="United States")

        destination = Destination.objects.create(
            name="United States",
            country="United States",
        )

        country_place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="United States",
            canonical_name="United States",
            aliases=["USA"],
            country_code="US",
            place_type="country",
        )

        springfield_illinois = Place.objects.create(
            destination=destination,
            country_ref=country,
            parent_place=country_place,
            name="Springfield",
            canonical_name="Springfield",
            aliases=[],
            country_code="US",
            place_type="city",
            geographic_type="settlement",
            city="Springfield",
        )

        springfield_massachusetts = Place.objects.create(
            destination=destination,
            country_ref=country,
            parent_place=country_place,
            name="Springfield",
            canonical_name="Springfield",
            aliases=[],
            country_code="US",
            place_type="city",
            geographic_type="settlement",
            city="Springfield",
        )

        incoming_result = {
            "name": "Springfield",
            "canonical_name": "Springfield",
            "aliases": [],
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "google-springfield",
        }

        references = find_candidate_city_reference_places(
            city_result=incoming_result,
            resolved_country=country,
            country_code="US",
        )

        self.assertEqual(
            {place.pk for place in references},
            {
                springfield_illinois.pk,
                springfield_massachusetts.pk,
            },
        )

    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_evaluation_authorizes_exact_identity_reuse(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import (
            evaluate_candidate_place_reference,
        )

        provider_evidence = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": ["Lake Como"],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }
        mock_get_geographic_place.return_value = provider_evidence
        candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }

        result = evaluate_candidate_place_reference(
            candidate,
            self.lake,
        )

        mock_get_geographic_place.assert_called_once_with("3178228")
        self.assertEqual(result["place"].pk, self.lake.pk)
        self.assertEqual(result["identity_relation"], "same")
        self.assertEqual(result["reconciliation_action"], "reuse")

    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_evaluation_preserves_unresolved_place(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import (
            evaluate_candidate_place_reference,
        )
        from .models import Destination, Place, PlaceExternalIdentity

        country = get_or_create_country(value="United States")
        destination = Destination.objects.create(
            name="United States",
            country="United States",
        )
        country_place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="United States",
            canonical_name="United States",
            aliases=["USA"],
            country_code="US",
            place_type="country",
        )
        springfield = Place.objects.create(
            destination=destination,
            country_ref=country,
            parent_place=country_place,
            name="Springfield",
            canonical_name="Springfield",
            aliases=[],
            country_code="US",
            place_type="city",
            geographic_type="settlement",
            city="Springfield",
        )
        PlaceExternalIdentity.objects.create(
            place=springfield,
            external_source="geonames",
            external_id="springfield-illinois",
            geographic_type="settlement",
        )
        mock_get_geographic_place.return_value = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
            "admin_context": [
                {"level": 1, "name": "Illinois"},
            ],
        }
        candidate = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
            "admin_context": [
                {"level": 1, "name": "Massachusetts"},
            ],
        }

        result = evaluate_candidate_place_reference(
            candidate,
            springfield,
        )

        mock_get_geographic_place.assert_called_once_with(
            "springfield-illinois"
        )
        self.assertIs(result["place"], springfield)
        self.assertEqual(result["identity_relation"], "unresolved")
        self.assertEqual(result["reconciliation_action"], "preserve")

    @patch("core.geography.services.get_google_geographic_place")
    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_collection_preserves_each_evaluation(
        self,
        mock_get_geographic_place,
        mock_get_google_geographic_place,
    ):
        from .geography.services import evaluate_candidate_place_references
        from .models import Destination, Place, PlaceExternalIdentity

        country = get_or_create_country(value="United States")
        destination = Destination.objects.create(
            name="United States",
            country="United States",
        )
        country_place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="United States",
            country_code="US",
            place_type="country",
        )
        springfield_illinois = Place.objects.create(
            destination=destination,
            country_ref=country,
            parent_place=country_place,
            name="Springfield",
            canonical_name="Springfield",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )
        springfield_massachusetts = Place.objects.create(
            destination=destination,
            country_ref=country,
            parent_place=country_place,
            name="Springfield",
            canonical_name="Springfield",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )
        PlaceExternalIdentity.objects.create(
            place=springfield_illinois,
            external_source="geonames",
            external_id="springfield-illinois",
        )
        PlaceExternalIdentity.objects.create(
            place=springfield_massachusetts,
            external_source="google_places",
            external_id="springfield-massachusetts",
        )

        mock_get_geographic_place.return_value = {
            "external_source": "geonames",
            "external_id": "springfield-illinois",
        }
        mock_get_google_geographic_place.return_value = {
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
        }
        candidate = {
            "name": "Springfield",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
        }

        evaluations = evaluate_candidate_place_references(
            candidate,
            [springfield_illinois, springfield_massachusetts],
        )

        self.assertEqual(len(evaluations), 2)
        by_place = {
            evaluation["place"].pk: evaluation
            for evaluation in evaluations
        }
        self.assertEqual(
            by_place[springfield_illinois.pk]["identity_relation"],
            "unresolved",
        )
        self.assertEqual(
            by_place[springfield_illinois.pk]["reconciliation_action"],
            "preserve",
        )
        self.assertEqual(
            by_place[springfield_massachusetts.pk]["identity_relation"],
            "same",
        )
        self.assertEqual(
            by_place[springfield_massachusetts.pk]["reconciliation_action"],
            "reuse",
        )

    @patch("core.geography.services.evaluate_candidate_place_references")
    def test_unresolved_candidate_references_produce_preserve_state(
        self,
        mock_evaluate_references,
    ):
        from .geography.services import resolve_candidate_place_references

        reference = object()
        mock_evaluate_references.return_value = [
            {
                "place": reference,
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            }
        ]

        result = resolve_candidate_place_references(
            candidate={"name": "Springfield"},
            places=[reference],
        )

        self.assertEqual(result["state"], "preserve")
        self.assertEqual(
            result["evaluations"],
            mock_evaluate_references.return_value,
        )

    @patch("core.geography.services.evaluate_candidate_place_references")
    def test_no_candidate_references_produce_no_reference_state(
        self,
        mock_evaluate_references,
    ):
        from .geography.services import resolve_candidate_place_references

        mock_evaluate_references.return_value = []

        result = resolve_candidate_place_references(
            candidate={"name": "New Place"},
            places=[],
        )

        self.assertEqual(result["state"], "no_reference")
        self.assertEqual(result["evaluations"], [])

    @patch("core.geography.services.find_candidate_city_reference_places")
    def test_city_reference_gate_reuses_exact_persisted_identity_without_discovery(
        self,
        mock_find_references,
    ):
        from .geography.services import evaluate_city_reference_gate

        candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": ["Lake Como"],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }

        result = evaluate_city_reference_gate(
            city_result=candidate,
            resolved_country=self.country,
            country_code="IT",
        )

        self.assertEqual(result["state"], "reuse")
        self.assertEqual(result["place"].pk, self.lake.pk)
        self.assertEqual(result["evaluations"], [])
        mock_find_references.assert_not_called()

    @patch("core.geography.services.get_geographic_place")
    def test_city_reference_gate_preserves_single_unresolved_reference(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import evaluate_city_reference_gate
        from .models import Destination, Place, PlaceExternalIdentity

        country = get_or_create_country(value="United States")
        destination = Destination.objects.create(
            name="United States",
            country="United States",
        )
        country_place = Place.objects.create(
            destination=destination,
            country_ref=country,
            name="United States",
            canonical_name="United States",
            aliases=["USA"],
            country_code="US",
            place_type="country",
        )
        springfield_illinois = Place.objects.create(
            destination=destination,
            country_ref=country,
            parent_place=country_place,
            name="Springfield",
            canonical_name="Springfield",
            aliases=[],
            country_code="US",
            place_type="city",
            geographic_type="settlement",
            city="Springfield",
        )
        PlaceExternalIdentity.objects.create(
            place=springfield_illinois,
            external_source="geonames",
            external_id="springfield-illinois",
            geographic_type="settlement",
        )
        mock_get_geographic_place.return_value = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
        }
        candidate = {
            "name": "Springfield",
            "canonical_name": "Springfield",
            "aliases": [],
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
        }

        result = evaluate_city_reference_gate(
            city_result=candidate,
            resolved_country=country,
            country_code="US",
        )

        self.assertEqual(result["state"], "preserve")
        self.assertEqual(len(result["evaluations"]), 1)
        evaluation = result["evaluations"][0]
        self.assertEqual(evaluation["place"].pk, springfield_illinois.pk)
        self.assertEqual(evaluation["identity_relation"], "unresolved")
        self.assertEqual(evaluation["reconciliation_action"], "preserve")
        mock_get_geographic_place.assert_called_once_with(
            "springfield-illinois"
        )

    @patch("core.geography.services.find_candidate_city_reference_places")
    def test_city_reference_gate_reports_no_reference_when_discovery_finds_none(
        self,
        mock_find_references,
    ):
        from .geography.services import evaluate_city_reference_gate

        mock_find_references.return_value = []
        candidate = {
            "name": "New Geographic Place",
            "canonical_name": "New Geographic Place",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "new-google-place",
        }

        result = evaluate_city_reference_gate(
            city_result=candidate,
            resolved_country=self.country,
            country_code="IT",
        )

        self.assertEqual(result["state"], "no_reference")
        self.assertEqual(result["evaluations"], [])
        mock_find_references.assert_called_once_with(
            city_result=candidate,
            resolved_country=self.country,
            country_code="IT",
        )

    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_reuses_gate_authorized_place(
        self,
        mock_reference_gate,
        mock_enrich,
        mock_create,
    ):
        from .geography.services import materialize_city_place

        mock_reference_gate.return_value = {
            "state": "reuse",
            "place": self.lake,
            "evaluations": [],
        }
        mock_enrich.return_value = self.lake

        city_result = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }

        result = materialize_city_place(
            city_result=city_result,
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
            user=None,
        )

        self.assertEqual(result["state"], "reuse")
        self.assertEqual(result["place"].pk, self.lake.pk)
        self.assertFalse(result["created"])
        self.assertEqual(result["evaluations"], [])
        mock_enrich.assert_called_once_with(
            existing_place=self.lake,
            city_result=city_result,
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
        )
        mock_create.assert_not_called()

    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_creates_after_no_reference(
        self,
        mock_reference_gate,
        mock_enrich,
        mock_create,
    ):
        from .geography.services import materialize_city_place

        mock_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }
        mock_create.return_value = (self.lake, True)

        city_result = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        result = materialize_city_place(
            city_result=city_result,
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
            user=None,
        )

        self.assertEqual(result["state"], "created")
        self.assertEqual(result["place"].pk, self.lake.pk)
        self.assertTrue(result["created"])
        self.assertEqual(result["evaluations"], [])
        mock_create.assert_called_once_with(
            city_result=city_result,
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
            user=None,
        )
        mock_enrich.assert_not_called()

    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_reuses_identity_winner_after_creation_race(
        self,
        mock_reference_gate,
        mock_enrich,
        mock_create,
    ):
        from .geography.services import materialize_city_place

        mock_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }
        mock_create.return_value = (self.lake, False)

        city_result = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
        }

        result = materialize_city_place(
            city_result=city_result,
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
            user=None,
        )

        self.assertEqual(result["state"], "reuse")
        self.assertEqual(result["place"].pk, self.lake.pk)
        self.assertFalse(result["created"])
        self.assertEqual(result["evaluations"], [])
        mock_create.assert_called_once_with(
            city_result=city_result,
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
            user=None,
        )
        mock_enrich.assert_not_called()

    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_rejects_unknown_reference_state_without_mutation(
        self,
        mock_reference_gate,
        mock_enrich,
        mock_create,
    ):
        from .geography.services import materialize_city_place

        mock_reference_gate.return_value = {
            "state": "escalate",
            "evaluations": [],
        }

        with self.assertRaises(ValueError):
            materialize_city_place(
                city_result={
                    "name": "Lake Como",
                    "canonical_name": "Lake Como",
                    "aliases": [],
                    "country_code": "IT",
                    "geographic_type": "lake",
                    "external_source": "google_places",
                    "external_id": "google-lake-como",
                },
                resolved_country=self.country,
                country_code="IT",
                country_place=self.country_place,
                user=None,
            )

        mock_enrich.assert_not_called()
        mock_create.assert_not_called()

    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_preserves_unresolved_reference_without_mutation(
        self,
        mock_reference_gate,
        mock_enrich,
        mock_create,
    ):
        from .geography.services import materialize_city_place

        evaluations = [
            {
                "place": self.lake,
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            }
        ]
        mock_reference_gate.return_value = {
            "state": "preserve",
            "evaluations": evaluations,
        }

        result = materialize_city_place(
            city_result={
                "name": "Lake Como",
                "canonical_name": "Lake Como",
                "aliases": [],
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "google_places",
                "external_id": "google-lake-como",
            },
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertIsNone(result["place"])
        self.assertFalse(result["created"])
        self.assertEqual(result["evaluations"], evaluations)
        mock_enrich.assert_not_called()
        mock_create.assert_not_called()

    def test_candidate_reference_discovery_excludes_different_geographic_type(self):
        from .geography.services import (
            find_candidate_city_reference_places,
        )

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

        references = find_candidate_city_reference_places(
            city_result=different_type_result,
            resolved_country=self.country,
            country_code="IT",
        )

        self.assertEqual(references, [])

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

    def test_google_discovery_normalizer_preserves_location_evidence(self):
        from .geography.providers.google_places import (
            normalize_google_discovery_result,
        )

        item = {
            "id": "google-parque-natural-estoril",
            "displayName": {
                "text": "Parque Natural Estoril",
            },
            "primaryType": "city_park",
            "types": [
                "city_park",
                "zoo",
                "park",
                "point_of_interest",
                "establishment",
            ],
            "formattedAddress": (
                "R. Portugal, 1100 - Estoril, "
                "São Bernardo do Campo - SP, "
                "09832-400, Brazil"
            ),
            "location": {
                "latitude": -23.7706338,
                "longitude": -46.5195035,
            },
            "addressComponents": [
                {
                    "longText": "Estoril",
                    "shortText": "Estoril",
                    "types": [
                        "sublocality_level_1",
                        "sublocality",
                        "political",
                    ],
                },
                {
                    "longText": "São Bernardo do Campo",
                    "shortText": "São Bernardo do Campo",
                    "types": [
                        "administrative_area_level_2",
                        "political",
                    ],
                },
                {
                    "longText": "São Paulo",
                    "shortText": "SP",
                    "types": [
                        "administrative_area_level_1",
                        "political",
                    ],
                },
                {
                    "longText": "Brazil",
                    "shortText": "BR",
                    "types": [
                        "country",
                        "political",
                    ],
                },
            ],
        }

        result = normalize_google_discovery_result(item)

        self.assertIsNotNone(result)
        self.assertEqual(result["primary_type"], "city_park")
        self.assertEqual(
            result["formatted_address"],
            (
                "R. Portugal, 1100 - Estoril, "
                "São Bernardo do Campo - SP, "
                "09832-400, Brazil"
            ),
        )
        self.assertEqual(
            result["location_context"],
            [
                {
                    "type": "sublocality_level_1",
                    "name": "Estoril",
                    "short_name": "Estoril",
                },
                {
                    "type": "administrative_area_level_2",
                    "name": "São Bernardo do Campo",
                    "short_name": "São Bernardo do Campo",
                },
                {
                    "type": "administrative_area_level_1",
                    "name": "São Paulo",
                    "short_name": "SP",
                },
                {
                    "type": "country",
                    "name": "Brazil",
                    "short_name": "BR",
                },
            ],
        )
        self.assertEqual(
            result["admin_context"],
            [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                    "code": "",
                    "external_id": "",
                    "iso_code": "",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                    "code": "",
                    "external_id": "",
                    "iso_code": "",
                },
            ],
        )
        self.assertEqual(result["country_code"], "BR")

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

    def test_google_place_details_requests_resolution_evidence(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.google_places import (
            get_google_geographic_place,
        )

        response = io.BytesIO(
            json.dumps(
                {
                    "id": "google-lake-como",
                    "displayName": {
                        "text": "Lake Como",
                    },
                    "types": [
                        "lake",
                        "natural_feature",
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
            ).encode("utf-8")
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
            ) as mocked_urlopen,
        ):
            get_google_geographic_place("google-lake-como")

        request = mocked_urlopen.call_args.args[0]
        field_mask = request.get_header("X-goog-fieldmask")

        self.assertIn(
            "primaryType",
            field_mask,
        )
        self.assertIn(
            "formattedAddress",
            field_mask,
        )

    def test_google_discovery_search_requests_resolution_evidence(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.google_places import (
            search_google_discovery_places,
        )

        response = io.BytesIO(
            json.dumps({"places": []}).encode("utf-8")
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
            ) as mocked_urlopen,
        ):
            search_google_discovery_places("Parque Estoril")

        request = mocked_urlopen.call_args.args[0]
        field_mask = request.get_header("X-goog-fieldmask")

        self.assertIn(
            "places.primaryType",
            field_mask,
        )
        self.assertIn(
            "places.formattedAddress",
            field_mask,
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
    def test_geonames_normalizer_preserves_structured_admin_identity(self):
        from .geography.providers.geonames import (
            normalize_geographic_result,
        )

        result = normalize_geographic_result(
            {
                "geonameId": 13015945,
                "name": "Parque Estoril",
                "toponymName": "Parque Estoril",
                "countryCode": "BR",
                "lat": "-22.44488",
                "lng": "-43.45969",
                "fcl": "L",
                "fcode": "PRK",
                "population": 0,
                "alternateNames": [],
                "adminName1": "Rio de Janeiro",
                "adminCode1": "21",
                "adminId1": "3451189",
                "adminCodes1": {
                    "ISO3166_2": "RJ",
                },
                "adminName2": "Miguel Pereira",
                "adminCode2": "3302908",
                "adminId2": "6322037",
            }
        )

        self.assertEqual(
            result["admin_context"],
            [
                {
                    "level": 1,
                    "name": "Rio de Janeiro",
                    "code": "21",
                    "external_id": "3451189",
                    "iso_code": "RJ",
                },
                {
                    "level": 2,
                    "name": "Miguel Pereira",
                    "code": "3302908",
                    "external_id": "6322037",
                    "iso_code": "",
                },
            ],
        )

    def test_geonames_park_feature_is_classified_as_park(self):
        from .geography.providers.geonames import (
            classify_geographic_feature,
        )

        self.assertEqual(
            classify_geographic_feature("L", "PRK"),
            "park",
        )

    def test_legacy_geographic_search_does_not_treat_park_as_hub(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers.geonames import (
            search_geographic_places,
        )

        response_payload = {
            "geonames": [
                {
                    "geonameId": 13015945,
                    "name": "Parque Estoril",
                    "toponymName": "Parque Estoril",
                    "countryCode": "BR",
                    "lat": "-22.44488",
                    "lng": "-43.45969",
                    "fcl": "L",
                    "fcode": "PRK",
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
                "Parque Estoril"
            )

        self.assertEqual(results, [])

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
    def test_interpreted_search_deduplicates_known_places_for_presentation(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        registry_candidate = {
            "name": "Lago Titicaca",
            "canonical_name": "Lago Titicaca",
            "aliases": [],
            "country_code": "BO",
            "geographic_type": "lake",
            "existing_place_id": 106,
        }

        provider_candidate = {
            "name": "Lago Titicaca",
            "canonical_name": "Lago Titicaca",
            "aliases": [],
            "country_code": "BO",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3927364",
            "existing_place_id": 106,
        }

        candidates = [
            registry_candidate,
            provider_candidate,
        ]

        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Titicaca"
        )

        self.assertIs(
            result["candidates"],
            candidates,
        )
        self.assertEqual(
            result["refined_candidates"],
            [
                {
                    **registry_candidate,
                    "can_open": True,
                },
            ],
        )
        self.assertIsNot(
            result["refined_candidates"][0],
            registry_candidate,
        )
        self.assertNotIn(
            "can_open",
            registry_candidate,
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_builds_suggestion_hypothesis_from_exact_anchor(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        anchor = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
            "existing_place_id": None,
        }
        suggestion_candidate = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "",
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
            "external_source": "google_places",
            "external_id": "google-parque-natural-estoril",
            "existing_place_id": None,
        }

        candidates = [
            anchor,
            suggestion_candidate,
        ]
        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Parque Estoril"
        )

        self.assertEqual(
            len(result["suggestion_hypotheses"]),
            1,
        )
        hypothesis = result["suggestion_hypotheses"][0]

        self.assertIs(
            hypothesis["anchor"],
            anchor,
        )
        self.assertIs(
            hypothesis["candidate"],
            suggestion_candidate,
        )
        self.assertIs(
            result["candidates"],
            candidates,
        )


    def test_suggestion_hypothesis_rejects_known_country_conflict(self):
        from .geography.discovery import (
            find_discovery_suggestion_hypotheses,
        )

        anchor = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "admin_context": [
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        other_country_candidate = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
            "country_code": "PT",
            "admin_context": [
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }

        hypotheses = find_discovery_suggestion_hypotheses(
            [
                anchor,
                other_country_candidate,
            ],
            "Parque Estoril",
        )

        self.assertEqual(
            hypotheses,
            [],
        )


    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_marks_unsupported_external_result_as_not_openable(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        park_candidate = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "park",
            "external_source": "geonames",
            "external_id": "13015945",
            "existing_place_id": None,
        }

        candidates = [park_candidate]
        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Parque Estoril"
        )

        self.assertNotIn(
            "can_open",
            result["candidates"][0],
        )
        self.assertFalse(
            result["refined_candidates"][0]["can_open"]
        )
        self.assertIsNot(
            result["refined_candidates"][0],
            park_candidate,
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_marks_supported_geonames_result_as_openable(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        lake_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178229",
            "existing_place_id": None,
        }

        candidates = [lake_candidate]
        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Lake Como"
        )

        self.assertNotIn(
            "can_open",
            result["candidates"][0],
        )
        self.assertTrue(
            result["refined_candidates"][0]["can_open"]
        )
        self.assertIsNot(
            result["refined_candidates"][0],
            lake_candidate,
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_marks_supported_google_result_as_openable(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        lake_candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "external_source": "google_places",
            "external_id": "google-lake-como",
            "provider_types": ["lake"],
            "existing_place_id": None,
        }

        candidates = [lake_candidate]
        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Lake Como"
        )

        self.assertNotIn(
            "can_open",
            result["candidates"][0],
        )
        self.assertFalse(
            "can_open" in lake_candidate
        )
        self.assertTrue(
            result["refined_candidates"][0]["can_open"]
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_marks_existing_place_as_openable_before_provider_policy(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        existing_park_candidate = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "park",
            "external_source": "geonames",
            "external_id": "13015945",
            "existing_place_id": 999,
        }

        candidates = [existing_park_candidate]
        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Parque Estoril"
        )

        self.assertNotIn(
            "can_open",
            result["candidates"][0],
        )
        self.assertTrue(
            result["refined_candidates"][0]["can_open"]
        )
        self.assertEqual(
            result["refined_candidates"][0]["existing_place_id"],
            999,
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


class GeographicDiscoveryRefinementApplicationTests(TestCase):
    def test_country_refinement_keeps_matching_known_country_candidates(self):
        from .geography.discovery import (
            apply_discovery_country_refinement,
        )

        portugal_candidate = {
            "name": "Estoril",
            "country_code": "PT",
        }

        brazil_candidate = {
            "name": "Estoril",
            "country_code": "BR",
        }

        parque_candidate = {
            "name": "Parque Estoril",
            "country_code": "BR",
        }

        candidates = [
            portugal_candidate,
            brazil_candidate,
            parque_candidate,
        ]

        self.assertEqual(
            apply_discovery_country_refinement(
                candidates,
                "PT",
            ),
            [
                portugal_candidate,
            ],
        )

    def test_country_refinement_excludes_unknown_and_other_countries(self):
        from .geography.discovery import (
            apply_discovery_country_refinement,
        )

        portugal_candidate = {
            "name": "Estoril",
            "country_code": "PT",
        }

        brazil_candidate = {
            "name": "Estoril",
            "country_code": "BR",
        }

        unknown_country_candidate = {
            "name": "Estoril",
            "country_code": "",
        }

        candidates = [
            portugal_candidate,
            brazil_candidate,
            unknown_country_candidate,
        ]

        self.assertEqual(
            apply_discovery_country_refinement(
                candidates,
                " pt ",
            ),
            [
                portugal_candidate,
            ],
        )

    def test_empty_country_refinement_preserves_all_candidates(self):
        from .geography.discovery import (
            apply_discovery_country_refinement,
        )

        candidates = [
            {
                "name": "Estoril",
                "country_code": "PT",
            },
            {
                "name": "Estoril",
                "country_code": "BR",
            },
            {
                "name": "Estoril",
                "country_code": "",
            },
        ]

        for country_code in ("", None):
            with self.subTest(country_code=country_code):
                result = apply_discovery_country_refinement(
                    candidates,
                    country_code,
                )

                self.assertIs(
                    result,
                    candidates,
                )

    def test_country_refinement_does_not_modify_original_candidates(self):
        from .geography.discovery import (
            apply_discovery_country_refinement,
        )

        portugal_candidate = {
            "name": "Estoril",
            "country_code": "PT",
        }

        brazil_candidate = {
            "name": "Estoril",
            "country_code": "BR",
        }

        candidates = [
            portugal_candidate,
            brazil_candidate,
        ]

        result = apply_discovery_country_refinement(
            candidates,
            "PT",
        )

        self.assertEqual(
            result,
            [
                portugal_candidate,
            ],
        )
        self.assertEqual(
            candidates,
            [
                portugal_candidate,
                brazil_candidate,
            ],
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_applies_country_refinement_without_replacing_candidates(
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
            "Estoril",
            country_refinement="PT",
        )

        self.assertIs(
            result["candidates"],
            candidates,
        )
        self.assertEqual(
            result["refined_candidates"],
            [
                {
                    **portugal_candidate,
                    "can_open": False,
                },
            ],
        )
        self.assertIsNot(
            result["refined_candidates"][0],
            portugal_candidate,
        )
        self.assertNotIn(
            "can_open",
            portugal_candidate,
        )
        self.assertEqual(
            result["country_refinement_options"],
            [
                {"country_code": "PT"},
                {"country_code": "BR"},
            ],
        )
        self.assertTrue(
            result["meaningful_ambiguity"]
        )

    @patch("core.geography.discovery.search_global_discovery_places")
    def test_country_refinement_runs_before_suggestion_resolution(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        brazil_anchor = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "settlement",
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        brazil_suggestion = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "",
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        portugal_anchor = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
            "admin_context": [
                {
                    "level": 1,
                    "name": "Lisboa",
                },
            ],
        }

        candidates = [
            brazil_anchor,
            brazil_suggestion,
            portugal_anchor,
        ]
        mock_search_global_discovery_places.return_value = candidates

        result = search_interpreted_global_discovery_places(
            "Parque Estoril",
            country_refinement="PT",
        )

        self.assertEqual(
            result["suggestion_hypotheses"],
            [],
        )
        self.assertEqual(
            len(result["refined_candidates"]),
            1,
        )
        self.assertEqual(
            result["refined_candidates"][0]["country_code"],
            "PT",
        )


    @patch("core.geography.discovery.search_global_discovery_places")
    def test_interpreted_search_without_country_refinement_preserves_all_candidates(
        self,
        mock_search_global_discovery_places,
    ):
        from .geography.discovery import (
            search_interpreted_global_discovery_places,
        )

        candidates = [
            {
                "name": "Estoril",
                "canonical_name": "Estoril",
                "aliases": [],
                "country_code": "PT",
                "geographic_type": "settlement",
            },
            {
                "name": "Estoril",
                "canonical_name": "Estoril",
                "aliases": [],
                "country_code": "BR",
                "geographic_type": "settlement",
            },
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
            result["refined_candidates"],
            [
                {
                    **candidates[0],
                    "can_open": False,
                },
                {
                    **candidates[1],
                    "can_open": False,
                },
            ],
        )
        self.assertIsNot(
            result["refined_candidates"][0],
            candidates[0],
        )
        self.assertIsNot(
            result["refined_candidates"][1],
            candidates[1],
        )
        self.assertNotIn("can_open", candidates[0])
        self.assertNotIn("can_open", candidates[1])


class GeographicResolutionTests(TestCase):
    def test_known_reference_evidence_groups_candidates_by_existing_place_id(self):
        from .geography.resolution import (
            group_known_reference_evidence,
        )

        registry_candidate = {
            "name": "Springfield",
            "existing_place_id": 123,
        }
        provider_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
            "existing_place_id": 123,
        }

        groups = group_known_reference_evidence(
            [
                registry_candidate,
                provider_candidate,
            ]
        )

        self.assertEqual(
            groups,
            {
                123: [
                    registry_candidate,
                    provider_candidate,
                ],
            },
        )

    def test_unknown_candidate_does_not_join_known_reference_evidence_by_similarity(self):
        from .geography.resolution import (
            group_known_reference_evidence,
        )

        known_candidate = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "existing_place_id": 123,
        }
        unresolved_candidate = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
            "existing_place_id": None,
        }

        groups = group_known_reference_evidence(
            [
                known_candidate,
                unresolved_candidate,
            ]
        )

        self.assertEqual(
            groups,
            {
                123: [
                    known_candidate,
                ],
            },
        )

    def test_exact_external_identity_anywhere_in_reference_evidence_establishes_same_relation(self):
        from .geography.resolution import (
            get_reference_evidence_identity_relation,
        )

        registry_candidate = {
            "name": "Springfield",
            "existing_place_id": 123,
        }
        geonames_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "4250542",
            "existing_place_id": 123,
        }
        incoming_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "4250542",
            "existing_place_id": None,
        }

        relation = get_reference_evidence_identity_relation(
            incoming_candidate,
            [
                registry_candidate,
                geonames_candidate,
            ],
        )

        self.assertEqual(
            relation,
            "same",
        )

    def test_gate_one_exact_identity_authorizes_reuse(self):
        from .geography.resolution import evaluate_existing_reference_gate

        candidate = {
            "name": "Lake Como",
            "external_source": "geonames",
            "external_id": "3178228",
        }
        reference_evidence = [
            {
                "name": "Lago di Como",
                "external_source": "geonames",
                "external_id": "3178228",
            }
        ]

        result = evaluate_existing_reference_gate(
            candidate,
            reference_evidence,
        )

        self.assertEqual(
            result,
            {
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            },
        )

    def test_gate_one_unresolved_identity_preserves_reference(self):
        from .geography.resolution import evaluate_existing_reference_gate

        candidate = {
            "name": "Springfield",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
        }
        reference_evidence = [
            {
                "name": "Springfield",
                "external_source": "geonames",
                "external_id": "springfield-illinois",
            }
        ]

        result = evaluate_existing_reference_gate(
            candidate,
            reference_evidence,
        )

        self.assertEqual(
            result,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_different_external_identities_across_reference_evidence_remain_unresolved(self):
        from .geography.resolution import (
            get_reference_evidence_identity_relation,
        )

        registry_candidate = {
            "name": "Springfield",
            "existing_place_id": 123,
        }
        geonames_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
            "existing_place_id": 123,
        }
        incoming_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "springfield-massachusetts",
            "existing_place_id": None,
        }

        relation = get_reference_evidence_identity_relation(
            incoming_candidate,
            [
                registry_candidate,
                geonames_candidate,
            ],
        )

        self.assertEqual(
            relation,
            "unresolved",
        )

    def test_candidate_admin_observations_preserve_each_reference_evidence_source(self):
        from .geography.resolution import (
            observe_candidate_admin_against_reference_evidence,
        )

        registry_candidate = {
            "name": "Springfield",
            "existing_place_id": 123,
            "admin_context": [],
        }
        geonames_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
            "existing_place_id": 123,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Illinois",
                },
            ],
        }
        unresolved_candidate = {
            "name": "Springfield",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
            "existing_place_id": None,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
            ],
        }

        observations = (
            observe_candidate_admin_against_reference_evidence(
                unresolved_candidate,
                [
                    registry_candidate,
                    geonames_candidate,
                ],
            )
        )

        self.assertEqual(
            observations,
            [
                {
                    "reference": registry_candidate,
                    "observation": {
                        "compatible_levels": [],
                        "divergent_levels": [],
                    },
                },
                {
                    "reference": geonames_candidate,
                    "observation": {
                        "compatible_levels": [],
                        "divergent_levels": [1],
                    },
                },
            ],
        )

    def test_settlement_classification_activates_localized_strategy(self):
        from .geography.resolution import (
            get_candidate_evaluation_strategies,
        )

        candidate = {
            "geographic_type": "settlement",
        }

        strategies = get_candidate_evaluation_strategies(candidate)

        self.assertEqual(
            strategies,
            {"localized"},
        )

    def test_google_natural_feature_activates_feature_and_area_strategies(self):
        from .geography.resolution import (
            get_candidate_evaluation_strategies,
        )

        candidate = {
            "geographic_type": None,
            "provider_types": [
                "natural_feature",
                "establishment",
            ],
        }

        strategies = get_candidate_evaluation_strategies(candidate)

        self.assertEqual(
            strategies,
            {"feature", "area"},
        )

    def test_classification_evidence_can_activate_multiple_strategies(self):
        from .geography.resolution import (
            get_candidate_evaluation_strategies,
        )

        candidate = {
            "geographic_type": "settlement",
            "provider_types": [
                "natural_feature",
            ],
        }

        strategies = get_candidate_evaluation_strategies(candidate)

        self.assertEqual(
            strategies,
            {"localized", "feature", "area"},
        )

    def test_admin_evidence_is_unknown_without_comparable_levels(self):
        from .geography.resolution import (
            get_admin_context_evidence_observation,
        )

        candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
            ],
        }

        reference = {
            "admin_context": [],
        }

        observation = get_admin_context_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "compatible_levels": [],
                "divergent_levels": [],
            },
        )

    def test_admin_evidence_is_compatible_when_shared_level_matches(self):
        from .geography.resolution import (
            get_admin_context_evidence_observation,
        )

        candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
            ],
        }

        reference = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "massachusetts",
                },
            ],
        }

        observation = get_admin_context_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
        )

    def test_admin_evidence_is_divergent_when_shared_level_differs(self):
        from .geography.resolution import (
            get_admin_context_evidence_observation,
        )

        candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
            ],
        }

        reference = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Illinois",
                },
            ],
        }

        observation = get_admin_context_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "compatible_levels": [],
                "divergent_levels": [1],
            },
        )

    def test_admin_evidence_preserves_compatible_and_divergent_levels(self):
        from .geography.resolution import (
            get_admin_context_evidence_observation,
        )

        candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "São Paulo",
                },
                {
                    "level": 2,
                    "name": "Municipality A",
                },
            ],
        }

        reference = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Sao Paulo",
                },
                {
                    "level": 2,
                    "name": "Municipality B",
                },
            ],
        }

        observation = get_admin_context_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "compatible_levels": [1],
                "divergent_levels": [2],
            },
        )

    def test_localized_reference_admin_evidence_preserves_informative_and_uninformative_sources(self):
        from .geography.resolution import (
            summarize_localized_reference_admin_evidence,
        )

        registry_candidate = {
            "name": "Springfield",
            "existing_place_id": 123,
            "admin_context": [],
        }
        geonames_candidate = {
            "name": "Springfield",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
            "existing_place_id": 123,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Illinois",
                },
            ],
        }
        unresolved_candidate = {
            "name": "Springfield",
            "external_source": "google_places",
            "external_id": "springfield-massachusetts",
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
            ],
        }

        summary = summarize_localized_reference_admin_evidence(
            unresolved_candidate,
            [
                registry_candidate,
                geonames_candidate,
            ],
        )

        self.assertEqual(
            summary,
            {
                "corroborating": [],
                "discriminating": [
                    {
                        "reference": geonames_candidate,
                        "levels": [1],
                    },
                ],
                "uninformative": [
                    registry_candidate,
                ],
            },
        )

    def test_localized_reference_admin_evidence_preserves_mixed_evidence_from_same_source(self):
        from .geography.resolution import (
            summarize_localized_reference_admin_evidence,
        )

        reference = {
            "name": "Springfield",
            "existing_place_id": 123,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
                {
                    "level": 2,
                    "name": "Hampden",
                },
            ],
        }
        candidate = {
            "name": "Springfield",
            "admin_context": [
                {
                    "level": 1,
                    "name": "Massachusetts",
                },
                {
                    "level": 2,
                    "name": "Springfield",
                },
            ],
        }

        summary = summarize_localized_reference_admin_evidence(
            candidate,
            [reference],
        )

        self.assertEqual(
            summary,
            {
                "corroborating": [
                    {
                        "reference": reference,
                        "levels": [1],
                    },
                ],
                "discriminating": [
                    {
                        "reference": reference,
                        "levels": [2],
                    },
                ],
                "uninformative": [],
            },
        )

    def test_localized_admin_interpretation_has_no_evidence_without_comparable_levels(self):
        from .geography.resolution import (
            interpret_localized_admin_evidence,
        )

        observation = {
            "compatible_levels": [],
            "divergent_levels": [],
        }

        interpretation = interpret_localized_admin_evidence(
            observation
        )

        self.assertEqual(
            interpretation,
            {
                "corroborating_levels": [],
                "discriminating_levels": [],
            },
        )

    def test_localized_admin_interpretation_treats_compatible_levels_as_corroborating(self):
        from .geography.resolution import (
            interpret_localized_admin_evidence,
        )

        observation = {
            "compatible_levels": [1],
            "divergent_levels": [],
        }

        interpretation = interpret_localized_admin_evidence(
            observation
        )

        self.assertEqual(
            interpretation,
            {
                "corroborating_levels": [1],
                "discriminating_levels": [],
            },
        )

    def test_localized_admin_interpretation_treats_divergent_levels_as_discriminating(self):
        from .geography.resolution import (
            interpret_localized_admin_evidence,
        )

        observation = {
            "compatible_levels": [],
            "divergent_levels": [1],
        }

        interpretation = interpret_localized_admin_evidence(
            observation
        )

        self.assertEqual(
            interpretation,
            {
                "corroborating_levels": [],
                "discriminating_levels": [1],
            },
        )

    def test_spatial_evidence_is_unknown_when_coordinates_are_incomplete(self):
        from .geography.resolution import (
            get_spatial_evidence_observation,
        )

        candidate = {
            "latitude": 42.1,
            "longitude": -72.59,
        }

        reference = {
            "latitude": None,
            "longitude": -89.64,
        }

        observation = get_spatial_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "distance_km": None,
            },
        )

    def test_spatial_evidence_preserves_calculated_distance(self):
        from .geography.resolution import (
            get_spatial_evidence_observation,
        )

        candidate = {
            "latitude": 42.1,
            "longitude": -72.59,
        }

        reference = {
            "latitude": 39.8,
            "longitude": -89.64,
        }

        observation = get_spatial_evidence_observation(
            candidate,
            reference,
        )

        self.assertAlmostEqual(
            observation["distance_km"],
            1452.027,
            places=3,
        )

    def test_suggestion_query_expansion_requires_additional_identity_token(self):
        from .geography.resolution import (
            discovery_candidate_expands_query_identity,
        )

        exact_candidate = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
        }
        expanded_candidate = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
        }
        partial_candidate = {
            "name": "Estoril Residence Hotel",
            "canonical_name": "Estoril Residence Hotel",
            "aliases": [],
        }

        self.assertFalse(
            discovery_candidate_expands_query_identity(
                exact_candidate,
                "Parque Estoril",
            )
        )
        self.assertTrue(
            discovery_candidate_expands_query_identity(
                expanded_candidate,
                "Parque Estoril",
            )
        )
        self.assertFalse(
            discovery_candidate_expands_query_identity(
                partial_candidate,
                "Parque Estoril",
            )
        )


    def test_admin_context_conflict_compares_shared_levels_by_name(self):
        from .geography.resolution import (
            discovery_candidates_have_admin_context_conflict,
        )

        geonames_candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Rio de Janeiro",
                },
                {
                    "level": 2,
                    "name": "Miguel Pereira",
                },
            ],
        }
        google_candidate = {
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }

        self.assertTrue(
            discovery_candidates_have_admin_context_conflict(
                geonames_candidate,
                google_candidate,
            )
        )


    def test_suggestion_for_anchor_requires_expansion_and_consistent_shared_context(self):
        from .geography.resolution import (
            discovery_candidate_is_suggestion_for_anchor,
        )

        anchor = {
            "name": "Parque Estoril",
            "canonical_name": "Parque Estoril",
            "aliases": [],
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        suggestion_candidate = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        conflicting_candidate = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
            "admin_context": [
                {
                    "level": 2,
                    "name": "Campinas",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        unknown_context_candidate = {
            "name": "Parque Natural Estoril",
            "canonical_name": "Parque Natural Estoril",
            "aliases": [],
            "admin_context": [],
        }

        self.assertTrue(
            discovery_candidate_is_suggestion_for_anchor(
                suggestion_candidate,
                anchor,
                "Parque Estoril",
            )
        )
        self.assertFalse(
            discovery_candidate_is_suggestion_for_anchor(
                conflicting_candidate,
                anchor,
                "Parque Estoril",
            )
        )
        self.assertFalse(
            discovery_candidate_is_suggestion_for_anchor(
                unknown_context_candidate,
                anchor,
                "Parque Estoril",
            )
        )


    def test_admin_context_shared_evidence_requires_matching_shared_level(self):
        from .geography.resolution import (
            discovery_candidates_share_admin_context_evidence,
        )

        first_candidate = {
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        matching_candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Sao Paulo",
                },
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
            ],
        }
        unknown_candidate = {
            "admin_context": [
                {
                    "level": 3,
                    "name": "Estoril",
                },
            ],
        }

        self.assertTrue(
            discovery_candidates_share_admin_context_evidence(
                first_candidate,
                matching_candidate,
            )
        )
        self.assertFalse(
            discovery_candidates_share_admin_context_evidence(
                first_candidate,
                unknown_candidate,
            )
        )


    def test_admin_context_missing_shared_level_does_not_establish_conflict(self):
        from .geography.resolution import (
            discovery_candidates_have_admin_context_conflict,
        )

        first_candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "São Paulo",
                },
            ],
        }
        second_candidate = {
            "admin_context": [
                {
                    "level": 2,
                    "name": "São Bernardo do Campo",
                },
            ],
        }

        self.assertFalse(
            discovery_candidates_have_admin_context_conflict(
                first_candidate,
                second_candidate,
            )
        )


class GeographyPlaceSearchViewTests(TestCase):
    @patch(
        "core.views.search_interpreted_global_discovery_places"
    )
    def test_search_returns_current_public_results_contract(
        self,
        mock_search_interpreted_global_discovery_places,
    ):
        geonames_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "latitude": 38.7057,
            "longitude": -9.3977,
            "feature_class": "P",
            "feature_code": "PPL",
            "geographic_type": "settlement",
            "population": 0,
            "admin_name": "Lisbon",
            "admin_context": [],
            "external_source": "geonames",
            "external_id": "2268434",
        }

        presented_geonames_candidate = {
            **geonames_candidate,
            "can_open": True,
        }

        mock_search_interpreted_global_discovery_places.return_value = {
            "candidates": [geonames_candidate],
            "refined_candidates": [presented_geonames_candidate],
            "meaningful_ambiguity": False,
            "country_refinement_options": [],
        }

        response = self.client.get(
            "/api/geography/places/search/",
            {"q": "Estoril"},
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["count"], 1)
        self.assertEqual(len(data["results"]), 1)
        self.assertEqual(
            data["results"][0]["canonical_name"],
            "Estoril",
        )
        self.assertEqual(
            data["results"][0]["country_code"],
            "PT",
        )
        self.assertEqual(
            data["results"][0]["external_source"],
            "geonames",
        )
        self.assertEqual(
            data["results"][0]["external_id"],
            "2268434",
        )
        self.assertTrue(
            data["results"][0]["can_open"]
        )

    @patch(
        "core.views.search_interpreted_global_discovery_places"
    )
    def test_search_uses_interpreted_discovery_refined_candidates(
        self,
        mock_search_interpreted_global_discovery_places,
    ):
        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
            "existing_place_id": None,
            "external_source": "geonames",
            "external_id": "2268434",
        }

        mock_search_interpreted_global_discovery_places.return_value = {
            "candidates": [portugal_candidate],
            "refined_candidates": [portugal_candidate],
            "meaningful_ambiguity": False,
            "country_refinement_options": [],
        }

        response = self.client.get(
            "/api/geography/places/search/",
            {"q": "Estoril"},
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(
            data["results"],
            [portugal_candidate],
        )
        self.assertEqual(data["count"], 1)

        mock_search_interpreted_global_discovery_places.assert_called_once_with(
            "Estoril",
            country_refinement=None,
        )

    @patch(
        "core.views.search_interpreted_global_discovery_places"
    )
    def test_search_passes_country_code_as_explicit_refinement(
        self,
        mock_search_interpreted_global_discovery_places,
    ):
        portugal_candidate = {
            "name": "Estoril",
            "canonical_name": "Estoril",
            "aliases": [],
            "country_code": "PT",
            "geographic_type": "settlement",
            "existing_place_id": None,
            "external_source": "geonames",
            "external_id": "2268434",
        }

        mock_search_interpreted_global_discovery_places.return_value = {
            "candidates": [portugal_candidate],
            "refined_candidates": [portugal_candidate],
            "meaningful_ambiguity": True,
            "country_refinement_options": [
                {"country_code": "PT"},
                {"country_code": "BR"},
            ],
        }

        response = self.client.get(
            "/api/geography/places/search/",
            {
                "q": "Estoril",
                "country_code": " pt ",
            },
        )

        self.assertEqual(response.status_code, 200)

        mock_search_interpreted_global_discovery_places.assert_called_once_with(
            "Estoril",
            country_refinement="PT",
        )

    @patch(
        "core.views.search_interpreted_global_discovery_places"
    )
    def test_search_exposes_discovery_refinement_metadata(
        self,
        mock_search_interpreted_global_discovery_places,
    ):
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

        mock_search_interpreted_global_discovery_places.return_value = {
            "candidates": [
                portugal_candidate,
                brazil_candidate,
            ],
            "refined_candidates": [
                portugal_candidate,
                brazil_candidate,
            ],
            "meaningful_ambiguity": True,
            "country_refinement_options": [
                {"country_code": "PT"},
                {"country_code": "BR"},
            ],
        }

        response = self.client.get(
            "/api/geography/places/search/",
            {"q": "Estoril"},
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertTrue(data["meaningful_ambiguity"])
        self.assertEqual(
            data["country_refinement_options"],
            [
                {"country_code": "PT"},
                {"country_code": "BR"},
            ],
        )
