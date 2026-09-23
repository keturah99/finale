from django.db import models
from django.conf import settings


class ReportLog(models.Model):
    """Audit trail of every report generated."""
    REPORT_TYPES = [
        ('inventory_summary', 'Inventory Summary'),
        ('stock_movements', 'Stock Movements'),
        ('low_stock_alerts', 'Low Stock Alerts'),
        ('produce_purchases', 'Produce Purchases'),
        ('production_batches', 'Production Batches'),
        ('pending_collections', 'Pending Collections'),
        ('transport_bookings', 'Transport Bookings'),
        ('vehicle_utilization', 'Vehicle Utilization'),
        ('payroll_summary', 'Payroll Summary'),
        ('bank_export', 'Bank Export'),
        ('executive_dashboard', 'Executive Dashboard'),
    ]
    FORMATS = [
        ('json', 'JSON'),
        ('csv', 'CSV'),
        ('xlsx', 'Excel'),
        ('pdf', 'PDF'),
    ]

    report_type = models.CharField(max_length=40, choices=REPORT_TYPES)
    report_format = models.CharField(max_length=10, choices=FORMATS)
    parameters = models.JSONField(default=dict, blank=True)
    file_name = models.CharField(max_length=200, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL
    )
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.get_report_type_display()} ({self.report_format}) @ {self.generated_at:%Y-%m-%d %H:%M}"