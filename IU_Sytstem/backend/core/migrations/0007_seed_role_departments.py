from django.db import migrations


# role_name -> list of department codes
ROLE_DEPARTMENT_MAP = {
    'transport_manager':    ['transport'],
    'transport_clerk':      ['transport'],
    'inventory_manager':    ['groceries', 'household', 'hardware', 'production'],
    'inventory_clerk':      ['groceries', 'household', 'hardware', 'production'],
    'supply_chain_officer': ['supplychain'],
    'payroll_officer':      ['payroll'],
    'reporting_analyst':    ['reporting', 'core'],
    'wholesale_manager':    ['groceries', 'household', 'hardware'],
    'wholesale_clerk':      ['groceries', 'household', 'hardware'],
    'cashier':              ['groceries', 'household'],
    'security_officer':     ['core'],
    # 'auditor' intentionally has no departments — treated as global
}


def seed(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    Department = apps.get_model('core', 'Department')

    for role_name, dept_codes in ROLE_DEPARTMENT_MAP.items():
        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            continue

        departments = Department.objects.filter(code__in=dept_codes)
        role.departments.set(departments)


def unseed(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.all():
        role.departments.clear()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0006_role_departments'),   # ← replace with the actual name
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]