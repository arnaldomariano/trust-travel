from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import random
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


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    country_code = models.CharField(max_length=2, default="XX")
    public_code = models.CharField(max_length=6, unique=True, blank=True)
    display_name = models.CharField(max_length=100, blank=True)

    # User avatar/photo.
    # This should only be exposed to trusted connections in the frontend/API logic.
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

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

    def __str__(self):
        return f"{self.name} ({self.country})" if self.country else self.name


# ===================== Place =====================

class Place(models.Model):
    destination = models.ForeignKey(Destination, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
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
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    place = models.ForeignKey(Place, on_delete=models.CASCADE)

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)

    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.type} - {self.place}"


# ===================== Experience =====================
class Experience(models.Model):
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