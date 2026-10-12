from rest_framework import serializers
from .models import Farmer, Crop, ProducePurchase, ProductionBatch


# ---------------------------------------------------------------------------
# Farmer
# ---------------------------------------------------------------------------

class FarmerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Farmer
        fields = ['id', 'first_name', 'last_name', 'full_name',
                  'phone', 'nrc', 'location', 'notes', 'is_active', 'created_at']
        read_only_fields = ['created_at']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


# ---------------------------------------------------------------------------
# Crop
# ---------------------------------------------------------------------------

class CropSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='get_name_display', read_only=True)

    class Meta:
        model = Crop
        fields = ['id', 'name', 'display_name', 'unit']


# ---------------------------------------------------------------------------
# Produce purchase
# ---------------------------------------------------------------------------

class ProducePurchaseSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source='farmer.__str__', read_only=True)
    crop_display = serializers.CharField(source='crop.get_name_display', read_only=True)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ProducePurchase
        fields = [
            'id', 'farmer', 'farmer_name', 'crop', 'crop_display',
            'quantity_kg', 'price_per_kg', 'total_amount', 'amount_paid',
            'balance', 'payment_status', 'purchase_date',
            'recorded_by', 'created_at',
        ]
        read_only_fields = ['total_amount', 'payment_status', 'recorded_by', 'created_at']


# ---------------------------------------------------------------------------
# Production batch
# ---------------------------------------------------------------------------

class ProductionBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionBatch
        fields = [
            'id', 'batch_number', 'raw_material_name', 'raw_material_qty_kg',
            'finished_product_name', 'finished_product_qty_kg',
            'yield_percentage', 'start_date', 'completion_date',
            'status', 'notes', 'created_at',
        ]
        read_only_fields = ['yield_percentage', 'created_at']