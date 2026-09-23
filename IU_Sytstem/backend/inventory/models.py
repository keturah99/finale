from django.db import models
from django.conf import settings


class Product(models.Model):
    """A sellable item — groceries, hardware, or produced goods."""
    DEPARTMENT_CHOICES = [
        ('groceries', 'Groceries'),
        ('household', 'Household'),
        ('hardware', 'Hardware'),
        ('production', 'Production'),
    ]

    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    department = models.CharField(max_length=20, choices=DEPARTMENT_CHOICES)
    category = models.CharField(max_length=80, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    reorder_level = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.sku} — {self.name}"


class StockLevel(models.Model):
    """Current quantity on hand for a product."""
    product = models.OneToOneField(
        Product, on_delete=models.CASCADE, related_name='stock'
    )
    quantity_on_hand = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.sku}: {self.quantity_on_hand}"


class StockMovement(models.Model):
    """Audit log of every stock-in and stock-out event."""
    MOVEMENT_TYPES = [
        ('in', 'Stock In'),
        ('out', 'Stock Out'),
        ('adjust', 'Adjustment'),
    ]

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='movements'
    )
    movement_type = models.CharField(max_length=10, choices=MOVEMENT_TYPES)
    quantity = models.PositiveIntegerField()
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_movement_type_display()} {self.quantity} × {self.product.sku}"


class StockAlert(models.Model):
    """Low-stock or out-of-stock alerts."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='alerts'
    )
    alert_type = models.CharField(max_length=20)  # 'low' or 'out'
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.alert_type}] {self.product.sku}"