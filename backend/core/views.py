# ============================================================
# CLEAN VIEWS FILE — Trust Travel
# ============================================================

from django.contrib.auth.models import User
from django.db.models import Q

from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied

from .models import (
    Destination,
    Place,
    Experience,
    Friendship,
    ExperienceReply,
    Update,
    Profile,
)

from .serializers import (
    DestinationSerializer,
    PlaceSerializer,
    ExperienceSerializer,
    UserRegisterSerializer,
    ExperienceReplySerializer,
)


# ============================================================
# USER INFO
# ============================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return basic info about logged user"""
    profile = getattr(request.user, "profile", None)

    return Response({
        "username": request.user.username,
        "public_code": profile.public_code if profile else None,
        "country_code": profile.country_code if profile else None,
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_friend_request(request):
    request_id = request.data.get("request_id")

    if not request_id:
        return Response({"detail": "request_id is required"}, status=400)

    try:
        friendship = Friendship.objects.get(
            id=request_id,
            from_user=request.user,
            status="pending"
        )

        friendship.delete()

        return Response({"detail": "Request canceled"})

    except Friendship.DoesNotExist:
        return Response({"detail": "Request not found"}, status=404)


# ============================================================
# UPDATE FEED
# ============================================================

class UpdateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        print("LOGGED USER:", request.user.username)

        # --------------------------------------------------------
        # Bidirectional friendship (real trust network)
        # --------------------------------------------------------
        outgoing = set(
            Friendship.objects.filter(
                from_user=user,
                status="accepted"
            ).values_list("to_user", flat=True)
        )

        incoming = set(
            Friendship.objects.filter(
                to_user=user,
                status="accepted"
            ).values_list("from_user", flat=True)
        )

        # Strict trust network (bidirectional only)
        forward_ids = set(
            Friendship.objects.filter(
                from_user=user,
                status="accepted"
            ).values_list("to_user", flat=True)
        )

        backward_ids = set(
            Friendship.objects.filter(
                to_user=user,
                status="accepted"
            ).values_list("from_user", flat=True)
        )

        friends = forward_ids & backward_ids

        # Pending requests sent
        sent_requests = set(
            Friendship.objects.filter(
                from_user=user,
                status="pending"
            ).values_list("to_user", flat=True)
        )

        # --------------------------------------------------------
        # Query optimization (avoid N+1 problem)
        # --------------------------------------------------------
        network_updates = Update.objects.filter(
            user__in=friends
        ).select_related("user__profile", "place").order_by("-created_at")

        other_updates = Update.objects.exclude(
            user__in=friends
        ).exclude(
            user=user
        ).select_related("user__profile", "place").order_by("-created_at")

        # Incoming friend requests
        requests_qs = Friendship.objects.filter(
            to_user=user,
            status="pending"
        ).select_related("from_user__profile")

        # --------------------------------------------------------
        # SERIALIZERS
        # --------------------------------------------------------
        def serialize_updates(qs):
            result = []

            for u in qs:
                profile = getattr(u.user, "profile", None)

                is_friend = u.user.id in friends

                result.append({
                    "id": u.id,
                    "type": u.type,
                    "category": u.category,
                    "text": u.text,
                    "user": profile.public_code if profile and profile.public_code else u.user.username,
                    "username": u.user.username,
                    "place": u.place.name,
                    "created_at": u.created_at,
                    "is_friend": is_friend,
                    "request_sent": u.user.id in sent_requests,

                    # 🔥 NOVO CAMPO (IMPORTANTE)
                    "priority": 1 if is_friend else 2,
                })

            return result

        def serialize_requests(qs):
            result = []

            for r in qs:
                profile = getattr(r.from_user, "profile", None)

                result.append({
                    "id": r.id,
                    "from_user": profile.public_code if profile and profile.public_code else r.from_user.username,
                    "username": r.from_user.username,
                })

            return result

        return Response({
            "network": serialize_updates(network_updates),
            "others": serialize_updates(other_updates),
            "requests": serialize_requests(requests_qs),
        })

    def post(self, request):
        """Create a new update"""
        place_id = request.data.get("place")
        text = request.data.get("text")
        update_type = request.data.get("type")
        category = request.data.get("category")

        # Validation
        if not place_id:
            return Response({"detail": "place is required"}, status=400)
        if not text:
            return Response({"detail": "text is required"}, status=400)
        if not update_type:
            return Response({"detail": "type is required"}, status=400)
        if not category:
            return Response({"detail": "category is required"}, status=400)

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Response({"detail": "Invalid place id"}, status=400)

        update = Update.objects.create(
            user=request.user,
            place=place,
            type=update_type,
            category=category,
            text=text,
        )

        profile = getattr(request.user, "profile", None)

        return Response({
            "id": update.id,
            "type": update.type,
            "category": update.category,
            "text": update.text,
            "user": profile.public_code if profile else request.user.username,
            "username": request.user.username,
            "place": update.place.name,
            "created_at": update.created_at,
        }, status=201)

# ============================================================
# CONNECTIONS LIST
# ============================================================

class ConnectionsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        pending_received = Friendship.objects.filter(
            to_user=user,
            status="pending"
        ).select_related("from_user__profile")

        pending_sent = Friendship.objects.filter(
            from_user=user,
            status="pending"
        ).select_related("to_user__profile")

        # Strict trust network: bidirectional accepted only
        forward_ids = set(
            Friendship.objects.filter(
                from_user=user,
                status="accepted"
            ).values_list("to_user", flat=True)
        )

        backward_ids = set(
            Friendship.objects.filter(
                to_user=user,
                status="accepted"
            ).values_list("from_user", flat=True)
        )

        friend_ids = forward_ids & backward_ids

        friends_qs = User.objects.filter(id__in=friend_ids).select_related("profile")

        friends = []
        for u in friends_qs:
            profile = getattr(u, "profile", None)

            friendship = Friendship.objects.filter(
                from_user=user,
                to_user=u,
                status="accepted"
            ).first()

            friends.append({
                "id": u.id,
                "username": u.username,
                "public_code": profile.public_code if profile else None,
                "trusted_since": friendship.created_at if friendship else None,
            })

        def serialize_received(qs):
            result = []
            for f in qs:
                sender = f.from_user
                profile = getattr(sender, "profile", None)

                result.append({
                    "request_id": f.id,
                    "id": sender.id,
                    "username": sender.username,
                    "public_code": profile.public_code if profile else None,
                })
            return result

        def serialize_sent(qs):
            result = []
            for f in qs:
                receiver = f.to_user
                profile = getattr(receiver, "profile", None)

                result.append({
                    "request_id": f.id,
                    "id": receiver.id,
                    "username": receiver.username,
                    "public_code": profile.public_code if profile else None,
                })
            return result

        return Response({
            "friends": friends,
            "pending_received": serialize_received(pending_received),
            "pending_sent": serialize_sent(pending_sent),
        })

# ============================================================
# CORE LIST VIEWS
# ============================================================

class PlaceDetailView(generics.RetrieveAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer


class DestinationListView(generics.ListAPIView):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer


class PlaceListView(generics.ListAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer


class ExperienceListView(generics.ListCreateAPIView):
    queryset = Experience.objects.all()
    serializer_class = ExperienceSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DestinationPlacesListView(generics.ListAPIView):
    serializer_class = PlaceSerializer

    def get_queryset(self):
        return Place.objects.filter(destination_id=self.kwargs["destination_id"])


class PlaceExperiencesListView(generics.ListAPIView):
    serializer_class = ExperienceSerializer

    def get_queryset(self):
        return Experience.objects.filter(place_id=self.kwargs["place_id"])

    def get_serializer_context(self):
        return {"request": self.request}


# ============================================================
# AUTH
# ============================================================

class UserRegisterView(generics.CreateAPIView):
    serializer_class = UserRegisterSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "public_code": profile.public_code if profile else None,
            "country_code": profile.country_code if profile else None,
        })


# ============================================================
# EXPERIENCE REPLIES
# ============================================================

class ExperienceReplyListCreateView(generics.ListCreateAPIView):
    serializer_class = ExperienceReplySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return ExperienceReply.objects.filter(
            experience_id=self.kwargs["experience_id"]
        ).order_by("created_at")

    def perform_create(self, serializer):
        experience = Experience.objects.get(id=self.kwargs["experience_id"])

        author = experience.user
        requester = self.request.user

        if author is None:
            raise PermissionDenied("This comment has no author.")

        # Self-reply allowed
        is_self = requester == author

        # Bidirectional friendship required
        forward = Friendship.objects.filter(
            from_user=requester,
            to_user=author,
            status="accepted"
        ).exists()

        backward = Friendship.objects.filter(
            from_user=author,
            to_user=requester,
            status="accepted"
        ).exists()

        in_network = forward and backward

        if not (is_self or in_network):
            raise PermissionDenied(
                "You can only reply to trusted users."
            )

        serializer.save(user=requester, experience=experience)


# ============================================================
# FRIENDSHIP SYSTEM
# ============================================================

from django.utils import timezone
from datetime import timedelta

class SendFriendRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("public_code")

        if not code:
            return Response({"detail": "public_code is required"}, status=400)

        try:
            profile = Profile.objects.get(public_code=code)
            to_user = profile.user
        except Profile.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)

        if to_user == request.user:
            return Response({"detail": "You cannot add yourself"}, status=400)

        existing = Friendship.objects.filter(
            from_user=request.user,
            to_user=to_user
        ).first()

        reverse = Friendship.objects.filter(
            from_user=to_user,
            to_user=request.user
        ).first()

        # 🔄 reverse relationship (you were the receiver before)
        if reverse:
            if reverse.status == "pending":
                return Response({
                    "detail": "This user has already sent you a request. Check your requests.",
                    "context": "reverse_pending"
                }, status=400)

            if reverse.status == "accepted":
                return Response({
                    "detail": "You are already connected.",
                    "context": "already_connected"
                }, status=400)

            if reverse.status == "rejected":
                Friendship.objects.create(
                    from_user=request.user,
                    to_user=to_user,
                    status="pending"
                )

                return Response({
                    "detail": "Request sent. This user previously declined your connection.",
                    "context": "reverse_rejected"
                }, status=201)

        from django.utils import timezone
        from datetime import timedelta

        if existing:
            if existing.status == "accepted":
                return Response({"detail": "You are already connected"}, status=400)

            if existing.status == "pending":
                return Response({"detail": "Request already sent"}, status=400)

            if existing.status == "rejected":
                cooldown = timedelta(days=2)

                if timezone.now() - existing.created_at < cooldown:
                    remaining = cooldown - (timezone.now() - existing.created_at)

                    hours = remaining.seconds // 3600
                    days = remaining.days

                    time_msg = ""
                    if days > 0:
                        time_msg += f"{days} day(s) "
                    if hours > 0:
                        time_msg += f"{hours} hour(s)"

                    return Response(
                        {"detail": f"Please wait {time_msg.strip()} before sending another request"},
                        status=400
                    )

                # ✅ allowed after cooldown
                existing.status = "pending"
                existing.created_at = timezone.now()
                existing.save()

                return Response({"detail": "Friend request sent"}, status=200)

        Friendship.objects.create(
            from_user=request.user,
            to_user=to_user,
            status="pending"
        )

        return Response({"detail": "Friend request sent"}, status=201)


class AcceptFriendRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request_id = request.data.get("request_id")

        if not request_id:
            return Response({"detail": "request_id is required"}, status=400)

        try:
            friendship = Friendship.objects.get(
                id=request_id,
                to_user=request.user,
                status="pending"
            )
        except Friendship.DoesNotExist:
            return Response({"detail": "Request not found"}, status=404)

        # Accept original request
        friendship.status = "accepted"
        friendship.save()

        # 🔥 CREATE REVERSE RELATION (CRITICAL)
        reverse_exists = Friendship.objects.filter(
            from_user=request.user,
            to_user=friendship.from_user
        ).exists()

        if not reverse_exists:
            Friendship.objects.create(
                from_user=request.user,
                to_user=friendship.from_user,
                status="accepted"
            )

        return Response({"detail": "Friend request accepted"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_friend_request(request):
    request_id = request.data.get("request_id")

    if not request_id:
        return Response({"detail": "request_id is required"}, status=400)

    try:
        friendship = Friendship.objects.get(
            id=request_id,
            to_user=request.user,
            status="pending"
        )

        friendship.status = "rejected"
        friendship.save()

        return Response({"detail": "Friend request rejected"})

    except Friendship.DoesNotExist:
        return Response({"detail": "Request not found"}, status=404)