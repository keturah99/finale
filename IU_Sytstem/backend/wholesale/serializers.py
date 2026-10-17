from rest_framework import serializers

from .models import (
    Wholesale,
    WholesaleStockLevel,
    WholesaleStockIn,
    WholesaleStockOut,
    WholesaleDamage,
    InterWholesaleTransfer,
    WeeklySales,
    WeeklySalesCashIn,
    WeeklySalesExpense,
    WeeklySalesDamage,
    PendingCollection,
)


# ---------------------------------------------------------------------------
# Scope validation helper
# ---------------------------------------------------------------------------

def _validate_outlet_scope(value, request):
    """Raise ValidationError if a scoped user targets another outlet."""
    if value is None:
        return value
    user = request.user
    if user.is_superuser or not user.wholesale_id:
        return value
    target_id = getattr(value, 'id', value)
    if str(target_id) != str(user.wholesale_id):
        raise serializers.ValidationError(
            'You can only work with your assigned outlet.'
        )
    return value


# ---------------------------------------------------------------------------
# Finance review mixin — shared fields for reviewable records
# ---------------------------------------------------------------------------

class FinanceReviewFieldsMixin(serializers.Serializer):
    """
    Adds finance review fields to any reviewable model serializer.

    Included fields:
      - finance_status       (current state)
      - finance_reviewed_by_name (who reviewed)
      - finance_reviewed_at  (when)
      - finance_notes        (rejection / query reason)
      - flags                (automated discrepancy list)
      - is_editable          (cashier-side: can the record still be edited?)
    """
    finance_reviewed_by_name = serializers.SerializerMethodField()
    is_editable = serializers.SerializerMethodField()

    def get_finance_reviewed_by_name(self, obj):
        user = getattr(obj, 'finance_reviewed_by', None)
        if not user:
            return None
        return user.get_full_name() or user.username

    def get_is_editable(self, obj):
        """A record is editable by its author when status is queried or rejected."""
        return obj.finance_status in ('queried', 'rejected')

    def _finance_fields(self):
        return [
            'finance_status',
            'finance_reviewed_by',
            'finance_reviewed_by_name',
            'finance_reviewed_at',
            'finance_notes',
            'flags',
            'is_editable',
        ]


# ---------------------------------------------------------------------------
# Wholesale
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Stock levels
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Stock in / out
# ---------------------------------------------------------------------------

class WholesaleStockInSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = WholesaleStockIn
        fields = ['id', 'wholesale', 'product', 'product_name',
                  'quantity', 'unit_value', 'total_value',
                  'stock_from', 'reference', 'notes',
                  'received_by', 'received_at']
        read_only_fields = ['total_value', 'received_by', 'received_at']

    def validate_wholesale(self, value):
        return _validate_outlet_scope(value, self.context['request'])


class WholesaleStockOutSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = WholesaleStockOut
        fields = ['id', 'wholesale', 'product', 'product_name',
                  'weekly_sales', 'quantity', 'unit_value', 'total_value',
                  'notes', 'approved_by', 'issued_at']
        read_only_fields = ['total_value', 'approved_by', 'issued_at']

    def validate_wholesale(self, value):
        return _validate_outlet_scope(value, self.context['request'])


# ---------------------------------------------------------------------------
# Wholesale damage (reviewable)
# ---------------------------------------------------------------------------

