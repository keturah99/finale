from django.db import models
from django.conf import settings
from decimal import Decimal


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
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, editable=False)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    payment_status = models.CharField(
        max_length=10, choices=PAYMENT_STATUS, default='pending'
    )
    purchase_date = models.DateField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-purchase_date', '-created_at']

    def save(self, *args, **kwargs):
        self.total_amount = (self.quantity_kg or 0) * (self.price_per_kg or 0)
        if self.amount_paid >= self.total_amount and self.total_amount > 0:
            self.payment_status = 'paid'
        elif self.amount_paid > 0:
            self.payment_status = 'partial'
        super().save(*args, **kwargs)

    @property
    def balance(self):
        return (self.total_amount or 0) - (self.amount_paid or 0)

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
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    yield_percentage = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True, editable=False
    )
    start_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='planned')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']
        verbose_name_plural = 'Production batches'

    def save(self, *args, **kwargs):
        if (self.raw_material_qty_kg and self.finished_product_qty_kg
                and self.raw_material_qty_kg > 0):
            self.yield_percentage = round(
                (self.finished_product_qty_kg / self.raw_material_qty_kg) * 100, 2
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.batch_number} ({self.status})"


class PendingCollection(models.Model):
    """Hardware layby — paid-for goods awaiting pickup."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('ready', 'Ready for Collection'),
        ('collected', 'Collected'),
        ('cancelled', 'Cancelled'),
    ]

    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=20, blank=True)
    description = models.TextField(help_text="What was bought / reserved")
    total_price = models.DecimalField(max_digits=14, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    balance = models.DecimalField(max_digits=14, decimal_places=2, editable=False, default=Decimal('0.00'))
    collection_deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        self.balance = (self.total_price or 0) - (self.amount_paid or 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.customer_name} — {self.status} ({self.balance} owing)"