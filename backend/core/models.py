from django.db import models
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password, check_password
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
import random
import secrets
import string

def generate_public_code(country_code: str):
    prefix = (country_code or "xx").upper()[:2]

    letters = string.ascii_lowercase
    digits = string.digits

    while True:
        code = (
            prefix
            + random.choice(letters)
            + random.choice(digits)
            + random.choice(digits)
            + random.choice(letters)
        )
        if not Profile.objects.filter(public_code=code).exists():
            return code

def generate_recovery_code():
    alphabet = string.ascii_uppercase + string.digits

    blocks = []

    for _ in range(3):
        block = "".join(secrets.choice(alphabet) for _ in range(4))
        blocks.append(block)

    return "TT-" + "-".join(blocks)

class Profile(models.Model):
    AGE_RANGE_CHOICES = [
        ("prefer_not_to_say", "Prefer not to say"),
        ("18_24", "18–24"),
        ("25_34", "25–34"),
        ("35_44", "35–44"),
        ("45_54", "45–54"),
        ("55_64", "55–64"),
        ("65_plus", "65+"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")

    # Public/pseudonymous identity.
    country_code = models.CharField(max_length=2, default="XX")
    public_code = models.CharField(max_length=6, unique=True, blank=True)
    display_name = models.CharField(max_length=100, blank=True)

    # Optional visible identity detail.
    # This can be shown only if the user allows it and only in the contexts we define.
    nationality = models.CharField(max_length=80, blank=True)
    nationality_country_code = models.CharField(max_length=2, blank=True)
    show_nationality = models.BooleanField(default=False)

    # User avatar/photo.
    # This should only be exposed to trusted connections in the frontend/API logic.
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    # Private/analytics-oriented travel profile.
    # These fields should not be displayed directly on public cards.
    country_of_birth = models.CharField(max_length=80, blank=True)
    country_of_residence = models.CharField(max_length=80, blank=True)

    # Optional professional/contextual profile.
    # These fields can help users interpret travel experiences by human context.
    profession = models.CharField(max_length=120, blank=True)
    travel_interests = models.CharField(max_length=255, blank=True)
    show_profile_context = models.BooleanField(default=False)

    # Private account recovery.
    # The plain recovery code is shown only once after signup.
    # We store only the hash, never the plain code.
    recovery_code_hash = models.CharField(max_length=255, blank=True)
    recovery_code_created_at = models.DateTimeField(null=True, blank=True)

    age_range = models.CharField(
        max_length=30,
        choices=AGE_RANGE_CHOICES,
        default="prefer_not_to_say",
    )


    def set_recovery_code(self, plain_code: str):
        self.recovery_code_hash = make_password(plain_code)
        self.recovery_code_created_at = timezone.now()

    def check_recovery_code(self, plain_code: str):
        if not self.recovery_code_hash:
            return False

        return check_password(plain_code, self.recovery_code_hash)

    def save(self, *args, **kwargs):
        if not self.public_code:
            self.public_code = generate_public_code(self.country_code)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.public_code}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, "profile"):
        instance.profile.save()
# ===================== Destination =====================
class Destination(models.Model):
    name = models.CharField(max_length=150)
    country = models.CharField(max_length=100, blank=True)
    image_url = models.URLField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "country"],
                name="unique_destination_name_country",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.country})" if self.country else self.name


# ===================== Place =====================

class Place(models.Model):
    PLACE_TYPE_CHOICES = [
        ("country", "Country"),
        ("city", "City / Region"),
        ("attraction", "Tourist attraction"),
        ("hotel", "Hotel"),
        ("restaurant", "Restaurant / Café"),
        ("nature", "Beach / Nature spot"),
        ("other", "Other"),
    ]

    destination = models.ForeignKey(Destination, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    # Type of place used for search, filtering and future travel discovery flows.
    # Examples:
    # country -> Laos
    # city -> Recife
    # attraction -> Coliseu
    # hotel -> Hotel X
    # restaurant -> Café Y
    # nature -> Praia de Boa Viagem
    place_type = models.CharField(
        max_length=30,
        choices=PLACE_TYPE_CHOICES,
        default="city",
    )

    city = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)

    # Optional geographic coordinates.
    # These fields prepare the app for maps, photo metadata, and external place lookup.
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    # Optional external reference.
    # Future integrations may use OpenStreetMap, Google Places, Wikidata, etc.
    external_source = models.CharField(max_length=50, blank=True)
    external_id = models.CharField(max_length=255, blank=True)

    # User who first added this place to Trust Travel.
    # This keeps one global place, but preserves community/origin context for future filters.
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_places",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["destination", "name"],
                name="unique_place_name_per_destination",
            )
        ]

    def __str__(self):
        return self.name


