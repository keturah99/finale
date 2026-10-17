"""
Wholesale module models.

Covers:
  - Wholesale outlets
  - Per-outlet stock levels
  - Stock-in and stock-out movements
  - Damage / loss records (finance-reviewable)
  - Inter-wholesale transfers
  - Weekly sales cycles (with auto-numbering)
  - Pending collections (hardware laybys)
  - Cash-in, expense, and damage sub-records (finance-reviewable)
"""

from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from finance.models import FinanceReviewableModel


# ---------------------------------------------------------------------------
# Decimal coercion helper
# ---------------------------------------------------------------------------

def to_decimal(value, default=Decimal('0.00')):
    """Safely convert a value (str, int, float, Decimal, None) to Decimal."""
    if value is None or value == '':
        return default
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Outlets
# ---------------------------------------------------------------------------

class Wholesale(models.Model):
    """A physical wholesale outlet or storage location."""
    name = models.CharField(max_length=100, unique=True)
    location = models.CharField(max_length=200, blank=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='managed_wholesales',
    )
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Current stock per outlet
# ---------------------------------------------------------------------------

class WholesaleStockLevel(models.Model):
    """Current on-hand quantity of a product at a given outlet."""
    wholesale = models.ForeignKey(
        Wholesale, on_delete=models.CASCADE, related_name='stock_levels',
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='wholesale_levels',
    )
    quantity = models.IntegerField(default=0)
    average_cost = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
        help_text='Weighted average cost per unit.',
    )
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('wholesale', 'product')
        ordering = ['wholesale__name', 'product__name']

    def __str__(self):
        return f"{self.wholesale.name} / {self.product.sku}: {self.quantity}"

    @property
    def total_value(self):
        return (self.average_cost or Decimal('0.00')) * self.quantity


# ---------------------------------------------------------------------------
# Stock-in
# ---------------------------------------------------------------------------

class WholesaleStockIn(models.Model):
    """Stock arriving at a wholesale outlet."""
    SOURCE_CHOICES = [
        ('main_warehouse', 'Main Warehouse'),
        ('supplier', 'Direct from Supplier'),
        ('transfer_in', 'Inter-Wholesale Transfer'),
        ('return', 'Customer Return'),
    ]

    wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='stock_ins',
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='wholesale_stock_ins',
    )
    quantity = models.PositiveIntegerField()
    unit_value = models.DecimalField(max_digits=12, decimal_places=2)
    total_value = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    stock_from = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default='main_warehouse',
    )
    reference = models.CharField(max_length=80, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='wholesale_stock_ins_received',
    )
    received_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f"IN {self.quantity} × {self.product.sku} → {self.wholesale.name}"

    def clean(self):
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if self.unit_value is not None and self.unit_value <= 0:
            raise ValidationError({'unit_value': 'Unit value must be greater than zero.'})

    def save(self, *args, **kwargs):
        from .services import sync_stock_in

        self.total_value = to_decimal(self.unit_value) * (self.quantity or 0)

        old_qty = 0
        old_unit = None
        if self.pk:
            old = WholesaleStockIn.objects.get(pk=self.pk)
            old_qty = old.quantity
            old_unit = old.unit_value

        super().save(*args, **kwargs)
        sync_stock_in(self, old_quantity=old_qty, old_unit_value=old_unit)

    def delete(self, *args, **kwargs):
        from .services import reverse_stock_in
        reverse_stock_in(self)
        super().delete(*args, **kwargs)


# ---------------------------------------------------------------------------
# Stock-out
# ---------------------------------------------------------------------------

class WholesaleStockOut(models.Model):
    """Stock issued from a wholesale outlet (to sales or direct buyers)."""
    wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='stock_outs',
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='wholesale_stock_outs',
    )
    weekly_sales = models.ForeignKey(
        'wholesale.WeeklySales',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='stock_outs',
    )
    quantity = models.PositiveIntegerField()
    unit_value = models.DecimalField(max_digits=12, decimal_places=2)
    total_value = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='wholesale_stock_outs_approved',
    )
    issued_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f"OUT {self.quantity} × {self.product.sku} ← {self.wholesale.name}"

    def clean(self):
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if self.unit_value is not None and self.unit_value <= 0:
            raise ValidationError({'unit_value': 'Unit value must be greater than zero.'})
        if self.weekly_sales and self.wholesale_id:
            if self.weekly_sales.wholesale_id != self.wholesale_id:
                raise ValidationError({
                    'weekly_sales': 'Weekly sales period belongs to a different wholesale.'
                })

    def save(self, *args, **kwargs):
        from .services import sync_stock_out

        self.total_value = to_decimal(self.unit_value) * (self.quantity or 0)

        old_qty = 0
        if self.pk:
            old_qty = WholesaleStockOut.objects.get(pk=self.pk).quantity

        super().save(*args, **kwargs)
        sync_stock_out(self, old_quantity=old_qty)

    def delete(self, *args, **kwargs):
        from .services import reverse_stock_out
        reverse_stock_out(self)
        super().delete(*args, **kwargs)


