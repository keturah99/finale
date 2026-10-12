from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    WholesaleViewSet, WholesaleStockLevelViewSet,
    WholesaleStockInViewSet, WholesaleStockOutViewSet,
    WholesaleDamageViewSet, InterWholesaleTransferViewSet,
    WeeklySalesViewSet, WeeklySalesCashInViewSet,
    WeeklySalesExpenseViewSet, WeeklySalesDamageViewSet,
    PendingCollectionViewSet, WholesaleReportViewSet,
)

router = DefaultRouter()
router.register('wholesales', WholesaleViewSet)
router.register('stock-levels', WholesaleStockLevelViewSet)
router.register('stock-in', WholesaleStockInViewSet)
router.register('stock-out', WholesaleStockOutViewSet)
router.register('damages', WholesaleDamageViewSet)
router.register('transfers', InterWholesaleTransferViewSet)
router.register('weekly-sales', WeeklySalesViewSet)
router.register('cash-ins', WeeklySalesCashInViewSet)
router.register('expenses', WeeklySalesExpenseViewSet)
router.register('weekly-damages', WeeklySalesDamageViewSet)
router.register('collections', PendingCollectionViewSet)
router.register('reports', WholesaleReportViewSet, basename='wholesale-reports')

urlpatterns = [
    path('', include(router.urls)),
]