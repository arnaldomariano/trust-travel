from django.contrib import admin
from .models import Destination, Place, Experience
from .models import Friendship
from .models import ExperienceReply
from .models import Update
from .models import OfficialSource

admin.site.register(Update)
admin.site.register(OfficialSource)

@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "country", "image_url")


admin.site.register(Place)
admin.site.register(Experience)
admin.site.register(Friendship)
admin.site.register(ExperienceReply)