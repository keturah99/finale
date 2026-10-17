"""
Payroll service layer.

Computation, payslip PDF generation, and bank export.
"""

import os
import csv
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO, StringIO

from django.core.files.base import ContentFile
from django.utils import timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

from .models import (
    SalaryStructure, PayrollRecord,
    NAPSA_EMPLOYEE_RATE, NAPSA_CEILING, NHIMA_EMPLOYEE_RATE,
    compute_paye,
)


# ---------------------------------------------------------------------------
# Font registration (Century Gothic via metric-compatible URW Gothic)
# ---------------------------------------------------------------------------

_FONT_SEARCH_PATHS = [
    '/usr/share/fonts/opentype/urw-base35',   # Debian / Ubuntu
    '/usr/share/fonts/urw-base35',             # Fedora
    '/usr/share/fonts/type1/urw-base35',
    '/usr/local/share/fonts',
]


def _find_font(filename: str) -> str | None:
    """Search known font directories for the given TTF filename."""
    for base in _FONT_SEARCH_PATHS:
        candidate = os.path.join(base, filename)
        if os.path.exists(candidate):
            return candidate
    return None


def _register_payslip_fonts() -> tuple[str, str]:
    """
    Register URW Gothic (Century Gothic clone) with ReportLab.
    Returns (regular_font_name, bold_font_name).

    Falls back to Helvetica if the TTF files aren't present.
    """
    regular_path = _find_font('URWGothic-Book.ttf')
    bold_path = _find_font('URWGothic-Demi.ttf')

    if not regular_path or not bold_path:
        return 'Helvetica', 'Helvetica-Bold'

    try:
        pdfmetrics.registerFont(TTFont('CenturyGothic', regular_path))
        pdfmetrics.registerFont(TTFont('CenturyGothic-Bold', bold_path))
        pdfmetrics.registerFontFamily(
            'CenturyGothic',
            normal='CenturyGothic',
            bold='CenturyGothic-Bold',
            italic='CenturyGothic',
            boldItalic='CenturyGothic-Bold',
        )
        return 'CenturyGothic', 'CenturyGothic-Bold'
    except Exception:
        return 'Helvetica', 'Helvetica-Bold'


FONT_REGULAR, FONT_BOLD = _register_payslip_fonts()


# ---------------------------------------------------------------------------
# Payroll computation
# ---------------------------------------------------------------------------

def calculate_record(employee, salary: SalaryStructure) -> dict:
    """Compute a PayrollRecord's fields from a SalaryStructure."""
    basic = salary.basic_salary
    housing = salary.housing_allowance
    transport = salary.transport_allowance
    other = salary.other_allowances
    gross = basic + housing + transport + other

    # NAPSA on basic (capped)
    napsa_base = min(basic, NAPSA_CEILING)
    napsa = (napsa_base * NAPSA_EMPLOYEE_RATE).quantize(Decimal('0.01'))

    # NHIMA on basic
    nhima = (basic * NHIMA_EMPLOYEE_RATE).quantize(Decimal('0.01'))

    # PAYE on gross minus NAPSA
    taxable = gross - napsa
    paye = compute_paye(taxable)

    total_deductions = napsa + nhima + paye
    net = gross - total_deductions

    return {
        'employee': employee,
        'basic_salary': basic,
        'housing_allowance': housing,
        'transport_allowance': transport,
        'other_allowances': other,
        'gross_salary': gross,
        'napsa_employee': napsa,
        'nhima_employee': nhima,
        'paye': paye,
        'total_deductions': total_deductions,
        'net_salary': net.quantize(Decimal('0.01')),
    }


