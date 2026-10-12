from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    """Company departments matching the modular monolith modules."""
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Role(models.Model):
    """Named roles used by RBAC (e.g. 'Transport Manager')."""
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


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

    def has_role(self, role_name):
        return self.roles.filter(name=role_name).exists()

    def __str__(self):
        return f"{self.username} ({self.get_full_name() or 'no name'})"


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