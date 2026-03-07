from rest_framework import generics
from .models import Destination, Place, Experience
from .serializers import DestinationSerializer, PlaceSerializer, ExperienceSerializer, UserRegisterSerializer
from rest_framework.generics import RetrieveAPIView
from .models import Place
from .serializers import PlaceSerializer
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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

class UserRegisterView(generics.CreateAPIView):
    serializer_class = UserRegisterSerializer

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "id": request.user.id,
            "username": request.user.username
        })