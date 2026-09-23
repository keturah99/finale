from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    """Company departments matching the modular monolith modules."""
    code = models.SlugField(unique=True)          # e.g. 'transport', 'payroll'
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Role(models.Model):
    """Named roles used by RBAC (e.g., 'Transport Head', 'Payroll Officer')."""
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Custom user with department + role links for RBAC."""
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL
    )
    roles = models.ManyToManyField(Role, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    bank_account = models.CharField(max_length=40, blank=True)

    def has_role(self, role_name):
        return self.roles.filter(name=role_name).exists()

    def __str__(self):
        return f"{self.username} ({self.get_full_name() or 'no name'})"