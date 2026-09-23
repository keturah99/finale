from django.db import migrations


CLASSES = [
    ('B',  'Light motor vehicle up to 4 tonnes',      4.00,  False, True),
    ('BE', 'Light motor vehicle with trailer',        4.00,  True,  True),
    ('C1', 'Heavy motor vehicle under 16 tonnes',    16.00,  False, False),
    ('C1E','Heavy motor vehicle with trailer < 16t', 16.00,  True,  False),
    ('C',  'Heavy motor vehicle 16 tonnes and above', None,  False, False),
    ('CE', 'Heavy motor vehicle with trailer >= 16t', None,  True,  False),
    ('DG', 'Dangerous goods endorsement',             None,  False, False),
]


def seed(apps, schema_editor):
    LicenseClass = apps.get_model('transport', 'LicenseClass')
    for code, desc, tonnage, trailer, psv in CLASSES:
        LicenseClass.objects.update_or_create(
            code=code,
            defaults=dict(
                description=desc,
                max_tonnage=tonnage,
                allows_trailer=trailer,
                requires_psv_for_public=psv,
            ),
        )


def unseed(apps, schema_editor):
    LicenseClass = apps.get_model('transport', 'LicenseClass')
    LicenseClass.objects.filter(code__in=[c[0] for c in CLASSES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('transport', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(seed, unseed),
    ]