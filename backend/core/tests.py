from unittest.mock import call, patch

from django.db import transaction
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
    def test_materialize_country_place_propagates_creation_integrity_error(self):
        from unittest.mock import patch

        from django.db import IntegrityError

        from .geography.services import materialize_country_place
        from .models import Place

        country_entry = resolve_country_catalog_entry(code="AR")

        with patch.object(
            Place.objects,
            "create",
            side_effect=IntegrityError("Simulated creation failure"),
        ) as mock_create:
            with patch.object(
                Place.objects,
                "filter",
                side_effect=AssertionError(
                    "Unexpected recovery query after IntegrityError"
                ),
            ):
                with self.assertRaises(IntegrityError):
                    materialize_country_place(
                        country_entry=country_entry,
                        user=None,
                    )

        mock_create.assert_called_once()
        self.assertEqual(
            Place.objects.filter(place_type="country").count(),
            0,
        )

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


    def test_materialize_country_place_preserves_conflicting_country_code(self):
        from .geography.services import (
            GeographicContextConflict,
            materialize_country_place,
        )
        from .models import Place

        country_entry = resolve_country_catalog_entry(code="AR")

        place, created = materialize_country_place(
            country_entry=country_entry,
            user=None,
        )
        self.assertTrue(created)

        place.country_code = "FR"
        place.save(update_fields=["country_code"])

        with self.assertRaises(GeographicContextConflict) as caught:
            materialize_country_place(
                country_entry=country_entry,
                user=None,
            )

        self.assertEqual(caught.exception.place.pk, place.pk)
        self.assertEqual(caught.exception.reason, "country_code")

        place.refresh_from_db()
        self.assertEqual(place.country_code, "FR")
        self.assertEqual(
            Place.objects.filter(
                place_type="country",
                country_ref=place.country_ref,
            ).count(),
            1,
        )


    def test_materialize_country_place_enriches_missing_country_code(self):
        from .geography.services import materialize_country_place

        country_entry = resolve_country_catalog_entry(code="AR")

        place, created = materialize_country_place(
            country_entry=country_entry,
            user=None,
        )
        self.assertTrue(created)

        place.country_code = ""
        place.save(update_fields=["country_code"])

        same_place, created_again = materialize_country_place(
            country_entry=country_entry,
            user=None,
        )

        self.assertFalse(created_again)
        self.assertEqual(same_place.pk, place.pk)

        place.refresh_from_db()
        self.assertEqual(place.country_code, "AR")


    def test_materialize_country_place_rejects_conflicting_country_identity(self):
        from .geography.services import (
            CountryIdentityConflict,
            materialize_country_place,
        )
        from .models import Destination, Place

        conflicting_country = Country.objects.create(
            code="FR",
            canonical_name="Argentina",
            aliases=[],
        )

        country_entry = resolve_country_catalog_entry(code="AR")

        with self.assertRaises(CountryIdentityConflict):
            materialize_country_place(
                country_entry=country_entry,
                user=None,
            )

        conflicting_country.refresh_from_db()

        self.assertEqual(conflicting_country.code, "FR")
        self.assertEqual(
            conflicting_country.canonical_name,
            "Argentina",
        )
        self.assertEqual(conflicting_country.aliases, [])

        self.assertFalse(Country.objects.filter(code="AR").exists())
        self.assertFalse(Place.objects.exists())
        self.assertFalse(Destination.objects.exists())


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


    def test_country_materialization_returns_409_for_conflicting_place(self):
        from .geography.services import materialize_country_place
        from .models import Place

        country_entry = resolve_country_catalog_entry(code="AR")

        place, created = materialize_country_place(
            country_entry=country_entry,
            user=self.user,
        )
        self.assertTrue(created)

        place.country_code = "FR"
        place.save(update_fields=["country_code"])

        response = self.client.post(
            self.url,
            data={"country_code": "AR"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )

        place.refresh_from_db()
        self.assertEqual(place.country_code, "FR")

        self.assertEqual(
            Place.objects.filter(
                place_type="country",
                country_ref=place.country_ref,
            ).count(),
            1,
        )


    def test_country_materialization_returns_409_for_conflicting_country_identity(self):
        from .models import Country, Destination, Place

        conflicting_country = Country.objects.create(
            code="FR",
            canonical_name="Argentina",
            aliases=[],
        )

        response = self.client.post(
            self.url,
            data={"country_code": "AR"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )

        conflicting_country.refresh_from_db()
        self.assertEqual(conflicting_country.code, "FR")
        self.assertEqual(
            conflicting_country.canonical_name,
            "Argentina",
        )
        self.assertEqual(conflicting_country.aliases, [])

        self.assertFalse(Country.objects.filter(code="AR").exists())
        self.assertFalse(Place.objects.exists())
        self.assertFalse(Destination.objects.exists())



class GeographicPlacePreflightAPITests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        self.user = User.objects.create_user(
            username="geographic-place-preflight-user",
            password="test-password",
        )
        self.access_token = str(
            AccessToken.for_user(self.user)
        )
        self.url = "/api/geography/places/preflight/"

    @patch("core.views.preflight_external_geographic_reference")
    def test_no_reference_returns_normal_preflight_result(
        self,
        mock_preflight_external_geographic_reference,
    ):
        mock_preflight_external_geographic_reference.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "google_places",
                "external_id": "example-google-place",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            200,
            response.content,
        )
        self.assertEqual(
            response.json(),
            {
                "state": "no_reference",
            },
        )

    @patch("core.views.preflight_external_geographic_reference")
    def test_reuse_returns_existing_place_without_internal_evidence(
        self,
        mock_preflight_external_geographic_reference,
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

        mock_preflight_external_geographic_reference.return_value = {
            "state": "reuse",
            "place": place,
            "evaluations": [
                {
                    "place": place,
                    "identity_relation": "same",
                    "reconciliation_action": "reuse",
                }
            ],
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

        data = response.json()

        self.assertEqual(data["state"], "reuse")
        self.assertEqual(data["place"]["id"], place.id)
        self.assertEqual(data["place"]["name"], "Lake Como")
        self.assertNotIn("evaluations", data)
        self.assertNotIn("identity_relation", str(data))
        self.assertNotIn("reconciliation_action", str(data))

    @patch("core.views.preflight_external_geographic_reference")
    def test_preserve_returns_resolution_required_without_internal_evidence(
        self,
        mock_preflight_external_geographic_reference,
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

        mock_preflight_external_geographic_reference.return_value = {
            "state": "preserve",
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
            200,
            response.content,
        )

        data = response.json()

        self.assertEqual(
            data,
            {
                "state": "resolution_required",
                "references": [
                    {
                        "id": reference_place.id,
                        "name": "Springfield",
                        "country_code": "US",
                        "country_name": "United States",
                        "geographic_type": "settlement",
                    }
                ],
            },
        )
        self.assertNotIn("evaluations", data)
        self.assertNotIn("identity_relation", str(data))
        self.assertNotIn("reconciliation_action", str(data))


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
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_country_identity_conflict_returns_409_without_materializing_place(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_materialize_city_place,
    ):
        from .models import Country, Destination, Place

        conflicting_country = Country.objects.create(
            code="FR",
            canonical_name="Argentina",
            aliases=[],
        )

        mock_reconstruct_external_geographic_reference.return_value = {
            "name": "Buenos Aires",
            "canonical_name": "Buenos Aires",
            "aliases": [],
            "external_source": "google_places",
            "external_id": "buenos-aires-google",
            "country_code": "AR",
            "geographic_type": "settlement",
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "google_places",
                "external_id": "buenos-aires-google",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )
        self.assertEqual(
            response.json()["code"],
            "country_identity_conflict",
        )

        mock_materialize_city_place.assert_not_called()

        conflicting_country.refresh_from_db()
        self.assertEqual(conflicting_country.code, "FR")
        self.assertEqual(
            conflicting_country.canonical_name,
            "Argentina",
        )

        self.assertFalse(Country.objects.filter(code="AR").exists())
        self.assertFalse(Destination.objects.exists())
        self.assertFalse(Place.objects.exists())

    @patch("core.views.materialize_city_place")
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_country_place_context_conflict_returns_resolution_required(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_materialize_city_place,
    ):
        from .geography.services import materialize_country_place
        from .models import Place

        country_entry = resolve_country_catalog_entry(code="AR")

        country_place, created = materialize_country_place(
            country_entry=country_entry,
            user=self.user,
        )
        self.assertTrue(created)

        country_place.country_code = "FR"
        country_place.save(update_fields=["country_code"])

        mock_reconstruct_external_geographic_reference.return_value = {
            "name": "Buenos Aires",
            "canonical_name": "Buenos Aires",
            "aliases": [],
            "external_source": "google_places",
            "external_id": "buenos-aires-google",
            "country_code": "AR",
            "geographic_type": "settlement",
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "google_places",
                "external_id": "buenos-aires-google",
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
            len(data["references"]),
            1,
        )
        self.assertEqual(
            data["references"][0]["id"],
            country_place.id,
        )

        self.assertNotIn("evaluations", data)
        self.assertNotIn("context_conflict", str(data))

        mock_materialize_city_place.assert_not_called()

        country_place.refresh_from_db()
        self.assertEqual(country_place.country_code, "FR")

        self.assertEqual(
            Place.objects.filter(
                place_type="country",
                country_ref=country_place.country_ref,
            ).count(),
            1,
        )

    @patch("core.views.materialize_city_place")
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_preserve_returns_resolution_required_without_internal_evidence(
        self,
        mock_reconstruct_external_geographic_reference,
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

        mock_reconstruct_external_geographic_reference.return_value = {
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
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_reuse_returns_existing_place_with_200(
        self,
        mock_reconstruct_external_geographic_reference,
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

        mock_reconstruct_external_geographic_reference.return_value = {
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
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_created_returns_new_place_with_201(
        self,
        mock_reconstruct_external_geographic_reference,
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

        mock_reconstruct_external_geographic_reference.return_value = {
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
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_unknown_materialization_state_fails_closed(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_materialize_city_place,
    ):
        mock_reconstruct_external_geographic_reference.return_value = {
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


    @patch("core.views.get_geographic_place")
    def test_reuse_preserves_city_with_conflicting_destination(
        self,
        mock_get_geographic_place,
    ):
        from .models import (
            Destination,
            Place,
            PlaceExternalIdentity,
        )

        conflicting_destination = Destination.objects.create(
            name="France",
            country="France",
        )

        city = Place.objects.create(
            destination=conflicting_destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Springfield",
            canonical_name="Springfield",
            country_code="US",
            place_type="city",
            geographic_type="settlement",
        )

        PlaceExternalIdentity.objects.create(
            place=city,
            external_source="geonames",
            external_id="springfield-destination-conflict",
            geographic_type="settlement",
        )

        mock_get_geographic_place.return_value = {
            "name": "Springfield",
            "canonical_name": "Springfield",
            "aliases": [],
            "external_source": "geonames",
            "external_id": "springfield-destination-conflict",
            "country_code": "US",
            "geographic_type": "settlement",
        }

        response = self.client.post(
            self.url,
            data={
                "external_id": "springfield-destination-conflict",
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
        self.assertEqual(
            response.json()["code"],
            "geographic_resolution_required",
        )

        city.refresh_from_db()

        self.assertEqual(
            city.destination_id,
            conflicting_destination.id,
        )
        self.assertEqual(
            city.parent_place_id,
            self.country_place.id,
        )
        self.assertEqual(city.country_code, "US")
        self.assertEqual(city.country_ref_id, self.country.id)


class GeographicPlaceExternalDetailAPITests(TestCase):
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_public_geonames_detail_does_not_materialize_place(
        self,
        mock_reconstruct,
    ):
        from .models import Place, PlaceExternalIdentity

        reference = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example Place",
            "canonical_name": "Example Place",
            "geographic_type": "settlement",
            "country_code": "BR",
        }
        mock_reconstruct.return_value = reference

        places_before = Place.objects.count()
        identities_before = PlaceExternalIdentity.objects.count()

        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "geonames",
                "external_id": "12345",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), reference)

        mock_reconstruct.assert_called_once_with(
            external_source="geonames",
            external_id="12345",
        )

        self.assertEqual(Place.objects.count(), places_before)
        self.assertEqual(
            PlaceExternalIdentity.objects.count(),
            identities_before,
        )


    @patch("core.views.reconstruct_external_geographic_reference")
    def test_public_google_detail_does_not_materialize_place(
        self,
        mock_reconstruct,
    ):
        from .models import Place, PlaceExternalIdentity

        reference = {
            "external_source": "google_places",
            "external_id": "google-example-123",
            "name": "Example Island",
            "canonical_name": "Example Island",
            "geographic_type": "island",
            "country_code": "BR",
            "latitude": "-23.5",
            "longitude": "-45.1",
        }
        mock_reconstruct.return_value = reference

        places_before = Place.objects.count()
        identities_before = PlaceExternalIdentity.objects.count()

        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "google_places",
                "external_id": "google-example-123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), reference)

        mock_reconstruct.assert_called_once_with(
            external_source="google_places",
            external_id="google-example-123",
        )

        self.assertEqual(Place.objects.count(), places_before)
        self.assertEqual(
            PlaceExternalIdentity.objects.count(),
            identities_before,
        )


    def test_external_detail_reconstruction_does_not_materialize(self):
        from .models import Place, PlaceExternalIdentity

        cases = [
            (
                "geonames",
                "12345",
                "core.geography.services.get_geographic_place",
            ),
            (
                "google_places",
                "google-example-123",
                "core.geography.services.get_google_geographic_place",
            ),
        ]

        for external_source, external_id, provider_path in cases:
            with self.subTest(external_source=external_source):
                reference = {
                    "external_source": external_source,
                    "external_id": external_id,
                    "name": "Example Place",
                    "canonical_name": "Example Place",
                    "geographic_type": "settlement",
                    "country_code": "BR",
                }

                places_before = Place.objects.count()
                identities_before = PlaceExternalIdentity.objects.count()

                with patch(
                    provider_path,
                    return_value=reference,
                ) as mock_provider:
                    response = self.client.get(
                        "/api/geography/places/external-detail/",
                        {
                            "external_source": external_source,
                            "external_id": external_id,
                        },
                    )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), reference)

                mock_provider.assert_called_once_with(external_id)

                self.assertEqual(
                    Place.objects.count(),
                    places_before,
                )
                self.assertEqual(
                    PlaceExternalIdentity.objects.count(),
                    identities_before,
                )


    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_detail_rejects_unsupported_source(
        self,
        mock_reconstruct,
    ):
        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "unsupported",
                "external_id": "12345",
            },
        )

        self.assertEqual(response.status_code, 400)
        mock_reconstruct.assert_not_called()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_detail_requires_external_id(
        self,
        mock_reconstruct,
    ):
        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "geonames",
            },
        )

        self.assertEqual(response.status_code, 400)
        mock_reconstruct.assert_not_called()


    def test_external_detail_handles_provider_errors(self):
        from .geography.providers.geonames import (
            GeoNamesConfigurationError,
            GeoNamesRequestError,
        )
        from .geography.providers.google_places import (
            GooglePlacesConfigurationError,
            GooglePlacesRequestError,
        )

        cases = [
            ("geonames", GeoNamesConfigurationError),
            ("google_places", GooglePlacesConfigurationError),
            ("geonames", GeoNamesRequestError),
            ("google_places", GooglePlacesRequestError),
        ]

        for external_source, error_class in cases:
            with self.subTest(
                external_source=external_source,
                error=error_class.__name__,
            ):
                with patch(
                    "core.views.reconstruct_external_geographic_reference",
                    side_effect=error_class("Provider unavailable"),
                ) as mock_reconstruct:
                    response = self.client.get(
                        "/api/geography/places/external-detail/",
                        {
                            "external_source": external_source,
                            "external_id": "example-123",
                        },
                    )

                self.assertEqual(response.status_code, 503)
                mock_reconstruct.assert_called_once_with(
                    external_source=external_source,
                    external_id="example-123",
                )

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_detail_returns_404_for_google_missing_reference(
        self,
        mock_reconstruct,
    ):
        from .geography.providers.google_places import (
            GooglePlacesReferenceNotFoundError,
        )
        from .models import Place, PlaceExternalIdentity

        mock_reconstruct.side_effect = GooglePlacesReferenceNotFoundError(
            "Google Places geographic reference does not exist."
        )

        places_before = Place.objects.count()
        identities_before = PlaceExternalIdentity.objects.count()

        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "google_places",
                "external_id": "missing-place",
            },
        )

        self.assertEqual(response.status_code, 404)

        mock_reconstruct.assert_called_once_with(
            external_source="google_places",
            external_id="missing-place",
        )

        self.assertEqual(
            Place.objects.count(),
            places_before,
        )
        self.assertEqual(
            PlaceExternalIdentity.objects.count(),
            identities_before,
        )

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_detail_returns_404_for_geonames_missing_reference(
        self,
        mock_reconstruct,
    ):
        from .geography.providers.geonames import (
            GeoNamesReferenceNotFoundError,
        )
        from .models import Place, PlaceExternalIdentity

        mock_reconstruct.side_effect = GeoNamesReferenceNotFoundError(
            "GeoNames geographic reference does not exist."
        )

        places_before = Place.objects.count()
        identities_before = PlaceExternalIdentity.objects.count()

        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "geonames",
                "external_id": "999999999",
            },
        )

        self.assertEqual(response.status_code, 404)

        mock_reconstruct.assert_called_once_with(
            external_source="geonames",
            external_id="999999999",
        )

        self.assertEqual(Place.objects.count(), places_before)
        self.assertEqual(
            PlaceExternalIdentity.objects.count(),
            identities_before,
        )

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_detail_returns_404_for_missing_reference(
        self,
        mock_reconstruct,
    ):
        mock_reconstruct.return_value = None

        response = self.client.get(
            "/api/geography/places/external-detail/",
            {
                "external_source": "geonames",
                "external_id": "missing-123",
            },
        )

        self.assertEqual(response.status_code, 404)
        mock_reconstruct.assert_called_once_with(
            external_source="geonames",
            external_id="missing-123",
        )


