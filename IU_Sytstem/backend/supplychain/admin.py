from django.contrib import admin
from .models import (
    Farmer, Crop, ProducePurchase, ProductionBatch, PendingCollection
)


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'location', 'is_active')
    search_fields = ('first_name', 'last_name', 'phone', 'nrc')
    list_filter = ('is_active',)


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit')


@admin.register(ProducePurchase)
class ProducePurchaseAdmin(admin.ModelAdmin):
    list_display = ('farmer', 'crop', 'quantity_kg', 'total_amount',
                    'amount_paid', 'payment_status', 'purchase_date')
    list_filter = ('crop', 'payment_status', 'purchase_date')
    search_fields = ('farmer__first_name', 'farmer__last_name')
    readonly_fields = ('total_amount', 'created_at')


@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ('batch_number', 'raw_material_name', 'raw_material_qty_kg',
                    'finished_product_qty_kg', 'yield_percentage',
                    'status', 'start_date')
    list_filter = ('status', 'start_date')
    search_fields = ('batch_number', 'raw_material_name', 'finished_product_name')
    readonly_fields = ('yield_percentage',)


@admin.register(PendingCollection)
class PendingCollectionAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'total_price', 'amount_paid',
                    'balance', 'status', 'collection_deadline')
    list_filter = ('status', 'collection_deadline')
    search_fields = ('customer_name', 'customer_phone')
    readonly_fields = ('balance',)