from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, StockMovementViewSet, StockAlertViewSet

router = DefaultRouter()
router.register('products', ProductViewSet)
router.register('movements', StockMovementViewSet)
router.register('alerts', StockAlertViewSet)

urlpatterns = [
    path('', include(router.urls)),
]