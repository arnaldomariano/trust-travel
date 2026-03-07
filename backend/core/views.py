from rest_framework import generics
from .models import Destination, Place, Experience
from .serializers import DestinationSerializer, PlaceSerializer, ExperienceSerializer

from rest_framework.generics import RetrieveAPIView
from .models import Place
from .serializers import PlaceSerializer


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