from django.db import IntegrityError, transaction
from django.db.models import Q

from ..models import Place
from ..place_utils import normalize_place_text


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
