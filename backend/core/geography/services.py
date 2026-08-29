from math import atan2, cos, radians, sin, sqrt

from django.db import IntegrityError, transaction
from django.db.models import Q

from ..models import Place
from ..place_utils import normalize_place_text


def calculate_distance_km(
    latitude_1,
    longitude_1,
    latitude_2,
    longitude_2,
):
    latitude_1 = float(latitude_1)
    longitude_1 = float(longitude_1)
    latitude_2 = float(latitude_2)
    longitude_2 = float(longitude_2)

    earth_radius_km = 6371.0088

    latitude_delta = radians(
        latitude_2 - latitude_1
    )

    longitude_delta = radians(
        longitude_2 - longitude_1
    )

    latitude_1 = radians(latitude_1)
    latitude_2 = radians(latitude_2)

    haversine_value = (
        sin(latitude_delta / 2) ** 2
        + cos(latitude_1)
        * cos(latitude_2)
        * sin(longitude_delta / 2) ** 2
    )

    haversine_value = min(
        1,
        max(0, haversine_value),
    )

    angular_distance = 2 * atan2(
        sqrt(haversine_value),
        sqrt(1 - haversine_value),
    )

    return earth_radius_km * angular_distance


def poi_matches_city_context(
    poi_result,
    city_place,
    fallback_distance_km=3,
):
    city_country_code = (
        city_place.country_ref.code
        if city_place.country_ref
        else city_place.country_code
    )

    city_country_code = str(
        city_country_code or ""
    ).strip().upper()

    poi_country_code = str(
        poi_result.get("country_code") or ""
    ).strip().upper()

    if (
        city_country_code
        and poi_country_code
        and city_country_code != poi_country_code
    ):
        return False

    locality = str(
        poi_result.get("locality") or ""
    ).strip()

    if locality:
        normalized_locality = normalize_place_text(
            locality
        )

        city_identity_values = {
            normalize_place_text(value)
            for value in [
                city_place.name,
                city_place.canonical_name,
                *(city_place.aliases or []),
            ]
            if str(value or "").strip()
        }

        return normalized_locality in city_identity_values

    poi_latitude = poi_result.get("latitude")
    poi_longitude = poi_result.get("longitude")

    if (
        city_place.latitude is None
        or city_place.longitude is None
        or poi_latitude is None
        or poi_longitude is None
    ):
        return False

    distance_km = calculate_distance_km(
        city_place.latitude,
        city_place.longitude,
        poi_latitude,
        poi_longitude,
    )

    return distance_km <= fallback_distance_km


def annotate_existing_city_places(results, country_code):
    external_identities = {
        (
            str(result.get("external_source") or "").strip(),
            str(result.get("external_id") or "").strip(),
        )
        for result in results
        if (
            str(result.get("external_source") or "").strip()
            and str(result.get("external_id") or "").strip()
        )
    }

    external_sources = {
        external_source
        for external_source, _ in external_identities
    }

    external_ids = {
        external_id
        for _, external_id in external_identities
    }

    existing_places_by_external_identity = {
        (place.external_source, place.external_id): place.id
        for place in Place.objects.filter(
            external_source__in=external_sources,
            external_id__in=external_ids,
        )
    }

    country_places = list(
        Place.objects.filter(
            place_type="city",
        )
        .filter(
            Q(country_ref__code=country_code)
            | Q(country_code=country_code)
        )
        .distinct()
    )

    places_by_identity_value = {}

    for place in country_places:
        place_values = {
            normalize_place_text(value)
            for value in [
                place.name,
                place.canonical_name,
                *(place.aliases or []),
            ]
            if str(value or "").strip()
        }

        for value in place_values:
            places_by_identity_value.setdefault(
                value,
                set(),
            ).add(place.id)

    for result in results:
        external_match_id = (
            existing_places_by_external_identity.get(
                (
                    str(result.get("external_source") or "").strip(),
                    str(result.get("external_id") or "").strip(),
                )
            )
        )

        if external_match_id is not None:
            result["existing_place_id"] = external_match_id
            continue

        result_values = {
            normalize_place_text(value)
            for value in [
                result.get("name"),
                result.get("canonical_name"),
                *(result.get("aliases") or []),
            ]
            if str(value or "").strip()
        }

        candidate_place_ids = set()

        for value in result_values:
            candidate_place_ids.update(
                places_by_identity_value.get(
                    value,
                    set(),
                )
            )

        if len(candidate_place_ids) == 1:
            result["existing_place_id"] = next(
                iter(candidate_place_ids)
            )
        else:
            result["existing_place_id"] = None

    return results


