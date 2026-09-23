from django.db import models
from django.conf import settings
from decimal import Decimal, ROUND_HALF_UP


class SalaryStructure(models.Model):
    """An employee's salary components and effective period."""
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='salary_structures'
    )
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    housing_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-effective_from']

    @property
    def gross_monthly(self):
        return (self.basic_salary or 0) + (self.housing_allowance or 0) \
             + (self.transport_allowance or 0) + (self.other_allowances or 0)

    def __str__(self):
        return f"{self.employee} — K{self.basic_salary} from {self.effective_from}"


class PayrollRun(models.Model):
    """A batch payroll processing for one period."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    period_label = models.CharField(max_length=30)   # e.g. "2026-09" or "September 2026"
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='draft')
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='payroll_runs'
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-period_start']

    def __str__(self):
        return f"Payroll {self.period_label} ({self.status})"


class PayrollRecord(models.Model):
    """A single employee's payroll line within a PayrollRun."""
    payroll_run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name='records'
    )
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='payroll_records'
    )

    # Earnings
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    housing_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2)

    # Statutory deductions
    napsa_employee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    nhima_employee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    paye = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    total_deductions = models.DecimalField(max_digits=12, decimal_places=2)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['employee__first_name', 'employee__last_name']
        unique_together = ('payroll_run', 'employee')

    def __str__(self):
        return f"{self.employee} — Net K{self.net_salary}"


class BankExport(models.Model):
    """A file exported for bank submission covering one payroll run."""
    payroll_run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name='bank_exports'
    )
    file_name = models.CharField(max_length=150)
    file_path = models.CharField(max_length=300, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    employee_count = models.PositiveIntegerField()
    exported_at = models.DateTimeField(auto_now_add=True)
    exported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"{self.file_name} ({self.employee_count} employees)"


# --- Statutory rate constants (Zambia, as of 2025/2026) ---
NAPSA_EMPLOYEE_RATE = Decimal('0.05')
NAPSA_CEILING = Decimal('29100.00')          # monthly K ceiling
NHIMA_EMPLOYEE_RATE = Decimal('0.01')

# Monthly PAYE bands: (upper_limit, rate). Last band uses None for "above".
PAYE_BANDS = [
    (Decimal('5100.00'),  Decimal('0.00')),
    (Decimal('7100.00'),  Decimal('0.20')),
    (Decimal('9200.00'),  Decimal('0.30')),
    (None,                Decimal('0.37')),
]


def compute_paye(taxable: Decimal) -> Decimal:
    """Progressive PAYE calculation on taxable monthly income."""
    tax = Decimal('0.00')
    lower = Decimal('0.00')
    for upper, rate in PAYE_BANDS:
        if upper is None or taxable <= upper:
            tax += (taxable - lower) * rate
            break
        tax += (upper - lower) * rate
        lower = upper
    return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)