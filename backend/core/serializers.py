from rest_framework import serializers
from .models import Destination, Place, Experience
from django.contrib.auth.models import User


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = "__all__"


class PlaceSerializer(serializers.ModelSerializer):
    reviews_count = serializers.IntegerField(source="experience_set.count", read_only=True)
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = "__all__"

    def get_average_rating(self, obj):
        experiences = obj.experience_set.all()
        if not experiences.exists():
            return None
        return round(sum(e.rating for e in experiences) / experiences.count(), 1)


class ExperienceSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    class Meta:
        model = Experience
        fields = "__all__"

class UserRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "password", "email"]
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user