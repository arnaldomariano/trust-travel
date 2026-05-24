from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Count, Q


from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import serializers

from .models import (
    Destination,
    Place,
    Experience,
    ExperiencePhoto,
    Friendship,
    ExperienceReply,
    SavedItem,
    TripPlan,
    Update,
    Profile,
    FeedState,
    SeenUpdate,
)

from .serializers import (
    DestinationSerializer,
    PlaceSerializer,
    ExperienceSerializer,
    ExperiencePhotoSerializer,
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

        avatar_url = None
        if profile and profile.avatar:
            avatar_url = request.build_absolute_uri(profile.avatar.url)

        return Response({
            "username": request.user.username,
            "display_name": profile.display_name if profile else "",
            "public_code": profile.public_code if profile else None,
            "country_code": profile.country_code if profile else None,
            "avatar_url": avatar_url,
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


class PlaceListView(generics.ListCreateAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer

    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)
        else:
            serializer.save()

class CreateBasicPlaceView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        city = (request.data.get("city") or "").strip()
        country = (request.data.get("country") or "").strip()
        place_type = (request.data.get("place_type") or "city").strip()

        valid_place_types = [
            "country",
            "city",
            "attraction",
            "hotel",
            "restaurant",
            "nature",
            "other",
        ]

        if place_type not in valid_place_types:
            place_type = "city"

        # Optional geographic/external fields.
        # These are not required now, but prepare the endpoint for maps,
        # photo metadata, and future external place lookup integrations.
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")
        external_source = (request.data.get("external_source") or "").strip()
        external_id = (request.data.get("external_id") or "").strip()

        if not name:
            return Response({"detail": "Place name is required."}, status=400)

        destination_name = city or name

        destination, _ = Destination.objects.get_or_create(
            name__iexact=destination_name,
            defaults={
                "name": destination_name,
                "country": country,
                "city": city,
            },
        )

        existing_place = Place.objects.filter(
            name__iexact=name,
            destination=destination,
        ).first()

        if existing_place:
            serializer = PlaceSerializer(
                existing_place,
                context={"request": request}
            )
            return Response(serializer.data, status=200)

        place = Place.objects.create(
            destination=destination,
            name=name,
            place_type=place_type,
            city=city,
            latitude=latitude or None,
            longitude=longitude or None,
            external_source=external_source,
            external_id=external_id,
            created_by=request.user,
        )

        serializer = PlaceSerializer(place, context={"request": request})
        return Response(serializer.data, status=201)

class PlaceDetailView(generics.RetrieveAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer


class DestinationPlacesListView(generics.ListAPIView):
    serializer_class = PlaceSerializer

    def get_queryset(self):
        return Place.objects.filter(destination_id=self.kwargs["destination_id"])


class ExperienceListView(generics.ListCreateAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Experience.objects.all()
    serializer_class = ExperienceSerializer

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        if not self.request.user.is_authenticated:
            raise PermissionDenied("You must be logged in to share an experience.")

        experience = serializer.save(user=self.request.user)

        # Use the short experience title as the main feed text.
        # If no title is provided, fall back to the beginning of the comment.
        feed_text = (experience.title or "").strip()

        if not feed_text:
            feed_text = experience.comment.strip()[:120]

        Update.objects.create(
            user=self.request.user,
            place=experience.place,
            experience=experience,
            type="experience",
            category="tourism",
            text=feed_text,
        )

class ExperienceDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = ExperienceSerializer

    def get_queryset(self):
        if self.request.method in ["GET", "HEAD", "OPTIONS"]:
            return Experience.objects.all()

        return Experience.objects.filter(user=self.request.user)

    def perform_update(self, serializer):
        remove_image = self.request.data.get("remove_image") == "true"

        experience = serializer.save()

        if remove_image and experience.image:
            experience.image.delete(save=False)
            experience.image = None
            experience.save(update_fields=["image", "updated_at"])

        # Keep the automatic experience update aligned with the edited title.
        feed_text = (experience.title or "").strip()

        if not feed_text:
            feed_text = experience.comment.strip()[:120]

        update = Update.objects.filter(
            user=self.request.user,
            place=experience.place,
            type="experience",
            created_at__gte=experience.created_at,
        ).order_by("created_at").first()

        if update:
            update.text = feed_text
            update.save()

class ExperiencePhotoListCreateView(generics.ListCreateAPIView):
    serializer_class = ExperiencePhotoSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        experience_id = self.kwargs.get("experience_id")
        return ExperiencePhoto.objects.filter(
            experience_id=experience_id
        ).order_by("created_at")

    def perform_create(self, serializer):
        experience_id = self.kwargs.get("experience_id")

        experience = Experience.objects.get(
            id=experience_id,
            user=self.request.user
        )

        current_count = ExperiencePhoto.objects.filter(
            experience=experience
        ).count()

        if current_count >= 3:
            raise serializers.ValidationError(
                {"detail": "You can add up to 3 extra photos per experience."}
            )

        serializer.save(experience=experience)


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
# TRIP PLANS / SAVED ITEMS
# ============================================================

def serialize_trip_plan(plan):
    saved_count = plan.saved_items.count()

    return {
        "id": plan.id,
        "title": plan.title,
        "destination_text": plan.destination_text,
        "description": plan.description,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "saved_count": saved_count,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


def serialize_saved_item(saved_item, request=None):
    experience = saved_item.experience
    place = experience.place
    destination = place.destination if place else None

    image_url = None

    if request and experience.image:
        image_url = request.build_absolute_uri(experience.image.url)

    return {
        "id": saved_item.id,
        "trip_plan_id": saved_item.trip_plan.id if saved_item.trip_plan else None,
        "experience_id": experience.id,
        "title": experience.title,
        "comment": experience.comment,
        "rating": experience.rating,
        "trip_context": experience.trip_context,
        "trip_style": experience.trip_style,
        "image_url": image_url,
        "place": place.name if place else "",
        "place_id": place.id if place else None,
        "destination": destination.name if destination else "",
        "saved_at": saved_item.created_at,
        "experience_created_at": experience.created_at,
    }


class TripPlanListCreateView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = TripPlan.objects.filter(
            user=request.user
        ).prefetch_related(
            "saved_items"
        ).order_by("-updated_at", "-created_at")

        return Response([
            serialize_trip_plan(plan)
            for plan in plans
        ])

    def post(self, request):
        title = (request.data.get("title") or "").strip()
        destination_text = (request.data.get("destination_text") or "").strip()
        description = (request.data.get("description") or "").strip()
        start_date = request.data.get("start_date") or None
        end_date = request.data.get("end_date") or None

        if not title:
            return Response({"detail": "Title is required."}, status=400)

        plan = TripPlan.objects.create(
            user=request.user,
            title=title,
            destination_text=destination_text,
            description=description,
            start_date=start_date,
            end_date=end_date,
        )

        return Response(serialize_trip_plan(plan), status=201)


class TripPlanDetailView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        try:
            return TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return None

    def get(self, request, pk):
        plan = self.get_object(request, pk)

        if not plan:
            return Response({"detail": "Trip plan not found."}, status=404)

        saved_items = SavedItem.objects.filter(
            user=request.user,
            trip_plan=plan,
        ).select_related(
            "experience",
            "experience__place",
            "experience__place__destination",
        ).order_by("-created_at")

        data = serialize_trip_plan(plan)
        data["saved_items"] = [
            serialize_saved_item(item, request)
            for item in saved_items
        ]

        return Response(data)

    def patch(self, request, pk):
        plan = self.get_object(request, pk)

        if not plan:
            return Response({"detail": "Trip plan not found."}, status=404)

        title = request.data.get("title", plan.title)
        destination_text = request.data.get("destination_text", plan.destination_text)
        description = request.data.get("description", plan.description)
        start_date = request.data.get("start_date", plan.start_date)
        end_date = request.data.get("end_date", plan.end_date)

        if not str(title).strip():
            return Response({"detail": "Title is required."}, status=400)

        plan.title = str(title).strip()
        plan.destination_text = str(destination_text or "").strip()
        plan.description = str(description or "").strip()
        plan.start_date = start_date or None
        plan.end_date = end_date or None
        plan.save()

        return Response(serialize_trip_plan(plan))

    def delete(self, request, pk):
        plan = self.get_object(request, pk)

        if not plan:
            return Response({"detail": "Trip plan not found."}, status=404)

        plan.delete()

        return Response({"detail": "Trip plan deleted."})


class TripPlanExperienceView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, experience_id):
        try:
            plan = TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return Response({"detail": "Trip plan not found."}, status=404)

        try:
            experience = Experience.objects.get(id=experience_id)
        except Experience.DoesNotExist:
            return Response({"detail": "Experience not found."}, status=404)

        saved_item, created = SavedItem.objects.get_or_create(
            user=request.user,
            trip_plan=plan,
            experience=experience,
        )

        # Touch the plan so recently used plans rise to the top.
        plan.save()

        return Response(
            {
                "detail": "Experience added to trip plan.",
                "saved": True,
                "created": created,
                "item": serialize_saved_item(saved_item, request),
            },
            status=201 if created else 200,
        )

    def delete(self, request, pk, experience_id):
        try:
            plan = TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return Response({"detail": "Trip plan not found."}, status=404)

        deleted_count, _ = SavedItem.objects.filter(
            user=request.user,
            trip_plan=plan,
            experience_id=experience_id,
        ).delete()

        if deleted_count == 0:
            return Response(
                {
                    "detail": "Experience was not in this trip plan.",
                    "saved": False,
                },
                status=404,
            )

        plan.save()

        return Response(
            {
                "detail": "Experience removed from trip plan.",
                "saved": False,
            }
        )

# ============================================================

# UPDATE SERIALIZER HELPER

# ============================================================

def serialize_update(update, request=None):

    profile = getattr(update.user, "profile", None)

    avatar_url = None

    if request and profile and profile.avatar:

        avatar_url = request.build_absolute_uri(profile.avatar.url)

    return {

        "id": update.id,

        "experience_id": update.experience.id if update.experience else None,

        "type": update.type,

        "category": update.category,

        "title": update.title,

        "text": update.text,

        "event_date": update.event_date,

        "external_link": update.external_link,

        "source_name": update.source_name,

        "source_url": update.source_url,

        "priority": update.priority,

        "place": update.place.name,

        "place_id": update.place.id,

        "user": profile.public_code if profile and profile.public_code else update.user.username,

        "username": update.user.username,

        "display_name": profile.display_name if profile else "",

        "author_nationality": (
            profile.nationality if profile and profile.show_nationality else ""
        ),

        "author_nationality_country_code": (
            (profile.nationality_country_code or profile.country_code or "").upper()
            if profile and profile.show_nationality
            else ""
        ),

        "avatar_url": avatar_url,

        "created_at": update.created_at,

        "updated_at": update.updated_at,

    }

class TripPlanSuggestionsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            plan = TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return Response({"detail": "Trip plan not found."}, status=404)

        query = (request.query_params.get("q") or "").strip()
        place_type = (request.query_params.get("place_type") or "").strip()

        valid_place_types = [
            "country",
            "city",
            "attraction",
            "hotel",
            "restaurant",
            "nature",
            "other",
        ]

        experiences = Experience.objects.select_related(
            "place",
            "place__destination",
            "user",
            "user__profile",
        ).all()

        if query:
            experiences = experiences.filter(
                Q(title__icontains=query)
                | Q(comment__icontains=query)
                | Q(place__name__icontains=query)
                | Q(place__city__icontains=query)
                | Q(place__destination__name__icontains=query)
                | Q(place__destination__country__icontains=query)
                | Q(place__destination__city__icontains=query)
            )
        elif plan.destination_text:
            destination_query = plan.destination_text.strip()

            experiences = experiences.filter(
                Q(place__name__icontains=destination_query)
                | Q(place__city__icontains=destination_query)
                | Q(place__destination__name__icontains=destination_query)
                | Q(place__destination__country__icontains=destination_query)
                | Q(place__destination__city__icontains=destination_query)
            )

        if place_type:
            if place_type not in valid_place_types:
                return Response({"detail": "Invalid place_type."}, status=400)

            experiences = experiences.filter(place__place_type=place_type)

        saved_experience_ids = set(
            SavedItem.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("experience_id", flat=True)
        )

        experiences = experiences.order_by("-created_at")[:30]

        result = []

        for experience in experiences:
            image_url = None

            if experience.image:
                image_url = request.build_absolute_uri(experience.image.url)

            place = experience.place
            destination = place.destination if place else None

            result.append({
                "experience_id": experience.id,
                "title": experience.title,
                "comment": experience.comment,
                "rating": experience.rating,
                "image_url": image_url,
                "place": place.name if place else "",
                "place_id": place.id if place else None,
                "place_type": place.place_type if place else "",
                "destination": destination.name if destination else "",
                "created_at": experience.created_at,
                "already_saved": experience.id in saved_experience_ids,
            })

        return Response(result)

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
        ).select_related("user__profile", "place", "experience").order_by("-created_at")

        other_updates = Update.objects.exclude(
            user__in=friends
        ).exclude(
            user=user
        ).select_related("user__profile", "place", "experience").order_by("-created_at")

        requests_qs = Friendship.objects.filter(
            to_user=user,
            status="pending"
        ).select_related("from_user__profile")

        seen_update_ids = set(
            SeenUpdate.objects.filter(user=user).values_list("update_id", flat=True)
        )

        def serialize_updates(qs):
            result = []

            for u in qs:
                if u.user == user:
                    continue

                profile = getattr(u.user, "profile", None)

                avatar_url = None

                if profile and profile.avatar:
                    avatar_url = request.build_absolute_uri(profile.avatar.url)

                data = serialize_update(u, request)

                data.update({
                    "user_id": u.user.id,
                    "is_new": u.id not in seen_update_ids,
                    "is_friend": u.user.id in friends,
                    "request_sent": u.user.id in sent_requests,
                    "feed_priority": 1 if u.user.id in friends else 2,
                })

                result.append(data)

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
        category = request.data.get("category") or "general"

        title = (request.data.get("title") or "").strip()
        event_date = request.data.get("event_date") or None
        external_link = (request.data.get("external_link") or "").strip()
        source_name = (request.data.get("source_name") or "").strip()
        source_url = (request.data.get("source_url") or "").strip()
        priority = request.data.get("priority") or "normal"

        valid_types = ["event", "alert", "info"]
        valid_priorities = ["low", "normal", "high", "urgent"]

        if not place_id or not update_type:
            return Response({"detail": "Missing required fields."}, status=400)

        if update_type not in valid_types:
            return Response({"detail": "Invalid update type."}, status=400)

        if priority not in valid_priorities:
            return Response({"detail": "Invalid priority."}, status=400)

        if not text or not str(text).strip():
            return Response({"detail": "Text is required."}, status=400)

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Response({"detail": "Invalid place id"}, status=400)

        update = Update.objects.create(
            user=request.user,
            place=place,
            type=update_type,
            category=category,
            title=title,
            text=str(text).strip(),
            event_date=event_date,
            external_link=external_link,
            source_name=source_name,
            source_url=source_url,
            priority=priority,
        )

        return Response(serialize_update(update, request), status=201)
class UpdateDetailView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            update = Update.objects.select_related(
                "user__profile",
                "place",
                "experience",
            ).get(id=pk)

        except Update.DoesNotExist:
            return Response({"detail": "Update not found."}, status=404)

        # Automatic experience updates should still be opened through
        # the experience/detail flow, not as standalone update pages.
        if update.type == "experience":
            return Response(
                {"detail": "Experience updates should be opened from the experience page."},
                status=400
            )

        return Response(serialize_update(update, request))

    def patch(self, request, pk):
        try:
            update = Update.objects.get(id=pk, user=request.user)
        except Update.DoesNotExist:
            return Response({"detail": "Update not found."}, status=404)

        # Do not allow editing automatic experience updates here.
        # Experiences should be edited through the experience editor.
        if update.type == "experience":
            return Response(
                {"detail": "Experience updates cannot be edited here."},
                status=400
            )

        update_type = request.data.get("type", update.type)
        category = request.data.get("category", update.category)
        text = request.data.get("text", update.text)
        title = request.data.get("title", update.title)
        event_date = request.data.get("event_date", update.event_date)
        external_link = request.data.get("external_link", update.external_link)
        source_name = request.data.get("source_name", update.source_name)
        source_url = request.data.get("source_url", update.source_url)
        priority = request.data.get("priority", update.priority)


        valid_types = ["event", "alert", "info"]
        valid_priorities = ["low", "normal", "high", "urgent"]

        if priority not in valid_priorities:
            return Response({"detail": "Invalid priority."}, status=400)

        if update_type not in valid_types:
            return Response({"detail": "Invalid update type."}, status=400)

        if not text or not str(text).strip():
            return Response({"detail": "Text is required."}, status=400)

        update.type = update_type
        update.category = category or "tourism"
        update.text = str(text).strip()
        update.title = str(title or "").strip()
        update.event_date = event_date or None
        update.external_link = str(external_link or "").strip()
        update.source_name = str(source_name or "").strip()
        update.source_url = str(source_url or "").strip()
        update.priority = priority or "normal"
        update.save()

        return Response(serialize_update(update, request))

    def delete(self, request, pk):
        try:
            update = Update.objects.get(id=pk, user=request.user)
        except Update.DoesNotExist:
            return Response({"detail": "Update not found."}, status=404)

        # Do not allow deleting automatic experience updates here.
        # If the user deletes an experience, we can later decide how to handle its feed update.
        if update.type == "experience":
            return Response(
                {"detail": "Experience updates cannot be deleted here."},
                status=400
            )

        update.delete()

        return Response({"detail": "Update deleted."})

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

class MarkUpdateSeenView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        update_id = request.data.get("update_id")

        if not update_id:
            return Response({"detail": "update_id required"}, status=400)

        try:
            update = Update.objects.get(id=update_id)
        except Update.DoesNotExist:
            return Response({"detail": "Update not found"}, status=404)

        SeenUpdate.objects.get_or_create(
            user=request.user,
            update=update,
        )

        return Response({"status": "ok"})

# ============================================================
# MY UPDATES / MY POSTS
# ============================================================

class PlaceUpdatesListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, place_id):
        updates = Update.objects.filter(
            place_id=place_id
        ).exclude(
            type="experience"
        ).select_related(
            "user__profile",
            "place",
            "experience",
        ).order_by("-created_at")

        return Response([
            serialize_update(update, request)
            for update in updates
        ])

class PlacePhotosView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request, place_id):
        experiences = Experience.objects.filter(
            place_id=place_id,
            image__isnull=False
        ).exclude(
            image=""
        ).select_related(
            "user",
            "place"
        ).order_by("-created_at")[:6]

        result = []

        for experience in experiences:
            image_url = None

            if experience.image:
                image_url = request.build_absolute_uri(experience.image.url)

            result.append({
                "id": experience.id,
                "title": experience.title,
                "comment": experience.comment,
                "rating": experience.rating,
                "image_url": image_url,
                "user": experience.user.username if experience.user else "Unknown user",
                "place_id": experience.place.id,
                "created_at": experience.created_at,
            })

        return Response(result)


class MyUpdatesView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        updates = Update.objects.filter(
            user=request.user
        ).select_related(
            "place",
            "experience",
            "user__profile",
        ).order_by("-created_at")

        return Response([
            serialize_update(update, request)
            for update in updates
        ])

class MyExperiencesView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        experiences = Experience.objects.filter(
            user=request.user
        ).select_related(
            "place",
            "place__destination"
        ).order_by("-created_at")

        result = []

        for experience in experiences:
            image_url = None

            if experience.image:
                image_url = request.build_absolute_uri(experience.image.url)

            result.append({
                "id": experience.id,
                "title": experience.title,
                "comment": experience.comment,
                "rating": experience.rating,
                "trip_context": experience.trip_context,
                "trip_style": experience.trip_style,
                "image_url": image_url,
                "place": experience.place.name,
                "place_id": experience.place.id,
                "destination": experience.place.destination.name if experience.place.destination else "",
                "created_at": experience.created_at,
                "updated_at": experience.updated_at,
            })

        return Response(result)

# ============================================================
# ANALYTICS
# ============================================================

def get_filtered_saved_items(request):
    user_country = (request.query_params.get("user_country") or "").strip().upper()

    saved_items = SavedItem.objects.select_related(
        "user",
        "user__profile",
        "experience",
        "experience__place",
        "experience__place__destination",
    )

    if user_country:
        saved_items = saved_items.filter(
            user__profile__country_code=user_country
        )

    return saved_items

class PlannerCountriesAnalyticsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        country_stats = (
            SavedItem.objects
            .exclude(user__profile__country_code__isnull=True)
            .exclude(user__profile__country_code="")
            .exclude(user__profile__country_code="XX")
            .values("user__profile__country_code")
            .annotate(saved_count=Count("id"))
            .order_by("user__profile__country_code")
        )

        country_labels = {
            "BR": "Brazil",
            "IT": "Italy",
            "NL": "Netherlands",
            "US": "United States",
            "PT": "Portugal",
            "FR": "France",
            "DE": "Germany",
            "ES": "Spain",
            "GB": "United Kingdom",
        }

        result = []

        for item in country_stats:
            country_code = item["user__profile__country_code"]

            result.append({
                "country_code": country_code,
                "label": country_labels.get(country_code, country_code),
                "saved_count": item["saved_count"],
            })

        return Response(result)

class TopSavedExperiencesAnalyticsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = get_filtered_saved_items(request)

        saved_stats = (
            queryset
            .values(
                "experience_id",
                "experience__title",
                "experience__comment",
                "experience__rating",
                "experience__place__name",
                "experience__place__id",
                "experience__place__place_type",
                "experience__place__destination__name",
            )
            .annotate(saved_count=Count("id"))
            .order_by("-saved_count", "experience__place__name")[:20]
        )

        result = []

        for item in saved_stats:
            result.append({
                "experience_id": item["experience_id"],
                "title": item["experience__title"],
                "comment": item["experience__comment"],
                "rating": item["experience__rating"],
                "place": item["experience__place__name"],
                "place_id": item["experience__place__id"],
                "place_type": item["experience__place__place_type"],
                "destination": item["experience__place__destination__name"],
                "saved_count": item["saved_count"],
            })

        return Response(result)


class TopSavedPlacesAnalyticsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        place_type = (request.query_params.get("place_type") or "").strip()

        valid_place_types = [
            "country",
            "city",
            "attraction",
            "hotel",
            "restaurant",
            "nature",
            "other",
        ]

        queryset = get_filtered_saved_items(request)

        if place_type:
            if place_type not in valid_place_types:
                return Response(
                    {"detail": "Invalid place_type."},
                    status=400,
                )

            queryset = queryset.filter(
                experience__place__place_type=place_type
            )

        saved_stats = (
            queryset
            .values(
                "experience__place__id",
                "experience__place__name",
                "experience__place__place_type",
                "experience__place__destination__name",
            )
            .annotate(saved_count=Count("id"))
            .order_by("-saved_count", "experience__place__name")[:20]
        )

        result = []

        for item in saved_stats:
            result.append({
                "place_id": item["experience__place__id"],
                "place": item["experience__place__name"],
                "place_type": item["experience__place__place_type"],
                "destination": item["experience__place__destination__name"],
                "saved_count": item["saved_count"],
            })

        return Response(result)


class TopSavedDestinationsAnalyticsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_country = (request.query_params.get("user_country") or "").strip().upper()

        queryset = get_filtered_saved_items(request)

        saved_stats = (
            queryset
            .values("experience__place__destination__name")
            .annotate(
                saved_count=Count("id"),
                unique_places=Count("experience__place_id", distinct=True),
                unique_experiences=Count("experience_id", distinct=True),
                unique_users=Count("user_id", distinct=True),
            )
            .order_by("-saved_count", "experience__place__destination__name")[:20]
        )

        result = []

        for item in saved_stats:
            destination_name = item["experience__place__destination__name"]

            if not destination_name:
                continue

            result.append({
                "destination": destination_name,
                "saved_count": item["saved_count"],
                "unique_places": item["unique_places"],
                "unique_experiences": item["unique_experiences"],
                "unique_users": item["unique_users"],
                "user_country": user_country or None,
            })

        return Response(result)


class SummaryAnalyticsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        saved_items = get_filtered_saved_items(request)

        total_saved_items = saved_items.count()

        unique_experiences_saved = (
            saved_items
            .values("experience_id")
            .distinct()
            .count()
        )

        unique_places_saved = (
            saved_items
            .values("experience__place_id")
            .distinct()
            .count()
        )

        top_place_type_row = (
            saved_items
            .values("experience__place__place_type")
            .annotate(saved_count=Count("id"))
            .order_by("-saved_count", "experience__place__place_type")
            .first()
        )

        top_destination_row = (
            saved_items
            .values("experience__place__destination__name")
            .annotate(saved_count=Count("id"))
            .order_by("-saved_count", "experience__place__destination__name")
            .first()
        )

        top_place_type = (
            top_place_type_row["experience__place__place_type"]
            if top_place_type_row
            else None
        )

        top_destination = (
            top_destination_row["experience__place__destination__name"]
            if top_destination_row
            else None
        )

        return Response({
            "total_saved_items": total_saved_items,
            "unique_experiences_saved": unique_experiences_saved,
            "unique_places_saved": unique_places_saved,
            "top_place_type": top_place_type,
            "top_destination": top_destination,
        })