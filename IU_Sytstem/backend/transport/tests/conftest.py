"""
Fixtures for transport module tests.

Provides ready-made license classes, vehicles, drivers, trailers, and
bookings so individual tests can focus on the logic they're verifying.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from transport.models import (
    LicenseClass, Vehicle, Driver, Trailer, TransportBooking,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# License classes (seeded once per test)
# ---------------------------------------------------------------------------

@pytest.fixture
def license_classes(db):
    """
    Ensures the standard Zambian license classes exist and returns
    a dict {code: LicenseClass} for convenience.
    """
    defaults = {
        'B':   ('Light motor vehicle up to 4 tonnes',      Decimal('4.00'),  False, True),
        'BE':  ('Light motor vehicle with trailer',        Decimal('4.00'),  True,  True),
        'C1':  ('Heavy motor vehicle under 16 tonnes',     Decimal('16.00'), False, False),
        'C1E': ('Heavy motor vehicle with trailer < 16t',  Decimal('16.00'), True,  False),
        'C':   ('Heavy motor vehicle 16 tonnes and above', None,             False, False),
        'CE':  ('Heavy motor vehicle with trailer >= 16t', None,             True,  False),
        'DG':  ('Dangerous goods endorsement',             None,             False, False),
    }
    result = {}
    for code, (desc, max_t, trailer, psv) in defaults.items():
        obj, _ = LicenseClass.objects.get_or_create(
            code=code,
            defaults=dict(
                description=desc,
                max_tonnage=max_t,
                allows_trailer=trailer,
                requires_psv_for_public=psv,
            ),
        )
        result[code] = obj
    return result


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@pytest.fixture
def driver_user(db):
    u, _ = User.objects.get_or_create(
        username='test_driver',
        defaults=dict(first_name='Paul', last_name='Phiri'),
    )
    u.set_password('testpass123')
    u.save()
    return u


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------

def _make_vehicle(reg, tonnage, category='private', vtype='fuso',
                  status='available', primary_driver=None):
    v, _ = Vehicle.objects.get_or_create(
        registration_number=reg,
        defaults=dict(
            make='TEST',
            tonnage=Decimal(str(tonnage)),
            vehicle_type=vtype,
            category=category,
            status=status,
            primary_driver=primary_driver,
        ),
    )
    # Always refresh fields in case the test runs with a reused DB
    v.make = 'TEST'
    v.tonnage = Decimal(str(tonnage))
    v.vehicle_type = vtype
    v.category = category
    v.status = status
    v.primary_driver = primary_driver
    v.save()
    return v


@pytest.fixture
def light_vehicle(db):
    """A 3t private van — requires class B."""
    return _make_vehicle('TST 0001', '3.00', 'private', 'van')


@pytest.fixture
def light_public_vehicle(db):
    """A 3t public van — requires class B + PSV."""
    return _make_vehicle('TST 0002', '3.00', 'public', 'van')


@pytest.fixture
def mid_vehicle(db):
    """A 10t private fuso — requires class C1."""
    return _make_vehicle('TST 0003', '10.00', 'private', 'fuso')


@pytest.fixture
def semi_truck(db):
    """A 20t private semi — requires class C."""
    return _make_vehicle('TST 0004', '20.00', 'private', 'semi_truck')


@pytest.fixture
def semi_truck_public(db):
    """A 20t public semi — requires class C + PSV."""
    return _make_vehicle('TST 0005', '20.00', 'public', 'semi_truck')


# ---------------------------------------------------------------------------
# Drivers
# ---------------------------------------------------------------------------

def _make_driver(user, license_number, codes, psv=False,
                 expired=False, status='available'):
    d, _ = Driver.objects.get_or_create(
        user=user,
        defaults=dict(
            license_number=license_number,
            license_expiry=date.today() + timedelta(days=365),
        ),
    )
    d.license_number = license_number
    d.license_expiry = (
        date.today() - timedelta(days=1) if expired
        else date.today() + timedelta(days=365)
    )
    d.has_psv = psv
    d.status = status
    d.save()
    d.license_classes.clear()
    for code in codes:
        d.license_classes.add(LicenseClass.objects.get(code=code))
    return d


@pytest.fixture
def driver_b(license_classes, driver_user):
    """A fresh user + driver with class B, no PSV."""
    u, _ = User.objects.get_or_create(
        username='drv_b',
        defaults=dict(first_name='Bee', last_name='Driver'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-B', ['B'])


@pytest.fixture
def driver_b_psv(license_classes):
    u, _ = User.objects.get_or_create(
        username='drv_bpsv',
        defaults=dict(first_name='Bee', last_name='WithPsv'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-BPSV', ['B'], psv=True)


@pytest.fixture
def driver_c1(license_classes):
    u, _ = User.objects.get_or_create(
        username='drv_c1',
        defaults=dict(first_name='Cee', last_name='One'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-C1', ['C1'])


@pytest.fixture
def driver_c(license_classes):
    u, _ = User.objects.get_or_create(
        username='drv_c',
        defaults=dict(first_name='Cee', last_name='Heavy'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-C', ['C'])


@pytest.fixture
def driver_c_psv(license_classes):
    u, _ = User.objects.get_or_create(
        username='drv_cpsv',
        defaults=dict(first_name='Cee', last_name='Public'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-CPSV', ['C'], psv=True)


@pytest.fixture
def driver_ce(license_classes):
    u, _ = User.objects.get_or_create(
        username='drv_ce',
        defaults=dict(first_name='See', last_name='Eee'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-CE', ['C', 'CE'])


@pytest.fixture
def driver_expired(license_classes):
    u, _ = User.objects.get_or_create(
        username='drv_expired',
        defaults=dict(first_name='Ex', last_name='Pired'),
    )
    u.set_password('testpass123')
    u.save()
    return _make_driver(u, 'DL-EXP', ['C'], psv=True, expired=True)


# ---------------------------------------------------------------------------
# Trailers
# ---------------------------------------------------------------------------

@pytest.fixture
def trailer_12t(db):
    t, _ = Trailer.objects.get_or_create(
        registration_number='TRL 9001',
        defaults=dict(make='HOWO', tonnage=Decimal('12.00'), category='private'),
    )
    t.make = 'HOWO'
    t.tonnage = Decimal('12.00')
    t.category = 'private'
    t.status = 'available'
    t.save()
    return t


@pytest.fixture
def trailer_12t_b(db):
    t, _ = Trailer.objects.get_or_create(
        registration_number='TRL 9002',
        defaults=dict(make='HOWO', tonnage=Decimal('12.00'), category='private'),
    )
    t.make = 'HOWO'
    t.tonnage = Decimal('12.00')
    t.category = 'private'
    t.status = 'available'
    t.save()
    return t


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

@pytest.fixture
def booking_small_cargo(db):
    """A booking with light cargo (2000kg) fitting any vehicle."""
    b, _ = TransportBooking.objects.get_or_create(
        customer_name='Small Cargo Customer',
        defaults=dict(
            customer_phone='0977000001',
            pickup_location='Lusaka',
            delivery_location='Kabwe',
            cargo_description='Light goods',
            cargo_weight_kg=Decimal('2000.00'),
            cargo_category='general',
            pickup_date=date.today() + timedelta(days=2),
        ),
    )
    b.status = 'pending'
    b.assigned_vehicle = None
    b.assigned_driver = None
    b.assigned_trailers.clear()
    b.pairing_warning = ''
    b.save()
    return b


@pytest.fixture
def booking_heavy_cargo(db):
    """A booking with cargo (18000kg) exceeding most vehicle solo capacities."""
    b, _ = TransportBooking.objects.get_or_create(
        customer_name='Heavy Cargo Customer',
        defaults=dict(
            customer_phone='0977000002',
            pickup_location='Lusaka',
            delivery_location='Ndola',
            cargo_description='Bulk maize',
            cargo_weight_kg=Decimal('18000.00'),
            cargo_category='general',
            pickup_date=date.today() + timedelta(days=3),
        ),
    )
    b.status = 'pending'
    b.assigned_vehicle = None
    b.assigned_driver = None
    b.assigned_trailers.clear()
    b.pairing_warning = ''
    b.save()
    return b


@pytest.fixture
def booking_dg_cargo(db):
    """A booking with DG cargo."""
    b, _ = TransportBooking.objects.get_or_create(
        customer_name='DG Customer',
        defaults=dict(
            customer_phone='0977000003',
            pickup_location='Lusaka',
            delivery_location='Livingstone',
            cargo_description='Fuel drums',
            cargo_weight_kg=Decimal('5000.00'),
            cargo_category='dg',
            pickup_date=date.today() + timedelta(days=1),
        ),
    )
    b.status = 'pending'
    b.assigned_vehicle = None
    b.assigned_driver = None
    b.assigned_trailers.clear()
    b.pairing_warning = ''
    b.save()
    return b