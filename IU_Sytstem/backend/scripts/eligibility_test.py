"""
Standalone eligibility matrix test.

Run:
    docker compose exec -T backend python manage.py shell \
        -c "exec(open('/app/scripts/eligibility_test.py').read())"
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model

from transport.models import Vehicle, Driver, LicenseClass
from transport.eligibility import is_driver_eligible, required_class_for

User = get_user_model()


def hr(t):
    print("\n" + "=" * 68)
    print(t)
    print("=" * 68)


def make_driver(username, codes, psv=False, expired=False):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('testpass123')
    u.save()
    driver, _ = Driver.objects.get_or_create(
        user=u,
        defaults=dict(
            license_number=f'DL-{username}',
            license_expiry=date.today() + timedelta(days=365),
        ),
    )
    driver.license_number = f'DL-{username}'
    driver.license_expiry = (
        date.today() - timedelta(days=1) if expired
        else date.today() + timedelta(days=365)
    )
    driver.has_psv = psv
    driver.status = 'available'
    driver.save()
    driver.license_classes.clear()
    for c in codes:
        driver.license_classes.add(LicenseClass.objects.get(code=c))
    return driver


def make_vehicle(reg, tonnage, category, vtype='fuso', status='available'):
    v, _ = Vehicle.objects.get_or_create(
        registration_number=reg,
        defaults=dict(
            make='TEST',
            tonnage=Decimal(str(tonnage)),
            vehicle_type=vtype,
            category=category,
            status=status,
        ),
    )
    v.make = 'TEST'
    v.tonnage = Decimal(str(tonnage))
    v.vehicle_type = vtype
    v.category = category
    v.status = status
    v.save()
    return v


# (driver_classes, has_psv, tonnage, category, expected_ok, label)
CASES = [
    (['B'],       False, '3.00',  'private', True,  'B, no PSV, 3t private'),
    (['B'],       False, '3.00',  'public',  False, 'B, no PSV, 3t public'),
    (['B'],       True,  '3.00',  'public',  True,  'B + PSV, 3t public'),
    (['B'],       True,  '5.00',  'private', False, 'B only, 5t private needs C1'),
    (['C1'],      False, '5.00',  'private', True,  'C1, 5t private'),
    (['C1'],      False, '5.00',  'public',  False, 'C1, no PSV, 5t public'),
    (['C1'],      True,  '5.00',  'public',  True,  'C1 + PSV, 5t public'),
    (['C'],       False, '20.00', 'private', True,  'C, 20t private'),
    (['C'],       False, '20.00', 'public',  False, 'C, no PSV, 20t public'),
    (['C', 'CE'], False, '20.00', 'private', True,  'CE, 20t private'),
]


def main():
    hr("Required class per vehicle")
    for t, ttype, expected in [
        ('3.00',  'small_car',  'B'),
        ('3.00',  'van',        'B'),
        ('10.00', 'fuso',       'C1'),
        ('20.00', 'tipper',     'C'),
        ('20.00', 'semi_truck', 'C'),
    ]:
        v = make_vehicle(f'TMP {t[:3]}', t, 'private', ttype)
        got = required_class_for(v)
        mark = 'OK' if got == expected else 'FAIL'
        print(f'  {ttype:12} {t:>6}t -> {got:4} (expected {expected}) {mark}')

    hr("Eligibility matrix")
    print(f"  {'case':40} {'expected':>9} {'got':>5}  reason")
    for i, (codes, psv, tonnage, category, expected, label) in enumerate(CASES):
        d = make_driver(f'td_{i}', codes, psv=psv)
        v = make_vehicle(f'TST {1000 + i}', tonnage, category)
        ok, reason = is_driver_eligible(d, v)
        mark = 'OK' if ok == expected else 'FAIL'
        print(f'  {label:40} {str(expected):>9} {str(ok):>5}  {reason[:40]}  {mark}')

    hr("Expired license")
    d = make_driver('td_expired', ['C'], psv=True, expired=True)
    v = make_vehicle('TST 9001', '20.00', 'private')
    ok, reason = is_driver_eligible(d, v)
    mark = 'OK' if not ok else 'FAIL'
    print(f'  expected False, got {ok}: {reason}  {mark}')

    hr("DONE")


main()