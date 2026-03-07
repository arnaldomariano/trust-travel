from rest_framework import serializers
from .models import Destination, Place, Experience
from django.contrib.auth.models import User


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = "__all__"


class PlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = "__all__"


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