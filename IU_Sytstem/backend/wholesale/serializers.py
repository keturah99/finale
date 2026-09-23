from rest_framework import serializers

from .models import InterWholesaleTransfer
from .models import (
    Wholesale, WholesaleStockLevel,
    WholesaleStockIn, WholesaleStockOut, WholesaleDamage,
)

from .models import (
    WeeklySales, WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage,
)


class WholesaleSerializer(serializers.ModelSerializer):
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Wholesale
        fields = ['id', 'name', 'location', 'manager', 'manager_name',
                  'phone', 'is_active', 'created_at']
        read_only_fields = ['created_at']

    def get_manager_name(self, obj):
        if not obj.manager:
            return None
        return obj.manager.get_full_name() or obj.manager.username


class WholesaleStockLevelSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    total_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )

    class Meta:
        model = WholesaleStockLevel
        fields = ['id', 'wholesale', 'product', 'product_sku', 'product_name',
                  'quantity', 'average_cost', 'total_value', 'last_updated']
        read_only_fields = ['quantity', 'average_cost', 'last_updated']


class WholesaleStockInSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = WholesaleStockIn
        fields = ['id', 'wholesale', 'product', 'product_name',
                  'quantity', 'unit_value', 'total_value',
                  'stock_from', 'reference', 'notes',
                  'received_by', 'received_at']
        read_only_fields = ['total_value', 'received_by', 'received_at']


class WholesaleStockOutSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = WholesaleStockOut
        fields = ['id', 'wholesale', 'product', 'product_name',
                  'quantity', 'unit_value', 'total_value',
                  'notes', 'approved_by', 'issued_at']
        read_only_fields = ['total_value', 'approved_by', 'issued_at']


class WholesaleDamageSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = WholesaleDamage
        fields = ['id', 'wholesale', 'product', 'product_name',
                  'quantity', 'selling_price', 'total_loss_value',
                  'image', 'notes', 'reported_by', 'reported_at']
        read_only_fields = ['total_loss_value', 'reported_by', 'reported_at']

    def validate_image(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Image must be under 5 MB.')
        return value


class InterWholesaleTransferSerializer(serializers.ModelSerializer):
    from_name = serializers.CharField(source='from_wholesale.name', read_only=True)
    to_name = serializers.CharField(source='to_wholesale.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    initiated_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InterWholesaleTransfer
        fields = [
            'id',
            'from_wholesale', 'from_name',
            'to_wholesale', 'to_name',
            'product', 'product_name',
            'quantity', 'unit_value', 'total_value',
            'status', 'reference', 'notes',
            'initiated_by', 'initiated_by_name', 'initiated_at',
            'approved_by', 'approved_by_name', 'approved_at',
            'received_by', 'received_by_name', 'received_at',
            'cancelled_by', 'cancelled_by_name', 'cancelled_at',
        ]
        read_only_fields = [
            'total_value', 'status',
            'initiated_by', 'initiated_at',
            'approved_by', 'approved_at',
            'received_by', 'received_at',
            'cancelled_by', 'cancelled_at',
        ]

    def _user_name(self, user):
        if not user:
            return None
        return user.get_full_name() or user.username

    def get_initiated_by_name(self, obj):
        return self._user_name(obj.initiated_by)

    def get_approved_by_name(self, obj):
        return self._user_name(obj.approved_by)

    def get_received_by_name(self, obj):
        return self._user_name(obj.received_by)

    def get_cancelled_by_name(self, obj):
        return self._user_name(obj.cancelled_by)

class WeeklySalesCashInSerializer(serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WeeklySalesCashIn
        fields = ['id', 'weekly_sales', 'amount', 'reference', 'notes',
                  'received_by', 'received_by_name', 'received_at']
        read_only_fields = ['received_by', 'received_at']

    def get_received_by_name(self, obj):
        if not obj.received_by:
            return None
        return obj.received_by.get_full_name() or obj.received_by.username


class WeeklySalesExpenseSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WeeklySalesExpense
        fields = ['id', 'weekly_sales', 'amount', 'description',
                  'recorded_by', 'recorded_by_name', 'recorded_at']
        read_only_fields = ['recorded_by', 'recorded_at']

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username


class WeeklySalesDamageSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WeeklySalesDamage
        fields = ['id', 'weekly_sales', 'product', 'product_name',
                  'quantity', 'selling_price', 'total_loss_value',
                  'image', 'notes',
                  'recorded_by', 'recorded_by_name', 'recorded_at']
        read_only_fields = ['total_loss_value', 'recorded_by', 'recorded_at']

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username

    def validate_image(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Image must be under 5 MB.')
        return value


class WeeklySalesSerializer(serializers.ModelSerializer):
    seller_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    wholesale_name = serializers.CharField(source='wholesale.name', read_only=True)
    total_cashed = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    total_expenses = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    total_damages_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    total_stock_in_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    net_position = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )

    class Meta:
        model = WeeklySales
        fields = [
            'id', 'wholesale', 'wholesale_name',
            'year', 'week_number', 'label',
            'seller', 'seller_name',
            'received_by', 'received_by_name',
            'start_date', 'end_date',
            'status', 'opened_at', 'closed_at', 'notes',
            'total_stock_in_value', 'total_cashed',
            'total_expenses', 'total_damages_value', 'net_position',
        ]
        read_only_fields = [
            'year', 'week_number', 'label',
            'opened_at', 'closed_at',
            'total_stock_in_value', 'total_cashed',
            'total_expenses', 'total_damages_value', 'net_position',
        ]

    def _user_name(self, user):
        if not user:
            return None
        return user.get_full_name() or user.username

    def get_seller_name(self, obj):
        return self._user_name(obj.seller)

    def get_received_by_name(self, obj):
        return self._user_name(obj.received_by)

    def validate(self, attrs):
        start = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end = attrs.get('end_date') or getattr(self.instance, 'end_date', None)
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'End date must be on or after start date.'}
            )
        return attrs