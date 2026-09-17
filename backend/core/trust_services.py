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


def can_comment_on_experience(user, experience):
    if (
        user is None
        or experience is None
        or not getattr(user, "pk", None)
        or not getattr(experience, "pk", None)
        or not getattr(user, "is_authenticated", False)
    ):
        return False

    author = experience.user

    if author is None:
        return False

    if user.pk == author.pk:
        return True

    professional_presence = getattr(author, "professional_presence", None)

    if (
        professional_presence is not None
        and professional_presence.status == "active"
    ):
        return True

    trust_level = get_trust_level(user, author)

    if trust_level == 1:
        return True

    if trust_level == 2:
        profile = getattr(author, "profile", None)

        return bool(
            profile
            and profile.allow_level_2_experience_comments
        )

    return False
