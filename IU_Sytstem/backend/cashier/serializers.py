"""
Cashier module serializers.

Combined view of the current user's own submissions.
"""

from rest_framework import serializers


class CashierSubmissionSerializer(serializers.Serializer):
    """
    Uniform shape for any submission type (cash-in, expense, damage)
    belonging to the current cashier.
    """
    id = serializers.IntegerField()
    type = serializers.CharField()
    type_display = serializers.CharField()
    reference = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    wholesale_id = serializers.IntegerField()
    wholesale_name = serializers.CharField()
    cycle_label = serializers.CharField()
    submitted_at = serializers.DateTimeField()
    finance_status = serializers.CharField()
    finance_notes = serializers.CharField()
    finance_reviewed_at = serializers.DateTimeField(allow_null=True)
    finance_reviewed_by_name = serializers.CharField(allow_null=True)
    flags = serializers.ListField(child=serializers.DictField())
    is_editable = serializers.BooleanField()