import unicodedata

from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404


from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
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
    SavedPlace,
    TripPlanWatchedPlace,
    TripPlanActivitySeen,
    TripPlan,
    Update,
    Profile,
    FeedState,
    SeenUpdate,
    ContentReport,
)

from .serializers import (
    DestinationSerializer,
    PlaceSerializer,
    ExperienceSerializer,
    ExperiencePhotoSerializer,
    UserRegisterSerializer,
    ExperienceReplySerializer,
    ProfileSerializer,
    ContentReportSerializer,
)

from .authentication import CookieJWTAuthentication

def normalize_place_text(value):
    value = str(value or "").strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = " ".join(value.split())
    return value


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
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
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

class RecoverPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        recovery_code = (request.data.get("recovery_code") or "").strip()
        new_password = request.data.get("new_password") or ""

        if not username or not recovery_code or not new_password:
            return Response(
                {
                    "detail": "Username, recovery code and new password are required."
                },
                status=400,
            )

        if len(new_password) < 8:
            return Response(
                {
                    "detail": "New password must be at least 8 characters long."
                },
                status=400,
            )

        try:
            user = User.objects.select_related("profile").get(username=username)
        except User.DoesNotExist:
            return Response(
                {
                    "detail": "Invalid username or recovery code."
                },
                status=400,
            )

        profile = getattr(user, "profile", None)

        if not profile or not profile.check_recovery_code(recovery_code):
            return Response(
                {
                    "detail": "Invalid username or recovery code."
                },
                status=400,
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {
                "detail": "Password updated successfully. You can now log in with your new password."
            }
        )


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

        specific_place_types = [
            "attraction",
            "hotel",
            "restaurant",
            "nature",
            "other",
        ]

        content_like_words = [
            "evite",
            "alerta",
            "alert",
            "alagamento",
            "alagamentos",
            "inverno",
            "fechado",
            "closed",
            "danger",
            "perigo",
            "urgente",
            "urgent",
            "promoção",
            "promotion",
        ]

        if not name:
            return Response({"detail": "Place name is required."}, status=400)

        if place_type not in valid_place_types:
            return Response(
                {"detail": "Invalid place type."},
                status=400,
            )

        normalized_name = name.lower()

        if any(word in normalized_name for word in content_like_words):
            return Response(
                {
                    "detail": (
                        "This looks like an alert, event or information title, "
                        "not a place name. Please select the place first, then "
                        "share the alert, event or information."
                    )
                },
                status=400,
            )

        if place_type == "country":
            city = ""
            country = country or name
            destination_name = name

        elif place_type == "city":
            if not country:
                return Response(
                    {"detail": "Country is required for cities and regions."},
                    status=400,
                )

            # City/region records must use the official city/region name as both
            # the Place name and city field. Popular names should become aliases later,
            # not primary Place names.
            city = name
            destination_name = country

        elif place_type in specific_place_types:
            if not country:
                return Response(
                    {"detail": "Country is required for specific places."},
                    status=400,
                )

            if not city:
                return Response(
                    {
                        "detail": (
                            "City or region is required for specific places. "
                            "Create or select the city/region first, then add "
                            "the specific place inside it."
                        )
                    },
                    status=400,
                )

            if name.strip().lower() == city.strip().lower():
                return Response(
                    {
                        "detail": (
                            "Specific place name cannot be the same as the city "
                            "or region name. Use place_type='city' for cities "
                            "and regions."
                        )
                    },
                    status=400,
                )

            destination_name = country

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")
        external_source = (request.data.get("external_source") or "").strip()
        external_id = (request.data.get("external_id") or "").strip()

        destination = Destination.objects.filter(
            name__iexact=destination_name,
            country__iexact=country,
        ).first()

        if not destination:
            destination = Destination.objects.create(
                name=destination_name,
                country=country,
                city="",
            )

        parent_place = None

        if place_type in specific_place_types:
            parent_place = Place.objects.filter(
                destination=destination,
                place_type="city",
                name__iexact=city,
            ).first()

            if not parent_place:
                parent_place = Place.objects.filter(
                    destination=destination,
                    place_type="city",
                    city__iexact=city,
                ).first()

            if not parent_place:
                return Response(
                    {
                        "detail": (
                            "City or region parent place was not found. "
                            "Create or select the city/region first, then add "
                            "the specific place inside it."
                        )
                    },
                    status=400,
                )

        normalized_requested_name = normalize_place_text(name)

        possible_existing_places = Place.objects.filter(
            destination=destination,
            place_type=place_type,
        )

        if parent_place:
            possible_existing_places = possible_existing_places.filter(
                parent_place=parent_place
            )

        existing_place = None

        for candidate in possible_existing_places:
            if normalize_place_text(candidate.name) == normalized_requested_name:
                existing_place = candidate
                break

        if existing_place:
            serializer = PlaceSerializer(
                existing_place,
                context={"request": request},
            )
            return Response(serializer.data, status=200)

        place = Place.objects.create(
            destination=destination,
            name=name,
            place_type=place_type,
            city=city,
            parent_place=parent_place,
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

class PlaceRatingsSummaryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, place_id):
        place = Place.objects.select_related("destination").filter(
            id=place_id
        ).first()

        if not place:
            return Response(
                {"detail": "Place not found."},
                status=404,
            )

        if place.place_type == "city":
            city_name = place.city or place.name

            experiences = Experience.objects.filter(
                Q(place=place)
                | Q(place__parent_place_id=place.id)
                | Q(
                    place__destination_id=place.destination_id,
                    place__city__iexact=city_name,
                )
            ).exclude(
                place__place_type="country"
            ).distinct()
        else:
            experiences = Experience.objects.filter(place=place)

        rated_experiences = experiences.exclude(rating__isnull=True)

        ratings = list(
            rated_experiences.values_list("rating", flat=True)
        )

        if ratings:
            overall_average = round(sum(ratings) / len(ratings), 1)
        else:
            overall_average = None

        distribution = {
            "5": rated_experiences.filter(rating=5).count(),
            "4": rated_experiences.filter(rating=4).count(),
            "3": rated_experiences.filter(rating=3).count(),
            "2": rated_experiences.filter(rating=2).count(),
            "1": rated_experiences.filter(rating=1).count(),
        }

        def practical_stats(field_name):
            values = list(
                experiences
                .exclude(**{f"{field_name}__isnull": True})
                .values_list(field_name, flat=True)
            )

            if not values:
                return {
                    "average": None,
                    "count": 0,
                }

            return {
                "average": round(sum(values) / len(values), 1),
                "count": len(values),
            }

        return Response(
            {
                "place": {
                    "id": place.id,
                    "name": place.name,
                    "place_type": place.place_type,
                    "city": place.city,
                    "destination": place.destination.name if place.destination else "",
                    "destination_country": (
                        place.destination.country if place.destination else ""
                    ),
                },
                "overall": {
                    "average": overall_average,
                    "total_reviews": experiences.count(),
                    "rated_count": rated_experiences.count(),
                    "distribution": distribution,
                },
                "practical": {
                    "safety": practical_stats("safety_rating"),
                    "cost": practical_stats("cost_rating"),
                    "accessibility": practical_stats("accessibility_rating"),
                    "convenience": practical_stats("convenience_rating"),
                },
            }
        )

