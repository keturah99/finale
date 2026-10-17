"""
Cashier module views.

- Own submission history (combined across types)
- Resubmit after edit
- Daily and weekly summaries
- PDF receipt
"""

from datetime import date, timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import RolePermission
from core.roles import CASHIER, WHOLESALE_MANAGER, WHOLESALE_CLERK

from wholesale.models import (
    WeeklySalesCashIn, WeeklySalesExpense,
    WeeklySalesDamage, WholesaleDamage,
)
from finance.services import resubmit_record
from .serializers import CashierSubmissionSerializer
from .services import generate_receipt_pdf


CASHIER_ROLES = [CASHIER, WHOLESALE_MANAGER, WHOLESALE_CLERK]


# ---------------------------------------------------------------------------
# Combined submissions list
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_submissions(request):
    """
    Return the current user's own submissions across cash-ins,
    expenses, and damages.

    Filters:
      ?status=pending|approved|rejected|queried
      ?type=cash_in|expense|damage
    """
    user = request.user
    status_filter = request.query_params.get('status')
    type_filter = request.query_params.get('type')

    items = []

    def _apply_status(qs):
        if status_filter:
            qs = qs.filter(finance_status=status_filter)
        return qs

    if not type_filter or type_filter == 'cash_in':
        qs = WeeklySalesCashIn.objects.select_related(
            'weekly_sales__wholesale', 'finance_reviewed_by',
        ).filter(received_by=user)
        qs = _apply_status(qs)
        for item in qs:
            items.append({
                'id': item.id,
                'type': 'cash_in',
                'type_display': 'Cash In',
                'reference': item.reference or f'Cash-In #{item.id}',
                'amount': item.amount,
                'wholesale_id': item.weekly_sales.wholesale_id,
                'wholesale_name': item.weekly_sales.wholesale.name,
                'cycle_label': item.weekly_sales.label,
                'submitted_at': item.received_at,
                'finance_status': item.finance_status,
                'finance_notes': item.finance_notes,
                'finance_reviewed_at': item.finance_reviewed_at,
                'finance_reviewed_by_name': (
                    (item.finance_reviewed_by.get_full_name()
                     or item.finance_reviewed_by.username)
                    if item.finance_reviewed_by else None
                ),
                'flags': item.flags,
                'is_editable': item.finance_status in ('queried', 'rejected'),
            })

    if not type_filter or type_filter == 'expense':
        qs = WeeklySalesExpense.objects.select_related(
            'weekly_sales__wholesale', 'finance_reviewed_by',
        ).filter(recorded_by=user)
        qs = _apply_status(qs)
        for item in qs:
            items.append({
                'id': item.id,
                'type': 'expense',
                'type_display': 'Expense',
                'reference': item.description[:60],
                'amount': item.amount,
                'wholesale_id': item.weekly_sales.wholesale_id,
                'wholesale_name': item.weekly_sales.wholesale.name,
                'cycle_label': item.weekly_sales.label,
                'submitted_at': item.recorded_at,
                'finance_status': item.finance_status,
                'finance_notes': item.finance_notes,
                'finance_reviewed_at': item.finance_reviewed_at,
                'finance_reviewed_by_name': (
                    (item.finance_reviewed_by.get_full_name()
                     or item.finance_reviewed_by.username)
                    if item.finance_reviewed_by else None
                ),
                'flags': item.flags,
                'is_editable': item.finance_status in ('queried', 'rejected'),
            })

    if not type_filter or type_filter == 'damage':
        qs = WeeklySalesDamage.objects.select_related(
            'weekly_sales__wholesale', 'product', 'finance_reviewed_by',
        ).filter(recorded_by=user)
        qs = _apply_status(qs)
        for item in qs:
            items.append({
                'id': item.id,
                'type': 'damage',
                'type_display': 'Damage (Weekly)',
                'reference': f'{item.product.sku} × {item.quantity}',
                'amount': item.total_loss_value,
                'wholesale_id': item.weekly_sales.wholesale_id,
                'wholesale_name': item.weekly_sales.wholesale.name,
                'cycle_label': item.weekly_sales.label,
                'submitted_at': item.recorded_at,
                'finance_status': item.finance_status,
                'finance_notes': item.finance_notes,
                'finance_reviewed_at': item.finance_reviewed_at,
                'finance_reviewed_by_name': (
                    (item.finance_reviewed_by.get_full_name()
                     or item.finance_reviewed_by.username)
                    if item.finance_reviewed_by else None
                ),
                'flags': item.flags,
                'is_editable': item.finance_status in ('queried', 'rejected'),
            })

        qs = WholesaleDamage.objects.select_related(
            'wholesale', 'product', 'finance_reviewed_by',
        ).filter(reported_by=user)
        qs = _apply_status(qs)
        for item in qs:
            items.append({
                'id': item.id,
                'type': 'damage',
                'type_display': 'Damage (Storage)',
                'reference': f'{item.product.sku} × {item.quantity}',
                'amount': item.total_loss_value,
                'wholesale_id': item.wholesale_id,
                'wholesale_name': item.wholesale.name,
                'cycle_label': '—',
                'submitted_at': item.reported_at,
                'finance_status': item.finance_status,
                'finance_notes': item.finance_notes,
                'finance_reviewed_at': item.finance_reviewed_at,
                'finance_reviewed_by_name': (
                    (item.finance_reviewed_by.get_full_name()
                     or item.finance_reviewed_by.username)
                    if item.finance_reviewed_by else None
                ),
                'flags': item.flags,
                'is_editable': item.finance_status in ('queried', 'rejected'),
            })

    items.sort(key=lambda i: i['submitted_at'], reverse=True)
    serializer = CashierSubmissionSerializer(items, many=True)
    return Response({'count': len(items), 'results': serializer.data})


