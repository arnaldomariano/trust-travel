from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Destination,
    Place,
    Experience,
    ExperiencePhoto,
    ExperienceReply,
    Friendship,
    Profile,
    Update,
    ContentReport,
    TripPlan,
    SavedItem,
    SavedPlace,
    generate_recovery_code,
)

class UpdateSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    place_name = serializers.CharField(source="place.name", read_only=True)
    city = serializers.CharField(source="place.city", read_only=True)

    class Meta:
        model = Update
        fields = [
            "id",
            "type",
            "category",
            "text",
            "user_name",
            "place_name",
            "city",
            "created_at",
        ]

class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = "__all__"

    def validate(self, attrs):
        name = attrs.get("name")
        country = attrs.get("country")

        if name and country:
            existing_destination = Destination.objects.filter(
                name__iexact=name.strip(),
                country=country,
            )

            if self.instance:
                existing_destination = existing_destination.exclude(pk=self.instance.pk)

            if existing_destination.exists():
                raise serializers.ValidationError(
                    {
                        "name": "A destination with this name already exists for this country."
                    }
                )

        return attrs

class PlaceSerializer(serializers.ModelSerializer):
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True
    )

    destination_name = serializers.CharField(
        source="destination.name",
        read_only=True
    )

    destination_country = serializers.CharField(
        source="destination.country",
        read_only=True
    )

    destination_city = serializers.CharField(
        source="destination.city",
        read_only=True
    )

    class Meta:
        model = Place
        fields = [
            "id",
            "destination",
            "destination_name",
            "destination_country",
            "destination_city",
            "name",
            "place_type",
            "city",
            "description",
            "image_url",
            "latitude",
            "longitude",
            "external_source",
            "external_id",
            "created_by",
            "created_by_username",
            "created_at",
            "average_rating",
            "reviews_count",
        ]
        read_only_fields = [
            "created_by",
            "created_at",
            "created_by_username",
            "average_rating",
            "reviews_count",
            "destination_name",
            "destination_country",
            "destination_city",
        ]

    def validate(self, attrs):
        name = attrs.get("name")
        destination = attrs.get("destination")

        # On updates, if one field is not sent, use the existing value.
        if self.instance:
            name = name or self.instance.name
            destination = destination or self.instance.destination

        if name and destination:
            existing_place = Place.objects.filter(
                destination=destination,
                name__iexact=name.strip(),
            )

            if self.instance:
                existing_place = existing_place.exclude(pk=self.instance.pk)

            if existing_place.exists():
                raise serializers.ValidationError(
                    {
                        "name": "A place with this name already exists for this destination."
                    }
                )

        return attrs

    def get_average_rating(self, obj):
        ratings = obj.experience_set.exclude(
            rating__isnull=True
        ).values_list("rating", flat=True)

        ratings = list(ratings)

        if not ratings:
            return None

        return round(sum(ratings) / len(ratings), 1)

    def get_reviews_count(self, obj):
        return obj.experience_set.count()


class ExperienceSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source="user.username", read_only=True)
    place_name = serializers.CharField(source="place.name", read_only=True)
    destination_name = serializers.CharField(source="place.destination.name", read_only=True)
    trust_level = serializers.SerializerMethodField()
    is_trusted = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    author_nationality = serializers.SerializerMethodField()
    author_nationality_country_code = serializers.SerializerMethodField()

    class Meta:
        model = Experience
        fields = [
            "id",
            "user",
            "author_nationality",
            "author_nationality_country_code",
            "place",
            "place_name",
            "destination_name",
            "title",
            "image",
            "image_url",
            "rating",
            "comment",
            "safety_rating",
            "cost_rating",
            "accessibility_rating",
            "convenience_rating",
            "trip_context",
            "trip_style",
            "created_at",
            "updated_at",
            "trust_level",
            "is_trusted",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")

        if not obj.image:
            return None

        if request:
            return request.build_absolute_uri(obj.image.url)

        return obj.image.url

    def can_show_author_nationality(self, obj):
        profile = getattr(obj.user, "profile", None)

        if not profile or not profile.show_nationality:
            return False

        return True

    def get_author_nationality(self, obj):
        if not self.can_show_author_nationality(obj):
            return ""

        profile = getattr(obj.user, "profile", None)

        if not profile:
            return ""

        return profile.nationality or ""

    def get_author_nationality_country_code(self, obj):
        if not self.can_show_author_nationality(obj):
            return ""

        profile = getattr(obj.user, "profile", None)

        if not profile:
            return ""

        return (profile.nationality_country_code or "").upper()

    def get_is_trusted(self, obj):
        return self.get_trust_level(obj) == 1

    def get_trust_level(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 3

        user = request.user
        author = obj.user

        if user == author:
            return 1

        # nível 1: conexão direta
        direct = Friendship.objects.filter(
            from_user=user,
            to_user=author,
            status="accepted"
        ).exists() or Friendship.objects.filter(
            from_user=author,
            to_user=user,
            status="accepted"
        ).exists()

        if direct:
            return 1

        # nível 2: amigo de amigo

        # amigos diretos (ida)
        friends_forward = Friendship.objects.filter(
            from_user=user
        ).values_list("to_user", flat=True)

        # amigos diretos (volta)
        friends_reverse = Friendship.objects.filter(
            to_user=user
        ).values_list("from_user", flat=True)

        # união dos dois
        all_friends = set(friends_forward) | set(friends_reverse)

        # amigo de amigo (considerando ambos os sentidos)
        friend_of_friend = Friendship.objects.filter(
            from_user__in=all_friends,
            to_user=author
        ).exists() or Friendship.objects.filter(
            from_user=author,
            to_user__in=all_friends
        ).exists()

        if friend_of_friend:
            return 2

        return 3

class ExperiencePhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ExperiencePhoto
        fields = [
            "id",
            "experience",
            "image",
            "image_url",
            "caption",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "experience",
            "image_url",
            "created_at",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")

        if not obj.image:
            return None

        if request:
            return request.build_absolute_uri(obj.image.url)

        return obj.image.url

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    country_code = serializers.CharField(write_only=True, max_length=2)
    email = serializers.EmailField(required=False, allow_blank=True)
    recovery_code = serializers.CharField(read_only=True)

    COUNTRY_LABELS = {
        "BR": "Brazil",
        "PT": "Portugal",
        "NL": "Netherlands",
        "IT": "Italy",
        "US": "United States",
        "GB": "United Kingdom",
        "ES": "Spain",
        "FR": "France",
        "DE": "Germany",
        "MX": "Mexico",
        "CL": "Chile",
        "AR": "Argentina",
        "GR": "Greece",
        "TH": "Thailand",
        "LA": "Laos",
        "BO": "Bolivia",
    }

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "country_code",
            "recovery_code",
        ]

    def create(self, validated_data):
        country_code = validated_data.pop("country_code", "XX")
        country_code = (country_code or "XX").upper()[:2]
        country_label = self.COUNTRY_LABELS.get(country_code, "")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )

        recovery_code = generate_recovery_code()

        profile = user.profile
        profile.country_code = country_code
        profile.public_code = ""

        profile.nationality = country_label
        profile.nationality_country_code = country_code
        profile.country_of_birth = country_label

        # Privacy default: the system knows the country for analytics/public code,
        # but does not show the flag publicly unless the user opts in later.
        profile.show_nationality = False

        # Recovery default: show the plain code once in the register response,
        # but store only the hash in the database.
        profile.set_recovery_code(recovery_code)

        profile.save()

        user.recovery_code = recovery_code

        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)

        recovery_code = getattr(instance, "recovery_code", None)

        if recovery_code:
            data["recovery_code"] = recovery_code

        return data

class ExperienceReplySerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    is_trusted = serializers.SerializerMethodField()
    reply_to_user = serializers.SerializerMethodField()

    class Meta:
        model = ExperienceReply
        fields = [
            "id",
            "user",
            "comment",
            "created_at",
            "is_trusted",
            "reply_to_user",
        ]

    def get_is_trusted(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return Friendship.objects.filter(
            from_user=request.user,
            to_user=obj.user
        ).exists()

    def get_reply_to_user(self, obj):
        if obj.experience and obj.experience.user:
            return obj.experience.user.username
        return None

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "username",

            # Public / trusted identity
            "display_name",
            "country_code",
            "public_code",
            "nationality",
            "nationality_country_code",
            "show_nationality",
            "avatar",
            "avatar_url",

            # Private / analytics-oriented travel profile
            "country_of_birth",
            "country_of_residence",
            "profession",
            "travel_interests",
            "show_profile_context",
            "age_range",
        ]

        read_only_fields = [
            "username",
            "public_code",
            "avatar_url",
        ]

    def get_avatar_url(self, obj):
        request = self.context.get("request")

        if not obj.avatar:
            return None

        if request:
            return request.build_absolute_uri(obj.avatar.url)

        return obj.avatar.url

