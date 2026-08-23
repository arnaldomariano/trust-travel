from django.urls import path

from .views import (
    DestinationListView,
    CountryCatalogView,
    PlaceListView,
    PlaceLocationSuggestionCreateView,
    PlaceLocationSuggestionListView,
    ExperienceListView,
    PlaceRatingsSummaryView,
    ExperiencePhotoListCreateView,
    ExperienceDetailView,
    ExperiencePhotoDetailView,
    DestinationPlacesListView,
    PlaceExperiencesListView,
    PlaceDetailView,
    PlaceSearchView,
    CountryContextView,
    UserRegisterView,
    RecoverPasswordView,
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
    TopSavedDestinationsAnalyticsView,
    TripPlanListCreateView,
    TripPlanDetailView,
    TripPlanExperienceView,
    TripPlanPlaceView,
    TripPlanSuggestionsView,
    TripPlanRadarView,
    TripPlanRadarPlaceSearchView,
    TripPlanWatchedPlaceView,
    SummaryAnalyticsView,
    PlannerCountriesAnalyticsView,
    ContentReportListCreateView,
    ContentReportDetailView,
    TripPlanActivitySummaryView,
    TripPlanActivityItemsView,
    TripPlanActivitySeenView,
)


urlpatterns = [
    path("destinations/", DestinationListView.as_view()),
    path("countries/", CountryCatalogView.as_view()),
    path("places/", PlaceListView.as_view()),
    path("places/search/", PlaceSearchView.as_view()),
    path("places/create-basic/", CreateBasicPlaceView.as_view()),
    path("places/<int:pk>/country-context/", CountryContextView.as_view()),

    path(
        "place-location-suggestions/",
        PlaceLocationSuggestionCreateView.as_view(),
    ),
    path(
        "places/<int:place_id>/location-suggestions/",
        PlaceLocationSuggestionListView.as_view(),
    ),

    path(
        "places/<int:place_id>/ratings-summary/",
        PlaceRatingsSummaryView.as_view(),
        name="place-ratings-summary",
    ),

    path("places/<int:pk>/", PlaceDetailView.as_view()),

    path("places/<int:place_id>/updates/", PlaceUpdatesListView.as_view()),
    path("places/<int:place_id>/photos/", PlacePhotosView.as_view()),
    path("destinations/<int:destination_id>/places/", DestinationPlacesListView.as_view()),
    path("places/<int:place_id>/experiences/", PlaceExperiencesListView.as_view()),


    path("register/", UserRegisterView.as_view()),
    path("recover-password/", RecoverPasswordView.as_view()),
    path("updates/", UpdateListView.as_view()),
    path("updates/<int:pk>/", UpdateDetailView.as_view()),
    path("connections/", ConnectionsListView.as_view()),

    path("experiences/", ExperienceListView.as_view()),
    path("experiences/<int:pk>/", ExperienceDetailView.as_view()),
    path("experiences/<int:experience_id>/photos/", ExperiencePhotoListCreateView.as_view()),
    path("experience-photos/<int:pk>/", ExperiencePhotoDetailView.as_view()),
    path("experiences/<int:experience_id>/replies/", ExperienceReplyListCreateView.as_view()),

    path("trip-plans/", TripPlanListCreateView.as_view()),
    path("trip-plans/<int:pk>/", TripPlanDetailView.as_view()),
    path(
        "trip-plans/<int:pk>/radar-place-search/",
        TripPlanRadarPlaceSearchView.as_view(),
        name="trip-plan-radar-place-search",
    ),
    path(
        "trip-plans/<int:pk>/experiences/<int:experience_id>/",
        TripPlanExperienceView.as_view(),
    ),

    path(
        "trip-plans/activity/",
        TripPlanActivitySummaryView.as_view(),
        name="trip-plan-activity-summary",
    ),

    path(
        "trip-plans/activity/items/",
        TripPlanActivityItemsView.as_view(),
        name="trip-plan-activity-items",
    ),

    path(
        "trip-plans/activity/seen/",
        TripPlanActivitySeenView.as_view(),
        name="trip-plan-activity-seen",
    ),

    path(
        "trip-plans/<int:pk>/places/<int:place_id>/",
        TripPlanPlaceView.as_view(),
    ),

    path(
        "trip-plans/<int:pk>/watched-places/<int:place_id>/",
        TripPlanWatchedPlaceView.as_view(),
    ),

    path(
        "trip-plans/<int:pk>/suggestions/",
        TripPlanSuggestionsView.as_view(),
        name="trip-plan-suggestions",
    ),

    path("trip-plans/<int:pk>/radar/", TripPlanRadarView.as_view(), name="trip-plan-radar"),

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
    path("reports/", ContentReportListCreateView.as_view(), name="content-reports"),
    path("reports/<int:pk>/", ContentReportDetailView.as_view(), name="content-report-detail"),
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

    path(
        "analytics/top-saved-destinations/",
        TopSavedDestinationsAnalyticsView.as_view(),
        name="top-saved-destinations-analytics",
    ),

    path(
        "analytics/summary/",
        SummaryAnalyticsView.as_view(),
        name="summary-analytics",
    ),

    path(
        "analytics/planner-countries/",
        PlannerCountriesAnalyticsView.as_view(),
        name="analytics-planner-countries",
    ),

]