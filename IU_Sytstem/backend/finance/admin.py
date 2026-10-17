from django.contrib import admin

from .models import FinanceReviewLog


@admin.register(FinanceReviewLog)
class FinanceReviewLogAdmin(admin.ModelAdmin):
    list_display = (
        'created_at', 'action', 'record_type', 'record_id',
        'actor', 'from_status', 'to_status',
    )
    list_filter = ('action', 'record_type', 'created_at')
    search_fields = ('record_type', 'record_id', 'reason')
    readonly_fields = (
        'record_type', 'record_id', 'action', 'actor',
        'reason', 'from_status', 'to_status', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False