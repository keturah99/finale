from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from core.permissions import RolePermission
from core.roles import PAYROLL_OFFICER

from .models import SalaryStructure, PayrollRun, PayrollRecord, BankExport
from .serializers import (
    SalaryStructureSerializer, PayrollRunSerializer,
    PayrollRecordSerializer, BankExportSerializer,
)
from .services import run_payroll, generate_payslip_pdf, generate_bank_export_csv

from .services import generate_payslip_pdf, run_payroll, generate_bank_export_csv

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
            return Response({'error': 'Payroll already completed'}, status=400)
        count = run_payroll(run, processed_by=request.user)
        return Response({
            'status': 'completed',
            'records_created': count,
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
            return Response({'error': 'Run payroll before exporting'}, status=400)

        csv_text = generate_bank_export_csv(run)
        filename = f"bank_export_{run.period_label}.csv".replace(' ', '_')
        total = sum(r.net_salary for r in run.records.all())

        export = BankExport.objects.create(
            payroll_run=run,
            file_name=filename,
            total_amount=total,
            employee_count=run.records.count(),
            exported_by=request.user,
        )

        response = HttpResponse(csv_text, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Export-Id'] = export.id
        return response


class PayrollRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view over PayrollRecord.

    A payroll officer sees all records.
    Any authenticated user can fetch their own via the `mine` action.
    """
    queryset = PayrollRecord.objects.select_related(
        'employee', 'payroll_run'
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
        """Return only the records belonging to the current user."""
        qs = self.get_queryset().filter(employee=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['get'],
        permission_classes=[IsAuthenticated],
    )
    def payslip(self, request, pk=None):
        """Download a PDF payslip for a single record."""
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


class BankExportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BankExport.objects.all()
    serializer_class = BankExportSerializer
    permission_classes = [RolePermission]
    read_roles = [PAYROLL_OFFICER]