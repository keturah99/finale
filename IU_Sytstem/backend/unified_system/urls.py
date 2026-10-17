from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/core/', include('core.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/supplychain/', include('supplychain.urls')),
    path('api/transport/', include('transport.urls')),
    path('api/payroll/', include('payroll.urls')),
    path('api/reporting/', include('reporting.urls')),
    path('api/wholesale/', include('wholesale.urls')),
    path('api/finance/', include('finance.urls')),
    path('api/cashier/', include('cashier.urls')),
]