class ExternalGeographicReferenceReconstructionTests(TestCase):
    @patch("core.geography.services.get_geographic_place")
    def test_geonames_reference_is_reconstructed_from_provider(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import (
            reconstruct_external_geographic_reference,
        )

        expected = {
            "external_source": "geonames",
            "external_id": "12345",
            "canonical_name": "Example Place",
        }
        mock_get_geographic_place.return_value = expected

        result = reconstruct_external_geographic_reference(
            external_source="geonames",
            external_id="12345",
        )

        self.assertEqual(result, expected)
        mock_get_geographic_place.assert_called_once_with("12345")

    @patch("core.geography.services.get_google_geographic_place")
    def test_google_reference_is_reconstructed_from_provider(
        self,
        mock_get_google_geographic_place,
    ):
        from .geography.services import (
            reconstruct_external_geographic_reference,
        )

        expected = {
            "external_source": "google_places",
            "external_id": "google-example",
            "canonical_name": "Example Place",
        }
        mock_get_google_geographic_place.return_value = expected

        result = reconstruct_external_geographic_reference(
            external_source="google_places",
            external_id="google-example",
        )

        self.assertEqual(result, expected)
        mock_get_google_geographic_place.assert_called_once_with(
            "google-example"
        )

    def test_unsupported_reference_source_fails_closed(self):
        from .geography.services import (
            reconstruct_external_geographic_reference,
        )

        with self.assertRaisesRegex(
            ValueError,
            "Unsupported geographic reference source: unsupported",
        ):
            reconstruct_external_geographic_reference(
                external_source="unsupported",
                external_id="12345",
            )


class ExternalGeographicReferencePreflightTests(TestCase):
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_preflight_resolves_reference_without_materializing(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
    ):
        from .geography.services import (
            preflight_external_geographic_reference,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        resolved_country = object()
        expected = {
            "state": "no_reference",
            "evaluations": [],
        }

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = resolved_country
        mock_evaluate_city_reference_gate.return_value = expected

        result = preflight_external_geographic_reference(
            external_source="geonames",
            external_id="12345",
        )

        self.assertEqual(result, expected)
        mock_reconstruct_external_geographic_reference.assert_called_once_with(
            external_source="geonames",
            external_id="12345",
        )
        mock_resolve_country_catalog_entry.assert_called_once_with(
            code="IT",
        )
        mock_resolve_country.assert_called_once_with(
            value="Italy",
            code="IT",
        )
        mock_evaluate_city_reference_gate.assert_called_once_with(
            city_result=geographic_result,
            resolved_country=resolved_country,
            country_code="IT",
        )


    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_preflight_allows_country_model_to_be_absent(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
    ):
        from .geography.services import (
            preflight_external_geographic_reference,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        expected = {
            "state": "no_reference",
            "evaluations": [],
        }

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = None
        mock_evaluate_city_reference_gate.return_value = expected

        result = preflight_external_geographic_reference(
            external_source="geonames",
            external_id="12345",
        )

        self.assertEqual(result, expected)
        mock_evaluate_city_reference_gate.assert_called_once_with(
            city_result=geographic_result,
            resolved_country=None,
            country_code="IT",
        )

    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_preflight_fails_closed_when_country_cannot_be_resolved(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
    ):
        from .geography.services import (
            preflight_external_geographic_reference,
        )

        mock_reconstruct_external_geographic_reference.return_value = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "ZZ",
            "geographic_type": "settlement",
        }
        mock_resolve_country_catalog_entry.return_value = None

        with self.assertRaisesRegex(
            ValueError,
            "Could not resolve the country for this geographic place.",
        ):
            preflight_external_geographic_reference(
                external_source="geonames",
                external_id="12345",
            )

        mock_resolve_country.assert_not_called()
        mock_evaluate_city_reference_gate.assert_not_called()



class ExternalGeographicReferenceCommitResolutionTests(TestCase):

    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    def test_commit_resolution_preserves_conflict_during_enrichment(
        self,
        mock_country_catalog,
        mock_resolve_country,
        mock_reference_gate,
        mock_materialize_country,
        mock_enrich,
    ):
        from types import SimpleNamespace

        from .geography.services import (
            GeographicContextConflict,
            resolve_reconstructed_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }

        existing_place = SimpleNamespace(
            pk=123,
            country_code="FR",
        )

        mock_country_catalog.return_value = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        mock_resolve_country.return_value = object()
        mock_reference_gate.return_value = {
            "state": "reuse",
            "place": existing_place,
            "evaluations": [],
        }
        mock_materialize_country.return_value = (
            SimpleNamespace(country_ref=object()),
            False,
        )
        mock_enrich.side_effect = GeographicContextConflict(
            existing_place,
            "country_code",
        )

        result = resolve_reconstructed_geographic_reference_for_commit(
            geographic_result=geographic_result,
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertIsNone(result["place"])
        self.assertFalse(result["created"])
        self.assertEqual(
            result["evaluations"][0]["context_conflict"],
            "country_code",
        )
        self.assertIs(
            result["evaluations"][0]["place"],
            existing_place,
        )

        mock_enrich.assert_called_once()


    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    def test_country_materialization_rolls_back_after_identity_conflict(
        self,
        mock_country_catalog,
        mock_resolve_country,
        mock_reference_gate,
        mock_create_city,
    ):
        from types import SimpleNamespace

        from .geography.services import (
            resolve_reconstructed_geographic_reference_for_commit,
        )
        from .models import Country, Destination, Place

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }

        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }

        mock_country_catalog.return_value = country_entry
        mock_resolve_country.return_value = SimpleNamespace(code="IT")
        mock_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }
        mock_create_city.return_value = (
            SimpleNamespace(pk=123, country_code="FR"),
            False,
        )

        self.assertFalse(Country.objects.filter(code="IT").exists())
        self.assertFalse(
            Destination.objects.filter(
                name="Italy",
                country="Italy",
            ).exists()
        )

        result = resolve_reconstructed_geographic_reference_for_commit(
            geographic_result=geographic_result,
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertIsNone(result["place"])
        self.assertFalse(result["created"])
        self.assertEqual(
            result["evaluations"][0]["context_conflict"],
            "country_code",
        )

        mock_create_city.assert_called_once()

        self.assertFalse(Country.objects.filter(code="IT").exists())
        self.assertFalse(
            Destination.objects.filter(
                name="Italy",
                country="Italy",
            ).exists()
        )
        self.assertFalse(
            Place.objects.filter(
                place_type="country",
                country_code="IT",
            ).exists()
        )

    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    def test_reconstructed_reference_can_be_resolved_without_provider_lookup(
        self,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
        mock_materialize_country_place,
    ):
        from .geography.services import (
            resolve_reconstructed_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        resolved_country = object()
        evaluations = [{"identity_relation": "unresolved"}]

        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = resolved_country
        mock_evaluate_city_reference_gate.return_value = {
            "state": "preserve",
            "evaluations": evaluations,
        }

        result = resolve_reconstructed_geographic_reference_for_commit(
            geographic_result=geographic_result,
            user=object(),
        )

        self.assertEqual(
            result,
            {
                "state": "preserve",
                "place": None,
                "created": False,
                "evaluations": evaluations,
            },
        )
        mock_evaluate_city_reference_gate.assert_called_once_with(
            city_result=geographic_result,
            resolved_country=resolved_country,
            country_code="IT",
        )
        mock_materialize_country_place.assert_not_called()


    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_preserve_does_not_materialize_country_or_place(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
        mock_materialize_country_place,
    ):
        from .geography.services import (
            resolve_external_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        resolved_country = object()
        evaluations = [{"identity_relation": "unresolved"}]

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = resolved_country
        mock_evaluate_city_reference_gate.return_value = {
            "state": "preserve",
            "evaluations": evaluations,
        }

        result = resolve_external_geographic_reference_for_commit(
            external_source="geonames",
            external_id="12345",
            user=object(),
        )

        self.assertEqual(
            result,
            {
                "state": "preserve",
                "place": None,
                "created": False,
                "evaluations": evaluations,
            },
        )
        mock_materialize_country_place.assert_not_called()



    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_reuse_materializes_country_then_enriches_authorized_place(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
        mock_materialize_country_place,
        mock_enrich_existing_city_place,
    ):
        from .geography.services import (
            resolve_external_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        from types import SimpleNamespace

        resolved_country = object()
        existing_place = object()
        country_place = SimpleNamespace(
            country_ref=resolved_country,
        )
        user = object()
        evaluations = [
            {
                "place": existing_place,
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            }
        ]

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = resolved_country
        mock_evaluate_city_reference_gate.return_value = {
            "state": "reuse",
            "place": existing_place,
            "evaluations": evaluations,
        }
        mock_materialize_country_place.return_value = (
            country_place,
            False,
        )
        mock_enrich_existing_city_place.return_value = existing_place

        result = resolve_external_geographic_reference_for_commit(
            external_source="geonames",
            external_id="12345",
            user=user,
        )

        self.assertEqual(
            result,
            {
                "state": "reuse",
                "place": existing_place,
                "created": False,
                "evaluations": evaluations,
            },
        )
        mock_materialize_country_place.assert_called_once_with(
            country_entry=country_entry,
            user=user,
        )
        mock_enrich_existing_city_place.assert_called_once_with(
            existing_place=existing_place,
            city_result=geographic_result,
            resolved_country=resolved_country,
            country_code="IT",
            country_place=country_place,
        )


    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_no_reference_materializes_country_then_creates_place(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
        mock_materialize_country_place,
        mock_create_city_place,
    ):
        from types import SimpleNamespace

        from .geography.services import (
            resolve_external_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        materialized_country = object()
        country_place = SimpleNamespace(
            country_ref=materialized_country,
        )
        created_place = object()
        user = object()

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = None
        mock_evaluate_city_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }
        mock_materialize_country_place.return_value = (
            country_place,
            True,
        )
        mock_create_city_place.return_value = (
            created_place,
            True,
        )

        result = resolve_external_geographic_reference_for_commit(
            external_source="geonames",
            external_id="12345",
            user=user,
        )

        self.assertEqual(
            result,
            {
                "state": "created",
                "place": created_place,
                "created": True,
                "evaluations": [],
            },
        )
        mock_create_city_place.assert_called_once_with(
            city_result=geographic_result,
            resolved_country=materialized_country,
            country_code="IT",
            country_place=country_place,
            user=user,
        )


    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_no_reference_reports_reuse_when_identity_creation_loses_race(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
        mock_materialize_country_place,
        mock_create_city_place,
    ):
        from types import SimpleNamespace

        from .geography.services import (
            resolve_external_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        materialized_country = object()
        country_place = SimpleNamespace(
            country_ref=materialized_country,
            destination_id=10,
        )
        winning_place = SimpleNamespace(
            pk=123,
            country_code="IT",
            country_ref_id=None,
            destination_id=10,
        )
        user = object()

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = None
        mock_evaluate_city_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }
        mock_materialize_country_place.return_value = (
            country_place,
            True,
        )
        mock_create_city_place.return_value = (
            winning_place,
            False,
        )

        result = resolve_external_geographic_reference_for_commit(
            external_source="geonames",
            external_id="12345",
            user=user,
        )

        self.assertEqual(
            result,
            {
                "state": "reuse",
                "place": winning_place,
                "created": False,
                "evaluations": [],
            },
        )
        mock_create_city_place.assert_called_once_with(
            city_result=geographic_result,
            resolved_country=materialized_country,
            country_code="IT",
            country_place=country_place,
            user=user,
        )


    @patch("core.geography.services.create_city_place")
    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    def test_creation_race_preserves_conflicting_country(
        self,
        mock_country_catalog,
        mock_resolve_country,
        mock_reference_gate,
        mock_materialize_country,
        mock_create_city,
    ):
        from types import SimpleNamespace

        from .geography.services import (
            resolve_reconstructed_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }

        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }

        winning_place = SimpleNamespace(
            pk=123,
            country_code="FR",
        )

        mock_country_catalog.return_value = country_entry
        mock_resolve_country.return_value = object()
        mock_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }
        mock_materialize_country.return_value = (
            SimpleNamespace(country_ref=object()),
            True,
        )
        mock_create_city.return_value = (
            winning_place,
            False,
        )

        result = resolve_reconstructed_geographic_reference_for_commit(
            geographic_result=geographic_result,
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertIsNone(result["place"])
        self.assertFalse(result["created"])
        self.assertEqual(len(result["evaluations"]), 1)
        self.assertIs(
            result["evaluations"][0]["place"],
            winning_place,
        )
        self.assertEqual(
            result["evaluations"][0]["context_conflict"],
            "country_code",
        )
        mock_create_city.assert_called_once()

    @patch("core.geography.services.enrich_existing_city_place")
    @patch("core.geography.services.materialize_country_place")
    @patch("core.geography.services.evaluate_city_reference_gate")
    @patch("core.geography.services.resolve_country")
    @patch("core.geography.services.resolve_country_catalog_entry")
    @patch(
        "core.geography.services.reconstruct_external_geographic_reference"
    )
    def test_reuse_uses_country_materialized_after_read_only_resolution(
        self,
        mock_reconstruct_external_geographic_reference,
        mock_resolve_country_catalog_entry,
        mock_resolve_country,
        mock_evaluate_city_reference_gate,
        mock_materialize_country_place,
        mock_enrich_existing_city_place,
    ):
        from types import SimpleNamespace

        from .geography.services import (
            resolve_external_geographic_reference_for_commit,
        )

        geographic_result = {
            "external_source": "geonames",
            "external_id": "12345",
            "name": "Example City",
            "canonical_name": "Example City",
            "country_code": "IT",
            "geographic_type": "settlement",
        }
        country_entry = {
            "code": "IT",
            "canonical_name": "Italy",
            "aliases": ["Italia"],
        }
        materialized_country = object()
        country_place = SimpleNamespace(
            country_ref=materialized_country,
        )
        existing_place = object()

        mock_reconstruct_external_geographic_reference.return_value = (
            geographic_result
        )
        mock_resolve_country_catalog_entry.return_value = country_entry
        mock_resolve_country.return_value = None
        mock_evaluate_city_reference_gate.return_value = {
            "state": "reuse",
            "place": existing_place,
            "evaluations": [],
        }
        mock_materialize_country_place.return_value = (
            country_place,
            True,
        )
        mock_enrich_existing_city_place.return_value = existing_place

        resolve_external_geographic_reference_for_commit(
            external_source="geonames",
            external_id="12345",
            user=object(),
        )

        mock_evaluate_city_reference_gate.assert_called_once_with(
            city_result=geographic_result,
            resolved_country=None,
            country_code="IT",
        )
        mock_enrich_existing_city_place.assert_called_once_with(
            existing_place=existing_place,
            city_result=geographic_result,
            resolved_country=materialized_country,
            country_code="IT",
            country_place=country_place,
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

    def test_country_ancestor_rejects_distinct_country_identity(self):
        from .geography.services import (
            GeographicContextConflict,
            assert_compatible_country_ancestor,
        )
        from .models import Country, Destination, Place

        unknown_country = Country.objects.create(
            code="",
            canonical_name="Unknown Country",
        )
        destination = Destination.objects.create(
            name="Unknown Country",
            country="Unknown Country",
        )
        ancestor = Place.objects.create(
            destination=destination,
            country_ref=unknown_country,
            name="Unknown Country",
            canonical_name="Unknown Country",
            aliases=[],
            country_code="",
            place_type="country",
        )

        with self.assertRaises(GeographicContextConflict) as caught:
            assert_compatible_country_ancestor(
                resolved_country=self.country,
                country_code="IT",
                country_place=ancestor,
            )

        self.assertEqual(
            caught.exception.reason,
            "country_ancestor",
        )

    def test_city_creation_preserves_conflicting_identity_owner_after_integrity_error(
        self,
    ):
        from .geography.services import (
            GeographicContextConflict,
            create_city_place,
        )
        from .models import Destination, Place, PlaceExternalIdentity

        conflicting_destination = Destination.objects.create(
            name="France",
            country="France",
        )

        identity_owner = Place.objects.create(
            destination=conflicting_destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Conflicting City Identity Owner",
            canonical_name="Conflicting City Identity Owner",
            aliases=[],
            country_code="IT",
            place_type="city",
            geographic_type="settlement",
            city="Conflicting City Identity Owner",
        )

        PlaceExternalIdentity.objects.create(
            place=identity_owner,
            external_source="google_places",
            external_id="conflicting-city-creation",
            geographic_type="settlement",
        )

        original_place_count = Place.objects.count()
        original_identity_count = PlaceExternalIdentity.objects.count()
        original_destination_id = identity_owner.destination_id
        original_parent_id = identity_owner.parent_place_id

        with self.assertRaises(GeographicContextConflict) as context:
            create_city_place(
                city_result={
                    "name": "Conflicting City",
                    "canonical_name": "Conflicting City",
                    "aliases": [],
                    "country_code": "IT",
                    "geographic_type": "settlement",
                    "external_source": "google_places",
                    "external_id": "conflicting-city-creation",
                },
                resolved_country=self.country,
                country_code="IT",
                country_place=self.country_place,
                user=None,
            )

        self.assertEqual(context.exception.reason, "destination")
        self.assertEqual(context.exception.place.pk, identity_owner.pk)

        identity_owner.refresh_from_db()

        self.assertEqual(
            identity_owner.destination_id,
            original_destination_id,
        )
        self.assertEqual(
            identity_owner.parent_place_id,
            original_parent_id,
        )
        self.assertEqual(Place.objects.count(), original_place_count)
        self.assertEqual(
            PlaceExternalIdentity.objects.count(),
            original_identity_count,
        )

    def test_city_creation_rejects_conflicting_country_ancestor(self):
        from .geography.services import create_city_place
        from .models import Destination, Place

        france = get_or_create_country(value="France", code="FR")
        france_destination = Destination.objects.create(
            name="France",
            country="France",
        )
        france_place = Place.objects.create(
            destination=france_destination,
            country_ref=france,
            name="France",
            canonical_name="France",
            aliases=[],
            country_code="FR",
            place_type="country",
        )

        city_result = {
            "name": "Test Italian City",
            "canonical_name": "Test Italian City",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "settlement",
        }

        before_count = Place.objects.count()

        with self.assertRaises(ValueError):
            create_city_place(
                city_result=city_result,
                resolved_country=self.country,
                country_code="IT",
                country_place=france_place,
                user=None,
            )

        self.assertEqual(Place.objects.count(), before_count)

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

    def test_candidate_reference_discovery_with_no_country_model_uses_country_code(
        self,
    ):
        from .geography.services import (
            find_candidate_city_reference_places,
        )
        from .models import Place

        italian_place = Place.objects.create(
            destination=self.destination,
            country_ref=None,
            name="Example City",
            canonical_name="Example City",
            aliases=[],
            country_code="IT",
            place_type="city",
            geographic_type="settlement",
            city="Example City",
        )

        Place.objects.create(
            destination=self.destination,
            country_ref=None,
            name="Example City",
            canonical_name="Example City",
            aliases=[],
            country_code="FR",
            place_type="city",
            geographic_type="settlement",
            city="Example City",
        )

        city_result = {
            "name": "Example City",
            "canonical_name": "Example City",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "settlement",
        }

        references = find_candidate_city_reference_places(
            city_result=city_result,
            resolved_country=None,
            country_code="IT",
        )

        self.assertEqual(
            [place.pk for place in references],
            [italian_place.pk],
        )

    @patch("core.geography.services.get_geographic_place")
    def test_admin_reference_reconstruction_fetches_resolvable_geonames_identity(
        self,
        mock_get_geographic_place,
    ):
        from .geography.services import (
            reconstruct_admin_reference_evidence,
        )

        evidence = {
            "external_source": "geonames",
            "admin_context": [
                {
                    "level": 2,
                    "name": "Middlesex",
                    "external_id": "4943909",
                },
            ],
        }
        admin_evidence = {
            "name": "Middlesex County",
            "canonical_name": "Middlesex County",
            "external_source": "geonames",
            "external_id": "4943909",
            "geographic_type": "administrative_area",
        }
        mock_get_geographic_place.return_value = admin_evidence

        reconstructed = reconstruct_admin_reference_evidence(
            evidence
        )

        mock_get_geographic_place.assert_called_once_with(
            "4943909"
        )
        self.assertEqual(
            reconstructed,
            [
                {
                    "level": 2,
                    "external_source": "geonames",
                    "external_id": "4943909",
                    "reference": admin_evidence,
                },
            ],
        )
        self.assertIs(
            reconstructed[0]["reference"],
            admin_evidence,
        )

    @patch("core.geography.services.get_geographic_place")
    def test_admin_reference_reconstruction_does_not_hide_provider_failure(
        self,
        mock_get_geographic_place,
    ):
        from .geography.providers.geonames import (
            GeoNamesRequestError,
        )
        from .geography.services import (
            reconstruct_admin_reference_evidence,
        )

        evidence = {
            "external_source": "geonames",
            "admin_context": [
                {
                    "level": 2,
                    "name": "Middlesex",
                    "external_id": "4943909",
                },
            ],
        }
        mock_get_geographic_place.side_effect = (
            GeoNamesRequestError(
                "GeoNames geographic place lookup failed."
            )
        )

        with self.assertRaises(GeoNamesRequestError):
            reconstruct_admin_reference_evidence(evidence)

    def test_admin_reference_reconstruction_rejects_unsupported_source(self):
        from .geography.services import (
            reconstruct_admin_reference_evidence,
        )

        evidence = {
            "external_source": "future_provider",
            "admin_context": [
                {
                    "level": 1,
                    "name": "Example Region",
                    "external_id": "region-123",
                },
            ],
        }

        with self.assertRaisesRegex(
            ValueError,
            "Unsupported admin reference evidence source: future_provider",
        ):
            reconstruct_admin_reference_evidence(evidence)

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

    @patch(
        "core.geography.services.get_geographic_identity_evidence_observation"
    )
    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_evaluation_authorizes_exact_identity_reuse(
        self,
        mock_get_geographic_place,
        mock_get_geographic_identity_evidence_observation,
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
        mock_get_geographic_identity_evidence_observation.assert_not_called()
        self.assertEqual(result["place"].pk, self.lake.pk)
        self.assertEqual(result["identity_relation"], "same")
        self.assertEqual(result["reconciliation_action"], "reuse")
        self.assertEqual(
            result["geographic_evidence_evaluations"],
            [],
        )

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
        provider_evidence = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
            "admin_context": [
                {"level": 1, "name": "Illinois"},
            ],
        }
        mock_get_geographic_place.return_value = provider_evidence
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
        self.assertEqual(
            result["geographic_evidence_evaluations"],
            [
                {
                    "reference": provider_evidence,
                    "evidence": {
                        "nominal": {
                            "matching_identity_values": [
                                "springfield",
                            ],
                            "compatibility": "compatible",
                        },
                        "semantic": {
                            "candidate_geographic_type": "settlement",
                            "reference_geographic_type": "settlement",
                            "compatibility": "compatible",
                        },
                        "country": {
                            "candidate_country_code": "US",
                            "reference_country_code": "US",
                            "compatibility": "compatible",
                        },
                        "admin": {
                            "compatible_levels": [],
                            "divergent_levels": [1],
                        },
                        "spatial": {
                            "distance_km": None,
                        },
                    },
                    "evaluation": {
                        "identity_relation": "unresolved",
                        "reconciliation_action": "preserve",
                    },
                    "strategy_evaluations": [
                        {
                            "strategy": "localized",
                            "evidence": {
                                "spatial_extent": {
                                    "relation": "unknown",
                                },
                                "reconstructed_admin": [],
                            },
                            "evaluation": {
                                "identity_relation": "unresolved",
                                "reconciliation_action": "preserve",
                            },
                        },
                    ],
                },
            ],
        )

    @patch(
        "core.geography.services.evaluate_localized_identity_strategy"
    )
    @patch(
        "core.geography.services.get_localized_identity_evidence_observation"
    )
    @patch(
        "core.geography.services.reconstruct_admin_reference_evidence"
    )
    @patch(
        "core.geography.services.get_geographic_identity_evidence_observation"
    )
    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_skips_localized_evidence_when_gate_two_is_blocked(
        self,
        mock_get_geographic_place,
        mock_get_evidence_observation,
        mock_reconstruct_admin_evidence,
        mock_get_localized_evidence,
        mock_evaluate_localized_strategy,
    ):
        from .geography.services import (
            evaluate_candidate_place_reference,
        )

        reference = {
            "name": "Example Settlement",
            "country_code": "IT",
            "geographic_type": "settlement",
            "external_source": "geonames",
            "external_id": "3178228",
        }
        candidate = {
            "name": "Example Settlement",
            "country_code": "IT",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "google-example-settlement",
        }
        blocked_evidence = {
            "nominal": {"compatibility": "compatible"},
            "semantic": {"compatibility": "unresolved"},
            "country": {"compatibility": "compatible"},
        }

        mock_get_geographic_place.return_value = reference
        mock_get_evidence_observation.return_value = blocked_evidence

        result = evaluate_candidate_place_reference(
            candidate,
            self.lake,
        )

        mock_reconstruct_admin_evidence.assert_not_called()
        mock_get_localized_evidence.assert_not_called()
        mock_evaluate_localized_strategy.assert_not_called()
        self.assertNotIn(
            "strategy_evaluations",
            result["geographic_evidence_evaluations"][0],
        )

    @patch(
        "core.geography.services.evaluate_localized_identity_strategy"
    )
    @patch(
        "core.geography.services.get_localized_identity_evidence_observation"
    )
    @patch(
        "core.geography.services.observe_candidate_admin_against_reconstructed_references"
    )
    @patch(
        "core.geography.services.reconstruct_admin_reference_evidence"
    )
    @patch(
        "core.geography.services.evaluate_geographic_identity_evidence"
    )
    @patch(
        "core.geography.services.get_geographic_identity_evidence_observation"
    )
    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_runs_eligible_localized_strategy(
        self,
        mock_get_geographic_place,
        mock_get_evidence_observation,
        mock_evaluate_evidence,
        mock_reconstruct_admin_evidence,
        mock_observe_reconstructed_admin,
        mock_get_localized_evidence,
        mock_evaluate_localized_strategy,
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
            country_code="US",
            place_type="country",
        )
        springfield = Place.objects.create(
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
            place=springfield,
            external_source="geonames",
            external_id="springfield-illinois",
            geographic_type="settlement",
        )

        reference = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "geonames",
            "external_id": "springfield-illinois",
        }
        candidate = {
            "name": "Springfield",
            "country_code": "US",
            "geographic_type": "settlement",
            "external_source": "google_places",
            "external_id": "springfield-google",
        }
        gate_two_evidence = {
            "nominal": {"compatibility": "compatible"},
            "semantic": {"compatibility": "compatible"},
            "country": {"compatibility": "compatible"},
        }
        gate_two_evaluation = {
            "identity_relation": "unresolved",
            "reconciliation_action": "preserve",
        }
        reconstructed_admin_evidence = [
            {
                "level": 1,
                "external_source": "geonames",
                "external_id": "us-il",
                "reference": {
                    "name": "Illinois",
                },
            },
        ]
        reconstructed_admin_observations = [
            {
                "level": 1,
                "external_source": "geonames",
                "external_id": "us-il",
                "nominal": {
                    "matching_identity_values": ["illinois"],
                    "compatibility": "compatible",
                },
            },
        ]
        localized_evidence = {
            "spatial_extent": {
                "relation": "inside",
            },
            "reconstructed_admin": (
                reconstructed_admin_observations
            ),
        }
        localized_evaluation = {
            "identity_relation": "unresolved",
            "reconciliation_action": "preserve",
        }

        mock_get_geographic_place.return_value = reference
        mock_get_evidence_observation.return_value = gate_two_evidence
        mock_evaluate_evidence.return_value = gate_two_evaluation
        mock_reconstruct_admin_evidence.return_value = (
            reconstructed_admin_evidence
        )
        mock_observe_reconstructed_admin.return_value = (
            reconstructed_admin_observations
        )
        mock_get_localized_evidence.return_value = localized_evidence
        mock_evaluate_localized_strategy.return_value = localized_evaluation

        result = evaluate_candidate_place_reference(
            candidate,
            springfield,
        )

        mock_reconstruct_admin_evidence.assert_called_once_with(
            reference,
        )
        mock_observe_reconstructed_admin.assert_called_once_with(
            candidate,
            reconstructed_admin_evidence,
        )
        mock_get_localized_evidence.assert_called_once_with(
            candidate,
            reference,
            reconstructed_admin_observations,
        )
        mock_evaluate_localized_strategy.assert_called_once_with(
            candidate,
            reference,
            gate_two_evidence,
            localized_evidence,
        )
        self.assertEqual(
            result["geographic_evidence_evaluations"],
            [
                {
                    "reference": reference,
                    "evidence": gate_two_evidence,
                    "evaluation": gate_two_evaluation,
                    "strategy_evaluations": [
                        {
                            "strategy": "localized",
                            "evidence": localized_evidence,
                            "evaluation": localized_evaluation,
                        },
                    ],
                },
            ],
        )

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

    @patch(
        "core.geography.services.evaluate_geographic_identity_evidence"
    )
    @patch(
        "core.geography.services.get_geographic_identity_evidence_observation"
    )
    @patch("core.geography.services.get_google_geographic_place")
    @patch("core.geography.services.get_geographic_place")
    def test_candidate_place_reference_evaluates_each_provider_evidence_separately(
        self,
        mock_get_geographic_place,
        mock_get_google_geographic_place,
        mock_get_evidence_observation,
        mock_evaluate_evidence,
    ):
        from .geography.services import evaluate_candidate_place_reference
        from .models import PlaceExternalIdentity

        PlaceExternalIdentity.objects.create(
            place=self.lake,
            external_source="google_places",
            external_id="lake-como-google",
            geographic_type="lake",
        )

        geonames_reference = {
            "name": "Lago di Como",
            "external_source": "geonames",
            "external_id": "3178228",
        }
        google_reference = {
            "name": "Lake Como",
            "external_source": "google_places",
            "external_id": "lake-como-google",
        }
        mock_get_geographic_place.return_value = geonames_reference
        mock_get_google_geographic_place.return_value = google_reference

        candidate = {
            "name": "Lake Como",
            "external_source": "future_provider",
            "external_id": "lake-como-future",
        }

        geonames_evidence = {"source": "geonames-evidence"}
        google_evidence = {"source": "google-evidence"}
        mock_get_evidence_observation.side_effect = [
            geonames_evidence,
            google_evidence,
        ]
        mock_evaluate_evidence.side_effect = [
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        ]

        result = evaluate_candidate_place_reference(
            candidate,
            self.lake,
        )

        self.assertEqual(result["identity_relation"], "unresolved")
        self.assertEqual(result["reconciliation_action"], "preserve")
        self.assertEqual(
            result["geographic_evidence_evaluations"],
            [
                {
                    "reference": geonames_reference,
                    "evidence": geonames_evidence,
                    "evaluation": {
                        "identity_relation": "unresolved",
                        "reconciliation_action": "preserve",
                    },
                },
                {
                    "reference": google_reference,
                    "evidence": google_evidence,
                    "evaluation": {
                        "identity_relation": "unresolved",
                        "reconciliation_action": "preserve",
                    },
                },
            ],
        )
        self.assertEqual(
            mock_get_evidence_observation.call_args_list,
            [
                call(candidate, geonames_reference),
                call(candidate, google_reference),
            ],
        )
        self.assertEqual(
            mock_evaluate_evidence.call_args_list,
            [
                call(geonames_evidence),
                call(google_evidence),
            ],
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
    def test_single_reusable_candidate_reference_produces_reuse_state(
        self,
        mock_evaluate_references,
    ):
        from .geography.services import resolve_candidate_place_references

        reference = object()
        mock_evaluate_references.return_value = [
            {
                "place": reference,
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            }
        ]

        result = resolve_candidate_place_references(
            candidate={"name": "Breda"},
            places=[reference],
        )

        self.assertEqual(result["state"], "reuse")
        self.assertIs(result["place"], reference)
        self.assertEqual(
            result["evaluations"],
            mock_evaluate_references.return_value,
        )

    @patch("core.geography.services.evaluate_candidate_place_references")
    def test_reusable_reference_with_unresolved_competitor_preserves_ambiguity(
        self,
        mock_evaluate_references,
    ):
        from .geography.services import resolve_candidate_place_references

        reusable_reference = object()
        unresolved_reference = object()
        mock_evaluate_references.return_value = [
            {
                "place": reusable_reference,
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            },
            {
                "place": unresolved_reference,
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        ]

        result = resolve_candidate_place_references(
            candidate={"name": "Gökdepe"},
            places=[reusable_reference, unresolved_reference],
        )

        self.assertEqual(result["state"], "preserve")
        self.assertNotIn("place", result)
        self.assertEqual(
            result["evaluations"],
            mock_evaluate_references.return_value,
        )

    @patch("core.geography.services.evaluate_candidate_place_references")
    def test_reusable_reference_with_distinct_competitor_produces_reuse_state(
        self,
        mock_evaluate_references,
    ):
        from .geography.services import resolve_candidate_place_references

        reusable_reference = object()
        distinct_reference = object()
        mock_evaluate_references.return_value = [
            {
                "place": reusable_reference,
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            },
            {
                "place": distinct_reference,
                "identity_relation": "distinct",
                "reconciliation_action": "preserve",
            },
        ]

        result = resolve_candidate_place_references(
            candidate={"name": "Breda"},
            places=[reusable_reference, distinct_reference],
        )

        self.assertEqual(result["state"], "reuse")
        self.assertIs(result["place"], reusable_reference)
        self.assertEqual(
            result["evaluations"],
            mock_evaluate_references.return_value,
        )

    @patch("core.geography.services.evaluate_candidate_place_references")
    def test_multiple_reusable_candidate_references_preserve_ambiguity(
        self,
        mock_evaluate_references,
    ):
        from .geography.services import resolve_candidate_place_references

        first_reference = object()
        second_reference = object()
        mock_evaluate_references.return_value = [
            {
                "place": first_reference,
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            },
            {
                "place": second_reference,
                "identity_relation": "same",
                "reconciliation_action": "reuse",
            },
        ]

        result = resolve_candidate_place_references(
            candidate={"name": "Springfield"},
            places=[first_reference, second_reference],
        )

        self.assertEqual(result["state"], "preserve")
        self.assertNotIn("place", result)
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

    def test_city_reference_gate_preserves_exact_identity_with_country_conflict(
        self,
    ):
        from .geography.services import evaluate_city_reference_gate

        france = get_or_create_country(value="France", code="FR")

        candidate = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": ["Lake Como"],
            "country_code": "FR",
            "geographic_type": "lake",
            "external_source": "geonames",
            "external_id": "3178228",
        }

        result = evaluate_city_reference_gate(
            city_result=candidate,
            resolved_country=france,
            country_code="FR",
        )

        self.assertEqual(result["state"], "preserve")
        self.assertNotEqual(result.get("place"), self.lake)

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

    def test_city_enrichment_updates_place_that_already_owns_identity(
        self,
    ):
        from .geography.services import enrich_existing_city_place

        result = enrich_existing_city_place(
            existing_place=self.lake,
            city_result={
                "name": "Lake Como",
                "canonical_name": "Lake Como",
                "aliases": ["Como Lake"],
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "geonames",
                "external_id": "3178228",
                "latitude": 46.016049,
                "longitude": 9.257168,
            },
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
        )

        self.assertEqual(result.pk, self.lake.pk)

        self.lake.refresh_from_db()
        self.assertEqual(self.lake.canonical_name, "Lake Como")
        self.assertIn("Como Lake", self.lake.aliases)
        self.assertEqual(str(self.lake.latitude), "46.016049")
        self.assertEqual(str(self.lake.longitude), "9.257168")


    def test_city_enrichment_rejects_country_conflict_without_mutation(
        self,
    ):
        from .geography.services import enrich_existing_city_place
        from .models import Destination, Place

        france = get_or_create_country(value="France", code="FR")
        france_destination = Destination.objects.create(
            name="France",
            country="France",
        )
        france_place = Place.objects.create(
            destination=france_destination,
            country_ref=france,
            name="France",
            canonical_name="France",
            aliases=[],
            country_code="FR",
            place_type="country",
        )

        original_country_id = self.lake.country_ref_id
        original_country_code = self.lake.country_code
        original_parent_id = self.lake.parent_place_id
        original_canonical_name = self.lake.canonical_name
        original_aliases = list(self.lake.aliases or [])

        with self.assertRaises(ValueError):
            enrich_existing_city_place(
                existing_place=self.lake,
                city_result={
                    "name": "Lago di Como",
                    "canonical_name": "Lake Como",
                    "aliases": ["French Lake Como"],
                    "country_code": "FR",
                    "geographic_type": "lake",
                    "external_source": "geonames",
                    "external_id": "3178228",
                },
                resolved_country=france,
                country_code="FR",
                country_place=france_place,
            )

        self.lake.refresh_from_db()
        self.assertEqual(self.lake.country_ref_id, original_country_id)
        self.assertEqual(self.lake.country_code, original_country_code)
        self.assertEqual(self.lake.parent_place_id, original_parent_id)
        self.assertEqual(self.lake.canonical_name, original_canonical_name)
        self.assertEqual(self.lake.aliases, original_aliases)

    def test_city_enrichment_rejects_country_ref_conflict_without_mutation(
        self,
    ):
        from .geography.services import enrich_existing_city_place
        from .models import Destination, Place

        france = get_or_create_country(value="France", code="FR")
        france_destination = Destination.objects.create(
            name="France",
            country="France",
        )
        france_place = Place.objects.create(
            destination=france_destination,
            country_ref=france,
            name="France",
            canonical_name="France",
            aliases=[],
            country_code="FR",
            place_type="country",
        )

        # A missing country code must not override a known country reference.
        self.lake.country_code = ""
        self.lake.save(update_fields=["country_code"])

        original_country_id = self.lake.country_ref_id
        original_parent_id = self.lake.parent_place_id
        original_canonical_name = self.lake.canonical_name
        original_aliases = list(self.lake.aliases or [])

        with self.assertRaises(ValueError):
            enrich_existing_city_place(
                existing_place=self.lake,
                city_result={
                    "name": "Lago di Como",
                    "canonical_name": "Lake Como",
                    "aliases": ["French Lake Como"],
                    "country_code": "FR",
                    "geographic_type": "lake",
                    "external_source": "geonames",
                    "external_id": "3178228",
                },
                resolved_country=france,
                country_code="FR",
                country_place=france_place,
            )

        self.lake.refresh_from_db()
        self.assertEqual(self.lake.country_ref_id, original_country_id)
        self.assertEqual(self.lake.country_code, "")
        self.assertEqual(self.lake.parent_place_id, original_parent_id)
        self.assertEqual(
            self.lake.canonical_name,
            original_canonical_name,
        )
        self.assertEqual(self.lake.aliases, original_aliases)

    def test_city_enrichment_returns_external_identity_owner(
        self,
    ):
        from .geography.services import enrich_existing_city_place
        from .models import Place, PlaceExternalIdentity

        identity_owner = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Lake Como Identity Owner",
            canonical_name="Lake Como Identity Owner",
            aliases=[],
            country_code="IT",
            place_type="city",
            geographic_type="lake",
            city="Lake Como Identity Owner",
        )

        PlaceExternalIdentity.objects.create(
            place=identity_owner,
            external_source="google_places",
            external_id="google-lake-como",
            geographic_type="lake",
        )

        result = enrich_existing_city_place(
            existing_place=self.lake,
            city_result={
                "name": "Lake Como",
                "canonical_name": "Lake Como",
                "aliases": [],
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "google_places",
                "external_id": "google-lake-como",
                "latitude": 46.016049,
                "longitude": 9.257168,
            },
            resolved_country=self.country,
            country_code="IT",
            country_place=self.country_place,
        )

        self.assertEqual(result.pk, identity_owner.pk)

        self.lake.refresh_from_db()
        self.assertEqual(
            self.lake.canonical_name,
            "Lago di Como",
        )
        self.assertEqual(
            self.lake.aliases,
            ["Lake Como", "Lago Como"],
        )
        self.assertEqual(
            str(self.lake.latitude),
            "46.007930",
        )
        self.assertEqual(
            str(self.lake.longitude),
            "9.260790",
        )


    def test_city_enrichment_preserves_conflicting_identity_owner_destination(
        self,
    ):
        from .geography.services import (
            GeographicContextConflict,
            enrich_existing_city_place,
        )
        from .models import Destination, Place, PlaceExternalIdentity

        conflicting_destination = Destination.objects.create(
            name="France",
            country="France",
        )

        identity_owner = Place.objects.create(
            destination=conflicting_destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Lake Como Identity Owner",
            canonical_name="Lake Como Identity Owner",
            aliases=[],
            country_code="IT",
            place_type="city",
            geographic_type="lake",
            city="Lake Como Identity Owner",
        )

        PlaceExternalIdentity.objects.create(
            place=identity_owner,
            external_source="google_places",
            external_id="google-lake-como-conflict",
            geographic_type="lake",
        )

        original_lake_destination_id = self.lake.destination_id
        original_lake_parent_id = self.lake.parent_place_id
        original_owner_destination_id = identity_owner.destination_id
        original_owner_parent_id = identity_owner.parent_place_id

        with self.assertRaises(GeographicContextConflict) as context:
            enrich_existing_city_place(
                existing_place=self.lake,
                city_result={
                    "name": "Lake Como",
                    "canonical_name": "Lake Como",
                    "aliases": [],
                    "country_code": "IT",
                    "geographic_type": "lake",
                    "external_source": "google_places",
                    "external_id": "google-lake-como-conflict",
                },
                resolved_country=self.country,
                country_code="IT",
                country_place=self.country_place,
            )

        self.assertEqual(context.exception.reason, "destination")
        self.assertEqual(context.exception.place.pk, identity_owner.pk)

        self.lake.refresh_from_db()
        identity_owner.refresh_from_db()

        self.assertEqual(
            self.lake.destination_id,
            original_lake_destination_id,
        )
        self.assertEqual(
            self.lake.parent_place_id,
            original_lake_parent_id,
        )
        self.assertEqual(
            identity_owner.destination_id,
            original_owner_destination_id,
        )
        self.assertEqual(
            identity_owner.parent_place_id,
            original_owner_parent_id,
        )


    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_preserves_conflicting_country_ancestor(
        self,
        mock_reference_gate,
    ):
        from .geography.services import materialize_city_place
        from .models import Destination, Place, PlaceExternalIdentity

        france = get_or_create_country(value="France", code="FR")
        france_destination = Destination.objects.create(
            name="France",
            country="France",
        )
        france_place = Place.objects.create(
            destination=france_destination,
            country_ref=france,
            name="France",
            canonical_name="France",
            aliases=[],
            country_code="FR",
            place_type="country",
        )

        mock_reference_gate.return_value = {
            "state": "reuse",
            "place": self.lake,
            "evaluations": [],
        }

        original_parent_id = self.lake.parent_place_id
        original_country_id = self.lake.country_ref_id
        original_canonical_name = self.lake.canonical_name
        original_identity_count = PlaceExternalIdentity.objects.count()

        result = materialize_city_place(
            city_result={
                "name": "Lake Como",
                "canonical_name": "Lake Como Updated",
                "aliases": ["French Lake Como"],
                "country_code": "IT",
                "geographic_type": "lake",
                "external_source": "google_places",
                "external_id": "geo02-conflicting-ancestor",
            },
            resolved_country=self.country,
            country_code="IT",
            country_place=france_place,
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertIsNone(result["place"])
        self.assertFalse(result["created"])
        self.assertEqual(
            result["evaluations"][0]["context_conflict"],
            "country_ancestor",
        )

        self.lake.refresh_from_db()
        self.assertEqual(self.lake.parent_place_id, original_parent_id)
        self.assertEqual(self.lake.country_ref_id, original_country_id)
        self.assertEqual(
            self.lake.canonical_name,
            original_canonical_name,
        )
        self.assertEqual(
            PlaceExternalIdentity.objects.count(),
            original_identity_count,
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

    @patch("core.geography.services.evaluate_city_reference_gate")
    def test_city_materialization_preserves_conflicting_ancestor_on_creation(
        self,
        mock_reference_gate,
    ):
        from .geography.services import materialize_city_place
        from .models import Destination, Place

        france = get_or_create_country(value="France", code="FR")
        france_destination = Destination.objects.create(
            name="France",
            country="France",
        )
        france_place = Place.objects.create(
            destination=france_destination,
            country_ref=france,
            name="France",
            canonical_name="France",
            aliases=[],
            country_code="FR",
            place_type="country",
        )

        mock_reference_gate.return_value = {
            "state": "no_reference",
            "evaluations": [],
        }

        before_count = Place.objects.count()

        result = materialize_city_place(
            city_result={
                "name": "Test Italian City",
                "canonical_name": "Test Italian City",
                "aliases": [],
                "country_code": "IT",
                "geographic_type": "settlement",
            },
            resolved_country=self.country,
            country_code="IT",
            country_place=france_place,
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertIsNone(result["place"])
        self.assertFalse(result["created"])
        self.assertEqual(
            result["evaluations"][0]["context_conflict"],
            "country_ancestor",
        )
        self.assertEqual(Place.objects.count(), before_count)

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

    def test_google_locality_is_interpreted_as_settlement(self):
        from .geography.providers.google_places import (
            normalize_google_discovery_result,
        )

        item = {
            "id": "google-cambridge-massachusetts",
            "displayName": {
                "text": "Cambridge",
            },
            "types": [
                "locality",
                "political",
            ],
            "location": {
                "latitude": 42.3666036,
                "longitude": -71.1056916,
            },
            "addressComponents": [
                {
                    "longText": "Massachusetts",
                    "shortText": "MA",
                    "types": [
                        "administrative_area_level_1",
                        "political",
                    ],
                },
                {
                    "longText": "United States",
                    "shortText": "US",
                    "types": [
                        "country",
                        "political",
                    ],
                },
            ],
        }

        result = normalize_google_discovery_result(item)

        self.assertIsNotNone(result)
        self.assertEqual(
            result["provider_types"],
            [
                "locality",
                "political",
            ],
        )
        self.assertEqual(
            result["geographic_type"],
            "settlement",
        )
        self.assertEqual(
            result["country_code"],
            "US",
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

    def test_google_place_details_distinguishes_missing_reference(self):
        import io
        import json
        from urllib.error import HTTPError
        from unittest.mock import patch

        from .geography.providers import google_places

        error_payload = {
            "error": {
                "code": 404,
                "message": "Place not found.",
                "status": "NOT_FOUND",
            }
        }

        error = HTTPError(
            url="https://places.googleapis.com/v1/places/missing-place",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=io.BytesIO(
                json.dumps(error_payload).encode("utf-8")
            ),
        )

        with (
            patch(
                "core.geography.providers.google_places."
                "get_google_places_api_key",
                return_value="test-api-key",
            ),
            patch(
                "core.geography.providers.google_places.urlopen",
                side_effect=error,
            ),
        ):
            with self.assertRaises(
                google_places.GooglePlacesReferenceNotFoundError
            ):
                google_places.get_google_geographic_place(
                    "missing-place"
                )

    def test_google_place_details_preserves_other_provider_errors(self):
        import io
        import json
        from urllib.error import HTTPError
        from unittest.mock import patch

        from .geography.providers import google_places

        cases = [
            (403, "PERMISSION_DENIED"),
            (429, "RESOURCE_EXHAUSTED"),
            (503, "UNAVAILABLE"),
            (404, None),
        ]

        for http_code, provider_status in cases:
            with self.subTest(
                http_code=http_code,
                provider_status=provider_status,
            ):
                error_payload = {
                    "error": {
                        "code": http_code,
                        "message": "Provider request failed.",
                    }
                }

                if provider_status:
                    error_payload["error"]["status"] = provider_status

                error = HTTPError(
                    url="https://places.googleapis.com/v1/places/test-place",
                    code=http_code,
                    msg="Provider Error",
                    hdrs=None,
                    fp=io.BytesIO(
                        json.dumps(error_payload).encode("utf-8")
                    ),
                )

                with (
                    patch(
                        "core.geography.providers.google_places."
                        "get_google_places_api_key",
                        return_value="test-api-key",
                    ),
                    patch(
                        "core.geography.providers.google_places.urlopen",
                        side_effect=error,
                    ),
                ):
                    with self.assertRaises(
                        google_places.GooglePlacesRequestError
                    ) as context:
                        google_places.get_google_geographic_place(
                            "test-place"
                        )

                self.assertNotIsInstance(
                    context.exception,
                    google_places.GooglePlacesReferenceNotFoundError,
                )

    def test_google_place_details_handles_unexpected_error_payload(self):
        import io
        import json
        from urllib.error import HTTPError
        from unittest.mock import patch

        from .geography.providers import google_places

        error = HTTPError(
            url="https://places.googleapis.com/v1/places/test-place",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=io.BytesIO(json.dumps([]).encode("utf-8")),
        )

        with (
            patch(
                "core.geography.providers.google_places."
                "get_google_places_api_key",
                return_value="test-api-key",
            ),
            patch(
                "core.geography.providers.google_places.urlopen",
                side_effect=error,
            ),
        ):
            with self.assertRaises(
                google_places.GooglePlacesRequestError
            ) as context:
                google_places.get_google_geographic_place(
                    "test-place"
                )

        self.assertNotIsInstance(
            context.exception,
            google_places.GooglePlacesReferenceNotFoundError,
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

    def test_geonames_normalizer_preserves_spatial_extent(self):
        from .geography.providers.geonames import (
            normalize_geographic_result,
        )

        result = normalize_geographic_result(
            {
                "geonameId": 4250542,
                "name": "Springfield",
                "toponymName": "Springfield",
                "countryCode": "US",
                "lat": "39.80172",
                "lng": "-89.64371",
                "fcl": "P",
                "fcode": "PPLA",
                "alternateNames": [],
                "bbox": {
                    "east": -89.568389,
                    "south": 39.653656,
                    "north": 39.87417,
                    "west": -89.773193,
                    "accuracyLevel": 0,
                },
            }
        )

        self.assertEqual(
            result["spatial_extent"],
            {
                "kind": "bounding_box",
                "north": 39.87417,
                "south": 39.653656,
                "east": -89.568389,
                "west": -89.773193,
            },
        )

    def test_geonames_normalizer_uses_unknown_spatial_extent_when_bbox_is_unavailable(self):
        from .geography.providers.geonames import (
            normalize_geographic_result,
        )

        base_item = {
            "geonameId": 4250542,
            "name": "Springfield",
            "toponymName": "Springfield",
            "countryCode": "US",
            "lat": "39.80172",
            "lng": "-89.64371",
            "fcl": "P",
            "fcode": "PPLA",
            "alternateNames": [],
        }

        without_bbox = normalize_geographic_result(
            base_item
        )
        with_incomplete_bbox = normalize_geographic_result(
            {
                **base_item,
                "bbox": {
                    "north": 39.87417,
                    "south": 39.653656,
                    "east": -89.568389,
                },
            }
        )

        self.assertIsNone(
            without_bbox["spatial_extent"]
        )
        self.assertIsNone(
            with_incomplete_bbox["spatial_extent"]
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


class GeoNamesReferenceNotFoundTests(TestCase):
    def test_geographic_lookup_distinguishes_missing_reference(self):
        import io
        import json
        from unittest.mock import patch

        from .geography.providers import geonames

        response_payload = {
            "status": {
                "message": "record does not exist",
                "value": 11,
            }
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
            with self.assertRaises(
                geonames.GeoNamesReferenceNotFoundError
            ):
                geonames.get_geographic_place("999999999")


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
    def test_resolvable_admin_references_preserve_provider_identity(self):
        from .geography.resolution import (
            get_resolvable_admin_references,
        )

        evidence = {
            "external_source": "geonames",
            "admin_context": [
                {
                    "level": 1,
                    "name": "Rio de Janeiro",
                    "external_id": "3451189",
                },
                {
                    "level": 2,
                    "name": "Miguel Pereira",
                    "external_id": "6322037",
                },
                {
                    "level": 3,
                    "name": "Example",
                    "external_id": "",
                },
            ],
        }

        self.assertEqual(
            get_resolvable_admin_references(evidence),
            [
                {
                    "level": 1,
                    "external_source": "geonames",
                    "external_id": "3451189",
                },
                {
                    "level": 2,
                    "external_source": "geonames",
                    "external_id": "6322037",
                },
            ],
        )

    def test_resolvable_admin_references_require_provider_identity(self):
        from .geography.resolution import (
            get_resolvable_admin_references,
        )

        evidence = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Rio de Janeiro",
                    "external_id": "3451189",
                },
            ],
        }

        self.assertEqual(
            get_resolvable_admin_references(evidence),
            [],
        )

    def test_reconstructed_admin_reference_can_corroborate_candidate_level(self):
        from .geography.resolution import (
            observe_candidate_admin_against_reconstructed_references,
        )

        candidate = {
            "external_source": "google_places",
            "admin_context": [
                {
                    "level": 2,
                    "name": "Middlesex County",
                },
            ],
        }
        reconstructed_references = [
            {
                "level": 2,
                "external_source": "geonames",
                "external_id": "4943909",
                "reference": {
                    "name": "Middlesex County",
                    "canonical_name": "Middlesex County",
                    "aliases": [],
                    "external_source": "geonames",
                    "external_id": "4943909",
                    "geographic_type": "administrative_area",
                },
            },
        ]

        observations = (
            observe_candidate_admin_against_reconstructed_references(
                candidate,
                reconstructed_references,
            )
        )

        self.assertEqual(
            observations,
            [
                {
                    "level": 2,
                    "external_source": "geonames",
                    "external_id": "4943909",
                    "nominal": {
                        "matching_identity_values": [
                            "middlesex county",
                        ],
                        "compatibility": "compatible",
                    },
                },
            ],
        )

    def test_reconstructed_admin_reference_nominal_difference_remains_unresolved(self):
        from .geography.resolution import (
            observe_candidate_admin_against_reconstructed_references,
        )

        candidate = {
            "external_source": "google_places",
            "admin_context": [
                {
                    "level": 2,
                    "name": "Example District",
                },
            ],
        }
        reconstructed_references = [
            {
                "level": 2,
                "external_source": "geonames",
                "external_id": "example-admin-123",
                "reference": {
                    "name": "Example Municipality",
                    "canonical_name": "Example Municipality",
                    "aliases": [],
                    "external_source": "geonames",
                    "external_id": "example-admin-123",
                    "geographic_type": "administrative_area",
                },
            },
        ]

        observations = (
            observe_candidate_admin_against_reconstructed_references(
                candidate,
                reconstructed_references,
            )
        )

        self.assertEqual(
            observations,
            [
                {
                    "level": 2,
                    "external_source": "geonames",
                    "external_id": "example-admin-123",
                    "nominal": {
                        "matching_identity_values": [],
                        "compatibility": "unresolved",
                    },
                },
            ],
        )

    def test_reconstructed_admin_reference_requires_matching_level(self):
        from .geography.resolution import (
            observe_candidate_admin_against_reconstructed_references,
        )

        candidate = {
            "admin_context": [
                {
                    "level": 1,
                    "name": "Santarém",
                },
            ],
        }
        reconstructed_references = [
            {
                "level": 2,
                "external_source": "geonames",
                "external_id": "8010609",
                "reference": {
                    "name": "Santarém",
                    "canonical_name": "Santarém",
                    "aliases": [],
                    "external_source": "geonames",
                    "external_id": "8010609",
                    "geographic_type": "administrative_area",
                },
            },
        ]

        observations = (
            observe_candidate_admin_against_reconstructed_references(
                candidate,
                reconstructed_references,
            )
        )

        self.assertEqual(observations, [])

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

    def test_gate_two_semantic_evidence_rejects_different_explicit_geographic_types(self):
        from .geography.resolution import (
            get_semantic_evidence_observation,
        )

        candidate = {
            "name": "Chapada Diamantina",
            "country_code": "BR",
            "geographic_type": "natural_feature",
        }
        reference = {
            "name": "Chapada Diamantina National Park",
            "country_code": "BR",
            "geographic_type": "park",
        }

        observation = get_semantic_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "candidate_geographic_type": "natural_feature",
                "reference_geographic_type": "park",
                "compatibility": "incompatible",
            },
        )

    def test_gate_two_semantic_evidence_is_unknown_when_classification_is_missing(self):
        from .geography.resolution import (
            get_semantic_evidence_observation,
        )

        candidate = {
            "name": "Breda",
            "country_code": "NL",
            "geographic_type": None,
            "primary_type": "locality",
            "provider_types": [
                "locality",
                "political",
            ],
        }
        reference = {
            "name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }

        observation = get_semantic_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "candidate_geographic_type": "",
                "reference_geographic_type": "settlement",
                "compatibility": "unknown",
            },
        )

    def test_gate_two_semantic_evidence_accepts_matching_explicit_geographic_types(self):
        from .geography.resolution import (
            get_semantic_evidence_observation,
        )

        candidate = {
            "name": "Lake Como",
            "country_code": "IT",
            "geographic_type": "lake",
        }
        reference = {
            "name": "Lago di Como",
            "country_code": "IT",
            "geographic_type": "lake",
        }

        observation = get_semantic_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "candidate_geographic_type": "lake",
                "reference_geographic_type": "lake",
                "compatibility": "compatible",
            },
        )

    def test_gate_two_nominal_evidence_does_not_treat_name_expansion_as_identity_match(self):
        from .geography.resolution import (
            get_nominal_evidence_observation,
        )

        candidate = {
            "name": "Chapada Diamantina",
            "canonical_name": "Chapada Diamantina",
            "aliases": [],
        }
        reference = {
            "name": "Chapada Diamantina National Park",
            "canonical_name": "Chapada Diamantina National Park",
            "aliases": [
                "Parque Nacional da Chapada Diamantina",
            ],
        }

        observation = get_nominal_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "matching_identity_values": [],
                "compatibility": "unresolved",
            },
        )

    def test_gate_two_nominal_evidence_accepts_exact_normalized_alias_identity_match(self):
        from .geography.resolution import (
            get_nominal_evidence_observation,
        )

        candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
        }
        reference = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": [
                "Lake Como",
                "Lago Como",
            ],
        }

        observation = get_nominal_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "matching_identity_values": [
                    "lake como",
                ],
                "compatibility": "compatible",
            },
        )

    def test_gate_two_country_evidence_rejects_different_explicit_countries(self):
        from .geography.resolution import (
            get_country_evidence_observation,
        )

        candidate = {
            "name": "Lake Como",
            "country_code": "IT",
        }
        reference = {
            "name": "Lake Como",
            "country_code": "US",
        }

        observation = get_country_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "candidate_country_code": "IT",
                "reference_country_code": "US",
                "compatibility": "incompatible",
            },
        )

    def test_gate_two_country_evidence_accepts_matching_explicit_countries(self):
        from .geography.resolution import (
            get_country_evidence_observation,
        )

        candidate = {
            "name": "Lake Como",
            "country_code": "it",
        }
        reference = {
            "name": "Lago di Como",
            "country_code": "IT",
        }

        observation = get_country_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "candidate_country_code": "IT",
                "reference_country_code": "IT",
                "compatibility": "compatible",
            },
        )

    def test_gate_two_country_evidence_is_unknown_when_country_is_missing(self):
        from .geography.resolution import (
            get_country_evidence_observation,
        )

        candidate = {
            "name": "Lake Como",
            "country_code": None,
        }
        reference = {
            "name": "Lago di Como",
            "country_code": "IT",
        }

        observation = get_country_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "candidate_country_code": "",
                "reference_country_code": "IT",
                "compatibility": "unknown",
            },
        )

    def test_gate_two_collects_pairwise_identity_evidence_without_deciding_identity(self):
        from .geography.resolution import (
            get_geographic_identity_evidence_observation,
        )

        candidate = {
            "name": "Lake Como",
            "canonical_name": "Lake Como",
            "aliases": [],
            "country_code": "IT",
            "geographic_type": "lake",
            "latitude": 46.0160486,
            "longitude": 9.2571676,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Lombardy",
                },
            ],
        }
        reference = {
            "name": "Lago di Como",
            "canonical_name": "Lago di Como",
            "aliases": [
                "Lake Como",
            ],
            "country_code": "IT",
            "geographic_type": "lake",
            "latitude": 46.00793,
            "longitude": 9.26079,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Lombardy",
                },
                {
                    "level": 2,
                    "name": "Province of Como",
                },
            ],
        }

        observation = get_geographic_identity_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation["nominal"],
            {
                "matching_identity_values": [
                    "lake como",
                ],
                "compatibility": "compatible",
            },
        )
        self.assertEqual(
            observation["semantic"],
            {
                "candidate_geographic_type": "lake",
                "reference_geographic_type": "lake",
                "compatibility": "compatible",
            },
        )
        self.assertEqual(
            observation["country"],
            {
                "candidate_country_code": "IT",
                "reference_country_code": "IT",
                "compatibility": "compatible",
            },
        )
        self.assertEqual(
            observation["admin"],
            {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
        )
        self.assertAlmostEqual(
            observation["spatial"]["distance_km"],
            0.945,
            places=2,
        )

    def test_gate_two_collects_related_but_non_identical_geographic_evidence(self):
        from .geography.resolution import (
            get_geographic_identity_evidence_observation,
        )

        candidate = {
            "name": "Chapada Diamantina",
            "canonical_name": "Chapada Diamantina",
            "aliases": [],
            "country_code": "BR",
            "geographic_type": "natural_feature",
            "latitude": -12.8801668,
            "longitude": -41.3721853,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Bahia",
                },
            ],
        }
        reference = {
            "name": "Chapada Diamantina National Park",
            "canonical_name": "Chapada Diamantina National Park",
            "aliases": [
                "Parque Nacional da Chapada Diamantina",
            ],
            "country_code": "BR",
            "geographic_type": "park",
            "latitude": -12.87992,
            "longitude": -41.40095,
            "admin_context": [
                {
                    "level": 1,
                    "name": "Bahia",
                },
            ],
        }

        observation = get_geographic_identity_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation["nominal"]["compatibility"],
            "unresolved",
        )
        self.assertEqual(
            observation["semantic"]["compatibility"],
            "incompatible",
        )
        self.assertEqual(
            observation["country"]["compatibility"],
            "compatible",
        )
        self.assertEqual(
            observation["admin"],
            {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
        )
        self.assertLess(
            observation["spatial"]["distance_km"],
            5,
        )
        self.assertNotIn(
            "identity_relation",
            observation,
        )
        self.assertNotIn(
            "reconciliation_action",
            observation,
        )

    def test_gate_two_preserves_when_explicit_semantic_evidence_is_incompatible(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [],
                "compatibility": "unresolved",
            },
            "semantic": {
                "candidate_geographic_type": "natural_feature",
                "reference_geographic_type": "park",
                "compatibility": "incompatible",
            },
            "country": {
                "candidate_country_code": "BR",
                "reference_country_code": "BR",
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
            "spatial": {
                "distance_km": 3.12,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_feature_without_positive_identity_strategy(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [
                    "lake como",
                ],
                "compatibility": "compatible",
            },
            "semantic": {
                "candidate_geographic_type": "lake",
                "reference_geographic_type": "lake",
                "compatibility": "compatible",
            },
            "country": {
                "candidate_country_code": "IT",
                "reference_country_code": "IT",
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
            "spatial": {
                "distance_km": 0.945,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_localized_identity_without_positive_admin_corroboration(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [
                    "springfield",
                ],
                "compatibility": "compatible",
            },
            "semantic": {
                "candidate_geographic_type": "settlement",
                "reference_geographic_type": "settlement",
                "compatibility": "compatible",
            },
            "country": {
                "candidate_country_code": "US",
                "reference_country_code": "US",
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [],
                "divergent_levels": [1, 2],
            },
            "spatial": {
                "distance_km": 1452.0,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_localized_identity_with_only_admin_corroboration(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [
                    "springfield",
                ],
                "compatibility": "compatible",
            },
            "semantic": {
                "candidate_geographic_type": "settlement",
                "reference_geographic_type": "settlement",
                "compatibility": "compatible",
            },
            "country": {
                "candidate_country_code": "US",
                "reference_country_code": "US",
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [2],
            },
            "spatial": {
                "distance_km": 0.158,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_when_semantic_evidence_is_unknown(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [
                    "breda",
                ],
                "compatibility": "compatible",
            },
            "semantic": {
                "candidate_geographic_type": "",
                "reference_geographic_type": "settlement",
                "compatibility": "unknown",
            },
            "country": {
                "candidate_country_code": "NL",
                "reference_country_code": "NL",
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [2],
            },
            "spatial": {
                "distance_km": 1.71,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_when_country_evidence_is_unknown(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [
                    "lake como",
                ],
                "compatibility": "compatible",
            },
            "semantic": {
                "candidate_geographic_type": "lake",
                "reference_geographic_type": "lake",
                "compatibility": "compatible",
            },
            "country": {
                "candidate_country_code": "",
                "reference_country_code": "IT",
                "compatibility": "unknown",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
            "spatial": {
                "distance_km": 0.945,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_when_country_evidence_is_incompatible(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [
                    "springfield",
                ],
                "compatibility": "compatible",
            },
            "semantic": {
                "candidate_geographic_type": "settlement",
                "reference_geographic_type": "settlement",
                "compatibility": "compatible",
            },
            "country": {
                "candidate_country_code": "US",
                "reference_country_code": "CA",
                "compatibility": "incompatible",
            },
            "admin": {
                "compatible_levels": [],
                "divergent_levels": [],
            },
            "spatial": {
                "distance_km": None,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_preserves_without_exact_nominal_identity_match(self):
        from .geography.resolution import (
            evaluate_geographic_identity_evidence,
        )

        evidence = {
            "nominal": {
                "matching_identity_values": [],
                "compatibility": "unresolved",
            },
            "semantic": {
                "candidate_geographic_type": "lake",
                "reference_geographic_type": "lake",
                "compatibility": "compatible",
            },
            "country": {
                "candidate_country_code": "IT",
                "reference_country_code": "IT",
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
            "spatial": {
                "distance_km": 0.5,
            },
        }

        evaluation = evaluate_geographic_identity_evidence(
            evidence
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
        )

    def test_gate_two_core_compatibility_supports_strategy_resolution(self):
        from .geography.resolution import (
            geographic_identity_evidence_supports_strategy_resolution,
        )

        evidence = {
            "nominal": {
                "compatibility": "compatible",
            },
            "semantic": {
                "compatibility": "compatible",
            },
            "country": {
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [],
                "divergent_levels": [1, 2],
            },
            "spatial": {
                "distance_km": 1452.0,
            },
        }

        self.assertTrue(
            geographic_identity_evidence_supports_strategy_resolution(
                evidence
            )
        )

    def test_gate_two_unknown_core_evidence_blocks_strategy_resolution(self):
        from .geography.resolution import (
            geographic_identity_evidence_supports_strategy_resolution,
        )

        evidence = {
            "nominal": {
                "compatibility": "compatible",
            },
            "semantic": {
                "compatibility": "unknown",
            },
            "country": {
                "compatibility": "compatible",
            },
        }

        self.assertFalse(
            geographic_identity_evidence_supports_strategy_resolution(
                evidence
            )
        )

    def test_gate_two_unresolved_or_incompatible_core_evidence_blocks_strategy_resolution(self):
        from .geography.resolution import (
            geographic_identity_evidence_supports_strategy_resolution,
        )

        unresolved_nominal_evidence = {
            "nominal": {
                "compatibility": "unresolved",
            },
            "semantic": {
                "compatibility": "compatible",
            },
            "country": {
                "compatibility": "compatible",
            },
        }
        incompatible_country_evidence = {
            "nominal": {
                "compatibility": "compatible",
            },
            "semantic": {
                "compatibility": "compatible",
            },
            "country": {
                "compatibility": "incompatible",
            },
        }

        self.assertFalse(
            geographic_identity_evidence_supports_strategy_resolution(
                unresolved_nominal_evidence
            )
        )
        self.assertFalse(
            geographic_identity_evidence_supports_strategy_resolution(
                incompatible_country_evidence
            )
        )

    def test_localized_strategy_requires_activation_and_gate_two_eligibility(self):
        from .geography.resolution import (
            localized_identity_strategy_can_evaluate,
        )

        eligible_evidence = {
            "nominal": {
                "compatibility": "compatible",
            },
            "semantic": {
                "compatibility": "compatible",
            },
            "country": {
                "compatibility": "compatible",
            },
        }
        blocked_evidence = {
            "nominal": {
                "compatibility": "compatible",
            },
            "semantic": {
                "compatibility": "unknown",
            },
            "country": {
                "compatibility": "compatible",
            },
        }

        localized_candidate = {
            "geographic_type": "settlement",
        }
        non_localized_candidate = {
            "geographic_type": "lake",
        }

        self.assertTrue(
            localized_identity_strategy_can_evaluate(
                localized_candidate,
                eligible_evidence,
            )
        )
        self.assertFalse(
            localized_identity_strategy_can_evaluate(
                non_localized_candidate,
                eligible_evidence,
            )
        )
        self.assertFalse(
            localized_identity_strategy_can_evaluate(
                localized_candidate,
                blocked_evidence,
            )
        )

    def test_localized_strategy_preserves_identity_without_positive_resolution_rule(self):
        from .geography.resolution import (
            evaluate_localized_identity_strategy,
        )

        candidate = {
            "name": "Springfield",
            "geographic_type": "settlement",
            "country_code": "US",
            "latitude": 42.1,
            "longitude": -72.59,
        }
        reference = {
            "name": "Springfield",
            "geographic_type": "settlement",
            "country_code": "US",
            "latitude": 42.1003,
            "longitude": -72.5896,
        }
        gate_two_evidence = {
            "nominal": {
                "compatibility": "compatible",
            },
            "semantic": {
                "compatibility": "compatible",
            },
            "country": {
                "compatibility": "compatible",
            },
            "admin": {
                "compatible_levels": [1],
                "divergent_levels": [],
            },
            "spatial": {
                "distance_km": 0.048,
            },
        }

        localized_evidence = {
            "spatial_extent": {
                "relation": "inside",
            },
        }

        evaluation = evaluate_localized_identity_strategy(
            candidate,
            reference,
            gate_two_evidence,
            localized_evidence,
        )

        self.assertEqual(
            evaluation,
            {
                "identity_relation": "unresolved",
                "reconciliation_action": "preserve",
            },
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

    def test_localized_identity_evidence_collects_spatial_extent_observation(self):
        from .geography.resolution import (
            get_localized_identity_evidence_observation,
        )

        candidate = {
            "latitude": 42.3666036,
            "longitude": -71.1056916,
        }
        reference = {
            "spatial_extent": {
                "kind": "bounding_box",
                "north": 42.404167,
                "south": 42.352397,
                "east": -71.063984,
                "west": -71.160332,
            },
        }

        reconstructed_admin_observations = [
            {
                "level": 2,
                "external_source": "geonames",
                "external_id": "4943909",
                "nominal": {
                    "matching_identity_values": [
                        "middlesex county",
                    ],
                    "compatibility": "compatible",
                },
            },
        ]

        evidence = get_localized_identity_evidence_observation(
            candidate,
            reference,
            reconstructed_admin_observations,
        )

        self.assertEqual(
            evidence,
            {
                "spatial_extent": {
                    "relation": "inside",
                },
                "reconstructed_admin": (
                    reconstructed_admin_observations
                ),
            },
        )

    def test_spatial_extent_observation_detects_point_inside_bounding_box(self):
        from .geography.resolution import (
            get_spatial_extent_evidence_observation,
        )

        candidate = {
            "latitude": 42.3666036,
            "longitude": -71.1056916,
        }
        reference = {
            "spatial_extent": {
                "kind": "bounding_box",
                "north": 42.404167,
                "south": 42.352397,
                "east": -71.063984,
                "west": -71.160332,
            },
        }

        observation = get_spatial_extent_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "relation": "inside",
            },
        )

    def test_spatial_extent_observation_handles_bounding_box_across_antimeridian(self):
        from .geography.resolution import (
            get_spatial_extent_evidence_observation,
        )

        reference = {
            "spatial_extent": {
                "kind": "bounding_box",
                "north": 10.0,
                "south": -10.0,
                "east": -170.0,
                "west": 170.0,
            },
        }

        eastern_candidate = {
            "latitude": 0.0,
            "longitude": 175.0,
        }
        western_candidate = {
            "latitude": 0.0,
            "longitude": -175.0,
        }

        self.assertEqual(
            get_spatial_extent_evidence_observation(
                eastern_candidate,
                reference,
            ),
            {
                "relation": "inside",
            },
        )
        self.assertEqual(
            get_spatial_extent_evidence_observation(
                western_candidate,
                reference,
            ),
            {
                "relation": "inside",
            },
        )

    def test_spatial_extent_observation_detects_point_outside_bounding_box(self):
        from .geography.resolution import (
            get_spatial_extent_evidence_observation,
        )

        candidate = {
            "latitude": 42.1,
            "longitude": -72.59,
        }
        reference = {
            "spatial_extent": {
                "kind": "bounding_box",
                "north": 39.87417,
                "south": 39.653656,
                "east": -89.568389,
                "west": -89.773193,
            },
        }

        observation = get_spatial_extent_evidence_observation(
            candidate,
            reference,
        )

        self.assertEqual(
            observation,
            {
                "relation": "outside",
            },
        )

    def test_spatial_extent_observation_is_unknown_without_supported_complete_evidence(self):
        from .geography.resolution import (
            get_spatial_extent_evidence_observation,
        )

        candidate_without_coordinates = {
            "latitude": None,
            "longitude": -71.1056916,
        }
        complete_candidate = {
            "latitude": 42.3666036,
            "longitude": -71.1056916,
        }
        unsupported_reference = {
            "spatial_extent": {
                "kind": "viewport",
                "north": 42.404167,
                "south": 42.352397,
                "east": -71.063984,
                "west": -71.160332,
            },
        }
        incomplete_reference = {
            "spatial_extent": {
                "kind": "bounding_box",
                "north": 42.404167,
                "south": 42.352397,
                "east": -71.063984,
            },
        }

        self.assertEqual(
            get_spatial_extent_evidence_observation(
                candidate_without_coordinates,
                {
                    "spatial_extent": {
                        "kind": "bounding_box",
                        "north": 42.404167,
                        "south": 42.352397,
                        "east": -71.063984,
                        "west": -71.160332,
                    },
                },
            ),
            {
                "relation": "unknown",
            },
        )
        self.assertEqual(
            get_spatial_extent_evidence_observation(
                complete_candidate,
                unsupported_reference,
            ),
            {
                "relation": "unknown",
            },
        )
        self.assertEqual(
            get_spatial_extent_evidence_observation(
                complete_candidate,
                incomplete_reference,
            ),
            {
                "relation": "unknown",
            },
        )

    def test_spatial_extent_observation_is_unknown_for_invalid_geometry(self):
        from .geography.resolution import (
            get_spatial_extent_evidence_observation,
        )

        valid_candidate = {
            "latitude": 42.3666036,
            "longitude": -71.1056916,
        }
        valid_reference = {
            "spatial_extent": {
                "kind": "bounding_box",
                "north": 42.404167,
                "south": 42.352397,
                "east": -71.063984,
                "west": -71.160332,
            },
        }

        invalid_candidates = [
            {
                "latitude": 91.0,
                "longitude": -71.1056916,
            },
            {
                "latitude": 42.3666036,
                "longitude": 181.0,
            },
        ]
        invalid_references = [
            {
                "spatial_extent": {
                    "kind": "bounding_box",
                    "north": 42.0,
                    "south": 43.0,
                    "east": -71.0,
                    "west": -72.0,
                },
            },
            {
                "spatial_extent": {
                    "kind": "bounding_box",
                    "north": 91.0,
                    "south": 42.0,
                    "east": -71.0,
                    "west": -72.0,
                },
            },
            {
                "spatial_extent": {
                    "kind": "bounding_box",
                    "north": 43.0,
                    "south": 42.0,
                    "east": 181.0,
                    "west": -72.0,
                },
            },
        ]

        for candidate in invalid_candidates:
            self.assertEqual(
                get_spatial_extent_evidence_observation(
                    candidate,
                    valid_reference,
                ),
                {
                    "relation": "unknown",
                },
            )

        for reference in invalid_references:
            self.assertEqual(
                get_spatial_extent_evidence_observation(
                    valid_candidate,
                    reference,
                ),
                {
                    "relation": "unknown",
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




class POIPlaceReconciliationTests(TestCase):
    def setUp(self):
        from .models import Destination, Place

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

        self.city_place = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.country_place,
            name="Rome",
            canonical_name="Rome",
            aliases=[],
            country_code="IT",
            place_type="city",
            geographic_type="settlement",
            city="Rome",
            latitude="41.9028",
            longitude="12.4964",
        )

        self.existing_restaurant = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.city_place,
            name="Bella Italia",
            canonical_name="Bella Italia",
            aliases=[],
            country_code="IT",
            place_type="restaurant",
            city="Rome",
            latitude="41.9028",
            longitude="12.4964",
        )

    def test_same_name_does_not_confirm_external_poi_identity(self):
        from .geography.services import annotate_existing_poi_places

        provider_result = {
            "name": "Bella Italia",
            "canonical_name": "Bella Italia",
            "aliases": [],
            "external_source": "foursquare",
            "external_id": "different-bella-italia",
            "country_code": "IT",
            "latitude": 41.9200,
            "longitude": 12.5100,
        }

        results = annotate_existing_poi_places(
            results=[provider_result],
            city_place=self.city_place,
            place_type="restaurant",
        )

        self.assertIsNone(results[0]["existing_place_id"])
        self.assertEqual(
            results[0]["candidate_place_ids"],
            [self.existing_restaurant.id],
        )

        self.existing_restaurant.refresh_from_db()
        self.assertEqual(
            str(self.existing_restaurant.latitude),
            "41.902800",
        )


    def test_confirmed_external_identity_reuses_correct_poi(self):
        from .models import Place, PlaceExternalIdentity
        from .geography.services import annotate_existing_poi_places

        other_restaurant = Place.objects.create(
            destination=self.destination,
            country_ref=self.country,
            parent_place=self.city_place,
            name="Bella Italia",
            canonical_name="Bella Italia",
            aliases=[],
            country_code="IT",
            place_type="restaurant",
            city="Rome",
            latitude="41.9200",
            longitude="12.5100",
        )

        PlaceExternalIdentity.objects.create(
            place=other_restaurant,
            external_source="foursquare",
            external_id="bella-italia-confirmed",
            geographic_type="",
        )

        provider_result = {
            "name": "Bella Italia",
            "canonical_name": "Bella Italia",
            "aliases": [],
            "external_source": "foursquare",
            "external_id": "bella-italia-confirmed",
            "country_code": "IT",
            "latitude": 41.9200,
            "longitude": 12.5100,
        }

        results = annotate_existing_poi_places(
            results=[provider_result],
            city_place=self.city_place,
            place_type="restaurant",
        )

        self.assertEqual(
            results[0]["existing_place_id"],
            other_restaurant.id,
        )
        self.assertNotEqual(
            results[0]["existing_place_id"],
            self.existing_restaurant.id,
        )

        other_restaurant.refresh_from_db()
        self.existing_restaurant.refresh_from_db()

        self.assertEqual(
            str(other_restaurant.latitude),
            "41.920000",
        )
        self.assertEqual(
            str(self.existing_restaurant.latitude),
            "41.902800",
        )


    def test_same_name_does_not_reuse_poi_during_materialization(self):
        from .geography.services import find_existing_poi_place

        provider_result = {
            "name": "Bella Italia",
            "canonical_name": "Bella Italia",
            "aliases": [],
            "external_source": "foursquare",
            "external_id": "different-bella-italia",
            "country_code": "IT",
            "latitude": 41.9200,
            "longitude": 12.5100,
        }

        existing_place = find_existing_poi_place(
            poi_result=provider_result,
            city_place=self.city_place,
            place_type="restaurant",
        )

        self.assertIsNone(existing_place)


    @patch("core.geography.providers.foursquare.search_pois")
    @patch("core.views.get_poi")
    def test_ambiguous_poi_materialization_preserves_existing_place(
        self,
        mock_get_poi,
        mock_search_pois,
    ):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Place, PlaceExternalIdentity

        user = User.objects.create_user(
            username="poi-materialization-user",
            password="test-password",
        )
        access_token = str(AccessToken.for_user(user))

        provider_result = {
            "name": "Bella Italia",
            "canonical_name": "Bella Italia",
            "aliases": [],
            "external_source": "foursquare",
            "external_id": "different-bella-italia",
            "country_code": "IT",
            "locality": "Rome",
            "latitude": 41.9200,
            "longitude": 12.5100,
        }

        mock_get_poi.return_value = provider_result
        mock_search_pois.return_value = [provider_result]

        original_place_count = Place.objects.count()

        response = self.client.post(
            "/api/geography/pois/materialize/",
            data={
                "external_id": "different-bella-italia",
                "place_type": "restaurant",
                "city_place_id": self.city_place.id,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["code"],
            "poi_resolution_required",
        )
        self.assertIn(
            self.existing_restaurant.id,
            response.json()["candidate_place_ids"],
        )

        self.assertEqual(
            Place.objects.count(),
            original_place_count,
        )

        self.existing_restaurant.refresh_from_db()

        self.assertEqual(
            str(self.existing_restaurant.latitude),
            "41.902800",
        )
        self.assertEqual(
            str(self.existing_restaurant.longitude),
            "12.496400",
        )

        self.assertFalse(
            PlaceExternalIdentity.objects.filter(
                external_source="foursquare",
                external_id="different-bella-italia",
            ).exists()
        )



    def test_poi_gate_preserves_name_only_candidate(self):
        from .geography.services import evaluate_poi_reference_gate

        decision = evaluate_poi_reference_gate(
            poi_result={
                "name": "Bella Italia",
                "canonical_name": "Bella Italia",
                "aliases": [],
                "external_source": "foursquare",
                "external_id": "different-bella-italia",
            },
            city_place=self.city_place,
            place_type="restaurant",
        )

        self.assertEqual(decision["state"], "preserve")
        self.assertEqual(
            decision["candidate_place_ids"],
            [self.existing_restaurant.id],
        )
        self.assertEqual(decision["reason"], "unresolved_identity")

    def test_poi_gate_reuses_confirmed_compatible_identity(self):
        from .models import PlaceExternalIdentity
        from .geography.services import evaluate_poi_reference_gate

        PlaceExternalIdentity.objects.create(
            place=self.existing_restaurant,
            external_source="foursquare",
            external_id="confirmed-bella-italia",
        )

        decision = evaluate_poi_reference_gate(
            poi_result={
                "name": "Bella Italia",
                "external_source": "foursquare",
                "external_id": "confirmed-bella-italia",
            },
            city_place=self.city_place,
            place_type="restaurant",
        )

        self.assertEqual(decision["state"], "reuse")
        self.assertEqual(
            decision["place"].id,
            self.existing_restaurant.id,
        )

    def test_poi_gate_allows_creation_without_candidates(self):
        from .geography.services import evaluate_poi_reference_gate

        decision = evaluate_poi_reference_gate(
            poi_result={
                "name": "Trattoria Nuova",
                "canonical_name": "Trattoria Nuova",
                "aliases": [],
                "external_source": "foursquare",
                "external_id": "new-trattoria",
            },
            city_place=self.city_place,
            place_type="restaurant",
        )

        self.assertEqual(decision["state"], "create")
        self.assertEqual(decision["candidate_place_ids"], [])



    def test_poi_gate_preserves_conflicting_external_identity(self):
        from .models import PlaceExternalIdentity
        from .geography.services import evaluate_poi_reference_gate

        PlaceExternalIdentity.objects.create(
            place=self.existing_restaurant,
            external_source="foursquare",
            external_id="conflicting-bella-italia",
        )

        decision = evaluate_poi_reference_gate(
            poi_result={
                "name": "Bella Italia",
                "external_source": "foursquare",
                "external_id": "conflicting-bella-italia",
            },
            city_place=self.city_place,
            place_type="hotel",
        )

        self.assertEqual(decision["state"], "preserve")
        self.assertIsNone(decision["place"])
        self.assertEqual(
            decision["candidate_place_ids"],
            [self.existing_restaurant.id],
        )
        self.assertEqual(
            decision["reason"],
            "external_identity_context_conflict",
        )



    @patch("core.geography.services.create_poi_place")
    @patch("core.geography.services.evaluate_poi_reference_gate")
    def test_poi_materialization_preserves_concurrent_identity_conflict(
        self,
        mock_gate,
        mock_create,
    ):
        from .geography.services import materialize_poi_place

        mock_gate.side_effect = [
            {
                "state": "create",
                "place": None,
                "candidate_place_ids": [],
                "reason": "no_existing_candidates",
            },
            {
                "state": "preserve",
                "place": None,
                "candidate_place_ids": [self.existing_restaurant.id],
                "reason": "external_identity_context_conflict",
            },
        ]

        mock_create.return_value = (
            self.existing_restaurant,
            False,
        )

        result = materialize_poi_place(
            poi_result={
                "name": "Bella Italia",
                "canonical_name": "Bella Italia",
                "aliases": [],
                "external_source": "foursquare",
                "external_id": "concurrent-bella-italia",
            },
            city_place=self.city_place,
            country_code="IT",
            place_type="hotel",
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertEqual(
            result["candidate_place_ids"],
            [self.existing_restaurant.id],
        )
        self.assertEqual(mock_gate.call_count, 2)



    def test_create_poi_recovers_existing_identity_after_integrity_error(self):
        from .geography.services import create_poi_place
        from .models import Place, PlaceExternalIdentity

        PlaceExternalIdentity.objects.create(
            place=self.existing_restaurant,
            external_source="foursquare",
            external_id="existing-bella-italia",
            geographic_type="",
        )

        initial_place_count = Place.objects.count()

        place, created = create_poi_place(
            poi_result={
                "name": "Bella Italia",
                "canonical_name": "Bella Italia",
                "aliases": [],
                "external_source": "foursquare",
                "external_id": "existing-bella-italia",
                "latitude": 41.9,
                "longitude": 12.5,
            },
            city_place=self.city_place,
            country_code="IT",
            place_type="restaurant",
            user=None,
        )

        self.assertFalse(created)
        self.assertEqual(place.id, self.existing_restaurant.id)
        self.assertEqual(Place.objects.count(), initial_place_count)
        self.assertEqual(
            PlaceExternalIdentity.objects.filter(
                external_source="foursquare",
                external_id="existing-bella-italia",
            ).count(),
            1,
        )



    def test_poi_materialization_preserves_integrity_error_identity_conflict(
        self,
    ):
        from .geography.services import (
            evaluate_poi_reference_gate,
            materialize_poi_place,
        )
        from .models import BusinessPresence, Place, PlaceExternalIdentity

        PlaceExternalIdentity.objects.create(
            place=self.existing_restaurant,
            external_source="foursquare",
            external_id="concurrent-hotel-identity",
            geographic_type="",
        )

        initial_place_count = Place.objects.count()
        initial_presence_count = BusinessPresence.objects.count()
        initial_name = self.existing_restaurant.name
        initial_parent_id = self.existing_restaurant.parent_place_id

        def gate_with_concurrent_identity(**kwargs):
            if mock_gate.call_count == 1:
                return {
                    "state": "create",
                    "place": None,
                    "candidate_place_ids": [],
                    "reason": "no_existing_candidates",
                }

            return evaluate_poi_reference_gate(**kwargs)


        with patch(
            "core.geography.services.evaluate_poi_reference_gate"
        ) as mock_gate:
            mock_gate.side_effect = gate_with_concurrent_identity

            result = materialize_poi_place(
                poi_result={
                    "name": "Bella Italia",
                    "canonical_name": "Bella Italia",
                    "aliases": [],
                    "external_source": "foursquare",
                    "external_id": "concurrent-hotel-identity",
                    "latitude": 41.9,
                    "longitude": 12.5,
                },
                city_place=self.city_place,
                country_code="IT",
                place_type="hotel",
                user=None,
            )
        self.assertEqual(result["state"], "preserve")
        self.assertEqual(
            result["reason"],
            "external_identity_context_conflict",
        )
        self.assertEqual(
            result["candidate_place_ids"],
            [self.existing_restaurant.id],
        )
        self.assertEqual(mock_gate.call_count, 2)
        self.assertEqual(Place.objects.count(), initial_place_count)
        self.assertEqual(
            BusinessPresence.objects.count(),
            initial_presence_count,
        )

        self.existing_restaurant.refresh_from_db()
        self.assertEqual(self.existing_restaurant.name, initial_name)
        self.assertEqual(
            self.existing_restaurant.parent_place_id,
            initial_parent_id,
        )



    def test_manual_poi_creation_preserves_existing_name_candidate(self):
        from decimal import Decimal
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Place

        user = User.objects.create_user(
            username="manual-poi-test-user",
            password="test-password",
        )
        access_token = str(AccessToken.for_user(user))

        initial_place_count = Place.objects.count()
        original_latitude = self.existing_restaurant.latitude
        original_longitude = self.existing_restaurant.longitude

        response = self.client.post(
            "/api/geography/pois/create-manual/",
            data={
                "name": "Bella Italia",
                "place_type": "restaurant",
                "city_place_id": self.city_place.id,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 409)

        data = response.json()

        self.assertEqual(
            data["code"],
            "poi_resolution_required",
        )
        self.assertEqual(
            data["reason"],
            "unresolved_identity",
        )
        self.assertEqual(
            data["candidate_place_ids"],
            [self.existing_restaurant.id],
        )

        self.assertEqual(
            Place.objects.count(),
            initial_place_count,
        )

        self.existing_restaurant.refresh_from_db()

        self.assertEqual(
            Decimal(str(self.existing_restaurant.latitude)),
            Decimal(str(original_latitude)),
        )
        self.assertEqual(
            Decimal(str(self.existing_restaurant.longitude)),
            Decimal(str(original_longitude)),
        )



    def test_manual_poi_creation_without_candidates_creates_place(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Place

        user = User.objects.create_user(
            username="manual-poi-create-user",
            password="test-password",
        )
        access_token = str(AccessToken.for_user(user))

        initial_place_count = Place.objects.count()

        response = self.client.post(
            "/api/geography/pois/create-manual/",
            data={
                "name": "Trattoria Test Roma",
                "place_type": "restaurant",
                "city_place_id": self.city_place.id,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Place.objects.count(),
            initial_place_count + 1,
        )

        created_place = Place.objects.get(
            name="Trattoria Test Roma",
        )

        self.assertEqual(
            created_place.place_type,
            "restaurant",
        )
        self.assertEqual(
            created_place.parent_place_id,
            self.city_place.id,
        )
        self.assertEqual(
            created_place.country_ref_id,
            self.country.id,
        )


    def test_poi_materialization_preserves_conflicting_city_country(self):
        from .geography.services import materialize_poi_place
        from .models import Place

        self.city_place.country_code = "FR"
        self.city_place.save(update_fields=["country_code"])

        initial_place_count = Place.objects.count()

        result = materialize_poi_place(
            poi_result={
                "name": "Trattoria Country Conflict",
                "canonical_name": "Trattoria Country Conflict",
                "aliases": [],
                "external_source": "",
                "external_id": "",
            },
            city_place=self.city_place,
            country_code="IT",
            place_type="restaurant",
            user=None,
        )

        self.assertEqual(result["state"], "preserve")
        self.assertEqual(
            result["reason"],
            "country_ancestry_conflict",
        )
        self.assertEqual(
            result["candidate_place_ids"],
            [],
        )
        self.assertEqual(
            Place.objects.count(),
            initial_place_count,
        )

        self.city_place.refresh_from_db()
        self.assertEqual(self.city_place.country_code, "FR")


    def test_manual_poi_creation_preserves_conflicting_city_country(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Place

        user = User.objects.create_user(
            username="manual-poi-country-conflict-user",
            password="test-password",
        )
        access_token = str(AccessToken.for_user(user))

        self.city_place.country_code = "FR"
        self.city_place.save(update_fields=["country_code"])

        initial_place_count = Place.objects.count()

        response = self.client.post(
            "/api/geography/pois/create-manual/",
            data={
                "name": "Trattoria Country Conflict",
                "place_type": "restaurant",
                "city_place_id": self.city_place.id,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 409)

        data = response.json()

        self.assertEqual(
            data["code"],
            "poi_resolution_required",
        )
        self.assertEqual(
            data["reason"],
            "country_ancestry_conflict",
        )
        self.assertEqual(
            data["candidate_place_ids"],
            [],
        )
        self.assertEqual(
            Place.objects.count(),
            initial_place_count,
        )

        self.city_place.refresh_from_db()
        self.assertEqual(self.city_place.country_code, "FR")


    @patch("core.geography.providers.foursquare.search_pois")
    @patch("core.views.get_poi")
    def test_external_poi_materialization_preserves_conflicting_city_country(
        self,
        mock_get_poi,
        mock_search_pois,
    ):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Place

        user = User.objects.create_user(
            username="external-poi-country-conflict-user",
            password="test-password",
        )
        access_token = str(AccessToken.for_user(user))

        provider_result = {
            "name": "Trattoria Country Conflict",
            "canonical_name": "Trattoria Country Conflict",
            "aliases": [],
            "external_source": "foursquare",
            "external_id": "trattoria-country-conflict",
            "country_code": "IT",
            "locality": "Rome",
            "latitude": 41.9200,
            "longitude": 12.5100,
        }

        mock_get_poi.return_value = provider_result
        mock_search_pois.return_value = [provider_result]

        self.city_place.country_code = "FR"
        self.city_place.save(update_fields=["country_code"])

        initial_place_count = Place.objects.count()

        response = self.client.post(
            "/api/geography/pois/materialize/",
            data={
                "external_id": "trattoria-country-conflict",
                "place_type": "restaurant",
                "city_place_id": self.city_place.id,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 409)

        data = response.json()

        self.assertEqual(
            data["code"],
            "poi_resolution_required",
        )
        self.assertEqual(
            data["reason"],
            "country_ancestry_conflict",
        )
        self.assertEqual(
            data["candidate_place_ids"],
            [],
        )
        self.assertEqual(
            Place.objects.count(),
            initial_place_count,
        )

        self.city_place.refresh_from_db()
        self.assertEqual(self.city_place.country_code, "FR")


class ExperienceCreationAtomicityTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Destination, Place

        self.user = User.objects.create_user(
            username="experience-atomicity-user",
            password="test-password",
        )

        self.access_token = str(
            AccessToken.for_user(self.user)
        )

        self.destination = Destination.objects.create(
            name="Netherlands",
            country="Netherlands",
        )

        self.place = Place.objects.create(
            destination=self.destination,
            name="Breda",
            canonical_name="Breda",
            country_code="NL",
            place_type="city",
            city="Breda",
        )

        self.url = "/api/experiences/"

    @patch("core.views.Update.objects.create")
    def test_feed_update_failure_rolls_back_experience(
        self,
        create_update,
    ):
        from .models import Experience

        create_update.side_effect = RuntimeError(
            "Simulated feed update failure."
        )

        authorization = f"Bearer {self.access_token}"

        with self.assertRaises(RuntimeError):
            self.client.post(
                self.url,
                data={
                    "place": self.place.id,
                    "title": "A day in Breda",
                    "comment": "A useful experience.",
                    "rating": 4,
                },
                content_type="application/json",
                HTTP_AUTHORIZATION=authorization,
            )

        self.assertEqual(
            Experience.objects.count(),
            0,
        )


class ExternalExperienceCreationTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Destination, Place

        self.user = User.objects.create_user(
            username="external-experience-user",
            password="test-password",
        )
        self.access_token = str(
            AccessToken.for_user(self.user)
        )

        self.destination = Destination.objects.create(
            name="Netherlands",
            country="Netherlands",
        )
        self.place = Place.objects.create(
            destination=self.destination,
            name="Breda",
            canonical_name="Breda",
            country_code="NL",
            place_type="city",
            city="Breda",
        )
        self.url = "/api/experiences/"

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_country_conflict_returns_409_without_publication(
        self,
        reconstruct_external_reference,
    ):
        from .models import Experience, PlaceExternalIdentity, Update

        PlaceExternalIdentity.objects.create(
            place=self.place,
            external_source="geonames",
            external_id="2758401",
            geographic_type="settlement",
        )

        reconstruct_external_reference.return_value = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "canonical_name": "Breda",
            "country_code": "BE",
            "geographic_type": "settlement",
        }

        original_country_code = self.place.country_code
        original_destination_id = self.place.destination_id
        original_parent_id = self.place.parent_place_id

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day in Breda",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["code"],
            "geographic_resolution_required",
        )

        self.assertEqual(Experience.objects.count(), 0)
        self.assertEqual(Update.objects.count(), 0)

        self.place.refresh_from_db()

        self.assertEqual(self.place.country_code, original_country_code)
        self.assertEqual(
            self.place.destination_id,
            original_destination_id,
        )
        self.assertEqual(
            self.place.parent_place_id,
            original_parent_id,
        )

        self.assertEqual(
            PlaceExternalIdentity.objects.filter(
                place=self.place,
                external_source="geonames",
                external_id="2758401",
            ).count(),
            1,
        )

        reconstruct_external_reference.assert_called_once()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_country_identity_conflict_returns_409_without_experience(
        self,
        reconstruct_external_reference,
    ):
        from .models import Country, Destination, Experience, Place, Update

        conflicting_country = Country.objects.create(
            code="FR",
            canonical_name="Argentina",
            aliases=[],
        )

        reconstruct_external_reference.return_value = {
            "external_source": "geonames",
            "external_id": "3435910",
            "name": "Buenos Aires",
            "canonical_name": "Buenos Aires",
            "aliases": [],
            "country_code": "AR",
            "geographic_type": "settlement",
        }

        original_place_count = Place.objects.count()
        original_destination_count = Destination.objects.count()

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "3435910",
                "title": "A day in Buenos Aires",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )
        self.assertEqual(
            response.json()["code"],
            "country_identity_conflict",
        )

        self.assertEqual(Experience.objects.count(), 0)
        self.assertEqual(Update.objects.count(), 0)

        conflicting_country.refresh_from_db()
        self.assertEqual(conflicting_country.code, "FR")
        self.assertEqual(
            conflicting_country.canonical_name,
            "Argentina",
        )

        self.assertFalse(
            Country.objects.filter(code="AR").exists()
        )
        self.assertEqual(
            Place.objects.count(),
            original_place_count,
        )
        self.assertEqual(
            Destination.objects.count(),
            original_destination_count,
        )

        reconstruct_external_reference.assert_called_once()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_creation_requires_place_or_external_identity(
        self,
        reconstruct_external_reference,
    ):
        from .models import Experience

        response = self.client.post(
            self.url,
            data={
                "title": "A day somewhere",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Experience.objects.count(), 0)
        reconstruct_external_reference.assert_not_called()


    @patch("core.views.reconstruct_external_geographic_reference")
    def test_creation_rejects_partial_external_identity(
        self,
        reconstruct_external_reference,
    ):
        from .models import Experience

        incomplete_identities = (
            {"external_source": "geonames"},
            {"external_id": "2758401"},
        )

        for external_identity in incomplete_identities:
            with self.subTest(external_identity=external_identity):
                response = self.client.post(
                    self.url,
                    data={
                        **external_identity,
                        "title": "A day somewhere",
                        "comment": "A useful experience.",
                        "rating": 4,
                    },
                    content_type="application/json",
                    HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(Experience.objects.count(), 0)

        reconstruct_external_reference.assert_not_called()


    @patch("core.views.reconstruct_external_geographic_reference")
    def test_creation_rejects_unsupported_external_source(
        self,
        reconstruct_external_reference,
    ):
        from .models import Experience

        response = self.client.post(
            self.url,
            data={
                "external_source": "unsupported_provider",
                "external_id": "2758401",
                "title": "A day somewhere",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Experience.objects.count(), 0)
        reconstruct_external_reference.assert_not_called()


    @patch("core.views.reconstruct_external_geographic_reference")
    def test_creation_rejects_place_with_external_identity(
        self,
        reconstruct_external_reference,
    ):
        from .models import Experience

        response = self.client.post(
            self.url,
            data={
                "place": self.place.id,
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day in Breda",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Experience.objects.count(), 0)
        reconstruct_external_reference.assert_not_called()


    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_returns_service_unavailable_when_provider_is_not_configured(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        from .geography.providers.geonames import GeoNamesConfigurationError
        from .models import Experience

        reconstruct_external_reference.side_effect = GeoNamesConfigurationError(
            "Simulated provider configuration failure."
        )

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day somewhere",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Geographic search is not configured.",
        )
        self.assertEqual(Experience.objects.count(), 0)
        resolve_reconstructed_reference.assert_not_called()


    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_returns_service_unavailable_when_provider_lookup_fails(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        from .geography.providers.geonames import GeoNamesRequestError
        from .models import Experience

        reconstruct_external_reference.side_effect = GeoNamesRequestError(
            "Simulated provider failure."
        )

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day somewhere",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Geographic place lookup is temporarily unavailable.",
        )
        self.assertEqual(Experience.objects.count(), 0)
        resolve_reconstructed_reference.assert_not_called()


    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_fails_closed_when_commit_resolution_has_no_place(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        from .models import Experience

        reconstruct_external_reference.return_value = {
            "external_source": "geonames",
            "external_id": "2758401",
            "canonical_name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }
        resolve_reconstructed_reference.return_value = {
            "state": "reuse",
            "place": None,
            "created": False,
            "evaluations": [],
        }

        with self.assertRaisesRegex(
            ValueError,
            "Geographic commit resolution did not return a place",
        ):
            self.client.post(
                self.url,
                data={
                    "external_source": "geonames",
                    "external_id": "2758401",
                    "title": "A day in Breda",
                    "comment": "A useful experience.",
                    "rating": 4,
                },
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
            )

        self.assertEqual(Experience.objects.count(), 0)


    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_fails_closed_for_unknown_commit_resolution_state(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        from .models import Experience

        reconstruct_external_reference.return_value = {
            "external_source": "geonames",
            "external_id": "2758401",
            "canonical_name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }
        resolve_reconstructed_reference.return_value = {
            "state": "unexpected",
            "place": None,
            "created": False,
            "evaluations": [],
        }

        with self.assertRaisesRegex(
            ValueError,
            "Unsupported geographic commit resolution state",
        ):
            self.client.post(
                self.url,
                data={
                    "external_source": "geonames",
                    "external_id": "2758401",
                    "title": "A day in Breda",
                    "comment": "A useful experience.",
                    "rating": 4,
                },
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
            )

        self.assertEqual(Experience.objects.count(), 0)


    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_returns_conflict_when_resolution_is_required(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        from .models import Experience, Update

        geographic_result = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "canonical_name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }
        reconstruct_external_reference.return_value = geographic_result
        resolve_reconstructed_reference.return_value = {
            "state": "preserve",
            "place": None,
            "created": False,
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day in Breda",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["code"],
            "geographic_resolution_required",
        )
        self.assertEqual(response.json()["references"], [])
        self.assertEqual(Experience.objects.count(), 0)
        self.assertEqual(Update.objects.count(), 0)


    @patch("core.views.Update.objects.create")
    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_place_materialization_rolls_back_when_update_creation_fails(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
        create_update,
    ):
        from .models import Experience, Place

        geographic_result = {
            "external_source": "geonames",
            "external_id": "external-test-place",
            "name": "External Test Place",
            "canonical_name": "External Test Place",
            "country_code": "NL",
            "geographic_type": "settlement",
        }
        reconstruct_external_reference.return_value = geographic_result

        def create_materialized_place(**kwargs):
            place = Place.objects.create(
                destination=self.destination,
                name="External Test Place",
                canonical_name="External Test Place",
                country_code="NL",
                place_type="city",
                city="External Test Place",
            )
            return {
                "state": "created",
                "place": place,
                "created": True,
                "evaluations": [],
            }

        resolve_reconstructed_reference.side_effect = create_materialized_place
        create_update.side_effect = RuntimeError("Update creation failed")

        with self.assertRaises(RuntimeError):
            self.client.post(
                self.url,
                data={
                    "external_source": "geonames",
                    "external_id": "external-test-place",
                    "title": "A day somewhere",
                    "comment": "A useful experience.",
                    "rating": 4,
                },
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
            )

        self.assertEqual(Experience.objects.count(), 0)
        self.assertFalse(
            Place.objects.filter(
                name="External Test Place",
            ).exists()
        )


    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_provider_lookup_occurs_before_commit_transaction(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        baseline_depth = len(transaction.get_connection().atomic_blocks)
        observed_depths = {}

        geographic_result = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "canonical_name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }

        def reconstruct_reference(**kwargs):
            observed_depths["provider"] = len(
                transaction.get_connection().atomic_blocks
            )
            return geographic_result

        def resolve_reference(**kwargs):
            observed_depths["commit"] = len(
                transaction.get_connection().atomic_blocks
            )
            return {
                "state": "reuse",
                "place": self.place,
                "created": False,
                "evaluations": [],
            }

        reconstruct_external_reference.side_effect = reconstruct_reference
        resolve_reconstructed_reference.side_effect = resolve_reference

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day in Breda",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(observed_depths["provider"], baseline_depth)
        self.assertEqual(observed_depths["commit"], baseline_depth + 1)

    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_creates_experience_with_resolved_place(
        self,
        reconstruct_external_reference,
        resolve_reconstructed_reference,
    ):
        from .models import Experience

        geographic_result = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "canonical_name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }
        reconstruct_external_reference.return_value = geographic_result
        resolve_reconstructed_reference.return_value = {
            "state": "reuse",
            "place": self.place,
            "created": False,
            "evaluations": [],
        }

        response = self.client.post(
            self.url,
            data={
                "external_source": "geonames",
                "external_id": "2758401",
                "title": "A day in Breda",
                "comment": "A useful experience.",
                "rating": 4,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

        self.assertEqual(response.status_code, 201)

        experience = Experience.objects.get()
        self.assertEqual(experience.place, self.place)
        self.assertEqual(experience.user, self.user)

        reconstruct_external_reference.assert_called_once_with(
            external_source="geonames",
            external_id="2758401",
        )
        resolve_reconstructed_reference.assert_called_once_with(
            geographic_result=geographic_result,
            user=self.user,
        )


class ExternalUpdateCreationTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken

        from .models import Destination, Place

        self.user = User.objects.create_user(
            username="external-update-user",
            password="test-password",
        )
        self.access_token = str(AccessToken.for_user(self.user))

        self.destination = Destination.objects.create(
            name="Netherlands",
            country="Netherlands",
        )
        self.place = Place.objects.create(
            destination=self.destination,
            name="Breda",
            canonical_name="Breda",
            country_code="NL",
            place_type="city",
            city="Breda",
        )
        self.url = "/api/updates/"

    def post_update(self, **overrides):
        payload = {
            "type": "event",
            "title": "Local festival",
            "text": "A festival in the city center.",
            "category": "culture",
            **overrides,
        }
        return self.client.post(
            self.url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}",
        )

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_identity_country_conflict_returns_409_without_update(
        self,
        reconstruct_reference,
    ):
        from .models import Experience, PlaceExternalIdentity, Update

        PlaceExternalIdentity.objects.create(
            place=self.place,
            external_source="geonames",
            external_id="2758401",
            geographic_type="settlement",
        )

        reconstruct_reference.return_value = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "canonical_name": "Breda",
            "country_code": "BE",
            "geographic_type": "settlement",
        }

        original_country_code = self.place.country_code
        original_destination_id = self.place.destination_id
        original_parent_id = self.place.parent_place_id

        response = self.post_update(
            external_source="geonames",
            external_id="2758401",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["code"],
            "geographic_resolution_required",
        )

        self.assertEqual(Update.objects.count(), 0)
        self.assertEqual(Experience.objects.count(), 0)

        self.place.refresh_from_db()

        self.assertEqual(self.place.country_code, original_country_code)
        self.assertEqual(
            self.place.destination_id,
            original_destination_id,
        )
        self.assertEqual(
            self.place.parent_place_id,
            original_parent_id,
        )

        self.assertEqual(
            PlaceExternalIdentity.objects.filter(
                place=self.place,
                external_source="geonames",
                external_id="2758401",
            ).count(),
            1,
        )

        reconstruct_reference.assert_called_once()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_country_identity_conflict_returns_409_without_update(
        self,
        reconstruct_reference,
    ):
        from .models import Country, Destination, Experience, Place, Update

        conflicting_country = Country.objects.create(
            code="FR",
            canonical_name="Argentina",
            aliases=[],
        )

        reconstruct_reference.return_value = {
            "external_source": "geonames",
            "external_id": "3435910",
            "name": "Buenos Aires",
            "canonical_name": "Buenos Aires",
            "aliases": [],
            "country_code": "AR",
            "geographic_type": "settlement",
        }

        original_place_count = Place.objects.count()
        original_destination_count = Destination.objects.count()

        response = self.post_update(
            external_source="geonames",
            external_id="3435910",
        )

        self.assertEqual(
            response.status_code,
            409,
            response.content,
        )
        self.assertEqual(
            response.json()["code"],
            "country_identity_conflict",
        )

        self.assertEqual(Update.objects.count(), 0)
        self.assertEqual(Experience.objects.count(), 0)

        conflicting_country.refresh_from_db()

        self.assertEqual(conflicting_country.code, "FR")
        self.assertEqual(
            conflicting_country.canonical_name,
            "Argentina",
        )

        self.assertFalse(
            Country.objects.filter(code="AR").exists()
        )
        self.assertEqual(
            Place.objects.count(),
            original_place_count,
        )
        self.assertEqual(
            Destination.objects.count(),
            original_destination_count,
        )

        reconstruct_reference.assert_called_once()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_creation_requires_place_or_complete_external_identity(
        self,
        reconstruct_reference,
    ):
        from .models import Update

        for identity in (
            {},
            {"external_source": "geonames"},
            {"external_id": "2758401"},
        ):
            with self.subTest(identity=identity):
                response = self.post_update(**identity)
                self.assertEqual(response.status_code, 400)

        self.assertEqual(Update.objects.count(), 0)
        reconstruct_reference.assert_not_called()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_invalid_update_does_not_trigger_geographic_lookup(
        self,
        reconstruct_reference,
    ):
        from .models import Update

        response = self.post_update(
            external_source="geonames",
            external_id="2758401",
            type="experience",
            text=" ",
            source_url="not-a-url",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Update.objects.count(), 0)
        reconstruct_reference.assert_not_called()

    @patch("core.views.reconstruct_external_geographic_reference")
    def test_existing_place_update_does_not_trigger_geographic_lookup(
        self,
        reconstruct_reference,
    ):
        from .models import Update

        response = self.post_update(place=self.place.id)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["place_id"], self.place.id)
        self.assertEqual(Update.objects.count(), 1)
        self.assertEqual(Update.objects.get().place_id, self.place.id)
        reconstruct_reference.assert_not_called()

    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_update_materializes_place_on_successful_publication(
        self,
        reconstruct_reference,
        resolve_reference,
    ):
        from .models import Place, Update

        reconstruct_reference.return_value = {
            "external_source": "geonames",
            "external_id": "external-update-place",
            "name": "External Update Place",
            "country_code": "NL",
            "geographic_type": "settlement",
        }

        def materialize_place(**kwargs):
            place = Place.objects.create(
                destination=self.destination,
                name="External Update Place",
                canonical_name="External Update Place",
                country_code="NL",
                place_type="city",
                city="External Update Place",
            )
            return {
                "state": "created",
                "place": place,
                "created": True,
                "evaluations": [],
            }

        resolve_reference.side_effect = materialize_place

        self.assertFalse(
            Place.objects.filter(name="External Update Place").exists()
        )

        response = self.post_update(
            external_source="geonames",
            external_id="external-update-place",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Update.objects.count(), 1)

        place = Place.objects.get(name="External Update Place")
        self.assertEqual(response.json()["place_id"], place.id)
        self.assertEqual(Update.objects.get().place_id, place.id)

        reconstruct_reference.assert_called_once()
        resolve_reference.assert_called_once()

    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_update_reuses_existing_place(
        self,
        reconstruct_reference,
        resolve_reference,
    ):
        from .models import Place, Update

        reconstruct_reference.return_value = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }

        resolve_reference.return_value = {
            "state": "reuse",
            "place": self.place,
            "created": False,
            "evaluations": [],
        }

        initial_place_count = Place.objects.count()

        response = self.post_update(
            external_source="geonames",
            external_id="2758401",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Place.objects.count(), initial_place_count)
        self.assertEqual(Update.objects.count(), 1)
        self.assertEqual(Update.objects.get().place_id, self.place.id)
        self.assertEqual(response.json()["place_id"], self.place.id)

        resolve_reference.assert_called_once()

    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_update_returns_conflict_without_persisting(
        self,
        reconstruct_reference,
        resolve_reference,
    ):
        from .models import Place, Update

        reconstruct_reference.return_value = {
            "external_source": "geonames",
            "external_id": "2758401",
            "name": "Breda",
            "country_code": "NL",
            "geographic_type": "settlement",
        }
        resolve_reference.return_value = {
            "state": "preserve",
            "place": None,
            "created": False,
            "evaluations": [],
        }

        initial_place_count = Place.objects.count()

        response = self.post_update(
            external_source="geonames",
            external_id="2758401",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["code"],
            "geographic_resolution_required",
        )
        self.assertEqual(response.json()["references"], [])
        self.assertEqual(Place.objects.count(), initial_place_count)
        self.assertEqual(Update.objects.count(), 0)

    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_update_returns_503_when_provider_fails(
        self,
        reconstruct_reference,
        resolve_reference,
    ):
        from .geography.providers.geonames import GeoNamesRequestError
        from .models import Place, Update

        reconstruct_reference.side_effect = GeoNamesRequestError(
            "Simulated provider failure."
        )

        initial_place_count = Place.objects.count()

        response = self.post_update(
            external_source="geonames",
            external_id="2758401",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(Place.objects.count(), initial_place_count)
        self.assertEqual(Update.objects.count(), 0)
        resolve_reference.assert_not_called()

    @patch("core.serializers.UpdateCreateSerializer.create")
    @patch(
        "core.views.resolve_reconstructed_geographic_reference_for_commit"
    )
    @patch("core.views.reconstruct_external_geographic_reference")
    def test_external_place_materialization_rolls_back_if_update_fails(
        self,
        reconstruct_reference,
        resolve_reference,
        create_update,
    ):
        from .models import Place, Update

        reconstruct_reference.return_value = {
            "external_source": "geonames",
            "external_id": "rollback-update-place",
            "name": "Rollback Update Place",
            "country_code": "NL",
            "geographic_type": "settlement",
        }

        def materialize_place(**kwargs):
            place = Place.objects.create(
                destination=self.destination,
                name="Rollback Update Place",
                canonical_name="Rollback Update Place",
                country_code="NL",
                place_type="city",
                city="Rollback Update Place",
            )
            return {
                "state": "created",
                "place": place,
                "created": True,
                "evaluations": [],
            }

        resolve_reference.side_effect = materialize_place
        create_update.side_effect = RuntimeError(
            "Simulated Update creation failure."
        )

        with self.assertRaises(RuntimeError):
            self.post_update(
                external_source="geonames",
                external_id="rollback-update-place",
            )

        self.assertFalse(
            Place.objects.filter(name="Rollback Update Place").exists()
        )
        self.assertEqual(Update.objects.count(), 0)
