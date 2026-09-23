from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView  # type: ignore
from .views import UserViewSet, DepartmentViewSet, RoleViewSet

router = DefaultRouter()
router.register('users', UserViewSet)
router.register('departments', DepartmentViewSet)
router.register('roles', RoleViewSet)

urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]