def annotate_existing_poi_places(
    results,
    city_place,
    place_type,
):
    external_identities = {
        (
            str(result.get("external_source") or "").strip(),
            str(result.get("external_id") or "").strip(),
        )
        for result in results
        if (
            str(result.get("external_source") or "").strip()
            and str(result.get("external_id") or "").strip()
        )
    }

    external_sources = {
        external_source
        for external_source, _ in external_identities
    }

    external_ids = {
        external_id
        for _, external_id in external_identities
    }

    existing_places_by_external_identity = {
        (place.external_source, place.external_id): place.id
        for place in Place.objects.filter(
            external_source__in=external_sources,
            external_id__in=external_ids,
        )
    }

    city_places = list(
        Place.objects.filter(
            parent_place=city_place,
            place_type=place_type,
        )
    )

    places_by_identity_value = {}

    for place in city_places:
        place_values = {
            normalize_place_text(value)
            for value in [
                place.name,
                place.canonical_name,
                *(place.aliases or []),
            ]
            if str(value or "").strip()
        }

        for value in place_values:
            places_by_identity_value.setdefault(
                value,
                set(),
            ).add(place.id)

    for result in results:
        external_match_id = (
            existing_places_by_external_identity.get(
                (
                    str(result.get("external_source") or "").strip(),
                    str(result.get("external_id") or "").strip(),
                )
            )
        )

        if external_match_id is not None:
            result["existing_place_id"] = external_match_id
            continue

        result_values = {
            normalize_place_text(value)
            for value in [
                result.get("name"),
                result.get("canonical_name"),
                *(result.get("aliases") or []),
            ]
            if str(value or "").strip()
        }

        candidate_place_ids = set()

        for value in result_values:
            candidate_place_ids.update(
                places_by_identity_value.get(
                    value,
                    set(),
                )
            )

        if len(candidate_place_ids) == 1:
            result["existing_place_id"] = next(
                iter(candidate_place_ids)
            )
        else:
            result["existing_place_id"] = None

    return results


def find_existing_poi_place(
    poi_result,
    city_place,
    place_type,
):
    external_source = (
        poi_result.get("external_source") or ""
    ).strip()

    external_id = str(
        poi_result.get("external_id") or ""
    ).strip()

    existing_place = Place.objects.filter(
        external_source=external_source,
        external_id=external_id,
    ).first()

    if existing_place:
        return existing_place

    result_values = {
        normalize_place_text(value)
        for value in [
            poi_result.get("name"),
            poi_result.get("canonical_name"),
            *(poi_result.get("aliases") or []),
        ]
        if str(value or "").strip()
    }

    matching_places = []

    possible_places = Place.objects.filter(
        parent_place=city_place,
        place_type=place_type,
    )

    for candidate in possible_places:
        candidate_values = {
            normalize_place_text(value)
            for value in [
                candidate.name,
                candidate.canonical_name,
                *(candidate.aliases or []),
            ]
            if str(value or "").strip()
        }

        if result_values.intersection(candidate_values):
            matching_places.append(candidate)

    if len(matching_places) == 1:
        return matching_places[0]

    return None


