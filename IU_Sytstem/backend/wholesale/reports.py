"""
Wholesale report builders.

Each function returns (headers: list, rows: list-of-lists) and accepts
an optional `params` dict with filters.
"""

from datetime import datetime
from decimal import Decimal

from django.db.models import Q

from .models import (
    WholesaleStockLevel,
    WholesaleStockIn,
    WholesaleStockOut,
    WholesaleDamage,
    InterWholesaleTransfer,
    WeeklySales,
    WeeklySalesDamage,
)


def _as_date(v):
    if not v:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        try:
            return datetime.strptime(v, '%Y-%m-%d').date()
        except ValueError:
            return None
    return v


def _zero():
    return Decimal('0.00')


# ---------------------------------------------------------------------------
# 1. Stock summary
# ---------------------------------------------------------------------------

def wholesale_stock_summary(params=None):
    params = params or {}
    qs = WholesaleStockLevel.objects.select_related('wholesale', 'product')
    if params.get('wholesale'):
        qs = qs.filter(wholesale_id=params['wholesale'])
    if params.get('product'):
        qs = qs.filter(product_id=params['product'])

    headers = ['Outlet', 'SKU', 'Product', 'Quantity',
               'Avg Cost (K)', 'Total Value (K)', 'Last Updated']
    rows = []
    for level in qs.order_by('wholesale__name', 'product__name'):
        rows.append([
            level.wholesale.name,
            level.product.sku,
            level.product.name,
            level.quantity,
            level.average_cost or _zero(),
            level.total_value,
            level.last_updated.strftime('%Y-%m-%d %H:%M'),
        ])
    return headers, rows


# ---------------------------------------------------------------------------
# 2. Inter-wholesale transfers
# ---------------------------------------------------------------------------

def inter_wholesale_transfers(params=None):
    params = params or {}
    qs = InterWholesaleTransfer.objects.select_related(
        'from_wholesale', 'to_wholesale', 'product',
        'initiated_by', 'approved_by', 'received_by', 'cancelled_by',
    )
    if params.get('wholesale'):
        wid = params['wholesale']
        qs = qs.filter(Q(from_wholesale_id=wid) | Q(to_wholesale_id=wid))
    if params.get('product'):
        qs = qs.filter(product_id=params['product'])
    if params.get('status'):
        qs = qs.filter(status=params['status'])
    if params.get('from'):
        qs = qs.filter(initiated_at__date__gte=_as_date(params['from']))
    if params.get('to'):
        qs = qs.filter(initiated_at__date__lte=_as_date(params['to']))

    headers = ['#', 'From', 'To', 'SKU', 'Product',
               'Qty', 'Unit (K)', 'Total (K)', 'Status', 'Ref',
               'Initiated', 'Approved', 'Received', 'Cancelled']

    def fmt(ts):
        return ts.strftime('%Y-%m-%d %H:%M') if ts else '—'

    rows = []
    for t in qs.order_by('-initiated_at'):
        rows.append([
            t.id,
            t.from_wholesale.name,
            t.to_wholesale.name,
            t.product.sku,
            t.product.name,
            t.quantity,
            t.unit_value,
            t.total_value,
            t.get_status_display(),
            t.reference or '—',
            fmt(t.initiated_at),
            fmt(t.approved_at),
            fmt(t.received_at),
            fmt(t.cancelled_at),
        ])
    return headers, rows


# ---------------------------------------------------------------------------
# 3. Weekly sales summary
# ---------------------------------------------------------------------------

def weekly_sales_summary(params=None):
    params = params or {}
    qs = WeeklySales.objects.select_related('wholesale', 'seller')
    if params.get('wholesale'):
        qs = qs.filter(wholesale_id=params['wholesale'])
    if params.get('status'):
        qs = qs.filter(status=params['status'])
    if params.get('from'):
        qs = qs.filter(start_date__gte=_as_date(params['from']))
    if params.get('to'):
        qs = qs.filter(end_date__lte=_as_date(params['to']))

    headers = ['Label', 'Outlet', 'Seller', 'Period', 'Status',
               'Stock Issued (K)', 'Cashed (K)', 'Expenses (K)',
               'Damages (K)', 'Net (K)']

    def user_name(u):
        if not u:
            return '—'
        return u.get_full_name() or u.username

    rows = []
    for ws in qs.order_by('-year', '-week_number'):
        rows.append([
            ws.label,
            ws.wholesale.name,
            user_name(ws.seller),
            f'{ws.start_date} → {ws.end_date}',
            ws.get_status_display(),
            ws.total_stock_in_value,
            ws.total_cashed,
            ws.total_expenses,
            ws.total_damages_value,
            ws.net_position,
        ])
    return headers, rows


