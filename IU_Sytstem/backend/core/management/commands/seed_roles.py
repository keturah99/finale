from django.core.management.base import BaseCommand
from core.models import Department, Role
from core.roles import ROLE_DEFINITIONS


DEPARTMENTS = [
    ('transport', 'Transport & Logistics'),
    ('groceries', 'Groceries'),
    ('household', 'Household'),
    ('hardware', 'Hardware & Construction'),
    ('production', 'Production'),
    ('supplychain', 'Supply Chain & Procurement'),
    ('payroll', 'Payroll & HR'),
    ('reporting', 'Reporting & Analytics'),
    ('core', 'Administration'),
]


class Command(BaseCommand):
    help = 'Seed departments and roles'

    def handle(self, *args, **options):
        for code, name in DEPARTMENTS:
            dept, created = Department.objects.get_or_create(
                code=code, defaults={'name': name}
            )
            self.stdout.write(
                f"  {'created' if created else 'exists '} dept: {dept.code}"
            )

        for name, description in ROLE_DEFINITIONS.items():
            role, created = Role.objects.get_or_create(
                name=name, defaults={'description': description}
            )
            self.stdout.write(
                f"  {'created' if created else 'exists '} role: {role.name}"
            )

        self.stdout.write(self.style.SUCCESS("Done."))