def find_existing_city_place(
    city_result,
    resolved_country,
    country_code,
):
    external_source = (
        city_result.get("external_source") or ""
    ).strip()

    external_id = str(
        city_result.get("external_id") or ""
    ).strip()

    existing_place = Place.objects.filter(
        place_type="city",
        external_source=external_source,
        external_id=external_id,
    ).first()

    if existing_place:
        return existing_place

    result_values = {
        normalize_place_text(value)
        for value in [
            city_result.get("name"),
            city_result.get("canonical_name"),
            *(city_result.get("aliases") or []),
        ]
        if str(value or "").strip()
    }

    matching_places = []

    possible_places = (
        Place.objects.filter(
            place_type="city",
        )
        .filter(
            Q(country_ref=resolved_country)
            | Q(country_code=country_code)
        )
        .distinct()
    )

    for candidate in possible_places:
        candidate_values = {
            normalize_place_text(value)
            for value in [
                candidate.name,
                candidate.canonical_name,
                *(candidate.aliases or []),
            ]
            if str(value or "").strip()
        }

        if result_values.intersection(candidate_values):
            matching_places.append(candidate)

    if len(matching_places) == 1:
        return matching_places[0]

    return None


def enrich_existing_city_place(
    existing_place,
    city_result,
    resolved_country,
    country_code,
    country_place,
):
    with transaction.atomic():
        locked_place = Place.objects.select_for_update().get(
            pk=existing_place.pk
        )

        merged_aliases = []

        seen_aliases = {
            normalize_place_text(
                city_result["canonical_name"]
            )
        }

        for alias in [
            *(locked_place.aliases or []),
            *(city_result.get("aliases") or []),
        ]:
            alias = str(alias or "").strip()

            if not alias:
                continue

            normalized_alias = normalize_place_text(alias)

            if normalized_alias in seen_aliases:
                continue

            seen_aliases.add(normalized_alias)
            merged_aliases.append(alias)

        locked_place.country_ref = resolved_country
        locked_place.country_code = country_code
        locked_place.parent_place = country_place
        locked_place.canonical_name = (
            city_result["canonical_name"]
        )
        locked_place.aliases = merged_aliases
        locked_place.latitude = (
            city_result.get("latitude") or None
        )
        locked_place.longitude = (
            city_result.get("longitude") or None
        )
        locked_place.external_source = (
            city_result.get("external_source") or ""
        ).strip()
        locked_place.external_id = str(
            city_result.get("external_id") or ""
        ).strip()

        if not locked_place.city:
            locked_place.city = locked_place.name

        try:
            with transaction.atomic():
                locked_place.save(
                    update_fields=[
                        "country_ref",
                        "country_code",
                        "parent_place",
                        "canonical_name",
                        "aliases",
                        "latitude",
                        "longitude",
                        "external_source",
                        "external_id",
                        "city",
                    ]
                )
        except IntegrityError:
            winner = Place.objects.filter(
                external_source=locked_place.external_source,
                external_id=locked_place.external_id,
            ).first()

            if winner:
                return winner

            raise

        return locked_place


def enrich_existing_poi_place(
    existing_place,
    poi_result,
    city_place,
    country_code,
):
    with transaction.atomic():
        locked_place = Place.objects.select_for_update().get(
            pk=existing_place.pk
        )

        merged_aliases = []

        seen_aliases = {
            normalize_place_text(
                poi_result["canonical_name"]
            )
        }

        for alias in [
            *(locked_place.aliases or []),
            *(poi_result.get("aliases") or []),
        ]:
            alias = str(alias or "").strip()

            if not alias:
                continue

            normalized_alias = normalize_place_text(alias)

            if normalized_alias in seen_aliases:
                continue

            seen_aliases.add(normalized_alias)
            merged_aliases.append(alias)

        locked_place.country_ref = city_place.country_ref
        locked_place.country_code = country_code
        locked_place.parent_place = city_place
        locked_place.canonical_name = (
            poi_result["canonical_name"]
        )
        locked_place.aliases = merged_aliases
        locked_place.latitude = (
            poi_result.get("latitude") or None
        )
        locked_place.longitude = (
            poi_result.get("longitude") or None
        )
        locked_place.external_source = (
            poi_result.get("external_source") or ""
        ).strip()
        locked_place.external_id = str(
            poi_result.get("external_id") or ""
        ).strip()
        locked_place.city = city_place.name

        try:
            with transaction.atomic():
                locked_place.save(
                    update_fields=[
                        "country_ref",
                        "country_code",
                        "parent_place",
                        "canonical_name",
                        "aliases",
                        "latitude",
                        "longitude",
                        "external_source",
                        "external_id",
                        "city",
                    ]
                )
        except IntegrityError:
            winner = Place.objects.filter(
                external_source=locked_place.external_source,
                external_id=locked_place.external_id,
            ).first()

            if winner:
                return winner

            raise

        return locked_place


