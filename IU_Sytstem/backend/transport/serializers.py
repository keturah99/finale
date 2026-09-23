from rest_framework import serializers
from .models import Vehicle, Driver, TransportBooking
from .models import Vehicle, Driver, TransportBooking, LicenseClass
from .models import (
    Vehicle, Driver, TransportBooking, LicenseClass, Trailer
)

from .models import (
    Vehicle, Driver, TransportBooking, LicenseClass, Trailer,
    REG_NUMBER_RE,
)

from .eligibility import requires_trailer, combined_capacity


class VehicleSerializer(serializers.ModelSerializer):
    vehicle_type_display = serializers.CharField(
        source='get_vehicle_type_display', read_only=True
    )
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )
    primary_driver_name = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            'id', 'registration_number', 'make',
            'vehicle_type', 'vehicle_type_display',
            'tonnage', 'category', 'category_display',
            'status', 'primary_driver', 'primary_driver_name',
            'notes', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_primary_driver_name(self, obj):
        if not obj.primary_driver:
            return None
        return str(obj.primary_driver)

    def validate_registration_number(self, value):
        value = value.upper().strip()
        if not REG_NUMBER_RE.match(value):
            raise serializers.ValidationError(
                'Registration number must be in the format "ABC 1234".'
            )
        return value

    def validate_tonnage(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Tonnage must be greater than zero.')
        return value

    def validate_make(self, value):
        return value.upper().strip()

class LicenseClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicenseClass
        fields = ['id', 'code', 'description', 'max_tonnage',
                  'allows_trailer', 'requires_psv_for_public']


class DriverSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    license_classes = serializers.SlugRelatedField(
        many=True,
        slug_field='code',
        queryset=LicenseClass.objects.all(),
        required=False,
    )
    class_codes = serializers.ListField(
        child=serializers.CharField(), read_only=True
    )

    class Meta:
        model = Driver
        fields = [
            'id', 'user', 'username', 'full_name',
            'license_number', 'license_expiry',
            'license_classes', 'class_codes', 'has_psv',
            'status', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

class TransportBookingSerializer(serializers.ModelSerializer):
    assigned_vehicle_reg = serializers.CharField(
        source='assigned_vehicle.registration_number', read_only=True
    )
    assigned_driver_name = serializers.SerializerMethodField()

    class Meta:
        model = TransportBooking
        fields = [
            'id', 'customer_name', 'customer_phone', 'customer_email',
            'pickup_location', 'delivery_location',
            'cargo_description', 'cargo_weight_kg',
            'pickup_date', 'delivery_date',
            'quoted_price',
            'assigned_vehicle', 'assigned_vehicle_reg',
            'assigned_driver', 'assigned_driver_name',
            'status', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['assigned_at', 'assigned_by', 'created_at', 'updated_at']

    def get_assigned_driver_name(self, obj):
        if not obj.assigned_driver:
            return None
        return str(obj.assigned_driver)

    needs_trailer = serializers.SerializerMethodField()
    combined_capacity = serializers.SerializerMethodField()

    class Meta:
        model = TransportBooking
        fields = [
            # ... existing fields ...
            'needs_trailer', 'combined_capacity',
        ]

    def get_needs_trailer(self, obj):
        if not obj.assigned_vehicle:
            return False
        return requires_trailer(obj.assigned_vehicle, obj)

    def get_combined_capacity(self, obj):
        if not obj.assigned_vehicle:
            return None
        trailers = obj.assigned_trailers.all() if obj.pk else []
        return str(combined_capacity(obj.assigned_vehicle, trailers))

class TrailerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trailer
        fields = [
            'id', 'registration_number', 'make', 'tonnage',
            'category', 'status', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at']