"""
Finance module views.

Provides:
  - Combined pending queue (all reviewable types)
  - Per-type review viewsets (approve, reject, query, reopen)
  - Bulk approval
  - Dashboard KPIs
  - Audit log
"""

from datetime import date
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import RolePermission
from core.roles import FINANCE_OFFICER, FINANCE_MANAGER
from core.scoping import ScopedViewSetMixin

from wholesale.models import (
    WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage, WholesaleDamage,
)
from wholesale.serializers import (
    WeeklySalesCashInSerializer, WeeklySalesExpenseSerializer,
    WeeklySalesDamageSerializer, WholesaleDamageSerializer,
)

from .models import FinanceReviewLog
from .serializers import FinanceReviewLogSerializer, PendingItemSerializer
from .services import (
    approve_record, reject_record, query_record, reopen_record,
    _has_role, FINANCE_ROLES, MANAGER_ROLES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_finance(user):
    return _has_role(user, FINANCE_ROLES)


def _is_manager(user):
    return _has_role(user, MANAGER_ROLES)


def _require_finance_or_403(user):
    if not _is_finance(user):
        raise PermissionDenied('Finance role required.')


def _require_manager_or_403(user):
    if not _is_manager(user):
        raise PermissionDenied('Finance manager role required.')


def _handle_django_error(e):
    """Translate a Django ValidationError into a DRF 400 response."""
    if hasattr(e, 'message_dict'):
        return Response(e.message_dict, status=400)
    if hasattr(e, 'messages'):
        return Response({'error': e.messages}, status=400)
    return Response({'error': str(e)}, status=400)


# ---------------------------------------------------------------------------
# Review mixin
# ---------------------------------------------------------------------------

class ReviewActionsMixin:
    """
    Shared approve / reject / query / reopen actions for a reviewable
    model viewset.
    """
    review_model_name = None  # 'cash_in' | 'expense' | 'damage'

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        _require_finance_or_403(request.user)
        record = self.get_object()
        try:
            approve_record(record, request.user, request.data.get('notes', ''))
        except DjangoValidationError as e:
            return _handle_django_error(e)
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        _require_finance_or_403(request.user)
        record = self.get_object()
        try:
            reject_record(record, request.user, request.data.get('reason', ''))
        except DjangoValidationError as e:
            return _handle_django_error(e)
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['post'])
    def query(self, request, pk=None):
        _require_finance_or_403(request.user)
        record = self.get_object()
        try:
            query_record(record, request.user, request.data.get('reason', ''))
        except DjangoValidationError as e:
            return _handle_django_error(e)
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        _require_manager_or_403(request.user)
        record = self.get_object()
        try:
            reopen_record(record, request.user, request.data.get('reason', ''))
        except DjangoValidationError as e:
            return _handle_django_error(e)
        return Response(self.get_serializer(record).data)


# ---------------------------------------------------------------------------
# Cash-in review
# ---------------------------------------------------------------------------

