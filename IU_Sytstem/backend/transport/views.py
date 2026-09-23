"""
Transport module views.

Covers:
  - Vehicles (fleet)
  - Drivers
  - Trailers
  - License classes (read-only lookup)
  - Transport bookings (customer portal + admin dispatch)

Permissions:
  - Customers (unauthenticated) may only CREATE a booking.
  - Transport clerks and managers may view bookings, vehicles, drivers, trailers.
  - Only transport managers may create/edit vehicles, drivers, trailers,
    or assign bookings.
  - Either role may advance a booking's status.

Behavioral rules:
  - PSV endorsement is required for public-category vehicles.
  - License class must cover the vehicle's tonnage + trailer status.
  - DG endorsement required when cargo_category == 'dg'.
  - Semi-trucks whose cargo exceeds their solo tonnage must pull at
    least one trailer.
  - Combined capacity (vehicle + trailers) must cover the cargo weight.
  - Vehicle/driver/trailer statuses stay in sync with the booking's state.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.permissions import RolePermission
from core.roles import TRANSPORT_MANAGER, TRANSPORT_CLERK

from .models import (
    Vehicle, Driver, TransportBooking, LicenseClass, Trailer,
)
from .serializers import (
    VehicleSerializer, DriverSerializer,
    TransportBookingSerializer, LicenseClassSerializer,
    TrailerSerializer,
)
from .eligibility import (
    is_driver_eligible,
    required_class_for,
    combined_capacity,
    requires_trailer,
    sync_vehicle_status,
)


# ---------------------------------------------------------------------------
# License classes (read-only lookup)
# ---------------------------------------------------------------------------

class LicenseClassViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LicenseClass.objects.all()
    serializer_class = LicenseClassSerializer
    permission_classes = [RolePermission]
    read_roles = [TRANSPORT_MANAGER, TRANSPORT_CLERK]


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.select_related(
        'primary_driver', 'primary_driver__user'
    ).all()
    serializer_class = VehicleSerializer
    permission_classes = [RolePermission]
    read_roles = [TRANSPORT_MANAGER, TRANSPORT_CLERK]
    write_roles = [TRANSPORT_MANAGER]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    @action(detail=False, methods=['get'])
    def available(self, request):
        qs = self.get_queryset().filter(status='available')
        return Response(VehicleSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='eligible-for-booking')
    def eligible_for_booking(self, request):
        """
        Vehicles that can legally carry the cargo of the given booking
        (coarse filter — tonnage only). Strict rules apply at assign time.
        """
        booking_id = request.query_params.get('booking_id')
        if not booking_id:
            return Response({'error': 'booking_id required'}, status=400)
        try:
            booking = TransportBooking.objects.get(pk=booking_id)
        except TransportBooking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=404)

        qs = self.get_queryset().filter(status='available')
        cargo_t = (booking.cargo_weight_kg or 0) / 1000
        qs = qs.filter(tonnage__gte=cargo_t)
        return Response(VehicleSerializer(qs, many=True).data)


# ---------------------------------------------------------------------------
# Drivers
# ---------------------------------------------------------------------------

class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related('user') \
        .prefetch_related('license_classes').all()
    serializer_class = DriverSerializer
    permission_classes = [RolePermission]
    read_roles = [TRANSPORT_MANAGER, TRANSPORT_CLERK]
    write_roles = [TRANSPORT_MANAGER]

    @action(detail=False, methods=['get'])
    def available(self, request):
        qs = self.get_queryset().filter(status='available')
        return Response(DriverSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='eligible-for-booking')
    def eligible_for_booking(self, request):
        """
        Drivers eligible to drive the vehicle currently assigned to the
        booking. If no vehicle assigned yet, returns all available drivers.
        """
        booking_id = request.query_params.get('booking_id')
        if not booking_id:
            return Response({'error': 'booking_id required'}, status=400)
        try:
            booking = TransportBooking.objects.get(pk=booking_id)
        except TransportBooking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=404)

        qs = self.get_queryset().filter(status='available')
        if booking.assigned_vehicle:
            eligible = []
            for d in qs:
                ok, _ = is_driver_eligible(d, booking.assigned_vehicle, booking)
                if ok:
                    eligible.append(d)
            return Response(DriverSerializer(eligible, many=True).data)

        return Response(DriverSerializer(qs, many=True).data)


# ---------------------------------------------------------------------------
# Trailers
# ---------------------------------------------------------------------------

class TrailerViewSet(viewsets.ModelViewSet):
    queryset = Trailer.objects.all()
    serializer_class = TrailerSerializer
    permission_classes = [RolePermission]
    read_roles = [TRANSPORT_MANAGER, TRANSPORT_CLERK]
    write_roles = [TRANSPORT_MANAGER]

    @action(detail=False, methods=['get'])
    def available(self, request):
        qs = self.get_queryset().filter(status='available')
        return Response(TrailerSerializer(qs, many=True).data)


# ---------------------------------------------------------------------------
# Transport bookings
# ---------------------------------------------------------------------------

class TransportBookingViewSet(viewsets.ModelViewSet):
    queryset = TransportBooking.objects.select_related(
        'assigned_vehicle', 'assigned_driver',
        'assigned_vehicle__primary_driver',
    ).prefetch_related('assigned_trailers').all()
    serializer_class = TransportBookingSerializer
    read_roles = [TRANSPORT_MANAGER, TRANSPORT_CLERK]
    write_roles = [TRANSPORT_MANAGER, TRANSPORT_CLERK]

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [RolePermission()]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    # ------------------------------------------------------------------
    # Assign vehicle (auto-pair primary driver if eligible)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='assign-vehicle')
    def assign_vehicle(self, request, pk=None):
        """
        Assign a vehicle to a pending/assigned booking.

        - Validates tonnage fits cargo.
        - Reserves the vehicle (status = 'on_trip').
        - If the vehicle's primary_driver is eligible, auto-assigns them
          and flips the booking to 'assigned'.
        - Otherwise sets a pairing_warning and leaves the booking 'pending'.
        - If the cargo exceeds the vehicle's solo tonnage and the vehicle
          is a semi-truck, appends a "trailer required" warning.
        """
        user = request.user
        if not _is_transport_manager(user):
            return Response(
                {'error': 'Only transport managers can assign vehicles'},
                status=403,
            )

        booking = self.get_object()
        if booking.status not in ('pending', 'assigned'):
            return Response(
                {'error': f'Cannot assign vehicle to booking in status "{booking.status}"'},
                status=400,
            )

        vehicle_id = request.data.get('vehicle_id')
        if not vehicle_id:
            return Response({'error': 'vehicle_id is required'}, status=400)

        try:
            vehicle = Vehicle.objects.select_for_update().get(pk=vehicle_id)
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found'}, status=404)

        if vehicle.status != 'available':
            return Response(
                {'error': f'Vehicle {vehicle.registration_number} is not available'},
                status=400,
            )

        cargo_t = Decimal(str(booking.cargo_weight_kg or 0)) / 1000
        if Decimal(str(vehicle.tonnage)) < cargo_t:
            # A semi could still be OK if trailers are attached, but the
            # solo capacity must at least exist. Warn loudly if solo
            # alone can't handle it — trailer requirement message follows.
            if vehicle.vehicle_type != 'semi_truck':
                return Response(
                    {'error': (
                        f'Vehicle tonnage ({vehicle.tonnage}t) is less than '
                        f'cargo weight ({cargo_t:.2f}t) and it cannot pull '
                        f'trailers.'
                    )},
                    status=400,
                )

        with transaction.atomic():
            # Release any previous vehicle
            if booking.assigned_vehicle and booking.assigned_vehicle != vehicle:
                booking.assigned_vehicle.status = 'available'
                booking.assigned_vehicle.save()

            booking.assigned_vehicle = vehicle
            vehicle.status = 'on_trip'
            vehicle.save()

            warning = ''
            pairing_source = 'manual'

            # Try to auto-pair the primary driver
            if vehicle.primary_driver:
                ok, reason = is_driver_eligible(
                    vehicle.primary_driver, vehicle, booking
                )
                if ok:
                    # Release any previous driver
                    if (booking.assigned_driver
                            and booking.assigned_driver != vehicle.primary_driver):
                        booking.assigned_driver.status = 'available'
                        booking.assigned_driver.save()

                    booking.assigned_driver = vehicle.primary_driver
                    vehicle.primary_driver.status = 'on_trip'
                    vehicle.primary_driver.save()
                    booking.status = 'assigned'
                    pairing_source = 'primary'
                else:
                    warning = f'Primary driver not assigned: {reason}'

            # Trailer requirement warning
            if requires_trailer(vehicle, booking):
                trailer_msg = (
                    f'Trailer required: cargo ({booking.cargo_weight_kg}kg) '
                    f'exceeds solo capacity ({vehicle.tonnage}t).'
                )
                warning = f'{warning} | {trailer_msg}' if warning else trailer_msg

            booking.pairing_source = pairing_source
            booking.pairing_warning = warning
            booking.assigned_at = timezone.now()
            booking.assigned_by = user
            booking.save()

        return Response(TransportBookingSerializer(booking).data)

    # ------------------------------------------------------------------
    # Assign driver (reverse auto-pair if driver has a primary vehicle)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='assign-driver')
    def assign_driver(self, request, pk=None):
        """
        Assign a driver to a booking.

        - If a vehicle is already assigned, validates eligibility and
          updates the booking to 'assigned'.
        - If no vehicle is assigned and the driver is primary for one,
          auto-assigns that vehicle when eligible.
        - Otherwise assigns the driver alone.
        """
        user = request.user
        if not _is_transport_manager(user):
            return Response(
                {'error': 'Only transport managers can assign drivers'},
                status=403,
            )

        booking = self.get_object()
        if booking.status not in ('pending', 'assigned'):
            return Response(
                {'error': f'Cannot assign driver to booking in status "{booking.status}"'},
                status=400,
            )

        driver_id = request.data.get('driver_id')
        if not driver_id:
            return Response({'error': 'driver_id is required'}, status=400)

        try:
            driver = Driver.objects.select_for_update().get(pk=driver_id)
        except Driver.DoesNotExist:
            return Response({'error': 'Driver not found'}, status=404)

        if driver.status != 'available':
            return Response(
                {'error': f'Driver {driver} is not available'},
                status=400,
            )

        with transaction.atomic():
            # --- Case 1: vehicle already assigned ---
            if booking.assigned_vehicle:
                ok, reason = is_driver_eligible(driver, booking.assigned_vehicle, booking)
                if not ok:
                    return Response({'error': reason}, status=400)

                # Release previous driver if different
                if booking.assigned_driver and booking.assigned_driver != driver:
                    booking.assigned_driver.status = 'available'
                    booking.assigned_driver.save()

                booking.assigned_driver = driver
                driver.status = 'on_trip'
                driver.save()
                booking.status = 'assigned'
                booking.pairing_source = 'manual'
                booking.pairing_warning = ''
                booking.assigned_at = timezone.now()
                booking.assigned_by = user
                booking.save()
                return Response(TransportBookingSerializer(booking).data)

            # --- Case 2: no vehicle yet, try the driver's primary vehicle ---
            primary = Vehicle.objects.filter(primary_driver=driver).first()

            if primary:
                if primary.status != 'available':
                    return Response(
                        {'error': (
                            f'Driver is primary for {primary.registration_number} '
                            f'but that vehicle is not available'
                        )},
                        status=400,
                    )

                ok, reason = is_driver_eligible(driver, primary, booking)
                if ok:
                    booking.assigned_vehicle = primary
                    primary.status = 'on_trip'
                    primary.save()

                    booking.assigned_driver = driver
                    driver.status = 'on_trip'
                    driver.save()
                    booking.status = 'assigned'
                    booking.pairing_source = 'primary'
                    booking.pairing_warning = (
                        _trailer_warning(primary, booking)
                    )
                else:
                    booking.assigned_driver = driver
                    driver.status = 'on_trip'
                    driver.save()
                    booking.pairing_source = 'manual'
                    booking.pairing_warning = (
                        f'Primary vehicle {primary.registration_number} '
                        f'not assigned: {reason}'
                    )
            else:
                # --- Case 3: no primary vehicle — assign driver alone ---
                booking.assigned_driver = driver
                driver.status = 'on_trip'
                driver.save()
                booking.pairing_source = 'manual'

            booking.assigned_at = timezone.now()
            booking.assigned_by = user
            booking.save()

        return Response(TransportBookingSerializer(booking).data)

    # ------------------------------------------------------------------
    # Attach trailers (0–2, semi-trucks only)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='attach-trailers')
    def attach_trailers(self, request, pk=None):
        """
        Attach 0–2 trailers to the booking.

        Rules:
          - Vehicle must be assigned and be a semi_truck.
          - If cargo exceeds the vehicle's solo tonnage, at least one
            trailer is required.
          - Combined capacity (vehicle + trailers) must cover the cargo.
          - All trailers must be 'available'.
        """
        user = request.user
        if not _is_transport_manager(user):
            return Response(
                {'error': 'Only transport managers can attach trailers'},
                status=403,
            )

        booking = self.get_object()
        if booking.status not in ('pending', 'assigned'):
            return Response(
                {'error': f'Cannot attach trailers to booking in status "{booking.status}"'},
                status=400,
            )
        if not booking.assigned_vehicle:
            return Response({'error': 'Assign a vehicle first'}, status=400)
        if booking.assigned_vehicle.vehicle_type != 'semi_truck':
            return Response(
                {'error': 'Only semi-trucks can pull trailers'},
                status=400,
            )

        trailer_ids = request.data.get('trailer_ids', [])
        if len(trailer_ids) > 2:
            return Response(
                {'error': 'Maximum 2 trailers per booking (interlink)'},
                status=400,
            )

        trailers = list(Trailer.objects.filter(id__in=trailer_ids))
        if len(trailers) != len(trailer_ids):
            return Response(
                {'error': 'One or more trailers not found'},
                status=404,
            )

        for t in trailers:
            if t.status != 'available':
                return Response(
                    {'error': f'Trailer {t.registration_number} is not available'},
                    status=400,
                )

        # Rule: cargo exceeds solo capacity => at least one trailer required
        if requires_trailer(booking.assigned_vehicle, booking) and not trailers:
            return Response(
                {'error': (
                    f'Cargo ({booking.cargo_weight_kg}kg) exceeds the vehicle '
                    f'solo capacity ({booking.assigned_vehicle.tonnage}t). '
                    f'At least one trailer is required.'
                )},
                status=400,
            )

        # Rule: combined capacity must cover cargo
        combined = combined_capacity(booking.assigned_vehicle, trailers)
        cargo_t = Decimal(str(booking.cargo_weight_kg or 0)) / 1000
        if combined < cargo_t:
            return Response(
                {'error': (
                    f'Combined capacity ({combined}t) is less than cargo weight '
                    f'({cargo_t:.2f}t). Add another trailer or use a larger vehicle.'
                )},
                status=400,
            )

        with transaction.atomic():
            # Release trailers that were attached before but not in the new list
            for old in booking.assigned_trailers.all():
                if old not in trailers:
                    old.status = 'available'
                    old.save()

            booking.assigned_trailers.set(trailers)
            for t in trailers:
                t.status = 'on_trip'
                t.save()

            # Clear the trailer warning if it was set
            if booking.pairing_warning and 'Trailer required' in booking.pairing_warning:
                parts = [
                    p.strip()
                    for p in booking.pairing_warning.split('|')
                    if 'Trailer required' not in p
                ]
                booking.pairing_warning = ' | '.join(parts)
                booking.save()

        return Response(TransportBookingSerializer(booking).data)

    # ------------------------------------------------------------------
    # Unassign
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def unassign(self, request, pk=None):
        """
        Release the vehicle, driver, and all trailers back to 'available'.
        Only allowed while the booking is pending or assigned.
        """
        user = request.user
        if not _is_transport_manager(user):
            return Response(
                {'error': 'Only transport managers can unassign'},
                status=403,
            )

        booking = self.get_object()
        if booking.status not in ('pending', 'assigned'):
            return Response(
                {'error': f'Cannot unassign from booking in status "{booking.status}"'},
                status=400,
            )

        with transaction.atomic():
            if booking.assigned_vehicle:
                booking.assigned_vehicle.status = 'available'
                booking.assigned_vehicle.save()
            if booking.assigned_driver:
                booking.assigned_driver.status = 'available'
                booking.assigned_driver.save()
            for t in booking.assigned_trailers.all():
                t.status = 'available'
                t.save()

            booking.assigned_vehicle = None
            booking.assigned_driver = None
            booking.assigned_trailers.clear()
            booking.assigned_at = None
            booking.assigned_by = None
            booking.pairing_source = 'manual'
            booking.pairing_warning = ''
            booking.status = 'pending'
            booking.save()

        return Response(TransportBookingSerializer(booking).data)

    # ------------------------------------------------------------------
    # Override pairing (clear warning)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='override-pairing')
    def override_pairing(self, request, pk=None):
        """
        Clears pairing_warning and sets pairing_source to 'manual'.
        Use when the primary driver is unavailable for a legitimate reason.
        """
        user = request.user
        if not _is_transport_manager(user):
            return Response(
                {'error': 'Only transport managers can override pairing'},
                status=403,
            )
        booking = self.get_object()
        booking.pairing_warning = ''
        booking.pairing_source = 'manual'
        booking.save()
        return Response(TransportBookingSerializer(booking).data)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        """
        Advance a booking through its lifecycle:
            pending -> assigned -> in_transit -> delivered
        or cancel at any non-terminal stage.

        Enforces:
          - Both vehicle + driver required before in_transit.
          - Trailer attached when cargo exceeds vehicle solo capacity.
        Releases all resources when the booking reaches delivered/cancelled.
        """
        booking = self.get_object()
        new_status = request.data.get('status')

        allowed_from = {
            'pending':    ['assigned', 'cancelled'],
            'assigned':   ['in_transit', 'cancelled'],
            'in_transit': ['delivered', 'cancelled'],
        }
        if new_status not in allowed_from.get(booking.status, []):
            return Response(
                {'error': f'Cannot move from "{booking.status}" to "{new_status}"'},
                status=400,
            )

        if new_status == 'in_transit':
            if not (booking.assigned_vehicle and booking.assigned_driver):
                return Response(
                    {'error': 'Cannot start trip without assigned vehicle and driver'},
                    status=400,
                )
            if (requires_trailer(booking.assigned_vehicle, booking)
                    and not booking.assigned_trailers.exists()):
                return Response(
                    {'error': (
                        'Cargo exceeds vehicle solo capacity. Attach at least '
                        'one trailer before starting the trip.'
                    )},
                    status=400,
                )

        with transaction.atomic():
            booking.status = new_status
            booking.save()

            if new_status in ('delivered', 'cancelled'):
                # Release every resource
                if booking.assigned_vehicle:
                    booking.assigned_vehicle.status = 'available'
                    booking.assigned_vehicle.save()
                if booking.assigned_driver:
                    booking.assigned_driver.status = 'available'
                    booking.assigned_driver.save()
                for t in booking.assigned_trailers.all():
                    t.status = 'available'
                    t.save()

        return Response(TransportBookingSerializer(booking).data)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_transport_manager(user) -> bool:
    return (
        user.is_authenticated
        and (user.is_superuser
             or user.roles.filter(name=TRANSPORT_MANAGER).exists())
    )


def _trailer_warning(vehicle, booking) -> str:
    """Return the trailer-requirement message if applicable, else ''."""
    if requires_trailer(vehicle, booking):
        return (
            f'Trailer required: cargo ({booking.cargo_weight_kg}kg) '
            f'exceeds solo capacity ({vehicle.tonnage}t).'
        )
    return ''