# ===================== Update (Feed do app) =====================
class Update(models.Model):
    TYPE_CHOICES = [
        ("event", "Event"),
        ("alert", "Alert"),
        ("info", "Info"),
        ("experience", "Experience"),
    ]

    CATEGORY_CHOICES = [
        ("music", "Music"),
        ("religious", "Religious"),
        ("social", "Social"),
        ("tourism", "Tourism"),
        ("transport", "Transport"),
        ("safety", "Safety"),
        ("weather", "Weather"),
        ("food", "Food"),
        ("culture", "Culture"),
        ("general", "General"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    place = models.ForeignKey(Place, on_delete=models.CASCADE)

    # Optional link to the original experience.
    # Only updates of type "experience" should normally use this field.
    # Event, alert and info updates can keep this as null.
    experience = models.ForeignKey(
        "Experience",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="feed_updates",
    )

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)

    # Kept required for compatibility, but now with more flexible categories.
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default="general",
    )

    # Main structured fields for standalone events, alerts and useful info.
    title = models.CharField(
        max_length=160,
        blank=True,
        help_text="Short title for event, alert or useful information.",
    )

    text = models.TextField()

    # Optional date/time for events, or for alerts/info that refer to a specific time.
    event_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional date/time related to the event, alert or information.",
    )

    # Optional external reference.
    external_link = models.URLField(
        max_length=500,
        blank=True,
        help_text="Optional external link related to the update.",
    )

    source_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional source name, e.g. official website, local authority, venue page.",
    )

    source_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Optional source URL for verification.",
    )

    # Mainly useful for alerts, but can remain optional for all update types.
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default="normal",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        label = self.title or self.text[:40]
        return f"{self.user} - {self.type} - {self.place} - {label}"

# ===================== Experience =====================

class Experience(models.Model):
    TRIP_CONTEXT_CHOICES = [
        ("prefer_not_to_say", "Prefer not to say"),
        ("solo", "Solo traveler"),
        ("couple", "Couple"),
        ("family_children", "Family with children"),
        ("friends_group", "Friends / group"),
        ("business", "Business traveler"),
        ("local_resident", "Local resident"),
        ("retired", "Retired traveler"),
    ]

    TRIP_STYLE_CHOICES = [
        ("prefer_not_to_say", "Prefer not to say"),
        ("culture_museums", "Culture and museums"),
        ("nature_outdoors", "Nature and outdoors"),
        ("food_restaurants", "Food and restaurants"),
        ("relaxed", "Relaxed travel"),
        ("budget", "Budget travel"),
        ("comfort", "Comfort travel"),
        ("adventure", "Adventure"),
        ("local_life", "Local life"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    place = models.ForeignKey(Place, on_delete=models.CASCADE)

    # Short public title for the experience.
    # Used in feeds, cards, previews, and future visual/photo-based layouts.
    title = models.CharField(max_length=160, blank=True)

    # Optional image attached to the experience.
    # This prepares the app for visual cards, place galleries, and future photo-based discovery.
    image = models.ImageField(
        upload_to="experience_images/",
        blank=True,
        null=True,
    )

    rating = models.IntegerField(null=True, blank=True)
    comment = models.TextField()

    # Optional trip-specific context.
    # These fields describe the situation of this specific experience,
    # not the user's permanent profile.
    trip_context = models.CharField(
        max_length=30,
        choices=TRIP_CONTEXT_CHOICES,
        default="prefer_not_to_say",
    )

    trip_style = models.CharField(
        max_length=30,
        choices=TRIP_STYLE_CHOICES,
        default="prefer_not_to_say",
    )

    trust_level = models.IntegerField(default=3)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} - {self.place} - {self.title or 'Experience'}"

# ===================== Experience Photo =====================
class ExperiencePhoto(models.Model):
    experience = models.ForeignKey(
        Experience,
        on_delete=models.CASCADE,
        related_name="photos"
    )

    image = models.ImageField(upload_to="experience_gallery/")
    caption = models.CharField(max_length=160, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo for experience {self.experience_id}"


# ===================== Friendship =====================
class Friendship(models.Model):
    from_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="friendships_sent"
    )
    to_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="friendships_received"
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("accepted", "Accepted"),
            ("rejected", "Rejected"),
        ],
        default="pending"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["from_user", "to_user"],
                name="unique_friendship_pair"
            )
        ]

    def __str__(self):
        return f"{self.from_user} -> {self.to_user}"


