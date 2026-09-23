from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model

from payroll.models import SalaryStructure, PayrollRun, PayrollRecord
from payroll.services import run_payroll, generate_payslip_pdf, generate_bank_export_csv

User = get_user_model()


def hr(t):
    print("\n" + "=" * 60); print(t); print("=" * 60)


# --- Create test employees with salaries ---
hr("Seeding employees + salary structures")

employees = [
    ('alice', 'Alice', 'Banda', Decimal('8000.00'), Decimal('1500.00'), Decimal('800.00')),
    ('bob',   'Bob',   'Chanda', Decimal('4500.00'), Decimal('600.00'),  Decimal('400.00')),
    ('carol', 'Carol', 'Daka',  Decimal('12000.00'), Decimal('2000.00'), Decimal('1000.00')),
]

users = []
for username, first, last, basic, housing, transport in employees:
    u, _ = User.objects.get_or_create(
        username=username,
        defaults=dict(first_name=first, last_name=last, email=f"{username}@co.zm"),
    )
    u.set_password('testpass123'); u.save()
    SalaryStructure.objects.filter(employee=u, is_active=True).update(is_active=False)
    SalaryStructure.objects.create(
        employee=u,
        basic_salary=basic,
        housing_allowance=housing,
        transport_allowance=transport,
        effective_from=date(2026, 1, 1),
    )
    users.append(u)
    print(f"  {u.get_full_name():15} basic=K{basic:>10,.2f}")

# --- Create a payroll run ---
hr("Creating payroll run")
run, created = PayrollRun.objects.get_or_create(
    period_label='2026-09',
    defaults=dict(period_start=date(2026, 9, 1), period_end=date(2026, 9, 30)),
)
print(f"  Run #{run.id} ({run.period_label}) — status: {run.status}")

# --- Process it ---
hr("Processing payroll")
count = run_payroll(run, processed_by=users[0])
run.refresh_from_db()
print(f"  Records created: {count}")
print(f"  Run status: {run.status}")
print(f"  Processed at: {run.processed_at}")

# --- Show records ---
hr("Payroll records")
print(f"  {'Employee':20} {'Gross':>12} {'NAPSA':>10} {'NHIMA':>8} {'PAYE':>10} {'Net':>12}")
for r in run.records.all():
    name = r.employee.get_full_name()
    print(f"  {name:20} {r.gross_salary:>12,.2f} {r.napsa_employee:>10,.2f} "
          f"{r.nhima_employee:>8,.2f} {r.paye:>10,.2f} {r.net_salary:>12,.2f}")

total_net = sum(r.net_salary for r in run.records.all())
print(f"  {'TOTAL':20} {'':>12} {'':>10} {'':>8} {'':>10} {total_net:>12,.2f}")

# --- Generate payslip PDF for first record ---
hr("Payslip PDF")
first = run.records.first()
pdf_bytes = generate_payslip_pdf(first)
print(f"  Employee: {first.employee.get_full_name()}")
print(f"  PDF size: {len(pdf_bytes):,} bytes")
print(f"  Download: http://localhost:8000/api/payroll/records/{first.id}/payslip/")

# --- Bank export CSV ---
hr("Bank export preview")
csv_text = generate_bank_export_csv(run)
print(csv_text)

hr("DONE")
print("Next steps:")
print("  - Open http://localhost:8000/admin/payroll/ to see records")
print(f"  - Download payslip: http://localhost:8000/api/payroll/records/{first.id}/payslip/")
print(f"  - Export bank file: POST http://localhost:8000/api/payroll/runs/{run.id}/export_bank/")