class CashInReviewViewSet(ScopedViewSetMixin, ReviewActionsMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WeeklySalesCashIn.objects.select_related(
        'weekly_sales', 'weekly_sales__wholesale', 'received_by',
        'finance_reviewed_by',
    ).all()
    serializer_class = WeeklySalesCashInSerializer
    permission_classes = [RolePermission]
    read_roles = [FINANCE_OFFICER, FINANCE_MANAGER]
    wholesale_field = 'weekly_sales__wholesale'
    review_model_name = 'cash_in'

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param == 'pending_review':
            qs = qs.filter(finance_status='pending')
        elif status_param:
            qs = qs.filter(finance_status=status_param)
        return self.scope_queryset(qs, self.request)


# ---------------------------------------------------------------------------
# Expense review
# ---------------------------------------------------------------------------

class ExpenseReviewViewSet(ScopedViewSetMixin, ReviewActionsMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WeeklySalesExpense.objects.select_related(
        'weekly_sales', 'weekly_sales__wholesale', 'recorded_by',
        'finance_reviewed_by',
    ).all()
    serializer_class = WeeklySalesExpenseSerializer
    permission_classes = [RolePermission]
    read_roles = [FINANCE_OFFICER, FINANCE_MANAGER]
    wholesale_field = 'weekly_sales__wholesale'
    review_model_name = 'expense'

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param == 'pending_review':
            qs = qs.filter(finance_status='pending')
        elif status_param:
            qs = qs.filter(finance_status=status_param)
        return self.scope_queryset(qs, self.request)


# ---------------------------------------------------------------------------
# Damage review (weekly)
# ---------------------------------------------------------------------------

class WeeklyDamageReviewViewSet(ScopedViewSetMixin, ReviewActionsMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WeeklySalesDamage.objects.select_related(
        'weekly_sales', 'weekly_sales__wholesale', 'product', 'recorded_by',
        'finance_reviewed_by',
    ).all()
    serializer_class = WeeklySalesDamageSerializer
    permission_classes = [RolePermission]
    read_roles = [FINANCE_OFFICER, FINANCE_MANAGER]
    wholesale_field = 'weekly_sales__wholesale'
    review_model_name = 'damage'

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param == 'pending_review':
            qs = qs.filter(finance_status='pending')
        elif status_param:
            qs = qs.filter(finance_status=status_param)
        return self.scope_queryset(qs, self.request)


# ---------------------------------------------------------------------------
# Damage review (storage level)
# ---------------------------------------------------------------------------

class StorageDamageReviewViewSet(ScopedViewSetMixin, ReviewActionsMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WholesaleDamage.objects.select_related(
        'wholesale', 'product', 'reported_by', 'finance_reviewed_by',
    ).all()
    serializer_class = WholesaleDamageSerializer
    permission_classes = [RolePermission]
    read_roles = [FINANCE_OFFICER, FINANCE_MANAGER]
    wholesale_field = 'wholesale'
    review_model_name = 'damage'

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param == 'pending_review':
            qs = qs.filter(finance_status='pending')
        elif status_param:
            qs = qs.filter(finance_status=status_param)
        return self.scope_queryset(qs, self.request)


# ---------------------------------------------------------------------------
# Combined pending queue
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_queue(request):
    """
    Aggregated pending queue across cash-ins, expenses, and damages.

    Filters:
      ?wholesale=N
      ?type=cash_in|expense|damage
      ?flagged=1     (only items with at least one flag)
    """
    _require_finance_or_403(request.user)

    user = request.user
    wholesale_id = request.query_params.get('wholesale')
    type_filter = request.query_params.get('type')
    flagged_only = request.query_params.get('flagged') in ('1', 'true')

    items = []

    def _scope_wholesale(qs, field):
        if not user.is_superuser and user.wholesale_id:
            qs = qs.filter(**{field: user.wholesale_id})
        elif wholesale_id:
            qs = qs.filter(**{field: wholesale_id})
        return qs

    # ---- Cash-ins ----
    if not type_filter or type_filter == 'cash_in':
        qs = WeeklySalesCashIn.objects.filter(finance_status='pending').select_related(
            'weekly_sales__wholesale', 'received_by',
        )
        qs = _scope_wholesale(qs, 'weekly_sales__wholesale_id')
        for item in qs:
            if flagged_only and not item.flags:
                continue
            items.append({
                'id': item.id,
                'type': 'cash_in',
                'type_display': 'Cash In',
                'reference': item.reference or f'Cash-In #{item.id}',
                'amount': item.amount,
                'wholesale_id': item.weekly_sales.wholesale_id,
                'wholesale_name': item.weekly_sales.wholesale.name,
                'submitted_by': (
                    item.received_by.get_full_name() or item.received_by.username
                ) if item.received_by else None,
                'submitted_at': item.received_at,
                'finance_status': item.finance_status,
                'flags': item.flags,
                'age_days': (timezone.now() - item.received_at).days,
            })

    # ---- Expenses ----
    if not type_filter or type_filter == 'expense':
        qs = WeeklySalesExpense.objects.filter(finance_status='pending').select_related(
            'weekly_sales__wholesale', 'recorded_by',
        )
        qs = _scope_wholesale(qs, 'weekly_sales__wholesale_id')
        for item in qs:
            if flagged_only and not item.flags:
                continue
            items.append({
                'id': item.id,
                'type': 'expense',
                'type_display': 'Expense',
                'reference': item.description[:60] or f'Expense #{item.id}',
                'amount': item.amount,
                'wholesale_id': item.weekly_sales.wholesale_id,
                'wholesale_name': item.weekly_sales.wholesale.name,
                'submitted_by': (
                    item.recorded_by.get_full_name() or item.recorded_by.username
                ) if item.recorded_by else None,
                'submitted_at': item.recorded_at,
                'finance_status': item.finance_status,
                'flags': item.flags,
                'age_days': (timezone.now() - item.recorded_at).days,
            })

    # ---- Weekly damages ----
    if not type_filter or type_filter == 'damage':
        qs = WeeklySalesDamage.objects.filter(finance_status='pending').select_related(
            'weekly_sales__wholesale', 'product', 'recorded_by',
        )
        qs = _scope_wholesale(qs, 'weekly_sales__wholesale_id')
        for item in qs:
            if flagged_only and not item.flags:
                continue
            items.append({
                'id': item.id,
                'type': 'damage',
                'type_display': 'Damage',
                'reference': f'{item.product.sku} × {item.quantity}',
                'amount': item.total_loss_value,
                'wholesale_id': item.weekly_sales.wholesale_id,
                'wholesale_name': item.weekly_sales.wholesale.name,
                'submitted_by': (
                    item.recorded_by.get_full_name() or item.recorded_by.username
                ) if item.recorded_by else None,
                'submitted_at': item.recorded_at,
                'finance_status': item.finance_status,
                'flags': item.flags,
                'age_days': (timezone.now() - item.recorded_at).days,
            })

        # ---- Storage damages ----
        qs = WholesaleDamage.objects.filter(finance_status='pending').select_related(
            'wholesale', 'product', 'reported_by',
        )
        qs = _scope_wholesale(qs, 'wholesale_id')
        for item in qs:
            if flagged_only and not item.flags:
                continue
            items.append({
                'id': item.id,
                'type': 'damage',
                'type_display': 'Storage Damage',
                'reference': f'{item.product.sku} × {item.quantity}',
                'amount': item.total_loss_value,
                'wholesale_id': item.wholesale_id,
                'wholesale_name': item.wholesale.name,
                'submitted_by': (
                    item.reported_by.get_full_name() or item.reported_by.username
                ) if item.reported_by else None,
                'submitted_at': item.reported_at,
                'finance_status': item.finance_status,
                'flags': item.flags,
                'age_days': (timezone.now() - item.reported_at).days,
            })

    # Sort: flagged first, then oldest first
    items.sort(key=lambda i: (0 if i['flags'] else 1, -i['age_days']))

    return Response({
        'count': len(items),
        'results': items,
    })


# ---------------------------------------------------------------------------
# Bulk approve
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_approve(request):
    """
    Approve multiple records of the same type.

    Body:
      {
        "record_type": "cash_in" | "expense" | "damage",
        "record_ids": [1, 2, 3],
        "notes": "..."
      }
    """
    _require_finance_or_403(request.user)

    record_type = request.data.get('record_type')
    ids = request.data.get('record_ids', [])
    notes = request.data.get('notes', '')

    if record_type not in ('cash_in', 'expense', 'damage'):
        return Response({'error': 'record_type must be cash_in, expense, or damage.'}, status=400)
    if not ids:
        return Response({'error': 'record_ids must be a non-empty list.'}, status=400)

    model_map = {
        'cash_in': WeeklySalesCashIn,
        'expense': WeeklySalesExpense,
        'damage': None,  # handled below — two damage models
    }

    approved = []
    errors = []

    if record_type == 'damage':
        for model in (WeeklySalesDamage, WholesaleDamage):
            for item in model.objects.filter(id__in=ids, finance_status='pending'):
                try:
                    approve_record(item, request.user, notes)
                    approved.append({'type': 'damage', 'id': item.id, 'model': model.__name__})
                except DjangoValidationError as e:
                    errors.append({'id': item.id, 'error': str(e)})
    else:
        model = model_map[record_type]
        for item in model.objects.filter(id__in=ids, finance_status='pending'):
            try:
                approve_record(item, request.user, notes)
                approved.append({'type': record_type, 'id': item.id})
            except DjangoValidationError as e:
                errors.append({'id': item.id, 'error': str(e)})

    return Response({
        'approved_count': len(approved),
        'error_count': len(errors),
        'approved': approved,
        'errors': errors,
    })


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def finance_dashboard(request):
    """
    KPI summary for the finance dashboard.

    Returns:
      - pending total per type with value
      - flagged items count
      - aging buckets (0-3, 4-7, 8-14, 15+ days)
      - approved today/week totals
    """
    _require_finance_or_403(request.user)

    user = request.user
    scope_filter = {}
    if not user.is_superuser and user.wholesale_id:
        scope_filter['wholesale_id'] = user.wholesale_id

    # Cash-ins
    cash_qs = WeeklySalesCashIn.objects.all()
    if scope_filter:
        cash_qs = cash_qs.filter(weekly_sales__wholesale_id=scope_filter['wholesale_id'])

    pending_cash = cash_qs.filter(finance_status='pending')
    pending_cash_value = pending_cash.aggregate(t=Sum('amount'))['t'] or 0

    # Expenses
    exp_qs = WeeklySalesExpense.objects.all()
    if scope_filter:
        exp_qs = exp_qs.filter(weekly_sales__wholesale_id=scope_filter['wholesale_id'])

    pending_exp = exp_qs.filter(finance_status='pending')
    pending_exp_value = pending_exp.aggregate(t=Sum('amount'))['t'] or 0

    # Weekly damages
    dmg_qs = WeeklySalesDamage.objects.all()
    if scope_filter:
        dmg_qs = dmg_qs.filter(weekly_sales__wholesale_id=scope_filter['wholesale_id'])
    pending_dmg_w = dmg_qs.filter(finance_status='pending')
    pending_dmg_w_value = pending_dmg_w.aggregate(t=Sum('total_loss_value'))['t'] or 0

    # Storage damages
    stor_qs = WholesaleDamage.objects.all()
    if scope_filter:
        stor_qs = stor_qs.filter(wholesale_id=scope_filter['wholesale_id'])
    pending_dmg_s = stor_qs.filter(finance_status='pending')
    pending_dmg_s_value = pending_dmg_s.aggregate(t=Sum('total_loss_value'))['t'] or 0

    # Flagged count across pending
    flagged_count = 0
    for qs in (pending_cash, pending_exp, pending_dmg_w, pending_dmg_s):
        flagged_count += sum(1 for item in qs if item.flags)

    # Aging buckets for pending items
    now = timezone.now()
    buckets = {'0_3': 0, '4_7': 0, '8_14': 0, '15_plus': 0}
    for qs in (pending_cash, pending_exp, pending_dmg_w, pending_dmg_s):
        for item in qs:
            ts = (
                getattr(item, 'received_at', None)
                or getattr(item, 'recorded_at', None)
                or getattr(item, 'reported_at', None)
            )
            if not ts:
                continue
            days = (now - ts).days
            if days <= 3:
                buckets['0_3'] += 1
            elif days <= 7:
                buckets['4_7'] += 1
            elif days <= 14:
                buckets['8_14'] += 1
            else:
                buckets['15_plus'] += 1

    # Approved today
    today = date.today()
    approved_today_value = (
        cash_qs.filter(finance_status='approved', finance_reviewed_at__date=today)
        .aggregate(t=Sum('amount'))['t'] or 0
    )

    # Approved this week
    week_start = today - timedelta(days=today.weekday())
    approved_week_value = (
        cash_qs.filter(finance_status='approved', finance_reviewed_at__date__gte=week_start)
        .aggregate(t=Sum('amount'))['t'] or 0
    )

    return Response({
        'pending': {
            'cash_ins': {
                'count': pending_cash.count(),
                'value': float(pending_cash_value),
            },
            'expenses': {
                'count': pending_exp.count(),
                'value': float(pending_exp_value),
            },
            'damages': {
                'count': pending_dmg_w.count() + pending_dmg_s.count(),
                'value': float(pending_dmg_w_value + pending_dmg_s_value),
            },
            'total_count': (
                pending_cash.count() + pending_exp.count()
                + pending_dmg_w.count() + pending_dmg_s.count()
            ),
        },
        'flagged_count': flagged_count,
        'aging': buckets,
        'approved_today': float(approved_today_value),
        'approved_this_week': float(approved_week_value),
    })


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

class FinanceReviewLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinanceReviewLog.objects.select_related('actor').all()
    serializer_class = FinanceReviewLogSerializer
    permission_classes = [RolePermission]
    read_roles = [FINANCE_OFFICER, FINANCE_MANAGER]

    def get_queryset(self):
        qs = super().get_queryset()
        record_type = self.request.query_params.get('record_type')
        record_id = self.request.query_params.get('record_id')
        action_param = self.request.query_params.get('action')
        if record_type:
            qs = qs.filter(record_type=record_type)
        if record_id:
            qs = qs.filter(record_id=record_id)
        if action_param:
            qs = qs.filter(action=action_param)
        return qs