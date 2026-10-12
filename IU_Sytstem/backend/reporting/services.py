import csv
from io import BytesIO, StringIO
from datetime import date
from decimal import Decimal

from django.db.models import Sum, Count, Avg, F, Q
from django.contrib.auth import get_user_model

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)

from inventory.models import Product, StockLevel, StockMovement, StockAlert
from supplychain.models import (
    Farmer, ProducePurchase, ProductionBatch
)
from wholesale.models import PendingCollection
from transport.models import Vehicle, Driver, TransportBooking
from payroll.models import PayrollRun, PayrollRecord

from wholesale.reports import WHOLESALE_REPORT_BUILDERS

User = get_user_model()


# ---------- Helpers ----------

def _fmt(v):
    if v is None:
        return ''
    if isinstance(v, Decimal):
        return f"{v:,.2f}"
    return v


def _rows_to_csv(headers, rows) -> str:
    sio = StringIO()
    w = csv.writer(sio)
    w.writerow(headers)
    for r in rows:
        w.writerow([_fmt(c) for c in r])
    return sio.getvalue()


def _rows_to_pdf(title: str, headers, rows) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        'Title', parent=styles['Heading1'],
        alignment=1, textColor=colors.HexColor('#1a3a6c'), fontSize=14,
    )
    elements = [
        Paragraph(f"INTEGRATED UNIFIED SYSTEM — {title}", h1),
        Spacer(1, 6*mm),
    ]

    data = [headers] + [[_fmt(c) for c in row] for row in rows]
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a3a6c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
         [colors.white, colors.HexColor('#f0f4fa')]),
    ]))
    elements.append(table)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def _rows_to_xlsx(title: str, headers, rows) -> bytes:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31] or 'Report'

    ws.append(headers)
    for row in rows:
        ws.append([float(c) if isinstance(c, Decimal) else c for c in row])

    # Bold header
    for cell in ws[1]:
        cell.font = cell.font.copy(bold=True)

    # Auto column width (rough)
    for col in ws.columns:
        max_len = max((len(str(c.value)) for c in col if c.value is not None),
                      default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    out = BytesIO()
    wb.save(out)
    data = out.getvalue()
    out.close()
    return data


# ---------- Report builders ----------

def inventory_summary(params=None):
    """Per-department counts and total stock value."""
    headers = ['Department', 'Products', 'Total Units', 'Stock Value (K)']
    rows = []
    for code, label in Product.DEPARTMENT_CHOICES:
        products = Product.objects.filter(department=code, is_active=True)
        units = StockLevel.objects.filter(
            product__department=code
        ).aggregate(t=Sum('quantity_on_hand'))['t'] or 0
        value = sum(
            (s.quantity_on_hand or 0) * (s.product.unit_price or 0)
            for s in StockLevel.objects.filter(product__department=code)
        )
        rows.append([label, products.count(), units, Decimal(value)])
    return headers, rows


def stock_movements(params):
    """Movements within a date range, optionally by department."""
    qs = StockMovement.objects.select_related('product').all()
    if params.get('start'):
        qs = qs.filter(created_at__date__gte=params['start'])
    if params.get('end'):
        qs = qs.filter(created_at__date__lte=params['end'])
    if params.get('department'):
        qs = qs.filter(product__department=params['department'])

    headers = ['Date', 'SKU', 'Product', 'Type', 'Qty', 'Reference']
    rows = [
        [m.created_at.strftime('%Y-%m-%d'), m.product.sku, m.product.name,
         m.get_movement_type_display(), m.quantity, m.reference or '']
        for m in qs.order_by('-created_at')[:1000]
    ]
    return headers, rows


def low_stock_alerts(params):
    qs = StockAlert.objects.filter(is_resolved=False).select_related('product')
    headers = ['Date', 'SKU', 'Product', 'Alert', 'On Hand', 'Reorder Level']
    rows = []
    for a in qs:
        lvl = getattr(a.product, 'stock', None)
        rows.append([
            a.created_at.strftime('%Y-%m-%d'),
            a.product.sku, a.product.name, a.alert_type,
            lvl.quantity_on_hand if lvl else 0,
            a.product.reorder_level,
        ])
    return headers, rows


def produce_purchases(params):
    qs = ProducePurchase.objects.select_related('farmer', 'crop').all()
    if params.get('start'):
        qs = qs.filter(purchase_date__gte=params['start'])
    if params.get('end'):
        qs = qs.filter(purchase_date__lte=params['end'])
    if params.get('crop'):
        qs = qs.filter(crop__name=params['crop'])

    headers = ['Date', 'Farmer', 'Crop', 'Qty (kg)', 'Price/kg',
               'Total', 'Paid', 'Status']
    rows = [
        [p.purchase_date, str(p.farmer), p.crop.get_name_display(),
         p.quantity_kg, p.price_per_kg, p.total_amount,
         p.amount_paid, p.payment_status]
        for p in qs.order_by('-purchase_date')
    ]
    return headers, rows


def production_batches(params):
    qs = ProductionBatch.objects.all()
    if params.get('start'):
        qs = qs.filter(start_date__gte=params['start'])
    if params.get('end'):
        qs = qs.filter(start_date__lte=params['end'])

    headers = ['Batch #', 'Raw Material', 'In (kg)', 'Finished',
               'Out (kg)', 'Yield %', 'Status', 'Start', 'Completion']
    rows = [
        [b.batch_number, b.raw_material_name, b.raw_material_qty_kg,
         b.finished_product_name or '-',
         b.finished_product_qty_kg or Decimal('0'),
         b.yield_percentage or Decimal('0'),
         b.get_status_display(),
         b.start_date, b.completion_date or '-']
        for b in qs.order_by('-start_date')
    ]
    return headers, rows


def pending_collections(params):
    qs = PendingCollection.objects.all()
    if params.get('status'):
        qs = qs.filter(status=params['status'])
    headers = ['Customer', 'Phone', 'Description', 'Total', 'Paid',
               'Balance', 'Deadline', 'Status']
    rows = [
        [c.customer_name, c.customer_phone, c.description,
         c.total_price, c.amount_paid, c.balance,
         c.collection_deadline or '-', c.get_status_display()]
        for c in qs.order_by('-created_at')
    ]
    return headers, rows


def transport_bookings(params):
    qs = TransportBooking.objects.select_related(
        'assigned_vehicle', 'assigned_driver'
    ).all()
    if params.get('start'):
        qs = qs.filter(pickup_date__gte=params['start'])
    if params.get('end'):
        qs = qs.filter(pickup_date__lte=params['end'])
    if params.get('status'):
        qs = qs.filter(status=params['status'])

    headers = ['#', 'Customer', 'From', 'To', 'Cargo (kg)',
               'Vehicle', 'Driver', 'Status', 'Pickup']
    rows = [
        [b.id, b.customer_name, b.pickup_location, b.delivery_location,
         b.cargo_weight_kg,
         b.assigned_vehicle.registration_number if b.assigned_vehicle else '-',
         str(b.assigned_driver) if b.assigned_driver else '-',
         b.get_status_display(), b.pickup_date]
        for b in qs.order_by('-created_at')
    ]
    return headers, rows


def vehicle_utilization(params):
    """Trips and cargo moved per vehicle."""
    from transport.models import Vehicle, TransportBooking
    from django.db.models import Sum

    headers = ['Reg #', 'Make', 'Type', 'Tonnage', 'Status', 'Trips', 'Cargo (kg)']
    rows = []
    for v in Vehicle.objects.all():
        trips = TransportBooking.objects.filter(assigned_vehicle=v).count()
        cargo = TransportBooking.objects.filter(
            assigned_vehicle=v, status='delivered'
        ).aggregate(t=Sum('cargo_weight_kg'))['t'] or Decimal('0.00')
        rows.append([
            v.registration_number,
            v.make,
            v.get_vehicle_type_display(),
            v.tonnage,
            v.get_status_display(),
            trips,
            cargo,
        ])
    return headers, rows

def payroll_summary(params):
    run_id = params.get('run_id')
    if run_id:
        runs = PayrollRun.objects.filter(pk=run_id)
    else:
        runs = PayrollRun.objects.filter(status='completed').order_by('-period_start')[:1]

    headers = ['Period', 'Employee', 'Gross', 'NAPSA', 'NHIMA', 'PAYE',
               'Total Deductions', 'Net']
    rows = []
    for run in runs:
        for r in run.records.select_related('employee'):
            rows.append([
                run.period_label,
                r.employee.get_full_name() or r.employee.username,
                r.gross_salary, r.napsa_employee, r.nhima_employee, r.paye,
                r.total_deductions, r.net_salary,
            ])
    return headers, rows


def executive_dashboard(params):
    """High-level KPIs across all modules."""
    total_stock_value = sum(
        (s.quantity_on_hand or 0) * (s.product.unit_price or 0)
        for s in StockLevel.objects.select_related('product')
    )
    return {
        'inventory': {
            'products': Product.objects.filter(is_active=True).count(),
            'stock_value': float(total_stock_value),
            'unresolved_alerts': StockAlert.objects.filter(is_resolved=False).count(),
        },
        'supply_chain': {
            'farmers': Farmer.objects.filter(is_active=True).count(),
            'purchases_count': ProducePurchase.objects.count(),
            'purchases_value': float(
                ProducePurchase.objects.aggregate(t=Sum('total_amount'))['t'] or 0
            ),
            'batches_in_progress': ProductionBatch.objects.filter(
                status='in_progress'
            ).count(),
            'pending_collections': PendingCollection.objects.filter(
                status__in=['pending', 'ready']
            ).count(),
            'outstanding_balance': float(
                PendingCollection.objects.filter(
                    status__in=['pending', 'ready']
                ).aggregate(t=Sum('balance'))['t'] or 0
            ),
        },
        'transport': {
            'vehicles': Vehicle.objects.count(),
            'available_vehicles': Vehicle.objects.filter(status='available').count(),
            'drivers': Driver.objects.count(),
            'bookings_pending': TransportBooking.objects.filter(status='pending').count(),
            'bookings_in_transit': TransportBooking.objects.filter(
                status='in_transit'
            ).count(),
        },
        'payroll': {
            'runs_completed': PayrollRun.objects.filter(status='completed').count(),
            'last_run': (
                PayrollRun.objects.filter(status='completed')
                .order_by('-period_start')
                .values('period_label', 'processed_at')
                .first()
            ),
        },
    }


# ---------- Dispatcher ----------

REPORT_BUILDERS = {
    'inventory_summary': inventory_summary,
    'stock_movements': stock_movements,
    'low_stock_alerts': low_stock_alerts,
    'produce_purchases': produce_purchases,
    'production_batches': production_batches,
    'pending_collections': pending_collections,
    'transport_bookings': transport_bookings,
    'vehicle_utilization': vehicle_utilization,
    'payroll_summary': payroll_summary,
}

REPORT_TITLES = {
    k: k.replace('_', ' ').title() for k in REPORT_BUILDERS
}


def build_report(report_type: str, params: dict):
    """Return (headers, rows) or (None, dashboard_dict)."""
    if report_type == 'executive_dashboard':
        return None, executive_dashboard(params)
    builder = REPORT_BUILDERS.get(report_type)
    if not builder:
        raise ValueError(f"Unknown report type: {report_type}")
    return builder(params)


def render_report(report_type: str, report_format: str, params: dict) -> tuple:
    """
    Return (content_bytes_or_str, content_type, file_extension, row_count).
    """
    headers, payload = build_report(report_type, params)

    if report_type == 'executive_dashboard':
        import json
        body = json.dumps(payload, default=str, indent=2)
        return body, 'application/json', 'json', 1

    title = REPORT_TITLES.get(report_type, report_type)
    row_count = len(payload)

    if report_format == 'csv':
        return _rows_to_csv(headers, payload), 'text/csv', 'csv', row_count
    if report_format == 'xlsx':
        return (_rows_to_xlsx(title, headers, payload),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'xlsx', row_count)
    if report_format == 'pdf':
        return _rows_to_pdf(title, headers, payload), 'application/pdf', 'pdf', row_count
    raise ValueError(f"Unsupported format: {report_format}")

REPORT_BUILDERS.update(WHOLESALE_REPORT_BUILDERS)

REPORT_BUILDERS = {
    'inventory_summary': inventory_summary,
    'stock_movements': stock_movements,
    'low_stock_alerts': low_stock_alerts,
    'produce_purchases': produce_purchases,
    'production_batches': production_batches,
    'pending_collections': pending_collections,
    'transport_bookings': transport_bookings,
    'vehicle_utilization': vehicle_utilization,
    'payroll_summary': payroll_summary,
}

# Merge wholesale reports
try:
    from wholesale.reports import WHOLESALE_REPORT_BUILDERS
    REPORT_BUILDERS.update(WHOLESALE_REPORT_BUILDERS)
except ImportError:
    pass

REPORT_TITLES = {
    k: k.replace('_', ' ').title() for k in REPORT_BUILDERS
}