# ---------------------------------------------------------------------------
# Damages at wholesale storage level (finance-reviewable)
# ---------------------------------------------------------------------------

class WholesaleDamage(FinanceReviewableModel):
    """Damaged or lost stock at the wholesale storage level."""
    wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='damages',
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='wholesale_damages',
    )
    quantity = models.PositiveIntegerField()
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_loss_value = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    image = models.ImageField(upload_to='damages/wholesale/', blank=True, null=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='wholesale_damages_reported',
    )
    reported_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-reported_at']
        verbose_name_plural = 'Wholesale damages'

    def __str__(self):
        return f"DMG {self.quantity} × {self.product.sku} @ {self.wholesale.name}"

    def clean(self):
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if self.selling_price is not None and self.selling_price <= 0:
            raise ValidationError({
                'selling_price': 'Selling price must be greater than zero.'
            })

    def save(self, *args, **kwargs):
        from .services import sync_damage
        from finance.services import compute_damage_flags

        self.total_loss_value = (
            to_decimal(self.selling_price) * (self.quantity or 0)
        )
        self.flags = compute_damage_flags(self)

        old_qty = 0
        if self.pk:
            old_qty = WholesaleDamage.objects.get(pk=self.pk).quantity

        super().save(*args, **kwargs)
        sync_damage(self, old_quantity=old_qty)

    def delete(self, *args, **kwargs):
        from .services import reverse_damage
        reverse_damage(self)
        super().delete(*args, **kwargs)


# ---------------------------------------------------------------------------
# Inter-wholesale transfers
# ---------------------------------------------------------------------------

