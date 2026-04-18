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
    rating = models.IntegerField(null=True, blank=True)
    comment = models.TextField()
    trust_level = models.IntegerField(default=3)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} - {self.place}"


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