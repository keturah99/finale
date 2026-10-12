"""
Wholesale module views with scoping and auditor support.
"""

from datetime import datetime

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import RolePermission
from core.roles import (
    WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER, INVENTORY_MANAGER, AUDITOR,
)
from core.scoping import ScopedViewSetMixin

from .models import (
    Wholesale, WholesaleStockLevel, WholesaleStockIn, WholesaleStockOut,
    WholesaleDamage, InterWholesaleTransfer, WeeklySales,
    WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage,
    PendingCollection,
)
from .serializers import (
    WholesaleSerializer, WholesaleStockLevelSerializer,
    WholesaleStockInSerializer, WholesaleStockOutSerializer,
    WholesaleDamageSerializer, InterWholesaleTransferSerializer,
    WeeklySalesSerializer, WeeklySalesCashInSerializer,
    WeeklySalesExpenseSerializer, WeeklySalesDamageSerializer,
    PendingCollectionSerializer,
)
from .services import (
    approve_transfer, receive_transfer, cancel_transfer,
    close_weekly_sales, close_and_open_next, assert_weekly_sales_open,
)

# ---------------------------------------------------------------------------
# Role groups
# ---------------------------------------------------------------------------

READ_ROLES = [
    WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER, INVENTORY_MANAGER, AUDITOR,
]
MANAGER_ONLY = [WHOLESALE_MANAGER]
MANAGER_OR_CLERK = [WHOLESALE_MANAGER, WHOLESALE_CLERK]


# ---------------------------------------------------------------------------
# Outlets
# ---------------------------------------------------------------------------

class WholesaleViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Wholesale.objects.select_related('manager').all()
    serializer_class = WholesaleSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_ONLY

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and user.wholesale_id:
            qs = qs.filter(pk=user.wholesale_id)
        return qs


# ---------------------------------------------------------------------------
# Stock levels
# ---------------------------------------------------------------------------

class WholesaleStockLevelViewSet(ScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WholesaleStockLevel.objects.select_related('wholesale', 'product').all()
    serializer_class = WholesaleStockLevelSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    wholesale_field = 'wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        p = self.request.query_params.get('product')
        if w:
            qs = qs.filter(wholesale_id=w)
        if p:
            qs = qs.filter(product_id=p)
        return self.scope_queryset(qs, self.request)


# ---------------------------------------------------------------------------
# Stock in
# ---------------------------------------------------------------------------

class WholesaleStockInViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WholesaleStockIn.objects.select_related(
        'wholesale', 'product', 'received_by'
    ).all()
    serializer_class = WholesaleStockInSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK
    wholesale_field = 'wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        p = self.request.query_params.get('product')
        f = self.request.query_params.get('from')
        t = self.request.query_params.get('to')
        if w:
            qs = qs.filter(wholesale_id=w)
        if p:
            qs = qs.filter(product_id=p)
        if f:
            qs = qs.filter(received_at__date__gte=f)
        if t:
            qs = qs.filter(received_at__date__lte=t)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)


# ---------------------------------------------------------------------------
# Stock out
# ---------------------------------------------------------------------------

class WholesaleStockOutViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WholesaleStockOut.objects.select_related(
        'wholesale', 'product', 'approved_by'
    ).all()
    serializer_class = WholesaleStockOutSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_ONLY
    wholesale_field = 'wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        p = self.request.query_params.get('product')
        if w:
            qs = qs.filter(wholesale_id=w)
        if p:
            qs = qs.filter(product_id=p)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        serializer.save(approved_by=self.request.user)


# ---------------------------------------------------------------------------
# Damages
# ---------------------------------------------------------------------------

class WholesaleDamageViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WholesaleDamage.objects.select_related(
        'wholesale', 'product', 'reported_by'
    ).all()
    serializer_class = WholesaleDamageSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK
    wholesale_field = 'wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        if w:
            qs = qs.filter(wholesale_id=w)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------

class InterWholesaleTransferViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = InterWholesaleTransfer.objects.select_related(
        'from_wholesale', 'to_wholesale', 'product',
        'initiated_by', 'approved_by', 'received_by', 'cancelled_by',
    ).all()
    serializer_class = InterWholesaleTransferSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK
    wholesale_or_fields = ('from_wholesale', 'to_wholesale')

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        from_w = self.request.query_params.get('from')
        to_w = self.request.query_params.get('to')
        product = self.request.query_params.get('product')
        if status_param:
            qs = qs.filter(status=status_param)
        if from_w:
            qs = qs.filter(from_wholesale_id=from_w)
        if to_w:
            qs = qs.filter(to_wholesale_id=to_w)
        if product:
            qs = qs.filter(product_id=product)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        serializer.save(initiated_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[RolePermission])
    def approve(self, request, pk=None):
        if not _is_wholesale_manager(request.user):
            return Response(
                {'error': 'Only wholesale managers can approve transfers'},
                status=403,
            )
        transfer = self.get_object()
        try:
            approve_transfer(transfer, request.user)
        except DjangoValidationError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(transfer).data)

    @action(detail=True, methods=['post'], permission_classes=[RolePermission])
    def receive(self, request, pk=None):
        transfer = self.get_object()
        try:
            receive_transfer(transfer, request.user)
        except DjangoValidationError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(transfer).data)

    @action(detail=True, methods=['post'], permission_classes=[RolePermission])
    def cancel(self, request, pk=None):
        if not _is_wholesale_manager(request.user):
            return Response(
                {'error': 'Only wholesale managers can cancel transfers'},
                status=403,
            )
        transfer = self.get_object()
        try:
            cancel_transfer(transfer, request.user)
        except DjangoValidationError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(transfer).data)


# ---------------------------------------------------------------------------
# Weekly sales
# ---------------------------------------------------------------------------

class WeeklySalesViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WeeklySales.objects.select_related(
        'wholesale', 'seller', 'received_by'
    ).all()
    serializer_class = WeeklySalesSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK
    wholesale_field = 'wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        s = self.request.query_params.get('status')
        if w:
            qs = qs.filter(wholesale_id=w)
        if s:
            qs = qs.filter(status=s)
        return self.scope_queryset(qs, self.request)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        ws = self.get_object()
        try:
            close_weekly_sales(ws, request.user)
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=400)
        return Response(self.get_serializer(ws).data)

    @action(detail=True, methods=['post'], url_path='close-and-open-next')
    def close_and_open_next_action(self, request, pk=None):
        ws = self.get_object()
        days = request.data.get('days')
        try:
            new_cycle = close_and_open_next(ws, request.user, days=days)
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=400)
        return Response({
            'closed': self.get_serializer(ws).data,
            'opened': self.get_serializer(new_cycle).data,
        })

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        ws = self.get_object()
        return Response({
            'label': ws.label,
            'wholesale': ws.wholesale.name,
            'status': ws.status,
            'start_date': ws.start_date,
            'end_date': ws.end_date,
            'total_stock_in_value': str(ws.total_stock_in_value),
            'total_cashed': str(ws.total_cashed),
            'total_expenses': str(ws.total_expenses),
            'total_damages_value': str(ws.total_damages_value),
            'net_position': str(ws.net_position),
        })


# ---------------------------------------------------------------------------
# Cash-ins / expenses / weekly damages
# ---------------------------------------------------------------------------

class WeeklySalesCashInViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WeeklySalesCashIn.objects.select_related(
        'weekly_sales', 'received_by'
    ).all()
    serializer_class = WeeklySalesCashInSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = [WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER]
    wholesale_field = 'weekly_sales__wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        ws = self.request.query_params.get('weekly_sales')
        if ws:
            qs = qs.filter(weekly_sales_id=ws)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        ws = serializer.validated_data['weekly_sales']
        assert_weekly_sales_open(ws)
        serializer.save(received_by=self.request.user)


class WeeklySalesExpenseViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WeeklySalesExpense.objects.select_related(
        'weekly_sales', 'recorded_by'
    ).all()
    serializer_class = WeeklySalesExpenseSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK
    wholesale_field = 'weekly_sales__wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        ws = self.request.query_params.get('weekly_sales')
        if ws:
            qs = qs.filter(weekly_sales_id=ws)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        ws = serializer.validated_data['weekly_sales']
        assert_weekly_sales_open(ws)
        serializer.save(recorded_by=self.request.user)


class WeeklySalesDamageViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = WeeklySalesDamage.objects.select_related(
        'weekly_sales', 'product', 'recorded_by'
    ).all()
    serializer_class = WeeklySalesDamageSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK
    wholesale_field = 'weekly_sales__wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        ws = self.request.query_params.get('weekly_sales')
        if ws:
            qs = qs.filter(weekly_sales_id=ws)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        ws = serializer.validated_data['weekly_sales']
        assert_weekly_sales_open(ws)
        serializer.save(recorded_by=self.request.user)


# ---------------------------------------------------------------------------
# Pending collections (laybys)
# ---------------------------------------------------------------------------

class PendingCollectionViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = PendingCollection.objects.select_related(
        'wholesale', 'recorded_by'
    ).all()
    serializer_class = PendingCollectionSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = [WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER]
    wholesale_field = 'wholesale'

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        s = self.request.query_params.get('status')
        if w:
            qs = qs.filter(wholesale_id=w)
        if s:
            qs = qs.filter(status=s)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='mark_collected')
    def mark_collected(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'collected'
        obj.save()
        return Response(self.get_serializer(obj).data)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class WholesaleReportViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]
    read_roles = READ_ROLES

    def list(self, request):
        from .reports import WHOLESALE_REPORT_BUILDERS
        return Response(sorted(WHOLESALE_REPORT_BUILDERS.keys()))

    @action(detail=False, methods=['get'], url_path=r'(?P<report_type>[^/.]+)')
    def generate(self, request, report_type=None):
        from .reports import WHOLESALE_REPORT_BUILDERS
        builder = WHOLESALE_REPORT_BUILDERS.get(report_type)
        if not builder:
            return Response(
                {'error': f'Unknown report type: {report_type}'},
                status=404,
            )

        fmt = request.query_params.get('format', 'json').lower()
        if fmt not in ('json', 'csv', 'xlsx', 'pdf'):
            return Response(
                {'error': 'format must be json, csv, xlsx, or pdf'},
                status=400,
            )

        params = request.query_params.dict()
        params.pop('format', None)

        # Scope the wholesale filter to the user's outlet if applicable
        user = request.user
        if not user.is_superuser and user.wholesale_id:
            params['wholesale'] = user.wholesale_id

        headers, rows = builder(params)

        if fmt == 'json':
            return Response({
                'report': report_type,
                'headers': headers,
                'rows': [[_json_safe(c) for c in row] for row in rows],
                'row_count': len(rows),
            })

        from reporting.services import _rows_to_csv, _rows_to_xlsx, _rows_to_pdf
        title = report_type.replace('_', ' ').title()

        if fmt == 'csv':
            content = _rows_to_csv(headers, rows)
            content_type = 'text/csv'
            ext = 'csv'
        elif fmt == 'xlsx':
            content = _rows_to_xlsx(title, headers, rows)
            content_type = (
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            ext = 'xlsx'
        else:
            content = _rows_to_pdf(title, headers, rows)
            content_type = 'application/pdf'
            ext = 'pdf'

        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{report_type}_{stamp}.{ext}"

        from reporting.models import ReportLog
        ReportLog.objects.create(
            report_type=report_type,
            report_format=fmt,
            parameters=params,
            file_name=filename,
            row_count=len(rows),
            generated_by=request.user if request.user.is_authenticated else None,
        )

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Row-Count'] = str(len(rows))
        return response


def _json_safe(v):
    from decimal import Decimal as D
    from datetime import date, datetime as dt
    if isinstance(v, D):
        return str(v)
    if isinstance(v, (date, dt)):
        return v.isoformat()
    return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_wholesale_manager(user) -> bool:
    return (
        user.is_authenticated
        and (user.is_superuser
             or user.roles.filter(name=WHOLESALE_MANAGER).exists())
    )