def run_payroll(payroll_run, processed_by=None):
    """Populate PayrollRecords for all active employees with a SalaryStructure."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    employees = User.objects.filter(
        salary_structures__is_active=True,
        is_active=True,
    ).distinct()

    payroll_run.records.all().delete()
    created = 0

    for emp in employees:
        salary = emp.salary_structures.filter(is_active=True) \
            .order_by('-effective_from').first()
        if not salary:
            continue
        fields = calculate_record(emp, salary)
        PayrollRecord.objects.create(payroll_run=payroll_run, **fields)
        created += 1

    payroll_run.status = 'completed'
    payroll_run.processed_at = timezone.now()
    payroll_run.processed_by = processed_by
    payroll_run.save()
    return created


# ---------------------------------------------------------------------------
# Payslip PDF
# ---------------------------------------------------------------------------

def _money(v) -> str:
    """Format a value as Zambian Kwacha with thousands separators."""
    if v is None or v == '':
        return 'K 0.00'
    return f"K {Decimal(v):,.2f}"


def _build_side_table(
    header: str,
    rows: list[tuple[str, str]],
    accent_color: colors.Color,
) -> Table:
    """
    Build a two-column earnings/deductions table with dotted row lines.
    """
    data = [[header, 'Amount']] + [[label, amt] for label, amt in rows]

    t = Table(data, colWidths=[48 * mm, 32 * mm])
    t.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), accent_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 10),

        # Body text
        ('FONTNAME', (0, 1), (-1, -1), FONT_REGULAR),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#0f172a')),

        # Last row is the total — bold
        ('FONTNAME', (0, -1), (-1, -1), FONT_BOLD),

        # Amounts right-aligned
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),

        # Dotted row lines between data rows
        ('LINEBELOW', (0, 1), (-1, -2),
         0.4, colors.HexColor('#cbd5e1'), None, (0.5, 2)),

        # Solid line above the total
        ('LINEABOVE', (0, -1), (-1, -1),
         0.6, colors.HexColor('#0f172a')),

        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),

        # Vertical separator between label and amount columns
        ('LINEBEFORE', (1, 0), (1, -1),
         0.4, colors.HexColor('#e2e8f0'), None, (0.5, 2)),
    ]))
    return t


def generate_payslip_pdf(record: PayrollRecord) -> bytes:
    """
    Build a PDF payslip for a single PayrollRecord.

    Renders:
      - Company-branded title
      - Employee identification block (name, username, NRC, phone)
      - Earnings and Deductions side by side
      - Net pay highlight row
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    # ---------------- Styles ----------------

    title_style = ParagraphStyle(
        'PayslipTitle',
        fontName=FONT_BOLD,
        fontSize=18,
        alignment=1,
        textColor=colors.HexColor('#1a3a6c'),
        spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        'PayslipSubtitle',
        fontName=FONT_REGULAR,
        fontSize=9,
        alignment=1,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=12,
    )

    # ---------------- Data lookup ----------------

    emp = record.employee
    period = record.payroll_run.period_label
    processed = (
        record.payroll_run.processed_at.strftime('%Y-%m-%d')
        if record.payroll_run.processed_at else '—'
    )

    full_name = emp.get_full_name() or emp.username
    nrc = getattr(emp, 'nrc', '') or '—'
    phone = getattr(emp, 'phone', '') or '—'

    elements: list = []

    # ---------------- Header ----------------

    elements.append(Paragraph(
        "INTEGRATED UNIFIED SYSTEM — PAYSLIP", title_style,
    ))
    elements.append(Paragraph(
        f"Pay period: {period}", subtitle_style,
    ))
    elements.append(Spacer(1, 4 * mm))

    # ---------------- Employee details table ----------------

    details_data = [
        ['Employee Name', full_name, 'Payroll Period', period],
        ['Username', emp.username, 'Processed', processed],
        ['NRC Number', nrc, 'Phone', phone],
    ]

    details_table = Table(
        details_data,
        colWidths=[28 * mm, 58 * mm, 30 * mm, 54 * mm],
    )
    details_table.setStyle(TableStyle([
        # Label cells — grey, bold
        ('FONTNAME', (0, 0), (0, -1), FONT_BOLD),
        ('FONTNAME', (2, 0), (2, -1), FONT_BOLD),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#64748b')),

        # Value cells — dark
        ('FONTNAME', (1, 0), (1, -1), FONT_REGULAR),
        ('FONTNAME', (3, 0), (3, -1), FONT_REGULAR),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (3, 0), (3, -1), colors.HexColor('#0f172a')),

        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),

        # Dotted separators between rows
        ('LINEBELOW', (0, 0), (-1, -2),
         0.4, colors.HexColor('#cbd5e1'), None, (0.5, 2)),

        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))

    elements.append(details_table)
    elements.append(Spacer(1, 8 * mm))

    # ---------------- Earnings and Deductions ----------------

    earnings_rows = [
        ('Basic Salary', _money(record.basic_salary)),
        ('Housing Allowance', _money(record.housing_allowance)),
        ('Transport Allowance', _money(record.transport_allowance)),
        ('Other Allowances', _money(record.other_allowances)),
        ('Gross Salary', _money(record.gross_salary)),
    ]
    deductions_rows = [
        ('NAPSA (5%)', _money(record.napsa_employee)),
        ('NHIMA (1%)', _money(record.nhima_employee)),
        ('PAYE', _money(record.paye)),
        ('Other', _money(record.other_deductions)),
        ('Total Deductions', _money(record.total_deductions)),
    ]

    earnings_tbl = _build_side_table(
        'EARNINGS', earnings_rows, colors.HexColor('#1a3a6c'),
    )
    deductions_tbl = _build_side_table(
        'DEDUCTIONS', deductions_rows, colors.HexColor('#8b1a1a'),
    )

    combined = Table(
        [[earnings_tbl, '', deductions_tbl]],
        colWidths=[80 * mm, 6 * mm, 80 * mm],
    )
    combined.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(combined)
    elements.append(Spacer(1, 10 * mm))

    # ---------------- Net Pay banner ----------------

    left = Paragraph(
        'NET PAY',
        ParagraphStyle(
            'NetLabel',
            fontName=FONT_BOLD,
            fontSize=11,
            textColor=colors.white,
        ),
    )
    right = Paragraph(
        _money(record.net_salary),
        ParagraphStyle(
            'NetValue',
            fontName=FONT_BOLD,
            fontSize=14,
            textColor=colors.white,
            alignment=2,
        ),
    )

    net_row = Table(
        [[left, right]],
        colWidths=[80 * mm, 55 * mm],
    )
    net_row.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a3a6c')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, 0), 12),
        ('RIGHTPADDING', (1, 0), (1, 0), 12),
    ]))
    elements.append(net_row)

    # ---------------- Footer ----------------

    elements.append(Spacer(1, 12 * mm))
    footer_style = ParagraphStyle(
        'Footer',
        fontName=FONT_REGULAR,
        fontSize=7,
        alignment=1,
        textColor=colors.HexColor('#94a3b8'),
    )
    elements.append(Paragraph(
        'This payslip is computer-generated and does not require a signature. '
        'Retain for your records.',
        footer_style,
    ))

    # ---------------- Build ----------------

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


# ---------------------------------------------------------------------------
# Bank export CSV
# ---------------------------------------------------------------------------

def generate_bank_export_csv(payroll_run) -> str:
    """Return a CSV string with one row per employee for the bank."""
    sio = StringIO()
    writer = csv.writer(sio)
    writer.writerow([
        'Employee ID', 'Employee Name', 'NRC Number',
        'Account Number', 'Bank', 'Branch', 'Net Amount',
    ])
    for rec in payroll_run.records.select_related('employee'):
        emp = rec.employee
        writer.writerow([
            emp.id,
            emp.get_full_name() or emp.username,
            getattr(emp, 'nrc', '') or '',
            getattr(emp, 'bank_account', ''),
            getattr(emp, 'bank_name', ''),
            getattr(emp, 'bank_branch', ''),
            f"{rec.net_salary:.2f}",
        ])
    return sio.getvalue()