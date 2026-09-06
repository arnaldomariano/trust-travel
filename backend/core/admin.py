from django.contrib import admin
from .models import Destination, Place, Experience
from .models import Friendship
from .models import ExperienceReply
from .models import Update
from .models import OfficialSource
from .models import OfficialSourceEntry

admin.site.register(Update)


@admin.register(OfficialSource)
class OfficialSourceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "source_type",
        "place",
        "is_verified",
        "updated_at",
    )

    list_filter = (
        "source_type",
        "is_verified",
    )

    search_fields = (
        "name",
        "website_url",
        "place__name",
    )

    ordering = ("name",)


@admin.register(OfficialSourceEntry)
class OfficialSourceEntryAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "official_source",
        "place",
        "status",
        "published_at",
        "discovered_at",
    )

    list_filter = (
        "status",
        "official_source",
        "published_at",
        "discovered_at",
    )

    search_fields = (
        "title",
        "text",
        "external_url",
        "external_id",
        "official_source__name",
        "place__name",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "country", "image_url")


admin.site.register(Place)
admin.site.register(Experience)
admin.site.register(Friendship)
admin.site.register(ExperienceReply)