"""
Model validation tests: reg number format, auto-uppercase, unique
constraint on primary_driver.
"""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from transport.models import Vehicle, Driver

pytestmark = pytest.mark.django_db


class TestVehicleValidation:

    def test_registration_uppercased_on_save(self, light_vehicle):
        light_vehicle.registration_number = 'abc 1234'
        # Registration validates against uppercase pattern, so this
        # should raise before saving
        with pytest.raises(ValidationError):
            light_vehicle.full_clean()

    def test_make_uppercased_on_save(self):
        v = Vehicle.objects.create(
            registration_number='TST 9001',
            make='toyota',
            tonnage=Decimal('5.00'),
            vehicle_type='fuso',
            category='private',
        )
        v.refresh_from_db()
        assert v.make == 'TOYOTA'

    def test_valid_registration_accepted(self):
        v = Vehicle.objects.create(
            registration_number='XYZ 1234',
            make='TEST',
            tonnage=Decimal('5.00'),
            vehicle_type='fuso',
            category='private',
        )
        assert v.pk is not None

    def test_invalid_registration_rejected(self):
        v = Vehicle(
            registration_number='xyz1234',  # no space, lowercase
            make='TEST',
            tonnage=Decimal('5.00'),
            vehicle_type='fuso',
            category='private',
        )
        with pytest.raises(ValidationError):
            v.full_clean()


class TestPrimaryDriverUniqueness:

    def test_driver_can_be_primary_for_only_one_vehicle(
        self, light_vehicle, mid_vehicle, driver_b,
    ):
        light_vehicle.primary_driver = driver_b
        light_vehicle.save()

        # Now try to assign the same driver to another vehicle
        mid_vehicle.primary_driver = driver_b
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                mid_vehicle.save()


class TestDriverClassAccessors:

    def test_class_codes_returns_sorted_list(self, driver_c, license_classes):
        driver_c.license_classes.add(license_classes['B'])
        driver_c.license_classes.add(license_classes['CE'])
        codes = driver_c.class_codes
        assert codes == ['B', 'C', 'CE']

    def test_empty_class_list(self, driver_b):
        driver_b.license_classes.clear()
        assert driver_b.class_codes == []