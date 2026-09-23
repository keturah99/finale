from django.contrib import admin
from .models import Product, StockLevel, StockMovement, StockAlert


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'department', 'unit_price', 'reorder_level', 'is_active')
    list_filter = ('department', 'is_active')
    search_fields = ('sku', 'name')


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ('product', 'quantity_on_hand', 'last_updated')
    search_fields = ('product__sku', 'product__name')


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'movement_type', 'quantity', 'reference', 'created_at')
    list_filter = ('movement_type',)
    search_fields = ('product__sku', 'reference')


@admin.register(StockAlert)
class StockAlertAdmin(admin.ModelAdmin):
    list_display = ('product', 'alert_type', 'is_resolved', 'created_at')
    list_filter = ('alert_type', 'is_resolved')