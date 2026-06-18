from collections import defaultdict

from django.core.management.base import BaseCommand

from core.models import Destination, Place


class Command(BaseCommand):
    help = "Check Place and Destination data for old or suspicious records."

    def handle(self, *args, **options):
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Trust Travel data sanity check"))
        self.stdout.write("")

        suspicious_places_count = self.check_places()
        duplicate_places_count = self.check_place_duplicates()
        suspicious_destinations_count = self.check_destinations()

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Summary"))
        self.stdout.write(f"Suspicious places: {suspicious_places_count}")
        self.stdout.write(f"Duplicate place-name groups: {duplicate_places_count}")
        self.stdout.write(f"Suspicious destinations: {suspicious_destinations_count}")

        if (
            suspicious_places_count == 0
            and duplicate_places_count == 0
            and suspicious_destinations_count == 0
        ):
            self.stdout.write(self.style.SUCCESS("No suspicious place data found."))
        else:
            self.stdout.write(
                self.style.WARNING(
                    "Review the records above before changing code or creating new data."
                )
            )

    def check_places(self):
        self.stdout.write(self.style.MIGRATE_HEADING("--- Suspicious places ---"))

        count = 0

        for place in Place.objects.select_related("destination").all().order_by("id"):
            destination_name = place.destination.name if place.destination else ""
            destination_country = place.destination.country if place.destination else ""

            reasons = []

            if not place.destination:
                reasons.append("no destination")

            if place.place_type == "city" and not place.city:
                reasons.append("city place with empty city field")

            if (
                place.place_type == "city"
                and place.city
                and place.city.strip().lower() != place.name.strip().lower()
            ):
                reasons.append("city place where city field differs from name")

            if place.place_type not in ["country", "city"] and not place.city:
                reasons.append("specific place with empty city field")

            if (
                place.destination
                and not destination_country
                and place.place_type != "country"
            ):
                reasons.append("non-country place linked to destination without country")

            if self.looks_like_content(place.name):
                reasons.append("place name looks like content/title")

            if reasons:
                count += 1
                self.stdout.write(
                    f"id={place.id} | name={place.name} | type={place.place_type} "
                    f"| city={place.city} | destination={destination_name} "
                    f"| country={destination_country} | reasons={', '.join(reasons)}"
                )

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No suspicious places found."))

        self.stdout.write("")
        return count

    def check_place_duplicates(self):
        self.stdout.write(self.style.MIGRATE_HEADING("--- Possible place duplicates ---"))

        grouped = defaultdict(list)

        for place in Place.objects.select_related("destination").all().order_by("name", "id"):
            key = place.name.strip().lower()

            if key:
                grouped[key].append(place)

        duplicate_groups = 0

        for key, places in grouped.items():
            if len(places) <= 1:
                continue

            duplicate_groups += 1
            self.stdout.write(self.style.WARNING(f"Duplicate name: {key}"))

            for place in places:
                destination_name = place.destination.name if place.destination else ""
                destination_country = place.destination.country if place.destination else ""

                self.stdout.write(
                    f"  id={place.id} | name={place.name} | type={place.place_type} "
                    f"| city={place.city} | destination={destination_name} "
                    f"| country={destination_country}"
                )

        if duplicate_groups == 0:
            self.stdout.write(self.style.SUCCESS("No duplicate place-name groups found."))

        self.stdout.write("")
        return duplicate_groups

    def check_destinations(self):
        self.stdout.write(self.style.MIGRATE_HEADING("--- Suspicious destinations ---"))

        count = 0

        for destination in Destination.objects.all().order_by("id"):
            reasons = []

            if not destination.country:
                reasons.append("empty country")

            if self.looks_like_content(destination.name):
                reasons.append("destination name looks like content/title")

            if self.looks_like_specific_place(destination.name):
                reasons.append("destination name looks like a specific place")

            if reasons:
                count += 1
                self.stdout.write(
                    f"id={destination.id} | name={destination.name} "
                    f"| country={destination.country} | city={destination.city} "
                    f"| reasons={', '.join(reasons)}"
                )

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No suspicious destinations found."))

        self.stdout.write("")
        return count

    def looks_like_content(self, value):
        text = (value or "").strip().lower()

        content_words = [
            "evite",
            "alerta",
            "alert",
            "alagamento",
            "alagamentos",
            "inverno",
            "fechado",
            "closed",
            "danger",
            "perigo",
            "urgente",
            "urgent",
            "promoção",
            "promotion",
        ]

        return any(word in text for word in content_words)

    def looks_like_specific_place(self, value):
        text = (value or "").strip().lower()

        specific_words = [
            "praia",
            "beach",
            "hotel",
            "restaurant",
            "restaurante",
            "cafe",
            "café",
            "museum",
            "museu",
            "park",
            "parque",
            "waterfall",
            "cachoeira",
            "viewpoint",
            "mirante",
        ]

        return any(word in text for word in specific_words)
