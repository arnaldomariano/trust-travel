from .models import Friendship


def get_mutual_trusted_user_ids(user):
    if user is None or not getattr(user, "pk", None):
        return set()

    forward_ids = set(
        Friendship.objects.filter(
            from_user=user,
            status="accepted",
        ).values_list("to_user_id", flat=True)
    )

    backward_ids = set(
        Friendship.objects.filter(
            to_user=user,
            status="accepted",
        ).values_list("from_user_id", flat=True)
    )

    return forward_ids & backward_ids


def get_trust_level(user, other_user):
    if (
        user is None
        or other_user is None
        or not getattr(user, "pk", None)
        or not getattr(other_user, "pk", None)
    ):
        return 3

    if user.pk == other_user.pk:
        return 1

    direct_user_ids = get_mutual_trusted_user_ids(user)

    if other_user.pk in direct_user_ids:
        return 1

    for direct_user_id in direct_user_ids:
        forward_exists = Friendship.objects.filter(
            from_user_id=direct_user_id,
            to_user=other_user,
            status="accepted",
        ).exists()

        backward_exists = Friendship.objects.filter(
            from_user=other_user,
            to_user_id=direct_user_id,
            status="accepted",
        ).exists()

        if forward_exists and backward_exists:
            return 2

    return 3
