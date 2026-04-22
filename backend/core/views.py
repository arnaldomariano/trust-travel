from django.contrib.auth.models import User

from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied

from rest_framework_simplejwt.views import TokenObtainPairView

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

from .authentication import CookieJWTAuthentication


# ============================================================
# AUTH / USER
# ============================================================

class MeView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        return Response({
            "username": request.user.username,
            "public_code": profile.public_code if profile else None,
            "country_code": profile.country_code if profile else None,
        })


class UserRegisterView(generics.CreateAPIView):
    serializer_class = UserRegisterSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            access = response.data.get("access")

            response.set_cookie(
                key="access",
                value=access,
                httponly=True,
                secure=False,   # em produção: True com HTTPS
                samesite="Lax",
                path="/",
            )

            response.data = {"message": "Login successful"}

        return response


# ============================================================
# CORE LIST VIEWS
# ============================================================

class DestinationListView(generics.ListAPIView):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer


class PlaceListView(generics.ListAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer


class PlaceDetailView(generics.RetrieveAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer


class DestinationPlacesListView(generics.ListAPIView):
    serializer_class = PlaceSerializer

    def get_queryset(self):
        return Place.objects.filter(destination_id=self.kwargs["destination_id"])


class ExperienceListView(generics.ListCreateAPIView):
    queryset = Experience.objects.all()
    serializer_class = ExperienceSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PlaceExperiencesListView(generics.ListAPIView):
    serializer_class = ExperienceSerializer

    def get_queryset(self):
        return Experience.objects.filter(place_id=self.kwargs["place_id"])

    def get_serializer_context(self):
        return {"request": self.request}


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

        is_self = requester == author

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
            raise PermissionDenied("You can only reply to trusted users.")

        serializer.save(user=requester, experience=experience)


# ============================================================
# UPDATE FEED
# ============================================================

class UpdateListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

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

        sent_requests = set(
            Friendship.objects.filter(
                from_user=user,
                status="pending"
            ).values_list("to_user", flat=True)
        )

        network_updates = Update.objects.filter(
            user__in=friends
        ).select_related("user__profile", "place").order_by("-created_at")

        other_updates = Update.objects.exclude(
            user__in=friends
        ).exclude(
            user=user
        ).select_related("user__profile", "place").order_by("-created_at")

        requests_qs = Friendship.objects.filter(
            to_user=user,
            status="pending"
        ).select_related("from_user__profile")

        def serialize_updates(qs):
            result = []
            for u in qs:
                profile = getattr(u.user, "profile", None)

                result.append({
                    "id": u.id,
                    "type": u.type,
                    "category": u.category,
                    "text": u.text,
                    "user": profile.public_code if profile and profile.public_code else u.user.username,
                    "username": u.user.username,
                    "place": u.place.name,
                    "created_at": u.created_at,
                    "is_friend": u.user.id in friends,
                    "request_sent": u.user.id in sent_requests,
                    "priority": 1 if u.user.id in friends else 2,
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
        place_id = request.data.get("place")
        text = request.data.get("text")
        update_type = request.data.get("type")
        category = request.data.get("category")

        if not all([place_id, text, update_type, category]):
            return Response({"detail": "Missing fields"}, status=400)

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
# CONNECTIONS
# ============================================================

class ConnectionsListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
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

            friends.append({
                "id": u.id,
                "username": u.username,
                "public_code": profile.public_code if profile else None,
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
# FRIENDSHIP ACTIONS
# ============================================================

class SendFriendRequestView(APIView):
    authentication_classes = [CookieJWTAuthentication]
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

        if existing:
            if existing.status == "accepted":
                return Response({"detail": "You are already connected"}, status=400)

            if existing.status == "pending":
                return Response({"detail": "Request already sent"}, status=400)

            if existing.status == "rejected":
                existing.status = "pending"
                existing.save()
                return Response({"detail": "Friend request sent"}, status=200)

        Friendship.objects.create(
            from_user=request.user,
            to_user=to_user,
            status="pending"
        )

        return Response({"detail": "Friend request sent"}, status=201)


class AcceptFriendRequestView(APIView):
    authentication_classes = [CookieJWTAuthentication]
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

        friendship.status = "accepted"
        friendship.save()

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