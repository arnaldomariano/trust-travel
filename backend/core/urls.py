from django.urls import path

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
    UpdateListView,
    ConnectionsListView,
    SendFriendRequestView,
    AcceptFriendRequestView,
    reject_friend_request,
    cancel_friend_request,  # 🔥 AQUI
)

from core.views import (
    ConnectionsListView,
    AcceptFriendRequestView,
    reject_friend_request,
)

urlpatterns = [
    path("connections/", ConnectionsListView.as_view()),
    path("connections/accept/", AcceptFriendRequestView.as_view()),
    path("connections/reject/", reject_friend_request),
]

urlpatterns = [
    path("destinations/", DestinationListView.as_view(), name="destination-list"),
    path("places/", PlaceListView.as_view(), name="place-list"),
    path("places/<int:pk>/", PlaceDetailView.as_view(), name="place-detail"),
    path("experiences/", ExperienceListView.as_view(), name="experience-list"),
    path("destinations/<int:destination_id>/places/", DestinationPlacesListView.as_view(), name="destination-places"),
    path("places/<int:place_id>/experiences/", PlaceExperiencesListView.as_view(), name="place-experiences"),

    path("register/", UserRegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    path("updates/", UpdateListView.as_view(), name="updates"),
    path("connections/", ConnectionsListView.as_view(), name="connections"),

    path(
        "experiences/<int:experience_id>/replies/",
        ExperienceReplyListCreateView.as_view(),
        name="experience-replies",
    ),

    path("friends/send/", SendFriendRequestView.as_view(), name="friend-send"),
    path("friends/accept/", AcceptFriendRequestView.as_view(), name="friend-accept"),
    path("friends/reject/", reject_friend_request),
    path("friends/cancel/", cancel_friend_request),  # 🔥 ESSA LINHA
]