from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CashInReviewViewSet, ExpenseReviewViewSet,
    WeeklyDamageReviewViewSet, StorageDamageReviewViewSet,
    FinanceReviewLogViewSet,
    pending_queue, bulk_approve, finance_dashboard,
)

router = DefaultRouter()
router.register('cash-ins', CashInReviewViewSet, basename='finance-cash-ins')
router.register('expenses', ExpenseReviewViewSet, basename='finance-expenses')
router.register('weekly-damages', WeeklyDamageReviewViewSet, basename='finance-weekly-damages')
router.register('storage-damages', StorageDamageReviewViewSet, basename='finance-storage-damages')
router.register('audit-log', FinanceReviewLogViewSet, basename='finance-audit-log')

urlpatterns = [
    path('pending/', pending_queue, name='finance-pending'),
    path('bulk-approve/', bulk_approve, name='finance-bulk-approve'),
    path('dashboard/', finance_dashboard, name='finance-dashboard'),
    path('', include(router.urls)),
]