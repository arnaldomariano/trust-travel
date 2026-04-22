from django.contrib import admin
from django.urls import path, include

from core.views import CustomTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/", include("core.urls")),  # 🔥 TODAS as rotas da API ficam aqui

    path("api/token/", CustomTokenObtainPairView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
]