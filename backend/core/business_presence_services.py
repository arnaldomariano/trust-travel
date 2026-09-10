from django.db import transaction
from django.utils import timezone

from .models import BusinessClaimRequest


class BusinessClaimApprovalError(Exception):
    pass


@transaction.atomic
def approve_business_claim_request(claim_id, reviewed_by):
    try:
        claim = (
            BusinessClaimRequest.objects
            .select_for_update()
            .select_related("business_presence")
            .get(id=claim_id)
        )
    except BusinessClaimRequest.DoesNotExist as exc:
        raise BusinessClaimApprovalError(
            "Business claim request does not exist."
        ) from exc

    if claim.status != "pending":
        raise BusinessClaimApprovalError(
            "Only pending business claim requests can be approved."
        )

    if reviewed_by is None or not getattr(reviewed_by, "pk", None):
        raise BusinessClaimApprovalError(
            "A valid reviewer is required before approval."
        )

    presence = claim.business_presence

    if presence.status == "claimed":
        raise BusinessClaimApprovalError(
            "This business presence is already claimed."
        )

    if presence.status == "suspended":
        raise BusinessClaimApprovalError(
            "A suspended business presence cannot be claimed."
        )

    claim.status = "approved"
    claim.reviewed_by = reviewed_by
    claim.reviewed_at = timezone.now()
    claim.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
        ]
    )

    presence.status = "claimed"
    presence.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return claim