# ---------------------------------------------------------------------------
# 4. Damage summary
# ---------------------------------------------------------------------------

def wholesale_damage_summary(params=None):
    params = params or {}
    from_d = _as_date(params.get('from'))
    to_d = _as_date(params.get('to'))

    storage_qs = WholesaleDamage.objects.select_related('wholesale', 'product')
    weekly_qs = WeeklySalesDamage.objects.select_related(
        'weekly_sales__wholesale', 'product',
    )
    if params.get('wholesale'):
        wid = params['wholesale']
        storage_qs = storage_qs.filter(wholesale_id=wid)
        weekly_qs = weekly_qs.filter(weekly_sales__wholesale_id=wid)
    if params.get('product'):
        pid = params['product']
        storage_qs = storage_qs.filter(product_id=pid)
        weekly_qs = weekly_qs.filter(product_id=pid)
    if from_d:
        storage_qs = storage_qs.filter(reported_at__date__gte=from_d)
        weekly_qs = weekly_qs.filter(recorded_at__date__gte=from_d)
    if to_d:
        storage_qs = storage_qs.filter(reported_at__date__lte=to_d)
        weekly_qs = weekly_qs.filter(recorded_at__date__lte=to_d)

    storage_agg = {}
    for d in storage_qs:
        key = (d.wholesale.name, d.product.sku, d.product.name)
        entry = storage_agg.setdefault(key, {'qty': 0, 'loss': _zero()})
        entry['qty'] += d.quantity
        entry['loss'] += d.total_loss_value

    weekly_agg = {}
    for d in weekly_qs:
        key = (d.weekly_sales.wholesale.name, d.product.sku, d.product.name)
        entry = weekly_agg.setdefault(key, {'qty': 0, 'loss': _zero()})
        entry['qty'] += d.quantity
        entry['loss'] += d.total_loss_value

    keys = set(storage_agg) | set(weekly_agg)
    headers = ['Outlet', 'SKU', 'Product',
               'Storage Qty', 'Storage Loss (K)',
               'Weekly Qty', 'Weekly Loss (K)',
               'Total Loss (K)']
    rows = []
    for key in sorted(keys):
        s = storage_agg.get(key, {'qty': 0, 'loss': _zero()})
        w = weekly_agg.get(key, {'qty': 0, 'loss': _zero()})
        rows.append([
            key[0], key[1], key[2],
            s['qty'], s['loss'],
            w['qty'], w['loss'],
            s['loss'] + w['loss'],
        ])
    return headers, rows


# ---------------------------------------------------------------------------
# 5. Stock movement ledger
# ---------------------------------------------------------------------------

