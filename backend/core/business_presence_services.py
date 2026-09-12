from django.db import transaction
from django.utils import timezone

from .models import (
    BusinessClaimRequest,
    BusinessPresenceManager,
)


class BusinessClaimApprovalError(Exception):
    pass

class BusinessPresenceManagerCreationError(Exception):
    pass

class BusinessPresenceManagerStatusError(Exception):
    pass


def create_business_presence_manager_from_claim(claim, added_by):
    if claim is None or not getattr(claim, "pk", None):
        raise BusinessPresenceManagerCreationError(
            "A valid business claim request is required."
        )

    if added_by is None or not getattr(added_by, "pk", None):
        raise BusinessPresenceManagerCreationError(
            "A valid user is required to create this business manager."
        )

    if claim.status != "approved":
        raise BusinessPresenceManagerCreationError(
            "Only approved business claim requests can create a manager."
        )

    if BusinessPresenceManager.objects.filter(
        business_presence=claim.business_presence,
        user=claim.requested_by,
    ).exists():
        raise BusinessPresenceManagerCreationError(
            "This user is already associated with this business presence."
        )

    manager = BusinessPresenceManager.objects.create(
        business_presence=claim.business_presence,
        user=claim.requested_by,
        role=claim.role,
        source_claim=claim,
        status="active",
        added_by=added_by,
    )

    return manager

@transaction.atomic
def add_business_presence_manager(
    business_presence,
    user,
    role,
    added_by,
):
    if business_presence is None or not getattr(business_presence, "pk", None):
        raise BusinessPresenceManagerCreationError(
            "A valid business presence is required."
        )

    if user is None or not getattr(user, "pk", None):
        raise BusinessPresenceManagerCreationError(
            "A valid user is required."
        )

    if added_by is None or not getattr(added_by, "pk", None):
        raise BusinessPresenceManagerCreationError(
            "A valid user is required to add this business manager."
        )

    if business_presence.status != "claimed":
        raise BusinessPresenceManagerCreationError(
            "Managers can only be added to a claimed business presence."
        )

    if BusinessPresenceManager.objects.filter(
        business_presence=business_presence,
        user=user,
    ).exists():
        raise BusinessPresenceManagerCreationError(
            "This user is already associated with this business presence."
        )

    manager = BusinessPresenceManager.objects.create(
        business_presence=business_presence,
        user=user,
        role=role.strip() if role else "",
        source_claim=None,
        status="active",
        added_by=added_by,
    )

    return manager

@transaction.atomic
def deactivate_business_presence_manager(manager_id, changed_by):
    try:
        manager = (
            BusinessPresenceManager.objects
            .select_for_update()
            .select_related("business_presence")
            .get(id=manager_id)
        )
    except BusinessPresenceManager.DoesNotExist as exc:
        raise BusinessPresenceManagerStatusError(
            "Business presence manager does not exist."
        ) from exc

    if changed_by is None or not getattr(changed_by, "pk", None):
        raise BusinessPresenceManagerStatusError(
            "A valid user is required to change this business manager."
        )

    if manager.status != "active":
        raise BusinessPresenceManagerStatusError(
            "Only active business managers can be deactivated."
        )

    active_manager_ids = list(
        BusinessPresenceManager.objects
        .select_for_update()
        .filter(
            business_presence=manager.business_presence,
            status="active",
        )
        .values_list("id", flat=True)
    )

    if (
            manager.business_presence.status == "claimed"
            and len(active_manager_ids) <= 1
    ):

        raise BusinessPresenceManagerStatusError(
            "The last active manager of a claimed business presence "
            "cannot be deactivated."
        )

    manager.status = "inactive"
    manager.ended_at = timezone.now()
    manager.save(
        update_fields=[
            "status",
            "ended_at",
            "updated_at",
        ]
    )

    return manager

@transaction.atomic
def reactivate_business_presence_manager(manager_id, changed_by):
    try:
        manager = (
            BusinessPresenceManager.objects
            .select_for_update()
            .get(id=manager_id)
        )
    except BusinessPresenceManager.DoesNotExist as exc:
        raise BusinessPresenceManagerStatusError(
            "Business presence manager does not exist."
        ) from exc

    if changed_by is None or not getattr(changed_by, "pk", None):
        raise BusinessPresenceManagerStatusError(
            "A valid user is required to change this business manager."
        )

    if manager.status != "inactive":
        raise BusinessPresenceManagerStatusError(
            "Only inactive business managers can be reactivated."
        )

    manager.status = "active"
    manager.ended_at = None
    manager.save(
        update_fields=[
            "status",
            "ended_at",
            "updated_at",
        ]
    )

    return manager

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

    try:
        create_business_presence_manager_from_claim(
            claim=claim,
            added_by=reviewed_by,
        )
    except BusinessPresenceManagerCreationError as exc:
        raise BusinessClaimApprovalError(
            str(exc)
        ) from exc

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