class WholesaleDamageSerializer(FinanceReviewFieldsMixin, serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    wholesale_name = serializers.CharField(source='wholesale.name', read_only=True)

    class Meta:
        model = WholesaleDamage
        fields = [
            'id', 'wholesale', 'wholesale_name',
            'product', 'product_name',
            'quantity', 'selling_price', 'total_loss_value',
            'image', 'notes',
            'reported_by', 'reported_at',
            # Finance review fields
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_by_name',
            'finance_reviewed_at', 'finance_notes', 'flags', 'is_editable',
        ]
        read_only_fields = [
            'total_loss_value', 'reported_by', 'reported_at',
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_at',
            'finance_notes', 'flags',
        ]

    def validate_wholesale(self, value):
        return _validate_outlet_scope(value, self.context['request'])

    def validate_image(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Image must be under 5 MB.')
        return value


# ---------------------------------------------------------------------------
# Inter-wholesale transfers
# ---------------------------------------------------------------------------

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

    def validate_from_wholesale(self, value):
        return _validate_outlet_scope(value, self.context['request'])


# ---------------------------------------------------------------------------
# Weekly sales — sub-records (reviewable)
# ---------------------------------------------------------------------------

class WeeklySalesCashInSerializer(FinanceReviewFieldsMixin, serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()
    wholesale_name = serializers.CharField(
        source='weekly_sales.wholesale.name', read_only=True,
    )
    cycle_label = serializers.CharField(
        source='weekly_sales.label', read_only=True,
    )

    class Meta:
        model = WeeklySalesCashIn
        fields = [
            'id', 'weekly_sales', 'cycle_label', 'wholesale_name',
            'amount', 'reference', 'notes',
            'received_by', 'received_by_name', 'received_at',
            # Finance review fields
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_by_name',
            'finance_reviewed_at', 'finance_notes', 'flags', 'is_editable',
        ]
        read_only_fields = [
            'received_by', 'received_at',
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_at',
            'finance_notes', 'flags',
        ]

    def get_received_by_name(self, obj):
        if not obj.received_by:
            return None
        return obj.received_by.get_full_name() or obj.received_by.username


class WeeklySalesExpenseSerializer(FinanceReviewFieldsMixin, serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    wholesale_name = serializers.CharField(
        source='weekly_sales.wholesale.name', read_only=True,
    )
    cycle_label = serializers.CharField(
        source='weekly_sales.label', read_only=True,
    )

    class Meta:
        model = WeeklySalesExpense
        fields = [
            'id', 'weekly_sales', 'cycle_label', 'wholesale_name',
            'amount', 'description',
            'recorded_by', 'recorded_by_name', 'recorded_at',
            # Finance review fields
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_by_name',
            'finance_reviewed_at', 'finance_notes', 'flags', 'is_editable',
        ]
        read_only_fields = [
            'recorded_by', 'recorded_at',
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_at',
            'finance_notes', 'flags',
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username


class WeeklySalesDamageSerializer(FinanceReviewFieldsMixin, serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    wholesale_name = serializers.CharField(
        source='weekly_sales.wholesale.name', read_only=True,
    )
    cycle_label = serializers.CharField(
        source='weekly_sales.label', read_only=True,
    )

    class Meta:
        model = WeeklySalesDamage
        fields = [
            'id', 'weekly_sales', 'cycle_label', 'wholesale_name',
            'product', 'product_name',
            'quantity', 'selling_price', 'total_loss_value',
            'image', 'notes',
            'recorded_by', 'recorded_by_name', 'recorded_at',
            # Finance review fields
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_by_name',
            'finance_reviewed_at', 'finance_notes', 'flags', 'is_editable',
        ]
        read_only_fields = [
            'total_loss_value', 'recorded_by', 'recorded_at',
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_at',
            'finance_notes', 'flags',
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username

    def validate_image(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Image must be under 5 MB.')
        return value


# ---------------------------------------------------------------------------
# Weekly sales — header
# ---------------------------------------------------------------------------

class WeeklySalesSerializer(serializers.ModelSerializer):
    seller_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    wholesale_name = serializers.CharField(source='wholesale.name', read_only=True)

    # Approved totals
    total_cashed = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_expenses = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_damages_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_stock_in_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    net_position = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    # Pending totals
    total_cashed_pending = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_expenses_pending = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_damages_value_pending = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = WeeklySales
        fields = [
            'id', 'wholesale', 'wholesale_name',
            'year', 'week_number', 'label',
            'seller', 'seller_name',
            'received_by', 'received_by_name',
            'start_date', 'end_date',
            'status', 'opened_at', 'closed_at', 'notes',
            'total_stock_in_value',
            'total_cashed', 'total_cashed_pending',
            'total_expenses', 'total_expenses_pending',
            'total_damages_value', 'total_damages_value_pending',
            'net_position',
        ]
        read_only_fields = [
            'year', 'week_number', 'label',
            'opened_at', 'closed_at',
            'total_stock_in_value',
            'total_cashed', 'total_cashed_pending',
            'total_expenses', 'total_expenses_pending',
            'total_damages_value', 'total_damages_value_pending',
            'net_position',
        ]

    def _user_name(self, user):
        if not user:
            return None
        return user.get_full_name() or user.username

    def get_seller_name(self, obj):
        return self._user_name(obj.seller)

    def get_received_by_name(self, obj):
        return self._user_name(obj.received_by)

    def validate_wholesale(self, value):
        return _validate_outlet_scope(value, self.context['request'])

    def validate(self, attrs):
        start = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end = attrs.get('end_date') or getattr(self.instance, 'end_date', None)
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'End date must be on or after start date.'}
            )
        return attrs


# ---------------------------------------------------------------------------
# Pending collections (laybys)
# ---------------------------------------------------------------------------

class PendingCollectionSerializer(serializers.ModelSerializer):
    wholesale_name = serializers.CharField(source='wholesale.name', read_only=True)

    class Meta:
        model = PendingCollection
        fields = [
            'id', 'wholesale', 'wholesale_name',
            'customer_name', 'customer_phone', 'description',
            'total_price', 'amount_paid', 'balance',
            'collection_deadline', 'status',
            'recorded_by', 'created_at',
        ]
        read_only_fields = ['balance', 'recorded_by', 'created_at']

    def validate_wholesale(self, value):
        return _validate_outlet_scope(value, self.context['request'])