class ContentReportSerializer(serializers.ModelSerializer):
    reported_by_username = serializers.CharField(
        source="reported_by.username",
        read_only=True,
    )

    experience_title = serializers.CharField(
        source="experience.title",
        read_only=True,
    )

    update_title = serializers.SerializerMethodField()

    place_name = serializers.CharField(
        source="place.name",
        read_only=True,
    )

    content_author = serializers.SerializerMethodField()
    content_place_name = serializers.SerializerMethodField()
    content_created_at = serializers.SerializerMethodField()
    content_text = serializers.SerializerMethodField()

    class Meta:
        model = ContentReport
        fields = [
            "id",
            "reported_by",
            "reported_by_username",
            "content_type",
            "experience",
            "experience_title",
            "update",
            "update_title",
            "place",
            "place_name",

            # Extra moderation context
            "content_author",
            "content_place_name",
            "content_created_at",
            "content_text",

            "reason",
            "comment",
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "reported_by",
            "reported_by_username",
            "experience_title",
            "update_title",
            "place_name",
            "content_author",
            "content_place_name",
            "content_created_at",
            "content_text",
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_at",
        ]

    def get_content_author(self, obj):
        if obj.content_type == "experience" and obj.experience:
            return obj.experience.user.username if obj.experience.user else ""

        if obj.content_type == "update" and obj.update:
            return obj.update.user.username if obj.update.user else ""

        if obj.content_type == "place" and obj.place:
            return obj.place.created_by.username if obj.place.created_by else ""

        return ""

    def get_content_place_name(self, obj):
        if obj.content_type == "experience" and obj.experience:
            return obj.experience.place.name if obj.experience.place else ""

        if obj.content_type == "update" and obj.update:
            return obj.update.place.name if obj.update.place else ""

        if obj.content_type == "place" and obj.place:
            return obj.place.name

        return ""

    def get_content_created_at(self, obj):
        if obj.content_type == "experience" and obj.experience:
            return obj.experience.created_at

        if obj.content_type == "update" and obj.update:
            return obj.update.created_at

        if obj.content_type == "place" and obj.place:
            return obj.place.created_at

        return None

    def get_content_text(self, obj):
        if obj.content_type == "experience" and obj.experience:
            parts = []

            if obj.experience.title:
                parts.append(obj.experience.title)

            if obj.experience.comment:
                parts.append(obj.experience.comment)

            return " — ".join(parts)

        if obj.content_type == "update" and obj.update:
            parts = []

            if obj.update.title:
                parts.append(obj.update.title)

            if obj.update.text:
                parts.append(obj.update.text)

            return " — ".join(parts)

        if obj.content_type == "place" and obj.place:
            return obj.place.description or obj.place.name

        return ""

    def validate(self, attrs):
        content_type = attrs.get("content_type")
        experience = attrs.get("experience")
        update = attrs.get("update")
        place = attrs.get("place")

        selected_targets = [
            bool(experience),
            bool(update),
            bool(place),
        ]

        if selected_targets.count(True) != 1:
            raise serializers.ValidationError(
                "Report must target exactly one content item."
            )

        if content_type == "experience" and not experience:
            raise serializers.ValidationError(
                "Experience report requires an experience."
            )

        if content_type == "update" and not update:
            raise serializers.ValidationError(
                "Update report requires an update."
            )

        if content_type == "place" and not place:
            raise serializers.ValidationError(
                "Place report requires a place."
            )

        request = self.context.get("request")

        if request and request.user and request.user.is_authenticated:
            existing_report = ContentReport.objects.filter(
                reported_by=request.user,
                content_type=content_type,
            )

            if content_type == "experience":
                existing_report = existing_report.filter(experience=experience)

            if content_type == "update":
                existing_report = existing_report.filter(update=update)

            if content_type == "place":
                existing_report = existing_report.filter(place=place)

            if existing_report.exists():
                raise serializers.ValidationError(
                    "You have already reported this content."
                )

        return attrs

class TripPlanSerializer(serializers.ModelSerializer):
    saved_count = serializers.SerializerMethodField()

    class Meta:
        model = TripPlan
        fields = [
            "id",
            "title",
            "destination_text",
            "description",
            "start_date",
            "end_date",
            "saved_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "saved_count",
            "created_at",
            "updated_at",
        ]

    def get_saved_count(self, obj):
        return obj.saved_items.count()

class SavedItemSerializer(serializers.ModelSerializer):
    experience_detail = ExperienceSerializer(
        source="experience",
        read_only=True,
    )

    class Meta:
        model = SavedItem
        fields = [
            "id",
            "trip_plan",
            "experience",
            "experience_detail",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "experience_detail",
        ]

class SavedPlaceSerializer(serializers.ModelSerializer):
    place_detail = PlaceSerializer(
        source="place",
        read_only=True,
    )

    class Meta:
        model = SavedPlace
        fields = [
            "id",
            "trip_plan",
            "place",
            "place_detail",
            "note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "place_detail",
        ]