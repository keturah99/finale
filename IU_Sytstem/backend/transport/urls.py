from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VehicleViewSet, DriverViewSet, TransportBookingViewSet,
    LicenseClassViewSet, TrailerViewSet,
)

router = DefaultRouter()
router.register('vehicles', VehicleViewSet)
router.register('drivers', DriverViewSet)
router.register('bookings', TransportBookingViewSet)
router.register('trailers', TrailerViewSet)
router.register('license-classes', LicenseClassViewSet)

urlpatterns = [
    path('', include(router.urls)),
]