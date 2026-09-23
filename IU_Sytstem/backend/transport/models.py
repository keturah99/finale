import re
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

REG_NUMBER_RE = re.compile(r'^[A-Z]{3} \d{4}$')


def validate_registration(value):
    """
    Registration numbers must be exactly 'ABC 1234' — three uppercase
    letters, a single space, four digits.
    """
    if not REG_NUMBER_RE.match(value or ''):
        raise ValidationError(
            f'"{value}" is not a valid registration number. '
            f'Use the format "ABC 1234" (three letters, space, four digits).'
        )


# ---------------------------------------------------------------------------
# License classes
# ---------------------------------------------------------------------------

class LicenseClass(models.Model):
    """
    Lookup table for Zambian driving license classes.

    Seeded via data migration. Do not edit rows manually unless RTSA
    changes the classification (rare).
    """
    code = models.CharField(max_length=4, unique=True)
    description = models.CharField(max_length=200)
    max_tonnage = models.DecimalField(
        max_digits=6, decimal_places=2,
        null=True, blank=True,
        help_text='Maximum vehicle tonnage this class covers. NULL = unlimited.',
    )
    allows_trailer = models.BooleanField(default=False)
    requires_psv_for_public = models.BooleanField(default=False)

    class Meta:
        ordering = ['code']
        verbose_name = 'License class'
        verbose_name_plural = 'License classes'

    def __str__(self):
        return self.code


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------

class Vehicle(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('on_trip', 'On Trip'),
        ('maintenance', 'Maintenance'),
        ('retired', 'Retired'),
    ]
    TYPE_CHOICES = [
        ('small_car', 'Small Car'),
        ('van', 'Van'),
        ('canter', 'Canter'),
        ('fuso', 'Fuso'),
        ('tipper', 'Tipper'),
        ('semi_truck', 'Semi Truck'),
    ]
    CATEGORY_CHOICES = [
        ('private', 'Private'),
        ('public', 'Public'),
    ]

    registration_number = models.CharField(
        max_length=8, unique=True,
        validators=[validate_registration],
        help_text='Format: ABC 1234',
    )
    make = models.CharField(
        max_length=50,
        help_text='Manufacturer — stored uppercase.',
    )
    tonnage = models.DecimalField(
        max_digits=6, decimal_places=2,
        help_text='Vehicle tonnage (2 decimals).',
    )
    vehicle_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    category = models.CharField(
        max_length=10, choices=CATEGORY_CHOICES, default='private',
    )
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default='available',
    )
    primary_driver = models.ForeignKey(
        'Driver',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='primary_for_vehicle',
        help_text='Driver normally assigned to this vehicle.',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['registration_number']
        constraints = [
            models.UniqueConstraint(
                fields=['primary_driver'],
                condition=models.Q(primary_driver__isnull=False),
                name='unique_primary_driver_per_vehicle',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.registration_number:
            self.registration_number = self.registration_number.upper()
        if self.make:
            self.make = self.make.upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.registration_number} "
            f"({self.make} {self.get_vehicle_type_display()})"
        )


# ---------------------------------------------------------------------------
# Drivers
# ---------------------------------------------------------------------------

class Driver(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('on_trip', 'On Trip'),
        ('off_duty', 'Off Duty'),
        ('suspended', 'Suspended'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='driver_profile',
    )
    license_number = models.CharField(max_length=50, unique=True)
    license_expiry = models.DateField()
    license_classes = models.ManyToManyField(
        LicenseClass, blank=True, related_name='drivers',
        help_text='License classes held by this driver.',
    )
    has_psv = models.BooleanField(
        default=False,
        help_text='Driver holds a Public Service Vehicle endorsement.',
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='available')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['user__first_name', 'user__last_name']

    def __str__(self):
        return (
            f"{self.user.get_full_name() or self.user.username} "
            f"({self.license_number})"
        )

    @property
    def class_codes(self):
        """Convenience accessor: sorted list of class codes, e.g. ['B', 'CE']."""
        return sorted(self.license_classes.values_list('code', flat=True))


# ---------------------------------------------------------------------------
# Trailers
# ---------------------------------------------------------------------------

class Trailer(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('on_trip', 'On Trip'),
        ('maintenance', 'Maintenance'),
        ('retired', 'Retired'),
    ]
    CATEGORY_CHOICES = [
        ('private', 'Private'),
        ('public', 'Public'),
    ]

    registration_number = models.CharField(
        max_length=8, unique=True,
        validators=[validate_registration],
        help_text='Format: ABC 1234',
    )
    make = models.CharField(max_length=50)
    tonnage = models.DecimalField(max_digits=6, decimal_places=2)
    category = models.CharField(
        max_length=10, choices=CATEGORY_CHOICES, default='private',
    )
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default='available',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['registration_number']

    def save(self, *args, **kwargs):
        if self.registration_number:
            self.registration_number = self.registration_number.upper()
        if self.make:
            self.make = self.make.upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.registration_number} ({self.make})"


# ---------------------------------------------------------------------------
# Transport bookings
# ---------------------------------------------------------------------------

class TransportBooking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    CARGO_CATEGORY_CHOICES = [
        ('general', 'General'),
        ('dg', 'Dangerous Goods'),
        ('bulk', 'Bulk'),
    ]
    PAIRING_SOURCE_CHOICES = [
        ('primary', 'Primary Pairing'),
        ('manual', 'Manual'),
        ('auto', 'Auto-detected'),
    ]

    # Customer
    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=20)
    customer_email = models.EmailField(blank=True)

    # Cargo
    pickup_location = models.CharField(max_length=200)
    delivery_location = models.CharField(max_length=200)
    cargo_description = models.TextField()
    cargo_weight_kg = models.DecimalField(max_digits=12, decimal_places=2)
    cargo_category = models.CharField(
        max_length=10, choices=CARGO_CATEGORY_CHOICES, default='general',
    )

    # Schedule
    pickup_date = models.DateField()
    delivery_date = models.DateField(null=True, blank=True)
    quoted_price = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )

    # Assignment
    assigned_vehicle = models.ForeignKey(
        Vehicle, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='bookings',
    )
    assigned_driver = models.ForeignKey(
        Driver, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='bookings',
    )
    assigned_trailers = models.ManyToManyField(
        Trailer, blank=True, related_name='bookings',
    )
    pairing_source = models.CharField(
        max_length=10, choices=PAIRING_SOURCE_CHOICES,
        default='manual', blank=True,
    )
    pairing_warning = models.TextField(blank=True)

    assigned_at = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispatched_bookings',
    )

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"#{self.id} {self.customer_name} → {self.delivery_location} ({self.status})"