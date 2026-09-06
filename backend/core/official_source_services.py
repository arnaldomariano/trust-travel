from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import OfficialSourceEntry, Update


OFFICIAL_CONTENT_PUBLISHER_USERNAME = "trust_travel_official"
OFFICIAL_CONTENT_PUBLISHER_DISPLAY_NAME = "Trust Travel"


class OfficialSourcePublicationError(Exception):
    pass


def get_official_content_publisher():
    try:
        user = User.objects.select_related("profile").get(
            username=OFFICIAL_CONTENT_PUBLISHER_USERNAME
        )
    except User.DoesNotExist:
        user = User(
            username=OFFICIAL_CONTENT_PUBLISHER_USERNAME,
            is_active=False,
            is_staff=False,
            is_superuser=False,
        )
        user.set_unusable_password()
        user.save()
    else:
        if (
            user.is_active
            or user.is_staff
            or user.is_superuser
            or user.has_usable_password()
        ):
            raise OfficialSourcePublicationError(
                "The Trust Travel official publisher username is already "
                "used by an account that is not a valid technical publisher."
            )

    profile = user.profile

    if profile.display_name != OFFICIAL_CONTENT_PUBLISHER_DISPLAY_NAME:
        profile.display_name = OFFICIAL_CONTENT_PUBLISHER_DISPLAY_NAME
        profile.save(update_fields=["display_name"])

    return user


@transaction.atomic
def publish_official_source_entry(entry_id, reviewed_by):
    try:
        entry = (
            OfficialSourceEntry.objects
            .select_for_update()
            .select_related(
                "official_source",
                "place",
                "resulting_update",
            )
            .get(id=entry_id)
        )
    except OfficialSourceEntry.DoesNotExist as exc:
        raise OfficialSourcePublicationError(
            "Official source entry does not exist."
        ) from exc

    if entry.resulting_update_id:
        return entry.resulting_update

    if entry.status != "pending":
        raise OfficialSourcePublicationError(
            "Only pending official source entries can be published."
        )

    if entry.place_id is None:
        raise OfficialSourcePublicationError(
            "Official source entry must have a place before publication."
        )

    if reviewed_by is None or not getattr(reviewed_by, "pk", None):
        raise OfficialSourcePublicationError(
            "A valid reviewer is required before publication."
        )

    if entry.external_url and len(entry.external_url) > 500:
        raise OfficialSourcePublicationError(
            "Official source entry external URL is too long for publication."
        )

    text = (entry.text or "").strip()

    if not text:
        raise OfficialSourcePublicationError(
            "Official source entry must have text before publication."
        )

    publisher = get_official_content_publisher()

    update = Update.objects.create(
        user=publisher,
        place=entry.place,
        type=entry.update_type,
        category=entry.category,
        title=(entry.title or "").strip(),
        text=text,
        event_date=entry.event_date,
        external_link=entry.external_url,
        source_name=entry.official_source.name,
        source_url=entry.external_url or entry.official_source.website_url,
        official_source=entry.official_source,
        priority=entry.priority,
    )

    entry.resulting_update = update
    entry.status = "published"
    entry.reviewed_by = reviewed_by
    entry.reviewed_at = timezone.now()
    entry.save(
        update_fields=[
            "resulting_update",
            "status",
            "reviewed_by",
            "reviewed_at",
            "updated_at",
        ]
    )

    return update
