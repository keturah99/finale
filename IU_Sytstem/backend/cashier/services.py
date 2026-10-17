"""
Cashier module services.

Receipt PDF generation for cash-in records.
"""

import os
from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A5
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)


# Reuse the payslip font search paths and registration
_FONT_SEARCH_PATHS = [
    '/usr/share/fonts/tex-gyre',
    '/usr/share/texmf/fonts/opentype/public/tex-gyre',
    '/usr/local/share/fonts',
]


def _find_font(filename: str) -> str | None:
    for base in _FONT_SEARCH_PATHS:
        candidate = os.path.join(base, filename)
        if os.path.exists(candidate):
            return candidate
    return None


def _register_receipt_fonts() -> tuple[str, str]:
    regular_path = _find_font('texgyreadventor-regular.otf')
    bold_path = _find_font('texgyreadventor-bold.otf')
    if not regular_path or not bold_path:
        return 'Helvetica', 'Helvetica-Bold'
    try:
        pdfmetrics.registerFont(TTFont('ReceiptFont', regular_path))
        pdfmetrics.registerFont(TTFont('ReceiptFont-Bold', bold_path))
        return 'ReceiptFont', 'ReceiptFont-Bold'
    except Exception:
        return 'Helvetica', 'Helvetica-Bold'


FONT_REGULAR, FONT_BOLD = _register_receipt_fonts()


def _money(v) -> str:
    if v is None or v == '':
        return 'K 0.00'
    return f"K {Decimal(v):,.2f}"


def generate_receipt_pdf(cash_in) -> bytes:
    """
    Generate a PDF receipt for a cash-in record.

    The receipt is intended for handoff to the customer at the
    moment of payment.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A5,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )

    title_style = ParagraphStyle(
        'ReceiptTitle',
        fontName=FONT_BOLD,
        fontSize=14,
        alignment=1,
        textColor=colors.HexColor('#1a3a6c'),
        spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        'ReceiptSubtitle',
        fontName=FONT_REGULAR,
        fontSize=9,
        alignment=1,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=8,
    )
    label_style = ParagraphStyle(
        'Label', fontName=FONT_BOLD, fontSize=9,
        textColor=colors.HexColor('#64748b'),
    )
    value_style = ParagraphStyle(
        'Value', fontName=FONT_REGULAR, fontSize=9,
        textColor=colors.HexColor('#0f172a'),
    )

    elements = []
    elements.append(Paragraph("INTEGRATED UNIFIED SYSTEM", title_style))
    elements.append(Paragraph("Cash-In Receipt", subtitle_style))

    cycle = cash_in.weekly_sales
    outlet = cycle.wholesale
    received_by = cash_in.received_by

    details = [
        ['Receipt No.', f'CI-{cash_in.id:06d}'],
        ['Outlet', outlet.name],
        ['Sales Cycle', cycle.label],
        ['Date', cash_in.received_at.strftime('%Y-%m-%d %H:%M')],
        ['Received By',
         (received_by.get_full_name() or received_by.username) if received_by else '—'],
        ['Reference', cash_in.reference or '—'],
    ]

    details_table = Table(details, colWidths=[35 * mm, 70 * mm])
    details_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), FONT_BOLD),
        ('FONTNAME', (1, 0), (1, -1), FONT_REGULAR),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#0f172a')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEBELOW', (0, 0), (-1, -2),
         0.3, colors.HexColor('#cbd5e1'), None, (0.5, 2)),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 6 * mm))

    # Amount highlight
    amount_table = Table(
        [[Paragraph('AMOUNT RECEIVED', label_style),
          Paragraph(_money(cash_in.amount),
                    ParagraphStyle('Amount', fontName=FONT_BOLD,
                                   fontSize=12, alignment=2,
                                   textColor=colors.white))]],
        colWidths=[50 * mm, 55 * mm],
    )
    amount_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a3a6c')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (0, 0), 8),
        ('RIGHTPADDING', (1, 0), (1, 0), 8),
    ]))
    elements.append(amount_table)
    elements.append(Spacer(1, 6 * mm))

    footer = ParagraphStyle(
        'Footer', fontName=FONT_REGULAR, fontSize=7,
        alignment=1, textColor=colors.HexColor('#94a3b8'),
    )
    elements.append(Paragraph(
        'This receipt confirms funds received. '
        'Retain for your records.',
        footer,
    ))

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf