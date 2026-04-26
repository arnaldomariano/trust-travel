from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
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
    FeedState,
)

from .serializers import (
    DestinationSerializer,
    PlaceSerializer,
    ExperienceSerializer,
    UserRegisterSerializer,
    ExperienceReplySerializer,
    ProfileSerializer,
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
            "display_name": profile.display_name if profile else "",
            "public_code": profile.public_code if profile else None,
            "country_code": profile.country_code if profile else None,
        })

class ProfileView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(
            profile,
            context={"request": request}
        )
        return Response(serializer.data)

    def patch(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request}
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=400)

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
                secure=False,
                samesite="Lax",
                path="/",
            )

            response.data = {"message": "Login successful"}

        return response


class LogoutView(APIView):
    def post(self, request):
        response = Response({"message": "Logged out"})
        response.delete_cookie("access", path="/")
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

        seen_map = {
            s.target_user_id: s.last_seen_at
            for s in FeedState.objects.filter(user=user)
        }

        def serialize_updates(qs):
            result = []

            for u in qs:
                if u.user == user:
                    continue

                profile = getattr(u.user, "profile", None)
                last_seen = seen_map.get(u.user.id)

                avatar_url = None

                if profile and profile.avatar:
                    avatar_url = request.build_absolute_uri(profile.avatar.url)

                result.append({
                    "id": u.id,
                    "type": u.type,
                    "category": u.category,
                    "text": u.text,
                    "user": profile.public_code if profile else u.user.username,
                    "username": u.user.username,
                    "display_name": profile.display_name if profile else "",
                    "avatar_url": avatar_url,
                    "place": u.place.name,
                    "place_id": u.place.id,
                    "user_id": u.user.id,
                    "created_at": u.created_at,
                    "is_new": (last_seen is None) or (u.created_at > last_seen),
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

        def get_avatar_url(profile):
            if profile and profile.avatar:
                return request.build_absolute_uri(profile.avatar.url)
            return None

        friends = []
        for u in friends_qs:
            profile = getattr(u, "profile", None)

            friends.append({
                "id": u.id,
                "username": u.username,
                "display_name": profile.display_name if profile else "",
                "public_code": profile.public_code if profile else None,
                "avatar_url": get_avatar_url(profile),
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
                    "display_name": profile.display_name if profile else "",
                    "public_code": profile.public_code if profile else None,
                    "avatar_url": get_avatar_url(profile),
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
                    "display_name": profile.display_name if profile else "",
                    "public_code": profile.public_code if profile else None,
                    "avatar_url": get_avatar_url(profile),
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

        # check existing relationship
        existing = Friendship.objects.filter(
            from_user=request.user,
            to_user=to_user
        ).first()

        if existing:
            if existing.status == "pending":
                return Response({"detail": "Request already sent"}, status=400)

            if existing.status == "accepted":
                return Response({"detail": "Already friends"}, status=400)

            if existing.status == "rejected":
                existing.status = "pending"
                existing.save()
                return Response({"detail": "Friend request resent"}, status=200)

        # check reverse
        reverse = Friendship.objects.filter(
            from_user=to_user,
            to_user=request.user
        ).first()

        if reverse and reverse.status == "pending":
            return Response({
                "detail": "User already sent you a request"
            }, status=400)

        # create request
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

        reverse, _ = Friendship.objects.get_or_create(
            from_user=request.user,
            to_user=friendship.from_user,
            defaults={"status": "accepted"}
        )

        if reverse.status != "accepted":
            reverse.status = "accepted"
            reverse.save()

        return Response({"detail": "Friend request accepted"})


@api_view(["POST"])
@authentication_classes([CookieJWTAuthentication])
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
@authentication_classes([CookieJWTAuthentication])
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


@api_view(["POST"])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def remove_friend(request):
    target_user_id = request.data.get("user_id")

    if not target_user_id:
        return Response({"detail": "user_id is required"}, status=400)

    Friendship.objects.filter(
        from_user=request.user,
        to_user_id=target_user_id,
        status="accepted"
    ).delete()

    Friendship.objects.filter(
        from_user_id=target_user_id,
        to_user=request.user,
        status="accepted"
    ).delete()

    return Response({"detail": "Friend removed"})


# ============================================================
# FEED STATE
# ============================================================

class MarkUserSeenView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_user_id = request.data.get("user_id")

        if not target_user_id:
            return Response({"detail": "user_id required"}, status=400)

        state, _ = FeedState.objects.get_or_create(
            user=request.user,
            target_user_id=target_user_id
        )

        state.last_seen_at = timezone.now()
        state.save()

        return Response({"status": "ok"})