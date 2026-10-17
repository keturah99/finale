from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import Department, Role
from core.roles import ROLE_DEFINITIONS

User = get_user_model()


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


# username, department_code, wholesale_name, role_names
SEED_USERS = [
    ('tmgr',        'transport',  None,               ['transport_manager']),
    ('tclerk',      'transport',  None,               ['transport_clerk']),
    ('wmgr',        'core',       None,               ['wholesale_manager', 'reporting_analyst']),
    ('wclerk_lsk',  'core',       'Wholesale Lusaka', ['wholesale_clerk']),
    ('wclerk_ktw',  'core',       'Wholesale Kitwe',  ['wholesale_clerk']),
    ('wcash_lsk',   'core',       'Wholesale Lusaka', ['cashier']),
    ('imgr',        'groceries',  None,               ['inventory_manager', 'reporting_analyst']),
    ('iclerk_gr',   'groceries',  None,               ['inventory_clerk']),
    ('iclerk_hw',   'hardware',   None,               ['inventory_clerk']),
    ('sco',         'supplychain',None,               ['supply_chain_officer']),
    ('poffic',      'payroll',    None,               ['payroll_officer']),
    ('analyst',     'reporting',  None,               ['reporting_analyst']),
    ('auditor',     'core',       None,               ['auditor']),
    ('fofficer', 'core', None, ['finance_officer']),
    ('fmgr',     'core', None, ['finance_manager']),
]


class Command(BaseCommand):
    help = 'Seed departments, roles, and demo users with scopes.'

    def handle(self, *args, **options):
        # 1. Departments
        for code, name in DEPARTMENTS:
            dept, created = Department.objects.get_or_create(
                code=code, defaults={'name': name}
            )
            self.stdout.write(
                f"  {'created' if created else 'exists '} dept: {dept.code}"
            )

        # 2. Roles
        for name, description in ROLE_DEFINITIONS.items():
            role, created = Role.objects.get_or_create(
                name=name, defaults={'description': description}
            )
            self.stdout.write(
                f"  {'created' if created else 'exists '} role: {role.name}"
            )

        # 3. Demo users (only if flag passed)
        if options.get('with_users'):
            from wholesale.models import Wholesale

            for username, dept_code, wholesale_name, role_names in SEED_USERS:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults=dict(is_active=True),
                )
                if created:
                    user.set_password('testpass123')

                # Scope FKs
                if dept_code:
                    user.department = Department.objects.get(code=dept_code)
                if wholesale_name:
                    try:
                        user.wholesale = Wholesale.objects.get(name=wholesale_name)
                    except Wholesale.DoesNotExist:
                        self.stdout.write(self.style.WARNING(
                            f'  outlet "{wholesale_name}" not found — skipping scope'
                        ))

                user.save()

                # Roles
                user.roles.clear()
                for rn in role_names:
                    role, _ = Role.objects.get_or_create(name=rn, defaults={'description': ''})
                    user.roles.add(role)

                self.stdout.write(
                    f"  {'created' if created else 'exists '} user: {username} "
                    f"(dept={dept_code}, outlet={wholesale_name}, "
                    f"roles={role_names})"
                )

        self.stdout.write(self.style.SUCCESS('Done.'))

    def add_arguments(self, parser):
        parser.add_argument(
            '--with-users',
            action='store_true',
            help='Also create demo users with scopes and roles.',
        )