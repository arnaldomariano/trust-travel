from django import forms
from django.contrib import admin
from .models import Destination, Place, Experience
from .models import Friendship
from .models import ExperienceReply
from .models import Update
from .models import OfficialSource
from .models import OfficialSourceEntry

from .official_source_services import (
    OfficialSourcePublicationError,
    publish_official_source_entry,
)

@admin.register(Update)
class UpdateAdmin(admin.ModelAdmin):
    actions = None

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.official_source_id:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.official_source_id:
            return False
        return super().has_delete_permission(request, obj)


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


class OfficialSourceEntryAdminForm(forms.ModelForm):
    class Meta:
        model = OfficialSourceEntry
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        status_field = self.fields.get("status")

        if status_field:
            if self.instance.status == "published":
                status_field.disabled = True
            else:
                status_field.choices = [
                    choice
                    for choice in status_field.choices
                    if choice[0] != "published"
                ]


@admin.register(OfficialSourceEntry)
class OfficialSourceEntryAdmin(admin.ModelAdmin):
    form = OfficialSourceEntryAdminForm

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
        "reviewed_by",
        "reviewed_at",
        "resulting_update",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "Source and location",
            {
                "fields": (
                    "official_source",
                    "place",
                    "external_url",
                    "external_id",
                )
            },
        ),
        (
            "Content",
            {
                "fields": (
                    "title",
                    "text",
                    "update_type",
                    "category",
                    "priority",
                    "event_date",
                    "published_at",
                    "discovered_at",
                )
            },
        ),
        (
            "Review and publication",
            {
                "fields": (
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "resulting_update",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    actions = ("publish_selected_entries",)

    @admin.action(description="Publish selected official source entries")
    def publish_selected_entries(self, request, queryset):
        published_count = 0

        for entry in queryset:
            if entry.status != "pending":
                self.message_user(
                    request,
                    f'Could not publish "{entry.title}": '
                    "only pending entries can be published.",
                    level="warning",
                )
                continue

            try:
                publish_official_source_entry(
                    entry_id=entry.id,
                    reviewed_by=request.user,
                )
            except OfficialSourcePublicationError as exc:
                self.message_user(
                    request,
                    f'Could not publish "{entry.title}": {exc}',
                    level="error",
                )
            else:
                published_count += 1

        if published_count:
            self.message_user(
                request,
                f"{published_count} official source entr"
                f"{'y' if published_count == 1 else 'ies'} published.",
                level="success",
            )


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "country", "image_url")


admin.site.register(Place)
admin.site.register(Experience)
admin.site.register(Friendship)
admin.site.register(ExperienceReply)