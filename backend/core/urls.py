from django.urls import path

from .views import (
    DestinationListView,
    PlaceListView,
    ExperienceListView,
    ExperiencePhotoListCreateView,
    ExperienceDetailView,
    DestinationPlacesListView,
    PlaceExperiencesListView,
    PlaceDetailView,
    UserRegisterView,
    MeView,
    ProfileView,
    ExperienceReplyListCreateView,
    UpdateListView,
    UpdateDetailView,
    ConnectionsListView,
    SendFriendRequestView,
    AcceptFriendRequestView,
    reject_friend_request,
    cancel_friend_request,
    LogoutView,
    MarkUserSeenView,
    remove_friend,
    MyUpdatesView,
    MyExperiencesView,
    PlaceUpdatesListView,
    CreateBasicPlaceView,
    MarkUpdateSeenView,
    PlacePhotosView,
    TopSavedExperiencesAnalyticsView,
    TopSavedPlacesAnalyticsView,
    TripPlanListCreateView,
    TripPlanDetailView,
    TripPlanExperienceView,




)


urlpatterns = [
    path("destinations/", DestinationListView.as_view()),
    path("places/", PlaceListView.as_view()),
    path("places/create-basic/", CreateBasicPlaceView.as_view()),
    path("places/<int:pk>/", PlaceDetailView.as_view()),

    path("places/<int:place_id>/updates/", PlaceUpdatesListView.as_view()),
    path("places/<int:place_id>/photos/", PlacePhotosView.as_view()),
    path("destinations/<int:destination_id>/places/", DestinationPlacesListView.as_view()),
    path("places/<int:place_id>/experiences/", PlaceExperiencesListView.as_view()),

    path("register/", UserRegisterView.as_view()),
    path("updates/", UpdateListView.as_view()),
    path("updates/<int:pk>/", UpdateDetailView.as_view()),
    path("connections/", ConnectionsListView.as_view()),

    path("experiences/", ExperienceListView.as_view()),
    path("experiences/<int:pk>/", ExperienceDetailView.as_view()),
    path("experiences/<int:experience_id>/photos/", ExperiencePhotoListCreateView.as_view()),
    path("experiences/<int:experience_id>/replies/", ExperienceReplyListCreateView.as_view()),

    path("trip-plans/", TripPlanListCreateView.as_view(), name="trip-plans"),
    path("trip-plans/<int:pk>/", TripPlanDetailView.as_view(), name="trip-plan-detail"),
    path(
        "trip-plans/<int:pk>/experiences/<int:experience_id>/",
        TripPlanExperienceView.as_view(),
        name="trip-plan-experience",
    ),

    path("friends/send/", SendFriendRequestView.as_view()),
    path("friends/accept/", AcceptFriendRequestView.as_view()),
    path("friends/reject/", reject_friend_request),
    path("friends/cancel/", cancel_friend_request),
    path("logout/", LogoutView.as_view()),
    path("feed/seen/", MarkUserSeenView.as_view()),
    path("feed/updates/seen/", MarkUpdateSeenView.as_view()),
    path("friends/remove/", remove_friend),
    path("me/", MeView.as_view()),
    path("profile/", ProfileView.as_view()),
    path("my-updates/", MyUpdatesView.as_view(), name="my-updates"),
    path("my-experiences/", MyExperiencesView.as_view(), name="my-experiences"),
    path(
        "analytics/top-saved-experiences/",
        TopSavedExperiencesAnalyticsView.as_view(),
        name="top-saved-experiences-analytics",
    ),
    path(
        "analytics/top-saved-places/",
        TopSavedPlacesAnalyticsView.as_view(),
        name="top-saved-places-analytics",
    ),

]