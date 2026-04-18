from .views import UpdateListView
from django.urls import path
from .views import reject_friend_request
from .views import (
    DestinationListView,
    PlaceListView,
    ExperienceListView,
    DestinationPlacesListView,
    PlaceExperiencesListView,
    PlaceDetailView,
    UserRegisterView,
    MeView,
    ExperienceReplyListCreateView,

    # 👇 ADICIONE
    SendFriendRequestView,
    AcceptFriendRequestView,
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

    path(
        "experiences/<int:experience_id>/replies/",
        ExperienceReplyListCreateView.as_view(),
        name="experience-replies",
    ),
    path("updates/", UpdateListView.as_view(), name="updates"),
    path("friends/send/", SendFriendRequestView.as_view()),
    path("friends/accept/", AcceptFriendRequestView.as_view()),
    path("friends/accept/", AcceptFriendRequestView.as_view()),
    path("friends/reject/", reject_friend_request),
]