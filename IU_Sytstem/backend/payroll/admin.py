from django.contrib import admin
from .models import SalaryStructure, PayrollRun, PayrollRecord, BankExport


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ('employee', 'basic_salary', 'housing_allowance',
                    'transport_allowance', 'gross_monthly',
                    'effective_from', 'is_active')
    list_filter = ('is_active', 'effective_from')
    search_fields = ('employee__username', 'employee__first_name', 'employee__last_name')


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ('period_label', 'period_start', 'period_end',
                    'status', 'processed_by', 'processed_at')
    list_filter = ('status', 'period_start')
    search_fields = ('period_label',)
    readonly_fields = ('processed_at', 'created_at')


@admin.register(PayrollRecord)
class PayrollRecordAdmin(admin.ModelAdmin):
    list_display = ('employee', 'payroll_run', 'gross_salary',
                    'total_deductions', 'net_salary')
    list_filter = ('payroll_run',)
    search_fields = ('employee__username', 'employee__first_name', 'employee__last_name')
    readonly_fields = ('gross_salary', 'total_deductions', 'net_salary', 'created_at')


@admin.register(BankExport)
class BankExportAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'payroll_run', 'employee_count',
                    'total_amount', 'exported_at', 'exported_by')
    list_filter = ('exported_at',)
    readonly_fields = ('exported_at',)