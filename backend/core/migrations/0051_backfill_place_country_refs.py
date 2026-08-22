from django.db import migrations


def backfill_place_country_refs(apps, schema_editor):
    Country = apps.get_model("core", "Country")
    Place = apps.get_model("core", "Place")

    places = (
        Place.objects
        .exclude(place_type="country")
        .filter(country_ref__isnull=True)
        .select_related("destination")
    )

    for place in places:
        country_name = (place.destination.country or "").strip()

        matching_countries = Country.objects.filter(
            canonical_name__iexact=country_name,
        )

        if matching_countries.count() != 1:
            raise RuntimeError(
                f"Expected exactly one Country for Place {place.id} "
                f"({place.name}) using destination country "
                f"{country_name!r}, found {matching_countries.count()}."
            )

        country = matching_countries.first()

        place.country_ref = country
        place.country_code = country.code

        place.save(
            update_fields=[
                "country_ref",
                "country_code",
            ]
        )


def reverse_backfill_place_country_refs(apps, schema_editor):
    Place = apps.get_model("core", "Place")

    Place.objects.exclude(place_type="country").update(
        country_ref=None,
        country_code="",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0050_seed_existing_countries"),
    ]

    operations = [
        migrations.RunPython(
            backfill_place_country_refs,
            reverse_backfill_place_country_refs,
        ),
    ]