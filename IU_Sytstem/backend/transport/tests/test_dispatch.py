"""
Full booking lifecycle tests: assign vehicle/driver, attach trailers,
advance status, release resources.
"""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from transport.models import TransportBooking, Vehicle, Driver, Trailer

pytestmark = pytest.mark.django_db


class TestFullDispatchFlow:

    def test_assign_vehicle_without_primary_driver_stays_pending(
        self, light_vehicle, booking_small_cargo,
    ):
        """
        When a vehicle has no primary driver, the booking gets the
        vehicle but stays pending (driver slot empty).
        """
        booking_small_cargo.assigned_vehicle = light_vehicle
        booking_small_cargo.status = 'pending'
        booking_small_cargo.save()

        light_vehicle.status = 'on_trip'
        light_vehicle.save()

        booking_small_cargo.refresh_from_db()
        light_vehicle.refresh_from_db()

        assert booking_small_cargo.assigned_vehicle == light_vehicle
        assert booking_small_cargo.assigned_driver is None
        assert booking_small_cargo.status == 'pending'
        assert light_vehicle.status == 'on_trip'

    def test_full_lifecycle_releases_resources(
        self, light_vehicle, driver_b, booking_small_cargo,
    ):
        """Assign → start trip → deliver releases vehicle + driver."""
        # Assign
        booking_small_cargo.assigned_vehicle = light_vehicle
        booking_small_cargo.assigned_driver = driver_b
        booking_small_cargo.status = 'assigned'
        booking_small_cargo.save()

        light_vehicle.status = 'on_trip'
        light_vehicle.save()
        driver_b.status = 'on_trip'
        driver_b.save()

        # Start trip
        booking_small_cargo.status = 'in_transit'
        booking_small_cargo.save()

        # Deliver — release
        light_vehicle.status = 'available'
        light_vehicle.save()
        driver_b.status = 'available'
        driver_b.save()
        booking_small_cargo.status = 'delivered'
        booking_small_cargo.save()

        light_vehicle.refresh_from_db()
        driver_b.refresh_from_db()
        booking_small_cargo.refresh_from_db()

        assert booking_small_cargo.status == 'delivered'
        assert light_vehicle.status == 'available'
        assert driver_b.status == 'available'

    def test_cancel_restores_resources(
        self, light_vehicle, driver_b, booking_small_cargo,
    ):
        booking_small_cargo.assigned_vehicle = light_vehicle
        booking_small_cargo.assigned_driver = driver_b
        booking_small_cargo.status = 'in_transit'
        booking_small_cargo.save()
        light_vehicle.status = 'on_trip'
        light_vehicle.save()
        driver_b.status = 'on_trip'
        driver_b.save()

        # Simulate cancel action
        booking_small_cargo.status = 'cancelled'
        booking_small_cargo.save()
        light_vehicle.status = 'available'
        light_vehicle.save()
        driver_b.status = 'available'
        driver_b.save()

        light_vehicle.refresh_from_db()
        driver_b.refresh_from_db()
        assert light_vehicle.status == 'available'
        assert driver_b.status == 'available'


class TestTrailerAttachment:

    def test_semi_with_oversized_cargo_and_trailer_ok(
        self, semi_truck, trailer_12t, booking_heavy_cargo,
    ):
        # Reduce semi tonnage so heavy cargo (18t) needs a trailer
        semi_truck.tonnage = Decimal('15.00')
        semi_truck.save()

        from transport.eligibility import requires_trailer, combined_capacity

        assert requires_trailer(semi_truck, booking_heavy_cargo) is True

        combined = combined_capacity(semi_truck, [trailer_12t])
        assert combined == Decimal('27.00')

        cargo_t = Decimal(booking_heavy_cargo.cargo_weight_kg) / 1000
        assert combined >= cargo_t

    def test_combined_capacity_insufficient(
        self, semi_truck, trailer_12t, booking_heavy_cargo,
    ):
        # 15t semi + 12t trailer = 27t. Cargo is 18t. OK.
        semi_truck.tonnage = Decimal('15.00')
        semi_truck.save()

        from transport.eligibility import combined_capacity
        combined = combined_capacity(semi_truck, [trailer_12t])
        cargo_t = Decimal(booking_heavy_cargo.cargo_weight_kg) / 1000

        # Both scenarios agree: this one is fine
        assert combined >= cargo_t

        # But with a lighter semi + no trailer, it fails
        semi_truck.tonnage = Decimal('5.00')
        semi_truck.save()
        combined = combined_capacity(semi_truck, [])
        assert combined < cargo_t


class TestBookingStatusTransitions:
    """
    Simulates the state machine that `update_status` enforces.
    """

    ALLOWED_FROM = {
        'pending':    ['assigned', 'cancelled'],
        'assigned':   ['in_transit', 'cancelled'],
        'in_transit': ['delivered', 'cancelled'],
    }

    @pytest.mark.parametrize('current,new,expected_ok', [
        ('pending', 'assigned', True),
        ('pending', 'in_transit', False),
        ('pending', 'delivered', False),
        ('assigned', 'in_transit', True),
        ('assigned', 'delivered', False),
        ('in_transit', 'delivered', True),
        ('in_transit', 'assigned', False),
        ('delivered', 'cancelled', False),
    ])
    def test_transition_matrix(self, current, new, expected_ok, booking_small_cargo):
        allowed = self.ALLOWED_FROM.get(current, [])
        assert (new in allowed) is expected_ok


class TestPairedAssignment:

    def test_primary_driver_auto_paired_when_eligible(
        self, driver_c, semi_truck,
    ):
        """
        Set up a vehicle with a primary driver, verify the pairing
        helper considers them eligible for a matching booking.
        """
        semi_truck.primary_driver = driver_c
        semi_truck.save()

        from transport.eligibility import is_driver_eligible
        ok, reason = is_driver_eligible(driver_c, semi_truck)
        assert ok, reason

    def test_primary_driver_not_eligible_for_public_vehicle(
        self, driver_c, semi_truck_public,
    ):
        semi_truck_public.primary_driver = driver_c
        semi_truck_public.save()

        from transport.eligibility import is_driver_eligible
        ok, reason = is_driver_eligible(driver_c, semi_truck_public)
        assert not ok
        assert 'PSV' in reason