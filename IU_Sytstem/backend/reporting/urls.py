from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import dashboard, report_list, generate_report, ReportLogViewSet

router = DefaultRouter()
router.register('logs', ReportLogViewSet)

urlpatterns = [
    path('dashboard/', dashboard, name='dashboard'),
    path('available/', report_list, name='report_list'),
    path('generate/<str:report_type>/', generate_report, name='generate_report'),
    path('', include(router.urls)),
]