class InterWholesaleTransfer(models.Model):
    r"""
    Move stock from one wholesale outlet to another.

        pending -> in_transit -> received
                \-> cancelled
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_transit', 'In Transit'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    ]

    from_wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='transfers_out',
    )
    to_wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='transfers_in',
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='wholesale_transfers',
    )
    quantity = models.PositiveIntegerField()
    unit_value = models.DecimalField(max_digits=12, decimal_places=2)
    total_value = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default='pending',
    )
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)

    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='transfers_initiated',
    )
    initiated_at = models.DateTimeField(auto_now_add=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='transfers_approved',
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='transfers_received',
    )
    received_at = models.DateTimeField(null=True, blank=True)

    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='transfers_cancelled',
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-initiated_at']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(from_wholesale=models.F('to_wholesale')),
                name='transfer_wholesales_differ',
            ),
        ]

    def __str__(self):
        return (
            f"TRF #{self.pk} {self.from_wholesale.name} → "
            f"{self.to_wholesale.name} ({self.status})"
        )

    def clean(self):
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if self.unit_value is not None and self.unit_value <= 0:
            raise ValidationError({'unit_value': 'Unit value must be greater than zero.'})
        if self.from_wholesale_id and self.to_wholesale_id:
            if self.from_wholesale_id == self.to_wholesale_id:
                raise ValidationError({
                    'to_wholesale': 'Source and destination must be different.'
                })

    def save(self, *args, **kwargs):
        self.total_value = to_decimal(self.unit_value) * (self.quantity or 0)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Weekly sales cycle
# ---------------------------------------------------------------------------

class WeeklySales(models.Model):
    """A sales period at a wholesale outlet."""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]

    wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='weekly_sales',
    )
    year = models.IntegerField(editable=False)
    week_number = models.PositiveIntegerField(editable=False)
    label = models.CharField(max_length=50, editable=False)

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='weekly_sales_as_seller',
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='weekly_sales_received',
    )

    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='open',
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-year', '-week_number']
        verbose_name_plural = 'Weekly sales'
        unique_together = ('wholesale', 'year', 'week_number')

    def __str__(self):
        return f"{self.label} @ {self.wholesale.name} ({self.status})"

    def clean(self):
        if (self.start_date and self.end_date
                and self.end_date < self.start_date):
            raise ValidationError({'end_date': 'End date must be on or after start date.'})

    def save(self, *args, **kwargs):
        from django.utils import timezone

        if not self.week_number:
            self.year = self.year or timezone.now().year
            self.week_number = _next_week_number(self.year, self.wholesale)
            self.label = f"Wk {self.week_number} — {self.year}"

        super().save(*args, **kwargs)

    @property
    def total_stock_in_value(self):
        from django.db.models import Sum
        return (
            self.stock_outs.aggregate(t=Sum('total_value'))['t']
            or Decimal('0.00')
        )

    @property
    def total_cashed(self):
        from django.db.models import Sum
        return (
            self.cash_ins.filter(finance_status='approved')
            .aggregate(t=Sum('amount'))['t']
            or Decimal('0.00')
        )

    @property
    def total_cashed_pending(self):
        from django.db.models import Sum
        return (
            self.cash_ins.exclude(finance_status='approved')
            .aggregate(t=Sum('amount'))['t']
            or Decimal('0.00')
        )

    @property
    def total_expenses(self):
        from django.db.models import Sum
        return (
            self.expenses.filter(finance_status='approved')
            .aggregate(t=Sum('amount'))['t']
            or Decimal('0.00')
        )

    @property
    def total_expenses_pending(self):
        from django.db.models import Sum
        return (
            self.expenses.exclude(finance_status='approved')
            .aggregate(t=Sum('amount'))['t']
            or Decimal('0.00')
        )

    @property
    def total_damages_value(self):
        from django.db.models import Sum
        return (
            self.damages.filter(finance_status='approved')
            .aggregate(t=Sum('total_loss_value'))['t']
            or Decimal('0.00')
        )

    @property
    def total_damages_value_pending(self):
        from django.db.models import Sum
        return (
            self.damages.exclude(finance_status='approved')
            .aggregate(t=Sum('total_loss_value'))['t']
            or Decimal('0.00')
        )

    @property
    def net_position(self):
        return self.total_cashed - self.total_expenses - self.total_damages_value


def _next_week_number(year, wholesale):
    """Highest existing week number at this wholesale + 1."""
    from django.db.models import Max
    latest = WeeklySales.objects.filter(
        year=year, wholesale=wholesale,
    ).aggregate(m=Max('week_number'))['m'] or 0
    return latest + 1


# ---------------------------------------------------------------------------
# Weekly sales — sub-records (finance-reviewable)
# ---------------------------------------------------------------------------

class WeeklySalesCashIn(FinanceReviewableModel):
    """Cash received during a weekly sales period."""
    weekly_sales = models.ForeignKey(
        WeeklySales, on_delete=models.CASCADE, related_name='cash_ins',
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='weekly_cash_ins_received',
    )
    received_at = models.DateTimeField(auto_now_add=True)
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f"K{self.amount} on {self.weekly_sales.label}"

    def clean(self):
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({'amount': 'Amount must be greater than zero.'})

    def save(self, *args, **kwargs):
        from finance.services import compute_cash_in_flags
        self.flags = compute_cash_in_flags(self)
        super().save(*args, **kwargs)


class WeeklySalesExpense(FinanceReviewableModel):
    """Expenses incurred during a weekly sales period."""
    weekly_sales = models.ForeignKey(
        WeeklySales, on_delete=models.CASCADE, related_name='expenses',
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.TextField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='weekly_expenses_recorded',
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return f"K{self.amount} — {self.description[:40]}"

    def clean(self):
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({'amount': 'Amount must be greater than zero.'})

    def save(self, *args, **kwargs):
        from finance.services import compute_expense_flags
        self.flags = compute_expense_flags(self)
        super().save(*args, **kwargs)


class WeeklySalesDamage(FinanceReviewableModel):
    """Damages that occur during a weekly sales period."""
    weekly_sales = models.ForeignKey(
        WeeklySales, on_delete=models.CASCADE, related_name='damages',
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='weekly_damages',
    )
    quantity = models.PositiveIntegerField()
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_loss_value = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    image = models.ImageField(upload_to='damages/weekly/', blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='weekly_damages_recorded',
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-recorded_at']
        verbose_name_plural = 'Weekly sales damages'

    def __str__(self):
        return f"DMG {self.quantity} × {self.product.sku} on {self.weekly_sales.label}"

    def clean(self):
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if self.selling_price is not None and self.selling_price <= 0:
            raise ValidationError({
                'selling_price': 'Selling price must be greater than zero.'
            })

    def save(self, *args, **kwargs):
        from finance.services import compute_damage_flags
        self.total_loss_value = (
            to_decimal(self.selling_price) * (self.quantity or 0)
        )
        self.flags = compute_damage_flags(self)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Pending collections (hardware laybys)
# ---------------------------------------------------------------------------

class PendingCollection(models.Model):
    """
    Hardware layby — goods paid for but awaiting pickup at a specific
    wholesale outlet.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('ready', 'Ready for Collection'),
        ('collected', 'Collected'),
        ('cancelled', 'Cancelled'),
    ]

    wholesale = models.ForeignKey(
        Wholesale, on_delete=models.PROTECT, related_name='collections',
    )
    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=20, blank=True)
    description = models.TextField(help_text="What was bought / reserved")
    total_price = models.DecimalField(max_digits=14, decimal_places=2)
    amount_paid = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    balance = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    collection_deadline = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='pending',
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='recorded_collections',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        total = to_decimal(self.total_price)
        paid = to_decimal(self.amount_paid)
        self.balance = total - paid
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.customer_name} — {self.status} ({self.balance} owing)"