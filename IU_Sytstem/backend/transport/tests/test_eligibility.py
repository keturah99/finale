"""
Pure unit tests for the eligibility helpers.

These exercise the rules — PSV gate, class coverage, DG, tonnage —
without going through the API.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from transport.eligibility import (
    required_class_for,
    is_driver_eligible,
    combined_capacity,
    requires_trailer,
)

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# required_class_for
# ---------------------------------------------------------------------------

class TestRequiredClass:

    @pytest.mark.parametrize('tonnage,expected', [
        ('3.00', 'B'),
        ('4.00', 'B'),
        ('5.00', 'C1'),
        ('10.00', 'C1'),
        ('15.99', 'C1'),
        ('16.00', 'C'),
        ('20.00', 'C'),
        ('30.00', 'C'),
    ])
    def test_tonnage_bands(self, tonnage, expected, light_vehicle):
        v = light_vehicle
        v.tonnage = Decimal(tonnage)
        v.vehicle_type = 'fuso'  # not semi
        assert required_class_for(v) == expected

    def test_semi_truck_with_trailer_under_16t_needs_c1e(
        self, semi_truck, trailer_12t,
    ):
        semi_truck.tonnage = Decimal('12.00')
        semi_truck.save()
        # Attach a trailer via a booking so _vehicle_has_trailer is True
        from transport.models import TransportBooking
        b = TransportBooking.objects.create(
            customer_name='T', customer_phone='0',
            pickup_location='A', delivery_location='B',
            cargo_description='x',
            cargo_weight_kg=Decimal('1000.00'),
            cargo_category='general',
            pickup_date=date.today(),
            assigned_vehicle=semi_truck,
            status='assigned',
        )
        b.assigned_trailers.add(trailer_12t)
        assert required_class_for(semi_truck) == 'C1E'

    def test_semi_truck_with_trailer_over_16t_needs_ce(
        self, semi_truck, trailer_12t,
    ):
        # semi_truck is 20t
        from transport.models import TransportBooking
        b = TransportBooking.objects.create(
            customer_name='T', customer_phone='0',
            pickup_location='A', delivery_location='B',
            cargo_description='x',
            cargo_weight_kg=Decimal('1000.00'),
            cargo_category='general',
            pickup_date=date.today(),
            assigned_vehicle=semi_truck,
            status='assigned',
        )
        b.assigned_trailers.add(trailer_12t)
        assert required_class_for(semi_truck) == 'CE'


# ---------------------------------------------------------------------------
# is_driver_eligible
# ---------------------------------------------------------------------------

class TestIsDriverEligible:

    def test_b_driver_can_drive_light_private(self, driver_b, light_vehicle):
        ok, reason = is_driver_eligible(driver_b, light_vehicle)
        assert ok, reason

    def test_b_driver_cannot_drive_light_public_without_psv(
        self, driver_b, light_public_vehicle,
    ):
        ok, reason = is_driver_eligible(driver_b, light_public_vehicle)
        assert not ok
        assert 'PSV' in reason

    def test_b_psv_driver_can_drive_light_public(
        self, driver_b_psv, light_public_vehicle,
    ):
        ok, reason = is_driver_eligible(driver_b_psv, light_public_vehicle)
        assert ok, reason

    def test_b_driver_cannot_drive_10t(self, driver_b, mid_vehicle):
        ok, reason = is_driver_eligible(driver_b, mid_vehicle)
        assert not ok
        assert 'C1' in reason

    def test_c1_driver_can_drive_10t(self, driver_c1, mid_vehicle):
        ok, reason = is_driver_eligible(driver_c1, mid_vehicle)
        assert ok, reason

    def test_c1_driver_cannot_drive_20t(self, driver_c1, semi_truck):
        ok, reason = is_driver_eligible(driver_c1, semi_truck)
        assert not ok
        assert 'C' in reason

    def test_c_driver_can_drive_20t(self, driver_c, semi_truck):
        ok, reason = is_driver_eligible(driver_c, semi_truck)
        assert ok, reason

    def test_c_driver_cannot_drive_public_semi_without_psv(
        self, driver_c, semi_truck_public,
    ):
        ok, reason = is_driver_eligible(driver_c, semi_truck_public)
        assert not ok
        assert 'PSV' in reason

    def test_c_psv_driver_can_drive_public_semi(
        self, driver_c_psv, semi_truck_public,
    ):
        ok, reason = is_driver_eligible(driver_c_psv, semi_truck_public)
        assert ok, reason

    def test_expired_license_blocks(self, driver_expired, semi_truck):
        ok, reason = is_driver_eligible(driver_expired, semi_truck)
        assert not ok
        assert 'expired' in reason.lower()

    def test_unavailable_driver_blocked(self, driver_c, semi_truck):
        driver_c.status = 'on_trip'
        driver_c.save()
        ok, reason = is_driver_eligible(driver_c, semi_truck)
        assert not ok
        assert 'not available' in reason.lower()

    def test_unavailable_vehicle_blocked(self, driver_c, semi_truck):
        semi_truck.status = 'maintenance'
        semi_truck.save()
        ok, reason = is_driver_eligible(driver_c, semi_truck)
        assert not ok
        assert 'not available' in reason.lower()

    def test_dg_cargo_needs_dg_class(self, driver_c1, mid_vehicle, booking_dg_cargo):
        ok, reason = is_driver_eligible(driver_c1, mid_vehicle, booking_dg_cargo)
        assert not ok
        assert 'DG' in reason

    def test_vehicle_tonnage_must_cover_cargo(
        self, driver_c1, mid_vehicle, booking_heavy_cargo,
    ):
        # 10t vehicle, 18t cargo
        ok, reason = is_driver_eligible(driver_c1, mid_vehicle, booking_heavy_cargo)
        assert not ok
        assert 'tonnage' in reason.lower()


# ---------------------------------------------------------------------------
# combined_capacity
# ---------------------------------------------------------------------------

class TestCombinedCapacity:

    def test_vehicle_only(self, semi_truck):
        assert combined_capacity(semi_truck, []) == Decimal('20.00')

    def test_vehicle_plus_one_trailer(self, semi_truck, trailer_12t):
        assert combined_capacity(semi_truck, [trailer_12t]) == Decimal('32.00')

    def test_vehicle_plus_two_trailers(
        self, semi_truck, trailer_12t, trailer_12t_b,
    ):
        result = combined_capacity(semi_truck, [trailer_12t, trailer_12t_b])
        assert result == Decimal('44.00')


# ---------------------------------------------------------------------------
# requires_trailer
# ---------------------------------------------------------------------------

class TestRequiresTrailer:

    def test_small_cargo_no_trailer_needed(self, semi_truck, booking_small_cargo):
        # 20t semi, 2t cargo — no trailer needed
        assert requires_trailer(semi_truck, booking_small_cargo) is False

    def test_oversized_cargo_needs_trailer(self, semi_truck, booking_heavy_cargo):
        # 20t semi, 18t cargo — still fits solo, not required
        # Hmm, 18t < 20t. Let me use a smaller semi.
        semi_truck.tonnage = Decimal('15.00')
        semi_truck.save()
        # 15t semi, 18t cargo — trailer required
        assert requires_trailer(semi_truck, booking_heavy_cargo) is True

    def test_non_semi_never_needs_trailer(self, mid_vehicle, booking_heavy_cargo):
        # Fuso can't pull trailers — rule returns False, but the assign
        # logic will reject the vehicle separately
        assert requires_trailer(mid_vehicle, booking_heavy_cargo) is False