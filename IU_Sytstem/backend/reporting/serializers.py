from rest_framework import serializers
from .models import ReportLog


class ReportLogSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ReportLog
        fields = [
            'id', 'report_type', 'report_format', 'parameters',
            'file_name', 'row_count', 'generated_by',
            'generated_by_name', 'generated_at',
        ]
        read_only_fields = ['generated_at']

    def get_generated_by_name(self, obj):
        if not obj.generated_by:
            return None
        return obj.generated_by.get_full_name() or obj.generated_by.username