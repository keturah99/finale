from rest_framework import serializers
from .models import SalaryStructure, PayrollRun, PayrollRecord, BankExport


class SalaryStructureSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    gross_monthly = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalaryStructure
        fields = [
            'id', 'employee', 'employee_name',
            'basic_salary', 'housing_allowance', 'transport_allowance',
            'other_allowances', 'gross_monthly',
            'effective_from', 'effective_to', 'is_active', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_employee_name(self, obj):
        return obj.employee.get_full_name() or obj.employee.username


class PayrollRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRecord
        fields = [
            'id', 'employee', 'employee_name',
            'basic_salary', 'housing_allowance', 'transport_allowance',
            'other_allowances', 'gross_salary',
            'napsa_employee', 'nhima_employee', 'paye', 'other_deductions',
            'total_deductions', 'net_salary', 'notes', 'created_at',
        ]
        read_only_fields = [
            'gross_salary', 'napsa_employee', 'nhima_employee',
            'paye', 'total_deductions', 'net_salary', 'created_at',
        ]

    def get_employee_name(self, obj):
        return obj.employee.get_full_name() or obj.employee.username


class PayrollRunSerializer(serializers.ModelSerializer):
    records = PayrollRecordSerializer(many=True, read_only=True)

    class Meta:
        model = PayrollRun
        fields = [
            'id', 'period_label', 'period_start', 'period_end',
            'status', 'processed_by', 'processed_at',
            'notes', 'records', 'created_at',
        ]
        read_only_fields = ['processed_by', 'processed_at', 'created_at']


class BankExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankExport
        fields = [
            'id', 'payroll_run', 'file_name', 'total_amount',
            'employee_count', 'exported_at', 'exported_by',
        ]
        read_only_fields = ['exported_at', 'exported_by']