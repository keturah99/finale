from django.db import migrations


ROLES = [
    (
        'wholesale_manager',
        'Full control over wholesale stock, transfers, and weekly sales',
    ),
    (
        'wholesale_clerk',
        'Record stock-in, damages, and receive inter-wholesale transfers',
    ),
    (
        'cashier',
        'Record cash-ins on open weekly sales periods',
    ),
]


def seed(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name, description in ROLES:
        Role.objects.update_or_create(
            name=name,
            defaults={'description': description},
        )


def unseed(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    Role.objects.filter(name__in=[r[0] for r in ROLES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        # REPLACE with the actual last core migration filename (without .py)
        ('core', '0002_user_bank_account_user_bank_branch_user_bank_name'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]