class PlaceSearchView(APIView):
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        country = (request.query_params.get("country") or "").strip()

        if len(query) < 2:
            return Response(
                {
                    "count": 0,
                    "results": [],
                    "detail": "Type at least 2 characters to search.",
                }
            )

        places = Place.objects.select_related("destination").filter(
            Q(name__icontains=query)
            | Q(city__icontains=query)
            | Q(place_type__icontains=query)
            | Q(destination__name__icontains=query)
            | Q(destination__country__icontains=query)
            | Q(destination__city__icontains=query)
        )

        if country:
            places = places.filter(
                Q(destination__name__iexact=country)
                | Q(destination__country__iexact=country)
            )

        places = places.order_by("place_type", "name")[:20]

        results = []

        for place in places:
            destination = place.destination

            results.append(
                {
                    "id": place.id,
                    "name": place.name,
                    "place_type": place.place_type,
                    "city": place.city,
                    "destination": destination.id if destination else None,
                    "destination_name": destination.name if destination else "",
                    "destination_country": destination.country if destination else "",
                    "destination_city": destination.city if destination else "",
                }
            )

        return Response(
            {
                "count": len(results),
                "results": results,
            }
        )

class CountryContextView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        country_place = Place.objects.select_related("destination").filter(
            pk=pk
        ).first()

        if not country_place:
            return Response(
                {"detail": "Place not found."},
                status=404,
            )

        if country_place.place_type != "country":
            return Response(
                {
                    "detail": "Country context is only available for places with place_type='country'."
                },
                status=400,
            )

        destination = country_place.destination

        child_places = Place.objects.filter(
            destination=destination
        ).exclude(
            id=country_place.id
        ).order_by(
            "place_type",
            "name",
        )

        general_experiences = Experience.objects.filter(
            place=country_place
        ).select_related(
            "user",
            "place",
            "place__destination",
        ).order_by(
            "-created_at"
        )

        child_places_data = []

        for place in child_places:
            child_places_data.append(
                {
                    "id": place.id,
                    "name": place.name,
                    "place_type": place.place_type,
                    "city": place.city,
                    "description": place.description,
                    "image_url": place.image_url,
                    "average_rating": getattr(place, "average_rating", None),
                    "reviews_count": getattr(place, "reviews_count", None),
                    "created_at": place.created_at,
                }
            )

        general_experiences_data = []

        for experience in general_experiences:
            general_experiences_data.append(
                {
                    "id": experience.id,
                    "title": getattr(experience, "title", ""),
                    "comment": getattr(experience, "comment", ""),
                    "rating": getattr(experience, "rating", None),
                    "image_url": getattr(experience, "image_url", ""),
                    "trip_context": getattr(experience, "trip_context", ""),
                    "trip_style": getattr(experience, "trip_style", ""),
                    "created_at": experience.created_at,
                    "user": experience.user.username if experience.user else None,
                    "place_id": country_place.id,
                    "place_name": country_place.name,
                }
            )

        return Response(
            {
                "country_place": {
                    "id": country_place.id,
                    "name": country_place.name,
                    "place_type": country_place.place_type,
                    "city": country_place.city,
                    "description": country_place.description,
                    "image_url": country_place.image_url,
                    "destination_id": destination.id if destination else None,
                    "destination_name": destination.name if destination else "",
                    "destination_country": destination.country if destination else "",
                    "created_at": country_place.created_at,
                },
                "general_experiences": general_experiences_data,
                "child_places": child_places_data,
                "child_places_count": child_places.count(),
                "general_experiences_count": general_experiences.count(),
            }
        )


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

class ExperiencePhotoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExperiencePhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        return ExperiencePhoto.objects.filter(
            experience__user=self.request.user
        )

class PlaceExperiencesListView(generics.ListAPIView):
    serializer_class = ExperienceSerializer

    def get_queryset(self):
        place_id = self.kwargs["place_id"]

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Experience.objects.none()

        base_queryset = Experience.objects.select_related(
            "user",
            "user__profile",
            "place",
            "place__destination",
        )

        # Important product rule:
        # A country page shows only general experiences saved directly to that country.
        # Experiences from cities, regions, hotels, restaurants or attractions inside
        # the country should be reached through related places, not mixed into the
        # country-level experience list.
        if place.place_type == "country":
            return base_queryset.filter(place_id=place_id).order_by("-created_at")

        # City/region pages should show:
        # 1. experiences attached directly to the city/region
        # 2. experiences attached to specific places with this city/region as parent
        # 3. legacy fallback: experiences attached to places with the same destination
        #    and city text, for records created before parent_place existed.
        if place.place_type == "city":
            city_name = place.city or place.name

            return base_queryset.filter(
                Q(place_id=place_id)
                | Q(place__parent_place_id=place.id)
                | Q(
                    place__destination_id=place.destination_id,
                    place__city__iexact=city_name,
                )
            ).exclude(
                place__place_type="country"
            ).distinct().order_by("-created_at")

        # Specific-place pages keep showing only experiences for that exact place.
        return base_queryset.filter(place_id=place_id).order_by("-created_at")

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
    saved_items_count = plan.saved_items.count()
    saved_places_count = plan.saved_places.count()

    return {
        "id": plan.id,
        "title": plan.title,
        "destination_text": plan.destination_text,
        "description": plan.description,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "saved_count": saved_items_count + saved_places_count,
        "saved_items_count": saved_items_count,
        "saved_places_count": saved_places_count,
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

def serialize_saved_place(saved_place, request=None):
    place = saved_place.place
    destination = place.destination if place else None

    related_experiences_count = 0
    related_updates_count = 0

    if place:
        related_experiences_count = Experience.objects.filter(
            place=place
        ).count()

        related_updates_count = Update.objects.filter(
            place=place
        ).exclude(
            type="experience"
        ).count()

    return {
        "id": saved_place.id,
        "trip_plan_id": saved_place.trip_plan.id,
        "place_id": place.id if place else None,
        "name": place.name if place else "",
        "place_type": place.place_type if place else "",
        "city": place.city if place else "",
        "destination": destination.name if destination else "",
        "destination_country": destination.country if destination else "",
        "destination_city": destination.city if destination else "",
        "note": saved_place.note,
        "saved_at": saved_place.created_at,
        "related_experiences_count": related_experiences_count,
        "related_updates_count": related_updates_count,
        "has_related_content": (
            related_experiences_count > 0 or related_updates_count > 0
        ),
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

        saved_places = SavedPlace.objects.filter(
            user=request.user,
            trip_plan=plan,
        ).select_related(
            "place",
            "place__destination",
        ).order_by("-created_at")

        data = serialize_trip_plan(plan)

        data["saved_items"] = [
            serialize_saved_item(item, request)
            for item in saved_items
        ]

        data["saved_places"] = [
            serialize_saved_place(saved_place, request)
            for saved_place in saved_places
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

class TripPlanPlaceView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, place_id):
        try:
            plan = TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return Response({"detail": "Trip plan not found."}, status=404)

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Response({"detail": "Place not found."}, status=404)

        note = (request.data.get("note") or "").strip()

        saved_place, created = SavedPlace.objects.get_or_create(
            user=request.user,
            trip_plan=plan,
            place=place,
            defaults={
                "note": note,
            },
        )

        if not created and note:
            saved_place.note = note
            saved_place.save()

        # Touch the plan so recently used plans rise to the top.
        plan.save()

        return Response(
            {
                "detail": "Place added to trip plan.",
                "saved": True,
                "created": created,
                "place": serialize_saved_place(saved_place, request),
            },
            status=201 if created else 200,
        )

    def delete(self, request, pk, place_id):
        try:
            plan = TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return Response({"detail": "Trip plan not found."}, status=404)

        deleted_count, _ = SavedPlace.objects.filter(
            user=request.user,
            trip_plan=plan,
            place_id=place_id,
        ).delete()

        if deleted_count == 0:
            return Response(
                {
                    "detail": "Place was not in this trip plan.",
                    "saved": False,
                },
                status=404,
            )

        plan.save()

        return Response(
            {
                "detail": "Place removed from trip plan.",
                "saved": False,
            }
        )

class TripPlanWatchedPlaceView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, place_id):
        trip_plan = get_object_or_404(
            TripPlan,
            pk=pk,
            user=request.user,
        )

        place = get_object_or_404(
            Place,
            pk=place_id,
        )

        watched_place, created = TripPlanWatchedPlace.objects.get_or_create(
            user=request.user,
            trip_plan=trip_plan,
            place=place,
        )

        return Response(
            {
                "id": watched_place.id,
                "trip_plan_id": trip_plan.id,
                "place_id": place.id,
                "name": place.name,
                "place_type": place.place_type,
                "city": place.city,
                "destination": place.destination.name if place.destination else "",
                "destination_country": place.destination.country if place.destination else "",
                "created": created,
                "detail": "Place added to Trust Radar watchlist.",
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk, place_id):
        trip_plan = get_object_or_404(
            TripPlan,
            pk=pk,
            user=request.user,
        )

        watched_place = TripPlanWatchedPlace.objects.filter(
            user=request.user,
            trip_plan=trip_plan,
            place_id=place_id,
        ).first()

        if not watched_place:
            return Response(
                {"detail": "This place is not being watched by Trust Radar."},
                status=status.HTTP_404_NOT_FOUND,
            )

        watched_place.delete()

        return Response(
            {"detail": "Place removed from Trust Radar watchlist."},
            status=status.HTTP_200_OK,
        )

class TripPlanRadarView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            plan = TripPlan.objects.get(id=pk, user=request.user)
        except TripPlan.DoesNotExist:
            return Response({"detail": "Trip plan not found."}, status=404)

        destination_text = (plan.destination_text or "").strip()

        saved_experience_ids = list(
            SavedItem.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("experience_id", flat=True)
        )

        saved_place_ids = list(
            SavedPlace.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("place_id", flat=True)
        )

        watched_places = TripPlanWatchedPlace.objects.filter(
            user=request.user,
            trip_plan=plan,
        ).select_related("place", "place__destination")

        watched_place_ids = list(
            watched_places.values_list("place_id", flat=True)
        )

        saved_places = SavedPlace.objects.filter(
            user=request.user,
            trip_plan=plan,
        ).select_related("place", "place__destination")

        saved_place_watch_ids = list(
            saved_places.values_list("place_id", flat=True)
        )

        # ------------------------------------------------------------
        # 1. Preferred mode: explicit Radar watchlist
        # ------------------------------------------------------------
        if watched_place_ids:
            watch_mode = "radar_watchlist"
            query = "Radar watchlist"

            matched_places = Place.objects.filter(
                id__in=watched_place_ids
            ).select_related("destination").order_by("place_type", "name")

        # ------------------------------------------------------------
        # 2. Secondary mode: saved places as automatic watchlist
        # ------------------------------------------------------------
        elif saved_place_watch_ids:
            watch_mode = "saved_places"
            query = "Saved places"

            matched_places = Place.objects.filter(
                id__in=saved_place_watch_ids
            ).select_related("destination").order_by("place_type", "name")

        # ------------------------------------------------------------
        # 3. Final fallback: broad destination search
        # ------------------------------------------------------------
        else:
            watch_mode = "destination_text"
            query = destination_text

            if not destination_text:
                return Response(
                    {
                        "trip_plan": serialize_trip_plan(plan),
                        "query": "",
                        "destination_text": "",
                        "watch_mode": watch_mode,
                        "watched_places_count": 0,
                        "watched_places": [],
                        "related_experiences_count": 0,
                        "related_places_count": 0,
                        "related_updates_count": 0,
                        "has_related_content": False,
                        "related_places": [],
                        "recommended_experiences": [],
                        "related_updates": [],
                        "saved_experience_ids": saved_experience_ids,
                        "saved_place_ids": saved_place_ids,
                        "detail": "This trip plan does not have a destination or watched places yet.",
                    }
                )

            matched_places = Place.objects.filter(
                Q(name__icontains=destination_text)
                | Q(city__icontains=destination_text)
                | Q(destination__name__icontains=destination_text)
                | Q(destination__country__icontains=destination_text)
            ).select_related(
                "destination"
            ).distinct().order_by(
                "place_type",
                "name",
            )

        matched_place_ids = list(matched_places.values_list("id", flat=True))

        recommended_experiences = Experience.objects.filter(
            place_id__in=matched_place_ids
        ).exclude(
            id__in=saved_experience_ids
        ).select_related(
            "place",
            "place__destination",
            "user",
        ).order_by(
            "-created_at"
        )[:20]

        updates = Update.objects.filter(
            place_id__in=matched_place_ids
        ).select_related(
            "place",
            "place__destination",
            "user",
        ).order_by(
            "-created_at"
        )[:20]

        related_places = list(matched_places[:30])

        return Response(
            {
                "trip_plan": serialize_trip_plan(plan),
                "query": query,
                "destination_text": destination_text,
                "watch_mode": watch_mode,
                "watched_places_count": len(watched_place_ids)
                if watched_place_ids
                else len(saved_place_watch_ids),
                "explicit_watched_places_count": len(watched_place_ids),
                "saved_places_count": len(saved_place_ids),
                "watched_places": [
                    {
                        "id": place.id,
                        "name": place.name,
                        "place_type": place.place_type,
                        "city": place.city,
                        "destination_id": place.destination_id,
                        "destination_name": place.destination.name
                        if place.destination
                        else "",
                        "destination_country": place.destination.country
                        if place.destination
                        else "",
                        "is_saved": place.id in saved_place_ids,
                    }
                    for place in related_places
                ],
                "related_experiences_count": recommended_experiences.count()
                if hasattr(recommended_experiences, "count")
                else len(recommended_experiences),
                "related_places_count": len(related_places),
                "related_updates_count": updates.count()
                if hasattr(updates, "count")
                else len(updates),
                "has_related_content": (
                    len(related_places) > 0
                    or len(recommended_experiences) > 0
                    or len(updates) > 0
                ),
                "related_places": [
                    {
                        "id": place.id,
                        "name": place.name,
                        "place_type": place.place_type,
                        "city": place.city,
                        "destination_id": place.destination_id,
                        "destination_name": place.destination.name
                        if place.destination
                        else "",
                        "destination_country": place.destination.country
                        if place.destination
                        else "",
                        "is_saved": place.id in saved_place_ids,
                    }
                    for place in related_places
                ],
                "recommended_experiences": [
                    {
                        "id": experience.id,
                        "title": experience.title,
                        "comment": experience.comment,
                        "rating": experience.rating,
                        "place_id": experience.place_id,
                        "place_name": experience.place.name
                        if experience.place
                        else "",
                        "destination_name": (
                            experience.place.destination.name
                            if experience.place and experience.place.destination
                            else ""
                        ),
                        "destination_country": (
                            experience.place.destination.country
                            if experience.place and experience.place.destination
                            else ""
                        ),
                        "user": experience.user.username
                        if experience.user
                        else "",
                        "created_at": experience.created_at,
                        "is_saved": experience.id in saved_experience_ids,
                    }
                    for experience in recommended_experiences
                ],
                "related_updates": [
                    {
                        "id": update.id,
                        "type": update.type,
                        "category": update.category,
                        "title": update.title,
                        "text": update.text,
                        "priority": update.priority,
                        "event_date": update.event_date,
                        "external_link": update.external_link,
                        "source_name": update.source_name,
                        "source_url": update.source_url,
                        "place_id": update.place_id,
                        "place_name": update.place.name
                        if update.place
                        else "",
                        "destination_name": (
                            update.place.destination.name
                            if update.place and update.place.destination
                            else ""
                        ),
                        "destination_country": (
                            update.place.destination.country
                            if update.place and update.place.destination
                            else ""
                        ),
                        "created_at": update.created_at,
                    }
                    for update in updates
                ],
                "saved_experience_ids": saved_experience_ids,
                "saved_place_ids": saved_place_ids,
            }
        )

class TripPlanActivitySummaryView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = TripPlan.objects.filter(user=request.user)

        plans_with_activity_count = 0
        total_related_count = 0
        total_unsaved_related_count = 0
        plans_activity = []

        for plan in plans:
            seen_record = TripPlanActivitySeen.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).first()

            last_seen_at = seen_record.last_seen_at if seen_record else None

            saved_places = SavedPlace.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).select_related("place", "place__destination")

            watched_places = TripPlanWatchedPlace.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).select_related("place", "place__destination")

            saved_experience_ids = SavedItem.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("experience_id", flat=True)

            saved_place_ids = saved_places.values_list("place_id", flat=True)
            watched_place_ids = watched_places.values_list("place_id", flat=True)

            watched_places_activity = []

            if watched_places.exists():
                watch_mode = "radar_watchlist"

                related_experiences = Experience.objects.filter(
                    place_id__in=watched_place_ids
                )

                related_updates = Update.objects.filter(
                    place_id__in=watched_place_ids
                )

                related_places = Place.objects.filter(
                    id__in=watched_place_ids
                )

                if last_seen_at:
                    related_experiences = related_experiences.filter(
                        created_at__gt=last_seen_at
                    )
                    related_updates = related_updates.filter(
                        created_at__gt=last_seen_at
                    )

                for watched_place in watched_places:
                    place = watched_place.place

                    place_experiences = Experience.objects.filter(
                        place=place
                    ).exclude(
                        id__in=saved_experience_ids
                    )

                    place_updates = Update.objects.filter(place=place)

                    if last_seen_at:
                        place_experiences = place_experiences.filter(
                            created_at__gt=last_seen_at
                        )
                        place_updates = place_updates.filter(
                            created_at__gt=last_seen_at
                        )

                    place_experiences_count = place_experiences.count()
                    place_updates_count = place_updates.count()

                    place_related_count = (
                        place_experiences_count
                        + place_updates_count
                    )

                    watched_places_activity.append(
                        {
                            "id": place.id,
                            "name": place.name,
                            "city": place.city,
                            "place_type": place.place_type,
                            "destination_name": place.destination.name
                            if place.destination
                            else None,
                            "destination_country": place.destination.country
                            if place.destination
                            else None,
                            "unsaved_experiences_count": place_experiences_count,
                            "updates_count": place_updates_count,
                            "related_count": place_related_count,
                            "is_saved_place": place.id in list(saved_place_ids),
                        }
                    )

            elif saved_places.exists():
                watch_mode = "saved_places"

                related_experiences = Experience.objects.filter(
                    place_id__in=saved_place_ids
                )

                related_updates = Update.objects.filter(
                    place_id__in=saved_place_ids
                )

                related_places = Place.objects.filter(
                    id__in=saved_place_ids
                )

                if last_seen_at:
                    related_experiences = related_experiences.filter(
                        created_at__gt=last_seen_at
                    )
                    related_updates = related_updates.filter(
                        created_at__gt=last_seen_at
                    )

                for saved_place in saved_places:
                    place = saved_place.place

                    place_experiences = Experience.objects.filter(
                        place=place
                    ).exclude(
                        id__in=saved_experience_ids
                    )

                    place_updates = Update.objects.filter(place=place)

                    if last_seen_at:
                        place_experiences = place_experiences.filter(
                            created_at__gt=last_seen_at
                        )
                        place_updates = place_updates.filter(
                            created_at__gt=last_seen_at
                        )

                    place_experiences_count = place_experiences.count()
                    place_updates_count = place_updates.count()

                    place_related_count = (
                        place_experiences_count
                        + place_updates_count
                    )

                    watched_places_activity.append(
                        {
                            "id": place.id,
                            "name": place.name,
                            "city": place.city,
                            "place_type": place.place_type,
                            "destination_name": place.destination.name
                            if place.destination
                            else None,
                            "destination_country": place.destination.country
                            if place.destination
                            else None,
                            "unsaved_experiences_count": place_experiences_count,
                            "updates_count": place_updates_count,
                            "related_count": place_related_count,
                            "is_saved_place": True,
                        }
                    )

            else:
                watch_mode = "destination_text"
                query = (plan.destination_text or plan.title or "").strip()

                if not query:
                    continue

                related_experiences = Experience.objects.filter(
                    Q(title__icontains=query)
                    | Q(comment__icontains=query)
                    | Q(place__name__icontains=query)
                    | Q(place__city__icontains=query)
                    | Q(place__destination__name__icontains=query)
                    | Q(place__destination__country__icontains=query)
                    | Q(place__destination__city__icontains=query)
                )

                related_places = Place.objects.filter(
                    Q(name__icontains=query)
                    | Q(city__icontains=query)
                    | Q(destination__name__icontains=query)
                    | Q(destination__country__icontains=query)
                    | Q(destination__city__icontains=query)
                )

                related_updates = Update.objects.filter(
                    Q(title__icontains=query)
                    | Q(text__icontains=query)
                    | Q(category__icontains=query)
                    | Q(place__name__icontains=query)
                    | Q(place__city__icontains=query)
                    | Q(place__destination__name__icontains=query)
                    | Q(place__destination__country__icontains=query)
                    | Q(place__destination__city__icontains=query)
                )

                if last_seen_at:
                    related_experiences = related_experiences.filter(
                        created_at__gt=last_seen_at
                    )
                    related_places = related_places.filter(
                        created_at__gt=last_seen_at
                    )
                    related_updates = related_updates.filter(
                        created_at__gt=last_seen_at
                    )

            related_experiences_count = related_experiences.count()
            related_places_count = related_places.count()
            related_updates_count = related_updates.count()

            unsaved_experiences_count = related_experiences.exclude(
                id__in=saved_experience_ids
            ).count()

            if watched_places.exists() or saved_places.exists():
                unsaved_places_count = 0
            else:
                unsaved_places_count = related_places.exclude(
                    id__in=saved_place_ids
                ).count()

            unsaved_updates_count = related_updates_count

            plan_related_count = (
                related_experiences_count
                + related_places_count
                + related_updates_count
            )

            plan_unsaved_related_count = (
                unsaved_experiences_count
                + unsaved_places_count
                + unsaved_updates_count
            )

            if plan_unsaved_related_count > 0:
                plans_with_activity_count += 1

            total_related_count += plan_related_count
            total_unsaved_related_count += plan_unsaved_related_count

            if plan_related_count > 0 or watched_places.exists():
                plans_activity.append(
                    {
                        "id": plan.id,
                        "title": plan.title,
                        "destination_text": plan.destination_text,
                        "watch_mode": watch_mode,
                        "last_seen_at": last_seen_at,
                        "watched_places_count": watched_places.count()
                        if watched_places.exists()
                        else saved_places.count(),
                        "explicit_watched_places_count": watched_places.count(),
                        "saved_places_count": saved_places.count(),
                        "watched_places": watched_places_activity,
                        "related_count": plan_related_count,
                        "unsaved_related_count": plan_unsaved_related_count,
                        "related_experiences_count": related_experiences_count,
                        "related_places_count": related_places_count,
                        "related_updates_count": related_updates_count,
                        "unsaved_experiences_count": unsaved_experiences_count,
                        "unsaved_places_count": unsaved_places_count,
                        "unsaved_updates_count": unsaved_updates_count,
                    }
                )

        return Response(
            {
                "has_activity": total_unsaved_related_count > 0,
                "plans_with_activity_count": plans_with_activity_count,
                "total_related_count": total_related_count,
                "total_unsaved_related_count": total_unsaved_related_count,
                "plans": plans_activity,
            }
        )


class TripPlanActivitySeenView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plans = TripPlan.objects.filter(user=request.user)
        now = timezone.now()

        marked_count = 0

        for plan in plans:
            TripPlanActivitySeen.objects.update_or_create(
                user=request.user,
                trip_plan=plan,
                defaults={"last_seen_at": now},
            )
            marked_count += 1

        return Response(
            {
                "status": "ok",
                "marked_seen_count": marked_count,
                "last_seen_at": now,
            }
        )

class TripPlanActivityItemsView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = TripPlan.objects.filter(user=request.user)

        activity_items = []

        for plan in plans:
            saved_experience_ids = list(
                SavedItem.objects.filter(
                    user=request.user,
                    trip_plan=plan,
                ).values_list("experience_id", flat=True)
            )

            watched_places = TripPlanWatchedPlace.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).select_related("place", "place__destination")

            saved_places = SavedPlace.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).select_related("place", "place__destination")

            if watched_places.exists():
                watched_place_ids = list(
                    watched_places.values_list("place_id", flat=True)
                )
                watch_mode = "radar_watchlist"

            elif saved_places.exists():
                watched_place_ids = list(
                    saved_places.values_list("place_id", flat=True)
                )
                watch_mode = "saved_places"

            else:
                query = (plan.destination_text or plan.title or "").strip()

                if not query:
                    continue

                watched_place_ids = list(
                    Place.objects.filter(
                        Q(name__icontains=query)
                        | Q(city__icontains=query)
                        | Q(destination__name__icontains=query)
                        | Q(destination__country__icontains=query)
                        | Q(destination__city__icontains=query)
                    ).values_list("id", flat=True)
                )
                watch_mode = "destination_text"

            if not watched_place_ids:
                continue

            experiences = Experience.objects.filter(
                place_id__in=watched_place_ids
            ).exclude(
                id__in=saved_experience_ids
            ).select_related(
                "place",
                "place__destination",
                "user",
            ).order_by(
                "-created_at"
            )

            for experience in experiences:
                place = experience.place
                destination = place.destination if place else None

                activity_items.append(
                    {
                        "type": "experience",
                        "id": experience.id,
                        "title": experience.title
                        or place.name
                        if place
                        else "Experience",
                        "text": experience.comment,
                        "rating": experience.rating,
                        "place_id": place.id if place else None,
                        "place_name": place.name if place else "",
                        "destination_name": destination.name if destination else "",
                        "destination_country": destination.country
                        if destination
                        else "",
                        "trip_plan_id": plan.id,
                        "trip_plan_title": plan.title,
                        "watch_mode": watch_mode,
                        "created_at": experience.created_at,
                        "is_saved": False,
                        "url": f"/places/{place.id}/experiences?highlight={experience.id}&trip_plan={plan.id}&radar=1"
                        if place
                        else f"/experiences/{experience.id}",
                    }
                )

            updates = Update.objects.filter(
                place_id__in=watched_place_ids
            ).select_related(
                "place",
                "place__destination",
                "user",
            ).order_by(
                "-created_at"
            )

            for update in updates:
                place = update.place
                destination = place.destination if place else None

                activity_items.append(
                    {
                        "type": update.type or "update",
                        "category": update.category,
                        "id": update.id,
                        "title": update.title or update.category or "Update",
                        "text": update.text,
                        "priority": update.priority,
                        "event_date": update.event_date,
                        "external_link": update.external_link,
                        "source_name": update.source_name,
                        "source_url": update.source_url,
                        "place_id": place.id if place else None,
                        "place_name": place.name if place else "",
                        "destination_name": destination.name if destination else "",
                        "destination_country": destination.country
                        if destination
                        else "",
                        "trip_plan_id": plan.id,
                        "trip_plan_title": plan.title,
                        "watch_mode": watch_mode,
                        "created_at": update.created_at,
                        "is_saved": False,
                        "url": f"/places/{place.id}/experiences?update={update.id}&trip_plan={plan.id}&radar=1"
                        if place
                        else "",
                    }
                )

        activity_items.sort(
            key=lambda item: item["created_at"],
            reverse=True,
        )

        return Response(
            {
                "count": len(activity_items),
                "items": activity_items[:100],
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

        "author_profession": (
            profile.profession if profile and profile.show_profile_context else ""
        ),

        "author_travel_interests": (
            profile.travel_interests if profile and profile.show_profile_context else ""
        ),

        "author_show_profile_context": (
            profile.show_profile_context if profile else False
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

        if place_type and place_type not in valid_place_types:
            return Response({"detail": "Invalid place_type."}, status=400)

        search_text = query or (plan.destination_text or "").strip()

        saved_experience_ids = set(
            SavedItem.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("experience_id", flat=True)
        )

        saved_place_ids_from_experiences = set(
            SavedItem.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("experience__place_id", flat=True)
        )

        saved_place_ids_direct = set(
            SavedPlace.objects.filter(
                user=request.user,
                trip_plan=plan,
            ).values_list("place_id", flat=True)
        )

        saved_place_ids = saved_place_ids_from_experiences | saved_place_ids_direct

        # ============================================================
        # Suggested experiences
        # ============================================================
        experiences = Experience.objects.select_related(
            "place",
            "place__destination",
            "user",
            "user__profile",
        ).all()

        if search_text:
            experiences = experiences.filter(
                Q(title__icontains=search_text)
                | Q(comment__icontains=search_text)
                | Q(place__name__icontains=search_text)
                | Q(place__city__icontains=search_text)
                | Q(place__destination__name__icontains=search_text)
                | Q(place__destination__country__icontains=search_text)
                | Q(place__destination__city__icontains=search_text)
            )

        if place_type:
            experiences = experiences.filter(place__place_type=place_type)

        experiences = experiences.order_by("-created_at")[:30]

        experience_results = []

        for experience in experiences:
            image_url = None

            if experience.image:
                image_url = request.build_absolute_uri(experience.image.url)

            place = experience.place
            destination = place.destination if place else None

            experience_results.append({
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

        # ============================================================
        # Related places
        # ============================================================
        places = Place.objects.select_related(
            "destination"
        ).all()

        if search_text:
            places = places.filter(
                Q(name__icontains=search_text)
                | Q(city__icontains=search_text)
                | Q(destination__name__icontains=search_text)
                | Q(destination__country__icontains=search_text)
                | Q(destination__city__icontains=search_text)
            )

        if place_type:
            places = places.filter(place_type=place_type)

        places = places.order_by("name")[:30]

        place_results = []

        for place in places:
            destination = place.destination

            place_results.append({
                "place_id": place.id,
                "name": place.name,
                "place_type": place.place_type,
                "city": place.city,
                "destination": destination.name if destination else "",
                "destination_country": destination.country if destination else "",
                "destination_city": destination.city if destination else "",
                "already_saved_place": place.id in saved_place_ids_direct,
                "already_has_saved_experience": place.id in saved_place_ids_from_experiences,
                "already_in_trip_plan": place.id in saved_place_ids,
            })

        return Response({
            "experiences": experience_results,
            "places": place_results,
        })

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
                "safety_rating": experience.safety_rating,
                "cost_rating": experience.cost_rating,
                "accessibility_rating": experience.accessibility_rating,
                "convenience_rating": experience.convenience_rating,
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
# TRUST & SAFETY / CONTENT REPORTS
# ============================================================

class ContentReportListCreateView(generics.ListCreateAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ContentReportSerializer

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        user = self.request.user

        # For now, staff users can review all reports.
        # Regular users only see their own reports.
        if user.is_staff:
            return ContentReport.objects.select_related(
                "reported_by",
                "experience",
                "update",
                "place",
                "reviewed_by",
            ).all()

        return ContentReport.objects.select_related(
            "reported_by",
            "experience",
            "update",
            "place",
            "reviewed_by",
        ).filter(reported_by=user)

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)

class ContentReportDetailView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not request.user.is_staff:
            return Response(
                {"detail": "Only staff users can update reports."},
                status=403,
            )

        try:
            report = ContentReport.objects.get(id=pk)
        except ContentReport.DoesNotExist:
            return Response(
                {"detail": "Report not found."},
                status=404,
            )

        new_status = request.data.get("status")

        valid_statuses = [
            "pending",
            "reviewed",
            "dismissed",
            "action_taken",
        ]

        if new_status not in valid_statuses:
            return Response(
                {"detail": "Invalid report status."},
                status=400,
            )

        report.status = new_status
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save()

        serializer = ContentReportSerializer(
            report,
            context={"request": request},
        )

        return Response(serializer.data)

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