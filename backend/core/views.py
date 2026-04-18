from .models import Destination, Place, Experience
from .serializers import DestinationSerializer, PlaceSerializer, ExperienceSerializer, UserRegisterSerializer
from rest_framework.generics import RetrieveAPIView
from .models import Place
from .serializers import PlaceSerializer
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from .models import Experience, Friendship, ExperienceReply
from .serializers import ExperienceReplySerializer
from rest_framework.generics import ListAPIView
from .models import Friendship, Update, Profile
from .serializers import UpdateSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    profile = getattr(request.user, "profile", None)

    return Response({
        "username": request.user.username,
        "public_code": profile.public_code if profile else None,
        "country_code": profile.country_code if profile else None,
    })

class UpdateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # 👥 amigos
        friends = set(
            Friendship.objects.filter(
                from_user=user,
                status="accepted"
            ).values_list("to_user", flat=True)
        )

        sent_requests = set(
            Friendship.objects.filter(
                from_user=user,
                status="pending"
            ).values_list("to_user", flat=True)
        )

        # 🟢 updates da rede
        network_updates = Update.objects.filter(
            user__in=friends
        ).order_by("-created_at")

        # ⚪ outros updates
        other_updates = Update.objects.exclude(
            user__in=friends
        ).order_by("-created_at")

        # 👤 requests recebidos (PONTO CHAVE)
        requests = Friendship.objects.filter(
            to_user=user,
            status="pending"
        ).select_related("from_user")

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

                    # 👇 NOVO
                    "is_friend": u.user.id in friends,
                    "request_sent": u.user.id in sent_requests,
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
            "requests": serialize_requests(requests),  # 👈 NOVO
        })

    def post(self, request):
        place_id = request.data.get("place")
        text = request.data.get("text")
        update_type = request.data.get("type")
        category = request.data.get("category")

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

        profile = getattr(update.user, "profile", None)

        profile = getattr(request.user, "profile", None)

        return Response(
            {
                "id": update.id,
                "type": update.type,
                "category": update.category,
                "text": update.text,
                "user": profile.public_code if profile and profile.public_code else request.user.username,
                "username": request.user.username,
                "place": update.place.name,
                "created_at": update.created_at,
            },
            status=201
        )

class PlaceDetailView(RetrieveAPIView):
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
        return {"request": self.request}  # 👈 ESSA LINHA É A CHAVE

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class DestinationPlacesListView(generics.ListAPIView):
    serializer_class = PlaceSerializer

    def get_queryset(self):
        destination_id = self.kwargs["destination_id"]
        return Place.objects.filter(destination_id=destination_id)

class PlaceExperiencesListView(generics.ListAPIView):
    serializer_class = ExperienceSerializer

    def get_queryset(self):
        place_id = self.kwargs["place_id"]
        return Experience.objects.filter(place_id=place_id)

    def get_serializer_context(self):
        return {"request": self.request}  # 👈 ADICIONE AQUI TAMBÉM

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
class ExperienceReplyListCreateView(generics.ListCreateAPIView):
    serializer_class = ExperienceReplySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        experience_id = self.kwargs["experience_id"]
        return ExperienceReply.objects.filter(experience_id=experience_id).order_by("created_at")

    def perform_create(self, serializer):
        experience_id = self.kwargs["experience_id"]
        experience = Experience.objects.get(id=experience_id)

        author = experience.user
        requester = self.request.user

        if author is None:
            raise PermissionDenied("This comment has no author.")

        # ✔️ Pode responder a si mesmo
        is_self = requester == author

        # ✔️ Amizade precisa ser nos dois sentidos
        forward = Friendship.objects.filter(
            from_user=requester,
            to_user=author
        ).exists()

        backward = Friendship.objects.filter(
            from_user=author,
            to_user=requester
        ).exists()

        in_network = forward and backward

        if not (is_self or in_network):
            raise PermissionDenied(
                "You can only reply to your own or trusted users' comments."
            )

        serializer.save(user=requester, experience=experience)

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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

        exists = Friendship.objects.filter(
            from_user=request.user,
            to_user=to_user
        ).exists()

        if exists:
            return Response({"detail": "Request already sent"}, status=400)

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

        friendship.status = "accepted"
        friendship.save()

        return Response({"detail": "Friend request accepted"})

from rest_framework.response import Response

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_friend_request(request):
    request_id = request.data.get("request_id")

    try:
        friendship = Friendship.objects.get(
            id=request_id,
            to_user=request.user
        )

        friendship.status = "rejected"
        friendship.save()

        return Response({"detail": "Friend request rejected"})

    except Friendship.DoesNotExist:
        return Response({"detail": "Request not found"}, status=404)
