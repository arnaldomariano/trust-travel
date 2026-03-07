from django.urls import path
from .views import UserRegisterView, MeView


from .views import (
    DestinationListView,
    PlaceListView,
    ExperienceListView,
    DestinationPlacesListView,
    PlaceExperiencesListView,
    PlaceDetailView,
)

urlpatterns = [
    path("destinations/", DestinationListView.as_view(), name="destination-list"),
    path("places/", PlaceListView.as_view(), name="place-list"),
    path("places/<int:pk>/", PlaceDetailView.as_view(), name="place-detail"),
    path("experiences/", ExperienceListView.as_view(), name="experience-list"),
    path("destinations/<int:destination_id>/places/", DestinationPlacesListView.as_view(), name="destination-places"),
    path("places/<int:place_id>/experiences/", PlaceExperiencesListView.as_view(), name="place-experiences"),
    path("register/", UserRegisterView.as_view(), name="register"),

    path("me/", MeView.as_view(), name="me"),
]