# ===================== Experience Reply =====================
class ExperienceReply(models.Model):
    experience = models.ForeignKey(
        Experience,
        on_delete=models.CASCADE,
        related_name="replies"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def reply_to_user(self):
        return self.experience.user.username

    def __str__(self):
        return f"{self.user} → {self.experience}"

# ===================== Trip Plan =====================
class TripPlan(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="trip_plans"
    )

    title = models.CharField(
        max_length=160,
        help_text="Short name for this trip plan, e.g. Thailand 2027 or Weekend in Amsterdam."
    )

    destination_text = models.CharField(
        max_length=160,
        blank=True,
        help_text="Free text destination, e.g. Thailand, Rome, Amsterdam, Northeast Brazil."
    )

    description = models.TextField(blank=True)

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"{self.user} - {self.title}"


# ===================== Saved Place =====================
class SavedPlace(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="saved_places"
    )

    trip_plan = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        related_name="saved_places"
    )

    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name="saved_in_trip_plans"
    )

    note = models.TextField(
        blank=True,
        help_text="Optional private note about why this place was saved."
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["trip_plan", "place"],
                name="unique_place_per_trip_plan"
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} saved place {self.place_id} in plan {self.trip_plan_id}"


# ===================== Trip Plan Activity Seen =====================
class TripPlanActivitySeen(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="trip_plan_activity_seen"
    )

    trip_plan = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        related_name="activity_seen_records"
    )

    last_seen_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "trip_plan"],
                name="unique_trip_plan_activity_seen"
            )
        ]
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"{self.user} saw activity for plan {self.trip_plan_id} at {self.last_seen_at}"

# ===================== Trip Plan Watched Place =====================
class TripPlanWatchedPlace(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="watched_trip_places",
    )

    trip_plan = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        related_name="watched_places",
    )

    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name="trip_plan_watchers",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["trip_plan", "place"],
                name="unique_watched_place_per_trip_plan",
            )
        ]

    def __str__(self):
        return f"{self.place.name} watched in {self.trip_plan.title}"

# ===================== Saved Item =====================
class SavedItem(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="saved_items"
    )

    trip_plan = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        related_name="saved_items",
        null=True,
        blank=True,
    )

    # Version 1: save experiences only inside a trip plan.
    # Later this model can evolve to support saved places, updates,
    # comments, map points, restaurants and personal notes.
    experience = models.ForeignKey(
        Experience,
        on_delete=models.CASCADE,
        related_name="saved_by"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["trip_plan", "experience"],
                name="unique_experience_per_trip_plan"
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} saved experience {self.experience_id} in plan {self.trip_plan_id}"

# ===================== Feed State =====================
class FeedState(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    target_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feed_seen_by"
    )
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "target_user")

# ===================== Seen Update =====================
class SeenUpdate(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="seen_updates"
    )

    update = models.ForeignKey(
        Update,
        on_delete=models.CASCADE,
        related_name="seen_by"
    )

    seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "update")

    def __str__(self):
        return f"{self.user} seen update {self.update_id}"

# ===================== Content Report / Trust & Safety =====================
class ContentReport(models.Model):
    CONTENT_TYPE_CHOICES = [
        ("experience", "Experience"),
        ("update", "Update"),
        ("place", "Place"),
    ]

    REASON_CHOICES = [
        ("misleading_information", "Misleading information"),
        ("unsafe_place", "Unsafe place"),
        ("fake_photo", "Fake photo"),
        ("scam_or_fraud", "Scam or fraud"),
        ("harassment", "Harassment"),
        ("suspicious_behavior", "Suspicious behavior"),
        ("other", "Other"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("reviewed", "Reviewed"),
        ("dismissed", "Dismissed"),
        ("action_taken", "Action taken"),
    ]

    reported_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="content_reports",
    )

    content_type = models.CharField(
        max_length=30,
        choices=CONTENT_TYPE_CHOICES,
    )

    experience = models.ForeignKey(
        Experience,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reports",
    )

    update = models.ForeignKey(
        Update,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reports",
    )

    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reports",
    )

    reason = models.CharField(
        max_length=40,
        choices=REASON_CHOICES,
    )

    comment = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_content_reports",
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "reported_by",
                    "content_type",
                    "experience",
                    "update",
                    "place",
                ],
                name="unique_report_per_user_content",
            )
        ]

    def __str__(self):
        return f"{self.reported_by} reported {self.content_type} - {self.reason}"