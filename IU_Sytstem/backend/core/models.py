import re

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

NRC_RE = re.compile(r'^\d{6}/\d{2}/\d$')


def validate_nrc(value):
    """
    Validate a Zambian NRC number.

    Expected format: 123456/78/9
      - 6 digits (registration sequence)
      - /
      - 2 digits (year of issue)
      - /
      - 1 digit (check digit)
    """
    if value in (None, ''):
        return
    if not NRC_RE.match(value):
        raise ValidationError(
            f'"{value}" is not a valid NRC number. '
            f'Use the format 123456/78/9.'
        )


# ---------------------------------------------------------------------------
# Department
# ---------------------------------------------------------------------------

class Department(models.Model):
    """Company departments matching the modular monolith modules."""
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------

class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    departments = models.ManyToManyField(
        Department,
        blank=True,
        related_name='roles',
        help_text='Departments this role applies to. Empty = global role.',
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(AbstractUser):
    """
    Custom user with department + wholesale scoping and role links.

    Scoping rules:
      - If `wholesale` is set, the user only sees/modifies data for that
        outlet in the Wholesale module.
      - If `department` is set, the user only sees/modifies data for that
        department in the Inventory module.
      - Superusers bypass both rules.
    """
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='users',
    )
    wholesale = models.ForeignKey(
        'wholesale.Wholesale', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_users',
        help_text='If set, the user is scoped to this outlet.',
    )
    roles = models.ManyToManyField(Role, blank=True, related_name='users')
    phone = models.CharField(max_length=20, blank=True)

    nrc = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        validators=[validate_nrc],
        verbose_name='NRC Number',
        help_text='Zambian NRC, e.g. 123456/78/9',
    )

    def save(self, *args, **kwargs):
        # Normalise empty NRC to NULL so multiple users without an NRC
        # don't violate the unique constraint
        if self.nrc == '':
            self.nrc = None
        super().save(*args, **kwargs)

    def has_role(self, role_name):
        return self.roles.filter(name=role_name).exists()

    def __str__(self):
        return f"{self.username} ({self.get_full_name() or 'no name'})"


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

class IdempotencyKey(models.Model):
    """
    Cached response for requests bearing an X-Client-Id header.

    When the same client_id is seen again, the middleware returns the
    cached response instead of re-executing the view. Makes retries
    from the offline sync queue safe.
    """
    key = models.UUIDField(unique=True, db_index=True)
    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
    )
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=500)
    response_status = models.IntegerField()
    response_body = models.TextField()
    response_headers = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Idempotency key'
        verbose_name_plural = 'Idempotency keys'

    def __str__(self):
        return f"{self.method} {self.path} — {self.key}"