import csv
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from datetime import date

from django.core.files.base import ContentFile
from django.utils import timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)

from .models import (
    SalaryStructure, PayrollRecord,
    NAPSA_EMPLOYEE_RATE, NAPSA_CEILING, NHIMA_EMPLOYEE_RATE,
    compute_paye,
)


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

    # PAYE on gross minus NAPSA (NAPSA is deductible, NHIMA is not in ZM rules)
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


def generate_payslip_pdf(record: PayrollRecord) -> bytes:
    """Return a PDF payslip as bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title', parent=styles['Heading1'],
        alignment=1, textColor=colors.HexColor('#1a3a6c'),
    )

    elements = []
    elements.append(Paragraph("INTEGRATED UNIFIED SYSTEM — PAYSLIP", title_style))
    elements.append(Spacer(1, 8*mm))

    emp = record.employee
    info = [
        ["Employee:", emp.get_full_name() or emp.username, "Payroll Period:", record.payroll_run.period_label],
        ["Username:", emp.username, "Processed:", record.payroll_run.processed_at.strftime('%Y-%m-%d') if record.payroll_run.processed_at else '-'],
    ]
    info_table = Table(info, colWidths=[30*mm, 55*mm, 35*mm, 55*mm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.grey),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8*mm))

    def money(v):
        return f"K {Decimal(v):,.2f}"

    earnings = [
        ["EARNINGS", "Amount"],
        ["Basic Salary", money(record.basic_salary)],
        ["Housing Allowance", money(record.housing_allowance)],
        ["Transport Allowance", money(record.transport_allowance)],
        ["Other Allowances", money(record.other_allowances)],
        ["Gross Salary", money(record.gross_salary)],
    ]
    earnings_table = Table(earnings, colWidths=[80*mm, 45*mm])
    earnings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a3a6c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8eef7')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))

    deductions = [
        ["DEDUCTIONS", "Amount"],
        ["NAPSA (5%)", money(record.napsa_employee)],
        ["NHIMA (1%)", money(record.nhima_employee)],
        ["PAYE", money(record.paye)],
        ["Other", money(record.other_deductions)],
        ["Total Deductions", money(record.total_deductions)],
    ]
    deductions_table = Table(deductions, colWidths=[80*mm, 45*mm])
    deductions_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b1a1a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f5e8e8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))

    combined = Table([[earnings_table, '', deductions_table]],
                     colWidths=[80*mm, 5*mm, 80*mm])
    combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(combined)
    elements.append(Spacer(1, 10*mm))

    net_row = [["NET PAY", money(record.net_salary)]]
    net_table = Table(net_row, colWidths=[120*mm, 45*mm])
    net_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a3a6c')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(net_table)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def generate_bank_export_csv(payroll_run) -> str:
    """Return a CSV string with one row per employee for the bank."""
    output = BytesIO()
    text = output
    from io import StringIO
    sio = StringIO()
    writer = csv.writer(sio)
    writer.writerow(['Employee ID', 'Employee Name', 'Account Number',
                     'Bank', 'Branch', 'Net Amount'])
    for rec in payroll_run.records.select_related('employee'):
        emp = rec.employee
        # Bank details assumed stored on User later; placeholders for now
        writer.writerow([
            emp.id,
            emp.get_full_name() or emp.username,
            getattr(emp, 'bank_account', ''),
            getattr(emp, 'bank_name', ''),
            getattr(emp, 'bank_branch', ''),
            f"{rec.net_salary:.2f}",
        ])
    return sio.getvalue()