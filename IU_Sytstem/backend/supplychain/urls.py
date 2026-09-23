from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FarmerViewSet, CropViewSet, ProducePurchaseViewSet,
    ProductionBatchViewSet, PendingCollectionViewSet,
)

router = DefaultRouter()
router.register('farmers', FarmerViewSet)
router.register('crops', CropViewSet)
router.register('purchases', ProducePurchaseViewSet)
router.register('batches', ProductionBatchViewSet)
router.register('collections', PendingCollectionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]