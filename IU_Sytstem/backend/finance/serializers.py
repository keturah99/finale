"""
Finance module serializers.

Lightweight serializers used by the finance endpoints for the
audit log and the combined pending queue.
"""

from rest_framework import serializers

from .models import FinanceReviewLog


class FinanceReviewLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = FinanceReviewLog
        fields = [
            'id', 'record_type', 'record_id',
            'action', 'action_display',
            'actor', 'actor_name',
            'reason', 'from_status', 'to_status',
            'created_at',
        ]

    def get_actor_name(self, obj):
        if not obj.actor:
            return None
        return obj.actor.get_full_name() or obj.actor.username


class PendingItemSerializer(serializers.Serializer):
    """
    Shallow, uniform shape for the combined pending queue.

    The same structure is used for cash-ins, expenses, and damages
    so the frontend can render them in one table.
    """
    id = serializers.IntegerField()
    type = serializers.CharField()               # 'cash_in' | 'expense' | 'damage'
    type_display = serializers.CharField()
    reference = serializers.CharField()          # short human-readable identifier
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    wholesale_id = serializers.IntegerField()
    wholesale_name = serializers.CharField()
    submitted_by = serializers.CharField(allow_null=True)
    submitted_at = serializers.DateTimeField()
    finance_status = serializers.CharField()
    flags = serializers.ListField(child=serializers.DictField())
    age_days = serializers.IntegerField()