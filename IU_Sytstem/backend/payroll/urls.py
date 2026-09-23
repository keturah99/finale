from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SalaryStructureViewSet, PayrollRunViewSet,
    PayrollRecordViewSet, BankExportViewSet,
)

router = DefaultRouter()
router.register('salaries', SalaryStructureViewSet)
router.register('runs', PayrollRunViewSet)
router.register('records', PayrollRecordViewSet)
router.register('bank-exports', BankExportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]