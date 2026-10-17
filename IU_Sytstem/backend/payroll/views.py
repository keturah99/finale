from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from core.permissions import RolePermission
from core.roles import PAYROLL_OFFICER

from .models import SalaryStructure, PayrollRun, PayrollRecord, BankExport
from .serializers import (
    SalaryStructureSerializer, PayrollRunSerializer,
    PayrollRecordSerializer, BankExportSerializer,
)
from .services import (
    run_payroll, generate_payslip_pdf, generate_bank_export_csv,
)


# ---------------------------------------------------------------------------
# Salary structures
# ---------------------------------------------------------------------------

class SalaryStructureViewSet(viewsets.ModelViewSet):
    queryset = SalaryStructure.objects.select_related('employee').all()
    serializer_class = SalaryStructureSerializer
    permission_classes = [RolePermission]
    read_roles = [PAYROLL_OFFICER]
    write_roles = [PAYROLL_OFFICER]

    def get_queryset(self):
        qs = super().get_queryset()
        emp = self.request.query_params.get('employee')
        if emp:
            qs = qs.filter(employee_id=emp)
        return qs


# ---------------------------------------------------------------------------
# Payroll runs
# ---------------------------------------------------------------------------

class PayrollRunViewSet(viewsets.ModelViewSet):
    queryset = PayrollRun.objects.all()
    serializer_class = PayrollRunSerializer
    permission_classes = [RolePermission]
    read_roles = [PAYROLL_OFFICER]
    write_roles = [PAYROLL_OFFICER]

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        run = self.get_object()

        if run.status == 'completed':
            return Response(
                {'error': 'Payroll has already been completed for this run'},
                status=400,
            )

        count = run_payroll(run, processed_by=request.user)
        run.refresh_from_db()

        return Response({
            'status': run.status,
            'period_label': run.period_label,
            'records_created': count,
            'processed_at': run.processed_at,
        })

    @action(detail=True, methods=['get'])
    def records(self, request, pk=None):
        run = self.get_object()
        serializer = PayrollRecordSerializer(run.records.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def export_bank(self, request, pk=None):
        run = self.get_object()

        if run.status != 'completed':
            return Response(
                {'error': 'Run payroll before exporting bank file'},
                status=400,
            )

        csv_text = generate_bank_export_csv(run)
        filename = f"bank_export_{run.period_label}.csv".replace(' ', '_')
        total = sum((r.net_salary or 0) for r in run.records.all())

        BankExport.objects.create(
            payroll_run=run,
            file_name=filename,
            total_amount=total,
            employee_count=run.records.count(),
            exported_by=request.user,
        )

        response = HttpResponse(csv_text, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ---------------------------------------------------------------------------
# Payroll records
# ---------------------------------------------------------------------------

class PayrollRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PayrollRecord.objects.select_related(
        'employee', 'payroll_run',
    ).all()
    serializer_class = PayrollRecordSerializer
    permission_classes = [RolePermission]
    read_roles = [PAYROLL_OFFICER]

    @action(
        detail=False,
        methods=['get'],
        url_path='mine',
        permission_classes=[IsAuthenticated],
    )
    def mine(self, request):
        qs = self.get_queryset().filter(employee=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['get'],
        permission_classes=[IsAuthenticated],
    )
    def payslip(self, request, pk=None):
        record = self.get_object()
        user = request.user

        is_officer = user.roles.filter(name=PAYROLL_OFFICER).exists()
        is_owner = record.employee_id == user.id

        if not (user.is_superuser or is_officer or is_owner):
            return Response(
                {'error': 'You may only download your own payslip'},
                status=403,
            )

        pdf = generate_payslip_pdf(record)
        filename = (
            f"payslip_{record.employee.username}_"
            f"{record.payroll_run.period_label}.pdf"
        )
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


# ---------------------------------------------------------------------------
# Bank exports history
# ---------------------------------------------------------------------------

class BankExportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BankExport.objects.select_related(
        'payroll_run', 'exported_by',
    ).all()
    serializer_class = BankExportSerializer
    permission_classes = [RolePermission]
    read_roles = [PAYROLL_OFFICER]

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        Regenerate and download the CSV for a historical bank export.

        Because the source data (the payroll run's records) is still
        available, we rebuild the file on demand rather than storing
        a copy on disk.
        """
        export = self.get_object()
        csv_text = generate_bank_export_csv(export.payroll_run)

        response = HttpResponse(csv_text, content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="{export.file_name}"'
        )
        return response