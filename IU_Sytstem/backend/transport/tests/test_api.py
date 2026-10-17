"""
HTTP endpoint tests using the DRF APIClient.

Uses the same fixtures as the model tests plus a few role-based users
to verify scoping and permissions.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core.models import Role
from django.contrib.auth import get_user_model
from transport.models import Vehicle, Driver, TransportBooking

User = get_user_model()

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@pytest.fixture
def transport_manager(db):
    u, _ = User.objects.get_or_create(
        username='tmgr_test',
        defaults=dict(first_name='T', last_name='Manager'),
    )
    u.set_password('testpass123')
    u.save()
    role, _ = Role.objects.get_or_create(
        name='transport_manager', defaults=dict(description=''),
    )
    u.roles.add(role)
    return u


@pytest.fixture
def transport_clerk(db):
    u, _ = User.objects.get_or_create(
        username='tclerk_test',
        defaults=dict(first_name='T', last_name='Clerk'),
    )
    u.set_password('testpass123')
    u.save()
    role, _ = Role.objects.get_or_create(
        name='transport_clerk', defaults=dict(description=''),
    )
    u.roles.add(role)
    return u


@pytest.fixture
def api_client():
    return APIClient()


def auth(client, user):
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class TestPermissions:

    def test_unauthenticated_cannot_list_vehicles(self, api_client):
        r = api_client.get('/api/transport/vehicles/')
        assert r.status_code in (401, 403)

    def test_clerk_can_read_vehicles(self, api_client, transport_clerk):
        auth(api_client, transport_clerk)
        r = api_client.get('/api/transport/vehicles/')
        assert r.status_code == 200

    def test_clerk_cannot_create_vehicle(self, api_client, transport_clerk):
        auth(api_client, transport_clerk)
        r = api_client.post('/api/transport/vehicles/', {
            'registration_number': 'NEW 1234',
            'make': 'TEST',
            'vehicle_type': 'fuso',
            'tonnage': '10.00',
            'category': 'private',
        }, format='json')
        assert r.status_code == 403

    def test_manager_can_create_vehicle(self, api_client, transport_manager):
        auth(api_client, transport_manager)
        r = api_client.post('/api/transport/vehicles/', {
            'registration_number': 'NEW 1234',
            'make': 'toyota',
            'vehicle_type': 'fuso',
            'tonnage': '10.00',
            'category': 'private',
        }, format='json')
        assert r.status_code == 201, r.data
        assert r.data['registration_number'] == 'NEW 1234'
        assert r.data['make'] == 'TOYOTA'  # uppercased

    def test_invalid_registration_rejected(self, api_client, transport_manager):
        auth(api_client, transport_manager)
        r = api_client.post('/api/transport/vehicles/', {
            'registration_number': 'abc1234',
            'make': 'TEST',
            'vehicle_type': 'fuso',
            'tonnage': '10.00',
            'category': 'private',
        }, format='json')
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Public booking (customer portal)
# ---------------------------------------------------------------------------

class TestPublicBooking:

    def test_anonymous_can_create_booking(self, api_client):
        r = api_client.post('/api/transport/bookings/', {
            'customer_name': 'Peter Zulu',
            'customer_phone': '0977333444',
            'pickup_location': 'Lusaka',
            'delivery_location': 'Kitwe',
            'cargo_description': 'Cement',
            'cargo_weight_kg': '4500.00',
            'cargo_category': 'general',
            'pickup_date': str(date.today() + timedelta(days=3)),
        }, format='json')
        assert r.status_code == 201, r.data
        assert r.data['customer_name'] == 'Peter Zulu'
        assert r.data['status'] == 'pending'

    def test_anonymous_cannot_list_bookings(self, api_client):
        r = api_client.get('/api/transport/bookings/')
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Dispatch endpoints
# ---------------------------------------------------------------------------

class TestDispatchEndpoints:

    def test_assign_vehicle_endpoint(
        self, api_client, transport_manager, light_vehicle, booking_small_cargo,
    ):
        auth(api_client, transport_manager)
        r = api_client.post(
            f'/api/transport/bookings/{booking_small_cargo.id}/assign-vehicle/',
            {'vehicle_id': light_vehicle.id},
            format='json',
        )
        assert r.status_code == 200, r.data
        assert r.data['assigned_vehicle'] == light_vehicle.id

        light_vehicle.refresh_from_db()
        assert light_vehicle.status == 'on_trip'

    def test_clerk_cannot_assign_vehicle(
        self, api_client, transport_clerk, light_vehicle, booking_small_cargo,
    ):
        auth(api_client, transport_clerk)
        r = api_client.post(
            f'/api/transport/bookings/{booking_small_cargo.id}/assign-vehicle/',
            {'vehicle_id': light_vehicle.id},
            format='json',
        )
        assert r.status_code == 403

    def test_assign_unavailable_vehicle_rejected(
        self, api_client, transport_manager, light_vehicle, booking_small_cargo,
    ):
        light_vehicle.status = 'on_trip'
        light_vehicle.save()
        auth(api_client, transport_manager)
        r = api_client.post(
            f'/api/transport/bookings/{booking_small_cargo.id}/assign-vehicle/',
            {'vehicle_id': light_vehicle.id},
            format='json',
        )
        assert r.status_code == 400
        assert 'not available' in str(r.data).lower()

    def test_start_trip_requires_vehicle_and_driver(
        self, api_client, transport_manager, booking_small_cargo,
    ):
        auth(api_client, transport_manager)
        r = api_client.post(
            f'/api/transport/bookings/{booking_small_cargo.id}/update-status/',
            {'status': 'in_transit'},
            format='json',
        )
        # Booking is pending — cannot go straight to in_transit
        assert r.status_code == 400

    def test_full_lifecycle_via_api(
        self, api_client, transport_manager,
        light_vehicle, driver_b, booking_small_cargo,
    ):
        auth(api_client, transport_manager)
        bid = booking_small_cargo.id

        # Assign vehicle
        r = api_client.post(
            f'/api/transport/bookings/{bid}/assign-vehicle/',
            {'vehicle_id': light_vehicle.id}, format='json',
        )
        assert r.status_code == 200, r.data

        # Assign driver
        r = api_client.post(
            f'/api/transport/bookings/{bid}/assign-driver/',
            {'driver_id': driver_b.id}, format='json',
        )
        assert r.status_code == 200, r.data
        assert r.data['status'] == 'assigned'

        # Start trip
        r = api_client.post(
            f'/api/transport/bookings/{bid}/update-status/',
            {'status': 'in_transit'}, format='json',
        )
        assert r.status_code == 200, r.data

        # Deliver
        r = api_client.post(
            f'/api/transport/bookings/{bid}/update-status/',
            {'status': 'delivered'}, format='json',
        )
        assert r.status_code == 200, r.data
        assert r.data['status'] == 'delivered'

        light_vehicle.refresh_from_db()
        driver_b.refresh_from_db()
        assert light_vehicle.status == 'available'
        assert driver_b.status == 'available'


# ---------------------------------------------------------------------------
# Eligible-for-booking filters
# ---------------------------------------------------------------------------

class TestEligibleEndpoints:

    def test_eligible_vehicles_filters_by_tonnage(
        self, api_client, transport_manager,
        light_vehicle, semi_truck, booking_heavy_cargo,
    ):
        auth(api_client, transport_manager)
        r = api_client.get(
            f'/api/transport/vehicles/eligible-for-booking/?booking_id={booking_heavy_cargo.id}',
        )
        assert r.status_code == 200
        regs = {v['registration_number'] for v in r.data}
        # 20t semi fits 18t cargo, 3t van does not
        assert 'TST 0004' in regs
        assert 'TST 0001' not in regs

    def test_eligible_drivers_filters_by_vehicle_class(
        self, api_client, transport_manager,
        semi_truck, driver_b, driver_c, booking_small_cargo,
    ):
        # Assign a 20t semi to the booking
        booking_small_cargo.assigned_vehicle = semi_truck
        booking_small_cargo.save()

        auth(api_client, transport_manager)
        r = api_client.get(
            f'/api/transport/drivers/eligible-for-booking/?booking_id={booking_small_cargo.id}',
        )
        assert r.status_code == 200
        names = {d['full_name'] for d in r.data}
        # Only C and above can drive a 20t semi
        assert 'Cee Heavy' in names
        assert 'Bee Driver' not in names


# ---------------------------------------------------------------------------
# Trailers
# ---------------------------------------------------------------------------

class TestTrailerEndpoints:

    def test_attach_trailers_to_semi(
        self, api_client, transport_manager,
        semi_truck, trailer_12t, booking_heavy_cargo,
    ):
        # Reduce semi tonnage so trailer is required
        semi_truck.tonnage = Decimal('15.00')
        semi_truck.save()

        booking_heavy_cargo.assigned_vehicle = semi_truck
        booking_heavy_cargo.save()

        auth(api_client, transport_manager)
        r = api_client.post(
            f'/api/transport/bookings/{booking_heavy_cargo.id}/attach-trailers/',
            {'trailer_ids': [trailer_12t.id]}, format='json',
        )
        assert r.status_code == 200, r.data
        assert trailer_12t.id in r.data['assigned_trailers']

        trailer_12t.refresh_from_db()
        assert trailer_12t.status == 'on_trip'

    def test_attach_trailers_to_non_semi_rejected(
        self, api_client, transport_manager,
        mid_vehicle, trailer_12t, booking_small_cargo,
    ):
        booking_small_cargo.assigned_vehicle = mid_vehicle
        booking_small_cargo.save()

        auth(api_client, transport_manager)
        r = api_client.post(
            f'/api/transport/bookings/{booking_small_cargo.id}/attach-trailers/',
            {'trailer_ids': [trailer_12t.id]}, format='json',
        )
        assert r.status_code == 400
        assert 'semi' in str(r.data).lower()

    def test_max_two_trailers_enforced(
        self, api_client, transport_manager,
        semi_truck, trailer_12t, trailer_12t_b, booking_heavy_cargo,
    ):
        booking_heavy_cargo.assigned_vehicle = semi_truck
        booking_heavy_cargo.save()

        auth(api_client, transport_manager)
        r = api_client.post(
            f'/api/transport/bookings/{booking_heavy_cargo.id}/attach-trailers/',
            {'trailer_ids': [trailer_12t.id, trailer_12t_b.id, 999]},
            format='json',
        )
        assert r.status_code == 400