def wholesale_stock_movement(params=None):
    params = params or {}
    wid = params.get('wholesale')
    pid = params.get('product')
    from_d = _as_date(params.get('from'))
    to_d = _as_date(params.get('to'))

    events = []

    # Stock in
    qs = WholesaleStockIn.objects.select_related('wholesale', 'product', 'received_by')
    if wid:
        qs = qs.filter(wholesale_id=wid)
    if pid:
        qs = qs.filter(product_id=pid)
    if from_d:
        qs = qs.filter(received_at__date__gte=from_d)
    if to_d:
        qs = qs.filter(received_at__date__lte=to_d)
    for si in qs:
        events.append((
            si.received_at, si.wholesale.name, 'Stock In', 'IN',
            si.product.sku, si.product.name,
            si.quantity, si.total_value, si.reference or '—',
            si.received_by.get_full_name() if si.received_by else '—',
        ))

    # Stock out
    qs = WholesaleStockOut.objects.select_related('wholesale', 'product', 'approved_by')
    if wid:
        qs = qs.filter(wholesale_id=wid)
    if pid:
        qs = qs.filter(product_id=pid)
    if from_d:
        qs = qs.filter(issued_at__date__gte=from_d)
    if to_d:
        qs = qs.filter(issued_at__date__lte=to_d)
    for so in qs:
        events.append((
            so.issued_at, so.wholesale.name, 'Stock Out', 'OUT',
            so.product.sku, so.product.name,
            so.quantity, so.total_value, '—',
            so.approved_by.get_full_name() if so.approved_by else '—',
        ))

    # Transfers
    qs = InterWholesaleTransfer.objects.select_related(
        'from_wholesale', 'to_wholesale', 'product', 'approved_by', 'received_by',
    ).filter(status__in=['in_transit', 'received'])
    if wid:
        qs = qs.filter(Q(from_wholesale_id=wid) | Q(to_wholesale_id=wid))
    if pid:
        qs = qs.filter(product_id=pid)
    if from_d:
        qs = qs.filter(approved_at__date__gte=from_d)
    if to_d:
        qs = qs.filter(approved_at__date__lte=to_d)
    for tr in qs:
        events.append((
            tr.approved_at, tr.from_wholesale.name,
            f'Transfer → {tr.to_wholesale.name}', 'OUT',
            tr.product.sku, tr.product.name,
            tr.quantity, tr.total_value,
            tr.reference or f'TRF#{tr.id}',
            tr.approved_by.get_full_name() if tr.approved_by else '—',
        ))
        if tr.received_at:
            events.append((
                tr.received_at, tr.to_wholesale.name,
                f'Transfer ← {tr.from_wholesale.name}', 'IN',
                tr.product.sku, tr.product.name,
                tr.quantity, tr.total_value,
                tr.reference or f'TRF#{tr.id}',
                tr.received_by.get_full_name() if tr.received_by else '—',
            ))

    # Storage damages
    qs = WholesaleDamage.objects.select_related('wholesale', 'product', 'reported_by')
    if wid:
        qs = qs.filter(wholesale_id=wid)
    if pid:
        qs = qs.filter(product_id=pid)
    if from_d:
        qs = qs.filter(reported_at__date__gte=from_d)
    if to_d:
        qs = qs.filter(reported_at__date__lte=to_d)
    for d in qs:
        events.append((
            d.reported_at, d.wholesale.name, 'Storage Damage', 'OUT',
            d.product.sku, d.product.name,
            d.quantity, d.total_loss_value, '—',
            d.reported_by.get_full_name() if d.reported_by else '—',
        ))

    # Weekly damages
    qs = WeeklySalesDamage.objects.select_related(
        'weekly_sales__wholesale', 'product', 'recorded_by',
    )
    if wid:
        qs = qs.filter(weekly_sales__wholesale_id=wid)
    if pid:
        qs = qs.filter(product_id=pid)
    if from_d:
        qs = qs.filter(recorded_at__date__gte=from_d)
    if to_d:
        qs = qs.filter(recorded_at__date__lte=to_d)
    for d in qs:
        events.append((
            d.recorded_at, d.weekly_sales.wholesale.name,
            f'Weekly Damage ({d.weekly_sales.label})', 'OUT',
            d.product.sku, d.product.name,
            d.quantity, d.total_loss_value, '—',
            d.recorded_by.get_full_name() if d.recorded_by else '—',
        ))

    events.sort(key=lambda e: e[0], reverse=True)

    headers = ['Date', 'Outlet', 'Type', 'Direction', 'SKU', 'Product',
               'Qty', 'Value (K)', 'Reference', 'By']
    rows = [
        [
            e[0].strftime('%Y-%m-%d %H:%M'),
            e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9],
        ]
        for e in events
    ]
    return headers, rows


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

WHOLESALE_REPORT_BUILDERS = {
    'wholesale_stock_summary':    wholesale_stock_summary,
    'inter_wholesale_transfers':  inter_wholesale_transfers,
    'weekly_sales_summary':       weekly_sales_summary,
    'wholesale_damage_summary':   wholesale_damage_summary,
    'wholesale_stock_movement':   wholesale_stock_movement,
}