from django.contrib import admin
from .models import ReportLog


@admin.register(ReportLog)
class ReportLogAdmin(admin.ModelAdmin):
    list_display = ('report_type', 'report_format', 'row_count',
                    'generated_by', 'generated_at')
    list_filter = ('report_type', 'report_format', 'generated_at')
    search_fields = ('file_name',)
    readonly_fields = ('generated_at',)