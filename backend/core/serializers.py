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

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "country_code"]

    def create(self, validated_data):
        country_code = validated_data.pop("country_code", "XX")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )

        user.profile.country_code = country_code.upper()[:2]
        user.profile.public_code = ""
        user.profile.save()

        return user


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