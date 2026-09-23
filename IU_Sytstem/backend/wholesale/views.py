from rest_framework import viewsets
from rest_framework.response import Response

from core.permissions import RolePermission
from core.roles import (
    WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER, INVENTORY_MANAGER,
)

from .models import (
    Wholesale, WholesaleStockLevel,
    WholesaleStockIn, WholesaleStockOut, WholesaleDamage, InterWholesaleTransfer
)
from .serializers import (
    WholesaleSerializer, WholesaleStockLevelSerializer,
    WholesaleStockInSerializer, WholesaleStockOutSerializer,
    WholesaleDamageSerializer, InterWholesaleTransferSerializer,
)

from rest_framework.decorators import action
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    WeeklySales, WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage,
)
from .serializers import (
    WeeklySalesSerializer,
    WeeklySalesCashInSerializer,
    WeeklySalesExpenseSerializer,
    WeeklySalesDamageSerializer,
)
from .services import (
    close_weekly_sales, close_and_open_next, assert_weekly_sales_open,
)

READ_ROLES = [
    WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER, INVENTORY_MANAGER,
]
MANAGER_ONLY = [WHOLESALE_MANAGER]
MANAGER_OR_CLERK = [WHOLESALE_MANAGER, WHOLESALE_CLERK]


# ---------------------------------------------------------------------------
# Outlets
# ---------------------------------------------------------------------------

class WholesaleViewSet(viewsets.ModelViewSet):
    queryset = Wholesale.objects.select_related('manager').all()
    serializer_class = WholesaleSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_ONLY


# ---------------------------------------------------------------------------
# Stock levels (read-mostly)
# ---------------------------------------------------------------------------

class WholesaleStockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WholesaleStockLevel.objects.select_related(
        'wholesale', 'product',
    ).all()
    serializer_class = WholesaleStockLevelSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        p = self.request.query_params.get('product')
        if w:
            qs = qs.filter(wholesale_id=w)
        if p:
            qs = qs.filter(product_id=p)
        return qs


# ---------------------------------------------------------------------------
# Stock in
# ---------------------------------------------------------------------------

class WholesaleStockInViewSet(viewsets.ModelViewSet):
    queryset = WholesaleStockIn.objects.select_related(
        'wholesale', 'product', 'received_by',
    ).all()
    serializer_class = WholesaleStockInSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK

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
        return qs

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)


# ---------------------------------------------------------------------------
# Stock out
# ---------------------------------------------------------------------------

class WholesaleStockOutViewSet(viewsets.ModelViewSet):
    queryset = WholesaleStockOut.objects.select_related(
        'wholesale', 'product', 'approved_by',
    ).all()
    serializer_class = WholesaleStockOutSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_ONLY

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        p = self.request.query_params.get('product')
        if w:
            qs = qs.filter(wholesale_id=w)
        if p:
            qs = qs.filter(product_id=p)
        return qs

    def perform_create(self, serializer):
        serializer.save(approved_by=self.request.user)


# ---------------------------------------------------------------------------
# Damages
# ---------------------------------------------------------------------------

class WholesaleDamageViewSet(viewsets.ModelViewSet):
    queryset = WholesaleDamage.objects.select_related(
        'wholesale', 'product', 'reported_by',
    ).all()
    serializer_class = WholesaleDamageSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        if w:
            qs = qs.filter(wholesale_id=w)
        return qs

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)


class InterWholesaleTransferViewSet(viewsets.ModelViewSet):
    queryset = InterWholesaleTransfer.objects.select_related(
        'from_wholesale', 'to_wholesale', 'product',
        'initiated_by', 'approved_by', 'received_by', 'cancelled_by',
    ).all()
    serializer_class = InterWholesaleTransferSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK

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
        return qs

    def perform_create(self, serializer):
        serializer.save(initiated_by=self.request.user)

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'],
            permission_classes=[RolePermission])
    def approve(self, request, pk=None):
        """pending -> in_transit. Managers only."""
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

    @action(detail=True, methods=['post'],
            permission_classes=[RolePermission])
    def receive(self, request, pk=None):
        """in_transit -> received. Manager or clerk."""
        transfer = self.get_object()
        try:
            receive_transfer(transfer, request.user)
        except DjangoValidationError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(transfer).data)

    @action(detail=True, methods=['post'],
            permission_classes=[RolePermission])
    def cancel(self, request, pk=None):
        """pending or in_transit -> cancelled. Managers only."""
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


def _is_wholesale_manager(user) -> bool:
    return (
        user.is_authenticated
        and (user.is_superuser
             or user.roles.filter(name=WHOLESALE_MANAGER).exists())
    )


# ---------------------------------------------------------------------------
# Weekly sales
# ---------------------------------------------------------------------------

class WeeklySalesViewSet(viewsets.ModelViewSet):
    queryset = WeeklySales.objects.select_related(
        'wholesale', 'seller', 'received_by',
    ).all()
    serializer_class = WeeklySalesSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK

    def get_queryset(self):
        qs = super().get_queryset()
        w = self.request.query_params.get('wholesale')
        status_param = self.request.query_params.get('status')
        if w:
            qs = qs.filter(wholesale_id=w)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a weekly sales cycle."""
        ws = self.get_object()
        try:
            close_weekly_sales(ws, request.user)
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=400)
        return Response(self.get_serializer(ws).data)

    @action(detail=True, methods=['post'], url_path='close-and-open-next')
    def close_and_open_next_action(self, request, pk=None):
        """Close this cycle and open the next one at the same wholesale."""
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
        """Return the financial summary for this cycle."""
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


class WeeklySalesCashInViewSet(viewsets.ModelViewSet):
    queryset = WeeklySalesCashIn.objects.select_related(
        'weekly_sales', 'received_by',
    ).all()
    serializer_class = WeeklySalesCashInSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = [WHOLESALE_MANAGER, WHOLESALE_CLERK, CASHIER]

    def get_queryset(self):
        qs = super().get_queryset()
        ws = self.request.query_params.get('weekly_sales')
        if ws:
            qs = qs.filter(weekly_sales_id=ws)
        return qs

    def perform_create(self, serializer):
        ws = serializer.validated_data['weekly_sales']
        assert_weekly_sales_open(ws)
        serializer.save(received_by=self.request.user)


class WeeklySalesExpenseViewSet(viewsets.ModelViewSet):
    queryset = WeeklySalesExpense.objects.select_related(
        'weekly_sales', 'recorded_by',
    ).all()
    serializer_class = WeeklySalesExpenseSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK

    def get_queryset(self):
        qs = super().get_queryset()
        ws = self.request.query_params.get('weekly_sales')
        if ws:
            qs = qs.filter(weekly_sales_id=ws)
        return qs

    def perform_create(self, serializer):
        ws = serializer.validated_data['weekly_sales']
        assert_weekly_sales_open(ws)
        serializer.save(recorded_by=self.request.user)


class WeeklySalesDamageViewSet(viewsets.ModelViewSet):
    queryset = WeeklySalesDamage.objects.select_related(
        'weekly_sales', 'product', 'recorded_by',
    ).all()
    serializer_class = WeeklySalesDamageSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = MANAGER_OR_CLERK

    def get_queryset(self):
        qs = super().get_queryset()
        ws = self.request.query_params.get('weekly_sales')
        if ws:
            qs = qs.filter(weekly_sales_id=ws)
        return qs

    def perform_create(self, serializer):
        ws = serializer.validated_data['weekly_sales']
        assert_weekly_sales_open(ws)
        serializer.save(recorded_by=self.request.user)