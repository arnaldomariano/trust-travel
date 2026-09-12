from django import forms
from django.contrib import admin
from django.contrib.admin.helpers import ActionForm
from django.contrib.auth.models import User
from .models import Destination, Place, Experience
from .models import Friendship
from .models import ExperienceReply
from .models import Update
from .models import OfficialSource
from .models import OfficialSourceEntry
from .models import BusinessPresence
from .models import BusinessClaimRequest
from .models import BusinessPresenceManager

from .official_source_services import (
    OfficialSourcePublicationError,
    publish_official_source_entry,
)

from .business_presence_services import (
    BusinessClaimApprovalError,
    BusinessPresenceManagerStatusError,
    BusinessPresenceManagerCreationError,
    add_business_presence_manager,
    approve_business_claim_request,
    deactivate_business_presence_manager,
    reactivate_business_presence_manager,
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

class BusinessPresenceManagerActionForm(ActionForm):
    manager_user = forms.ModelChoiceField(
        queryset=User.objects.order_by("username"),
        required=False,
        label="Manager user",
    )

    manager_role = forms.CharField(
        max_length=120,
        required=False,
        label="Manager role",
    )

@admin.register(BusinessPresence)
class BusinessPresenceAdmin(admin.ModelAdmin):
    list_display = (
        "place",
        "official_name",
        "status",
        "is_verified",
        "updated_at",
    )

    list_filter = (
        "status",
        "is_verified",
    )

    search_fields = (
        "place__name",
        "official_name",
        "website_url",
    )

    ordering = ("place__name",)

    action_form = BusinessPresenceManagerActionForm
    actions = ["add_business_manager"]

    @admin.action(description="Add business manager")
    def add_business_manager(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                "Select exactly one business presence.",
                level="error",
            )
            return

        manager_user_id = request.POST.get("manager_user")
        manager_role = (request.POST.get("manager_role") or "").strip()

        if not manager_user_id:
            self.message_user(
                request,
                "Choose a manager user.",
                level="error",
            )
            return

        if not manager_role:
            self.message_user(
                request,
                "Enter the manager role.",
                level="error",
            )
            return

        try:
            manager_user = User.objects.get(pk=manager_user_id)
        except User.DoesNotExist:
            self.message_user(
                request,
                "The selected manager user does not exist.",
                level="error",
            )
            return

        business_presence = queryset.first()

        try:
            manager = add_business_presence_manager(
                business_presence=business_presence,
                user=manager_user,
                role=manager_role,
                added_by=request.user,
            )
        except BusinessPresenceManagerCreationError as exc:
            self.message_user(
                request,
                str(exc),
                level="error",
            )
            return

        self.message_user(
            request,
            (
                f"{manager.user.username} was added as "
                f"{manager.role} for {business_presence}."
            ),
            level="success",
        )

@admin.register(BusinessClaimRequest)
class BusinessClaimRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business_presence",
        "requested_by",
        "role",
        "status",
        "reviewed_by",
        "reviewed_at",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "business_presence__place__name",
        "business_presence__official_name",
        "requested_by__username",
        "role",
        "evidence",
    )

    ordering = ("-created_at",)

    readonly_fields = (
        "status",
        "reviewed_by",
        "reviewed_at",
    )

    actions = ["approve_selected_claims"]

    @admin.action(description="Approve selected business claims")
    def approve_selected_claims(self, request, queryset):
        approved_count = 0

        for claim in queryset:
            try:
                approve_business_claim_request(
                    claim_id=claim.id,
                    reviewed_by=request.user,
                )
                approved_count += 1
            except BusinessClaimApprovalError as exc:
                self.message_user(
                    request,
                    f"{claim}: {exc}",
                    level="error",
                )

        if approved_count:
            self.message_user(
                request,
                f"{approved_count} business claim(s) approved.",
                level="success",
            )

@admin.register(BusinessPresenceManager)
class BusinessPresenceManagerAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business_presence",
        "user",
        "role",
        "status",
        "source_claim",
        "added_by",
        "created_at",
        "ended_at",
    )

    list_filter = (
        "status",
        "created_at",
        "ended_at",
    )

    search_fields = (
        "business_presence__place__name",
        "business_presence__official_name",
        "user__username",
        "role",
    )

    ordering = ("-created_at",)

    readonly_fields = (
        "source_claim",
        "added_by",
        "status",
        "created_at",
        "updated_at",
        "ended_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    actions = [
        "deactivate_selected_managers",
        "reactivate_selected_managers",
    ]

    @admin.action(description="Deactivate selected business managers")
    def deactivate_selected_managers(self, request, queryset):
        deactivated_count = 0

        for manager in queryset:
            try:
                deactivate_business_presence_manager(
                    manager_id=manager.id,
                    changed_by=request.user,
                )
                deactivated_count += 1
            except BusinessPresenceManagerStatusError as exc:
                self.message_user(
                    request,
                    f"{manager}: {exc}",
                    level="error",
                )

        if deactivated_count:
            self.message_user(
                request,
                f"{deactivated_count} business manager(s) deactivated.",
                level="success",
            )

    @admin.action(description="Reactivate selected business managers")
    def reactivate_selected_managers(self, request, queryset):
        reactivated_count = 0

        for manager in queryset:
            try:
                reactivate_business_presence_manager(
                    manager_id=manager.id,
                    changed_by=request.user,
                )
                reactivated_count += 1
            except BusinessPresenceManagerStatusError as exc:
                self.message_user(
                    request,
                    f"{manager}: {exc}",
                    level="error",
                )

        if reactivated_count:
            self.message_user(
                request,
                f"{reactivated_count} business manager(s) reactivated.",
                level="success",
            )

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