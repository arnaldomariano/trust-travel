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