# ---------------------------------------------------------------------------
# Resubmit after edit
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resubmit_cash_in(request, pk):
    try:
        record = WeeklySalesCashIn.objects.get(pk=pk, received_by=request.user)
    except WeeklySalesCashIn.DoesNotExist:
        return Response({'error': 'Record not found.'}, status=404)

    try:
        resubmit_record(record, request.user)
    except DjangoValidationError as e:
        if hasattr(e, 'messages'):
            return Response({'error': e.messages}, status=400)
        return Response({'error': str(e)}, status=400)

    return Response({
        'status': record.finance_status,
        'id': record.id,
        'message': 'Resubmitted for finance review.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resubmit_expense(request, pk):
    try:
        record = WeeklySalesExpense.objects.get(pk=pk, recorded_by=request.user)
    except WeeklySalesExpense.DoesNotExist:
        return Response({'error': 'Record not found.'}, status=404)

    try:
        resubmit_record(record, request.user)
    except DjangoValidationError as e:
        if hasattr(e, 'messages'):
            return Response({'error': e.messages}, status=400)
        return Response({'error': str(e)}, status=400)

    return Response({
        'status': record.finance_status,
        'id': record.id,
        'message': 'Resubmitted for finance review.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resubmit_damage(request, pk):
    """
    Works for both weekly and storage damages. Attempts weekly first,
    then storage.
    """
    record = (
        WeeklySalesDamage.objects.filter(pk=pk, recorded_by=request.user).first()
        or WholesaleDamage.objects.filter(pk=pk, reported_by=request.user).first()
    )
    if not record:
        return Response({'error': 'Record not found.'}, status=404)

    try:
        resubmit_record(record, request.user)
    except DjangoValidationError as e:
        if hasattr(e, 'messages'):
            return Response({'error': e.messages}, status=400)
        return Response({'error': str(e)}, status=400)

    return Response({
        'status': record.finance_status,
        'id': record.id,
        'message': 'Resubmitted for finance review.',
    })


# ---------------------------------------------------------------------------
# Daily summary
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_summary(request):
    """
    Today's cash-in totals for the current user.
    """
    today = date.today()
    qs = WeeklySalesCashIn.objects.filter(
        received_by=request.user,
        received_at__date=today,
    )

    approved_qs = qs.filter(finance_status='approved')
    pending_qs = qs.filter(finance_status='pending')
    queried_qs = qs.filter(finance_status='queried')
    rejected_qs = qs.filter(finance_status='rejected')

    return Response({
        'date': today,
        'total_amount': float(qs.aggregate(t=Sum('amount'))['t'] or 0),
        'count': qs.count(),
        'approved_amount': float(approved_qs.aggregate(t=Sum('amount'))['t'] or 0),
        'approved_count': approved_qs.count(),
        'pending_amount': float(pending_qs.aggregate(t=Sum('amount'))['t'] or 0),
        'pending_count': pending_qs.count(),
        'queried_count': queried_qs.count(),
        'rejected_count': rejected_qs.count(),
    })


# ---------------------------------------------------------------------------
# Weekly summary
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def weekly_summary(request):
    """
    Cash-in totals for each of the last 7 days.
    """
    today = date.today()
    start = today - timedelta(days=6)

    results = []
    for offset in range(7):
        d = start + timedelta(days=offset)
        qs = WeeklySalesCashIn.objects.filter(
            received_by=request.user,
            received_at__date=d,
        )
        approved = qs.filter(finance_status='approved')
        results.append({
            'date': d,
            'count': qs.count(),
            'total': float(qs.aggregate(t=Sum('amount'))['t'] or 0),
            'approved': float(approved.aggregate(t=Sum('amount'))['t'] or 0),
            'pending_count': qs.filter(finance_status='pending').count(),
        })

    return Response({'days': results})


# ---------------------------------------------------------------------------
# Receipt PDF
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def receipt(request, pk):
    """
    Download a PDF receipt for a cash-in.
    Only the cashier who recorded it (or superuser) can retrieve it.
    """
    qs = WeeklySalesCashIn.objects.filter(pk=pk)
    if not request.user.is_superuser:
        qs = qs.filter(received_by=request.user)
    record = qs.first()

    if not record:
        return Response({'error': 'Receipt not found.'}, status=404)

    pdf = generate_receipt_pdf(record)
    filename = f"receipt_{record.pk:06d}.pdf"
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response