"""
End-to-end dispatch flow test.

Run:
    docker compose exec -T backend python manage.py shell \
        -c "exec(open('/app/scripts/dispatch_smoke.py').read())"
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model

from transport.models import (
    Vehicle, Driver, Trailer, LicenseClass, TransportBooking,
)
from transport.eligibility import is_driver_eligible, required_class_for

User = get_user_model()


def hr(t):
    print("\n" + "=" * 68)
    print(t)
    print("=" * 68)


def make_user(username, first, last):
    u, _ = User.objects.get_or_create(username=username)
    u.first_name, u.last_name = first, last
    u.set_password('testpass123')
    u.save()
    return u


def make_driver(username, codes, psv=False):
    u = make_user(username, username.title(), 'Driver')
    d, _ = Driver.objects.get_or_create(
        user=u,
        defaults=dict(
            license_number=f'DL-{username}',
            license_expiry=date.today() + timedelta(days=365),
        ),
    )
    d.license_number = f'DL-{username}'
    d.license_expiry = date.today() + timedelta(days=365)
    d.has_psv = psv
    d.status = 'available'
    d.save()
    d.license_classes.clear()
    for c in codes:
        d.license_classes.add(LicenseClass.objects.get(code=c))
    return d


def make_vehicle(reg, tonnage, category, vtype='semi_truck', primary_driver=None):
    v, _ = Vehicle.objects.get_or_create(
        registration_number=reg,
        defaults=dict(
            make='TEST',
            tonnage=Decimal(str(tonnage)),
            vehicle_type=vtype,
            category=category,
        ),
    )
    v.make = 'TEST'
    v.tonnage = Decimal(str(tonnage))
    v.vehicle_type = vtype
    v.category = category
    v.status = 'available'
    v.primary_driver = primary_driver
    v.save()
    return v


def main():
    # --- Fixtures ---
    hr("Setting up fixtures")

    # Clean previous test data
    TransportBooking.objects.filter(customer_name__startswith='Smoke').delete()
    Vehicle.objects.filter(registration_number__startswith='SMK').delete()
    Trailer.objects.filter(registration_number__startswith='SMK').delete()

    # Driver with CE + PSV, primary for a semi-truck
    driver1 = make_driver('smk_d1', ['C', 'CE'], psv=True)
    print(f'  Driver1: {driver1} classes={driver1.class_codes} psv={driver1.has_psv}')

    # Driver with CE but no PSV
    driver2 = make_driver('smk_d2', ['C', 'CE'], psv=False)
    print(f'  Driver2: {driver2} classes={driver2.class_codes} psv={driver2.has_psv}')

    # Semi-truck (private), primary driver is driver1
    v1 = make_vehicle('SMK 1001', '20.00', 'private', 'semi_truck', primary_driver=driver1)
    print(f'  Vehicle1: {v1} primary_driver={v1.primary_driver}')

    # A public vehicle — driver2 cannot take it (no PSV)
    v2 = make_vehicle('SMK 1002', '10.00', 'public', 'fuso')
    print(f'  Vehicle2: {v2} category=public')

    # Two trailers
    t1, _ = Trailer.objects.get_or_create(
        registration_number='SMK 9001',
        defaults=dict(make='TEST', tonnage=Decimal('12.00'), category='private'),
    )
    t2, _ = Trailer.objects.get_or_create(
        registration_number='SMK 9002',
        defaults=dict(make='TEST', tonnage=Decimal('12.00'), category='private'),
    )
    print(f'  Trailers: {t1} / {t2}')

    # --- Booking ---
    hr("Creating booking")
    booking = TransportBooking.objects.create(
        customer_name='Smoke Test 1',
        customer_phone='0977000000',
        pickup_location='Lusaka',
        delivery_location='Kitwe',
        cargo_description='Bulk cement',
        cargo_weight_kg=Decimal('8000.00'),
        cargo_category='general',
        pickup_date=date.today() + timedelta(days=2),
    )
    print(f'  Booking #{booking.id} — weight={booking.cargo_weight_kg}kg status={booking.status}')

    # --- Eligibility check ---
    hr("Eligibility pre-check")
    for d, v in [(driver1, v1), (driver2, v1), (driver1, v2), (driver2, v2)]:
        ok, reason = is_driver_eligible(d, v)
        print(f'  {d} on {v.registration_number} ({v.category}): {ok} — {reason}')
    print(f'  v1 required class: {required_class_for(v1)}')
    print(f'  v2 required class: {required_class_for(v2)}')

    # --- Assign vehicle ---
    hr("Assign vehicle (should auto-pair primary driver)")
    v1.refresh_from_db()
    if v1.status != 'available':
        v1.status = 'available'; v1.save()
    driver1.refresh_from_db()
    if driver1.status != 'available':
        driver1.status = 'available'; driver1.save()

    booking.assigned_vehicle = v1
    v1.status = 'on_trip'; v1.save()

    # Auto-pair primary driver1
    ok, reason = is_driver_eligible(driver1, v1, booking)
    if ok:
        booking.assigned_driver = driver1
        driver1.status = 'on_trip'; driver1.save()
        booking.status = 'assigned'
        booking.pairing_source = 'primary'
        print(f'  Primary driver auto-assigned: {driver1}')
    else:
        booking.pairing_warning = f'Primary driver not assigned: {reason}'
        print(f'  Pairing failed: {reason}')
    booking.assigned_at = __import__('django.utils.timezone', fromlist=['now']).now()
    booking.save()

    booking.refresh_from_db()
    v1.refresh_from_db()
    driver1.refresh_from_db()
    print(f'  Booking status: {booking.status}')
    print(f'  Assigned vehicle: {booking.assigned_vehicle}')
    print(f'  Assigned driver: {booking.assigned_driver}')
    print(f'  Vehicle status: {v1.status}')
    print(f'  Driver status: {driver1.status}')

    # --- Attach trailers ---
    hr("Attach 2 trailers (interlink)")
    booking.assigned_trailers.set([t1, t2])
    t1.status = 'on_trip'; t1.save()
    t2.status = 'on_trip'; t2.save()
    booking.refresh_from_db()
    print(f'  Attached: {[str(t) for t in booking.assigned_trailers.all()]}')
    print(f'  t1 status: {t1.status}')
    print(f'  t2 status: {t2.status}')

    # --- Advance to in_transit ---
    hr("Advance to in_transit")
    booking.status = 'in_transit'
    booking.save()
    print(f'  Status: {booking.status}')

    # --- Deliver ---
    hr("Deliver — release all resources")
    booking.status = 'delivered'
    booking.save()
    v1.refresh_from_db()
    driver1.refresh_from_db()
    t1.refresh_from_db()
    t2.refresh_from_db()
    print(f'  Vehicle status: {v1.status}')
    print(f'  Driver status: {driver1.status}')
    print(f'  Trailer1 status: {t1.status}')
    print(f'  Trailer2 status: {t2.status}')
    print(f'  Pairing still intact: {v1.primary_driver}')

    # --- Trailer requirement test ---
    hr("Trailer requirement when cargo exceeds solo capacity")

# Reset fixtures
    Vehicle.objects.filter(registration_number='SMK 1003').delete()
    TransportBooking.objects.filter(customer_name='Smoke Test 2').delete()
    
    # Semi-truck with 15t solo capacity
    semi = make_vehicle('SMK 1003', '15.00', 'private', 'semi_truck')
    print(f'  Semi solo capacity: {semi.tonnage}t')
    
    # Cargo exceeds solo capacity — 18t
    booking2 = TransportBooking.objects.create(
        customer_name='Smoke Test 2',
        customer_phone='0977000001',
        pickup_location='Lusaka',
        delivery_location='Ndola',
        cargo_description='Bulk maize',
        cargo_weight_kg=Decimal('18000.00'),
        pickup_date=date.today() + timedelta(days=3),
    )
    print(f'  Booking #{booking2.id} cargo: {booking2.cargo_weight_kg}kg')
    
    # Assign vehicle only
    booking2.assigned_vehicle = semi
    semi.status = 'on_trip'
    semi.save()
    booking2.save()
    
    from transport.eligibility import requires_trailer, combined_capacity
    print(f'  requires_trailer: {requires_trailer(semi, booking2)}')  # expect True
    
    # Combined capacity without trailers
    cap0 = combined_capacity(semi, [])
    print(f'  Combined capacity (no trailers): {cap0}t')
    
    # With one trailer
    cap1 = combined_capacity(semi, [t1])
    print(f'  Combined capacity (+1 trailer): {cap1}t')
    
    # With two trailers
    cap2 = combined_capacity(semi, [t1, t2])
    print(f'  Combined capacity (+2 trailers): {cap2}t')
    
    # Assign driver (a CE+PSV driver)
    driver1.status = 'available'
    driver1.save()
    ok, reason = is_driver_eligible(driver1, semi, booking2)
    print(f'  Driver eligibility: {ok} — {reason}')
    
    booking2.assigned_driver = driver1
    driver1.status = 'on_trip'
    driver1.save()
    booking2.status = 'assigned'
    booking2.save()
    
    # Attach trailers — verify combined capacity passes
    t1.refresh_from_db(); t2.refresh_from_db()
    t1.status = 'available'; t1.save()
    t2.status = 'available'; t2.save()
    
    booking2.assigned_trailers.set([t1, t2])
    t1.status = 'on_trip'; t1.save()
    t2.status = 'on_trip'; t2.save()
    booking2.refresh_from_db()
    
    print(f'  Final combined capacity: {combined_capacity(semi, booking2.assigned_trailers.all())}t')
    
    # Deliver
    booking2.status = 'delivered'
    booking2.save()
    semi.refresh_from_db(); driver1.refresh_from_db()
    t1.refresh_from_db(); t2.refresh_from_db()
    print(f'  After delivery — vehicle: {semi.status}, driver: {driver1.status}, '
          f'trailers: {t1.status}/{t2.status}')
    
    hr("DONE")


main()