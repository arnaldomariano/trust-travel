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

class BusinessClaimWithdrawalError(Exception):
    pass


@transaction.atomic
def withdraw_business_claim_request(claim_id, requested_by):
    try:
        claim = (
            BusinessClaimRequest.objects
            .select_for_update()
            .get(id=claim_id)
        )
    except BusinessClaimRequest.DoesNotExist as exc:
        raise BusinessClaimWithdrawalError(
            "Business claim request does not exist."
        ) from exc

    if requested_by is None or not getattr(requested_by, "pk", None):
        raise BusinessClaimWithdrawalError(
            "A valid requester is required."
        )

    if claim.requested_by_id != requested_by.id:
        raise BusinessClaimWithdrawalError(
            "You can only withdraw your own business claim request."
        )

    if claim.status != "pending":
        raise BusinessClaimWithdrawalError(
            "Only pending business claim requests can be withdrawn."
        )

    claim.status = "withdrawn"
    claim.save(
        update_fields=[
            "status",
        ]
    )

    return claim