def create_city_place(
    city_result,
    resolved_country,
    country_code,
    country_place,
    user,
):
    destination = country_place.destination

    try:
        with transaction.atomic():
            place = Place.objects.create(
                destination=destination,
                country_ref=resolved_country,
                parent_place=country_place,
                name=city_result["canonical_name"],
                canonical_name=city_result["canonical_name"],
                aliases=city_result.get("aliases") or [],
                country_code=country_code,
                place_type="city",
                city=city_result["canonical_name"],
                latitude=city_result.get("latitude") or None,
                longitude=city_result.get("longitude") or None,
                external_source=(
                    city_result.get("external_source") or ""
                ).strip(),
                external_id=str(
                    city_result.get("external_id") or ""
                ).strip(),
                created_by=user,
            )
    except IntegrityError:
        winner = Place.objects.filter(
            external_source=(
                city_result.get("external_source") or ""
            ).strip(),
            external_id=str(
                city_result.get("external_id") or ""
            ).strip(),
        ).first()

        if winner:
            return winner, False

        raise

    return place, True


def create_poi_place(
    poi_result,
    city_place,
    country_code,
    place_type,
    user,
):
    destination = city_place.destination

    try:
        with transaction.atomic():
            place = Place.objects.create(
                destination=destination,
                country_ref=city_place.country_ref,
                parent_place=city_place,
                name=poi_result["canonical_name"],
                canonical_name=poi_result["canonical_name"],
                aliases=poi_result.get("aliases") or [],
                country_code=country_code,
                place_type=place_type,
                city=city_place.name,
                latitude=poi_result.get("latitude") or None,
                longitude=poi_result.get("longitude") or None,
                external_source=(
                    poi_result.get("external_source") or ""
                ).strip(),
                external_id=str(
                    poi_result.get("external_id") or ""
                ).strip(),
                created_by=user,
            )
    except IntegrityError:
        winner = Place.objects.filter(
            external_source=(
                poi_result.get("external_source") or ""
            ).strip(),
            external_id=str(
                poi_result.get("external_id") or ""
            ).strip(),
        ).first()

        if winner:
            return winner, False

        raise

    return place, True


def materialize_poi_place(
    poi_result,
    city_place,
    country_code,
    place_type,
    user,
):
    existing_place = find_existing_poi_place(
        poi_result=poi_result,
        city_place=city_place,
        place_type=place_type,
    )

    if existing_place:
        place = enrich_existing_poi_place(
            existing_place=existing_place,
            poi_result=poi_result,
            city_place=city_place,
            country_code=country_code,
        )

        return place, False

    return create_poi_place(
        poi_result=poi_result,
        city_place=city_place,
        country_code=country_code,
        place_type=place_type,
        user=user,
    )


def materialize_city_place(
    city_result,
    resolved_country,
    country_code,
    country_place,
    user,
):
    existing_place = find_existing_city_place(
        city_result=city_result,
        resolved_country=resolved_country,
        country_code=country_code,
    )

    if existing_place:
        place = enrich_existing_city_place(
            existing_place=existing_place,
            city_result=city_result,
            resolved_country=resolved_country,
            country_code=country_code,
            country_place=country_place,
        )

        return place, False

    return create_city_place(
        city_result=city_result,
        resolved_country=resolved_country,
        country_code=country_code,
        country_place=country_place,
        user=user,
    )
