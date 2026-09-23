from rest_framework import serializers
from .models import Product, StockLevel, StockMovement, StockAlert


class StockLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockLevel
        fields = ['quantity_on_hand', 'last_updated']


class ProductSerializer(serializers.ModelSerializer):
    stock = StockLevelSerializer(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'department', 'category',
            'unit_price', 'reorder_level', 'is_active',
            'stock', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'movement_type', 'quantity',
            'reference', 'notes', 'performed_by', 'created_at',
        ]
        read_only_fields = ['performed_by', 'created_at']


class StockAlertSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = StockAlert
        fields = ['id', 'product', 'product_sku', 'alert_type', 'message',
                  'is_resolved', 'created_at']