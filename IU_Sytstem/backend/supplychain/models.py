from decimal import Decimal, InvalidOperation

from django.db import models
from django.conf import settings


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


class Farmer(models.Model):
    """Registry of farmers supplying produce to the company."""
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    phone = models.CharField(max_length=20, blank=True)
    nrc = models.CharField(max_length=20, blank=True, verbose_name="NRC Number")
    location = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


class Crop(models.Model):
    """Crops the company buys (maize, groundnuts, soybeans, etc.)."""
    CROP_CHOICES = [
        ('maize', 'Maize'),
        ('groundnuts', 'Groundnuts'),
        ('soybeans', 'Soybeans'),
        ('sunflower', 'Sunflower'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=20, choices=CROP_CHOICES, unique=True)
    unit = models.CharField(max_length=10, default='kg')

    def __str__(self):
        return self.get_name_display()


class ProducePurchase(models.Model):
    """A single purchase of produce from a farmer."""
    PAYMENT_STATUS = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('partial', 'Partial'),
    ]

    farmer = models.ForeignKey(
        Farmer, on_delete=models.PROTECT, related_name='purchases'
    )
    crop = models.ForeignKey(
        Crop, on_delete=models.PROTECT, related_name='purchases'
    )
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2)
    price_per_kg = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(
        max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'),
    )
    amount_paid = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    payment_status = models.CharField(
        max_length=10, choices=PAYMENT_STATUS, default='pending'
    )
    purchase_date = models.DateField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-purchase_date', '-created_at']

    def save(self, *args, **kwargs):
        qty = to_decimal(self.quantity_kg)
        price = to_decimal(self.price_per_kg)
        paid = to_decimal(self.amount_paid)

        self.total_amount = qty * price

        if paid >= self.total_amount and self.total_amount > 0:
            self.payment_status = 'paid'
        elif paid > 0:
            self.payment_status = 'partial'
        else:
            self.payment_status = 'pending'

        super().save(*args, **kwargs)

    @property
    def balance(self):
        return to_decimal(self.total_amount) - to_decimal(self.amount_paid)

    def __str__(self):
        return f"{self.crop} {self.quantity_kg}kg from {self.farmer}"


class ProductionBatch(models.Model):
    """Raw material intake → finished product output."""
    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    batch_number = models.CharField(max_length=40, unique=True)
    raw_material_name = models.CharField(max_length=100)
    raw_material_qty_kg = models.DecimalField(max_digits=12, decimal_places=2)
    finished_product_name = models.CharField(max_length=100, blank=True)
    finished_product_qty_kg = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    yield_percentage = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True, editable=False,
    )
    start_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default='planned',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']
        verbose_name_plural = 'Production batches'

    def save(self, *args, **kwargs):
        raw = to_decimal(self.raw_material_qty_kg)
        finished = to_decimal(self.finished_product_qty_kg)

        if raw > 0 and finished > 0:
            self.yield_percentage = round((finished / raw) * 100, 2)
        else:
            self.yield_percentage = None

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.batch_number} ({self.status})"