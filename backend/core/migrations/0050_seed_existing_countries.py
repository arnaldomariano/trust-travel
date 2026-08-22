from django.db import migrations


COUNTRIES = [
    ("BO", "Bolivia"),
    ("TH", "Thailand"),
    ("ID", "Indonesia"),
    ("CL", "Chile"),
    ("BR", "Brazil"),
    ("AD", "Andorra"),
    ("LA", "Laos"),
    ("DK", "Denmark"),
    ("ES", "Spain"),
    ("PA", "Panama"),
    ("BE", "Belgium"),
    ("FI", "Finland"),
    ("GR", "Greece"),
    ("IT", "Italy"),
    ("MX", "Mexico"),
    ("NL", "Netherlands"),
    ("AW", "Aruba"),
]


def seed_existing_countries(apps, schema_editor):
    Country = apps.get_model("core", "Country")
    Place = apps.get_model("core", "Place")

    for code, canonical_name in COUNTRIES:
        matching_places = Place.objects.filter(
            place_type="country",
            name__iexact=canonical_name,
        )

        if matching_places.count() != 1:
            raise RuntimeError(
                f"Expected exactly one country Place for {canonical_name}, "
                f"found {matching_places.count()}."
            )

        place = matching_places.first()

        existing_aliases = [
            str(alias).strip()
            for alias in (place.aliases or [])
            if str(alias).strip()
        ]

        country, _ = Country.objects.update_or_create(
            code=code,
            defaults={
                "canonical_name": canonical_name,
                "aliases": existing_aliases,
            },
        )

        place.country_ref = country
        place.country_code = code

        if not place.canonical_name:
            place.canonical_name = canonical_name

        place.save(
            update_fields=[
                "country_ref",
                "country_code",
                "canonical_name",
            ]
        )


def unseed_existing_countries(apps, schema_editor):
    Country = apps.get_model("core", "Country")
    Place = apps.get_model("core", "Place")

    for code, canonical_name in COUNTRIES:
        country = Country.objects.filter(code=code).first()

        if country:
            Place.objects.filter(country_ref=country).update(
                country_ref=None,
            )

        Place.objects.filter(
            place_type="country",
            name__iexact=canonical_name,
            country_code=code,
        ).update(
            country_code="",
        )

        if country:
            country.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0049_country_place_country_ref"),
    ]

    operations = [
        migrations.RunPython(
            seed_existing_countries,
            unseed_existing_countries,
        ),
    ]