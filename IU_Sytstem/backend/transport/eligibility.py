"""
Driver ↔ Vehicle eligibility rules.

All dispatch validation funnels through these two functions:
    required_class_for(vehicle)                       -> minimum class code
    is_driver_eligible(driver, vehicle, booking=None) -> (ok, reason)

Keeping the rules here means views stay thin and the same logic is
reusable by admin, services, and future endpoints.
"""

from datetime import date
from decimal import Decimal


# Tonnage thresholds (in tonnes)
LIGHT_MAX = Decimal('4.00')
HEAVY_MIN = Decimal('16.00')


def required_class_for(vehicle) -> str:
    """
    Return the minimum license class code required to drive `vehicle`.

        semi-truck with trailer, < 16t  -> C1E
        semi-truck with trailer, >= 16t -> CE
        no trailer, <= 4t               -> B
        no trailer, < 16t               -> C1
        no trailer, >= 16t              -> C
    """
    has_trailer = _vehicle_has_trailer(vehicle)
    t = Decimal(str(vehicle.tonnage or 0))

    if has_trailer:
        return 'C1E' if t < HEAVY_MIN else 'CE'

    if t <= LIGHT_MAX:
        return 'B'
    if t < HEAVY_MIN:
        return 'C1'
    return 'C'


def is_driver_eligible(driver, vehicle, booking=None):
    """
    Full eligibility check for a driver on a given vehicle.

    Returns (ok: bool, reason: str). The reason string is user-facing;
    return it verbatim in API error responses.

    Order matters:
        1. License expiry
        2. PSV gate (public-category vehicles require PSV endorsement)
        3. License class coverage
        4. DG endorsement if the booking carries dangerous goods
        5. Availability (driver and vehicle both 'available')
        6. Tonnage fits the booking's cargo
    """
    # 1. License expiry
    if driver.license_expiry and driver.license_expiry < date.today():
        return False, "Driver's license is expired"

    # 2. PSV gate — HARD RULE, checked before class coverage
    if vehicle.category == 'public' and not driver.has_psv:
        return False, "PSV endorsement required for public-category vehicles"

    # 3. Class coverage
    required = required_class_for(vehicle)
    held = set(driver.license_classes.values_list('code', flat=True))
    if required not in held:
        return False, f"Driver needs license class {required}"

    # 4. DG endorsement
    if booking and getattr(booking, 'cargo_category', None) == 'dg':
        if 'DG' not in held:
            return False, "DG endorsement required for dangerous goods"

    # 5. Availability
    if driver.status != 'available':
        return False, f"Driver is not available (status: {driver.status})"
    if vehicle.status != 'available':
        return False, f"Vehicle is not available (status: {vehicle.status})"

    # 6. Tonnage vs cargo
    if booking and booking.cargo_weight_kg:
        cargo_t = Decimal(str(booking.cargo_weight_kg)) / 1000
        if Decimal(str(vehicle.tonnage)) < cargo_t:
            return False, (
                f"Vehicle tonnage ({vehicle.tonnage}t) is less than "
                f"cargo weight ({cargo_t:.2f}t)"
            )

    return True, "OK"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _vehicle_has_trailer(vehicle) -> bool:
    """
    Determine whether the vehicle is currently pulling a trailer.

    Right now we infer this from active bookings that have trailers
    attached. If the model ever gains a permanent trailer FK, this is
    the one place to update.
    """
    if getattr(vehicle, '_current_booking_with_trailers', None) is not None:
        return vehicle._current_booking_with_trailers

    active = vehicle.bookings.filter(
        status__in=['assigned', 'in_transit'],
    ).prefetch_related('assigned_trailers')

    for b in active:
        if b.assigned_trailers.exists():
            return True

    return False

# ---------------------------------------------------------------------------
# Status sync
# ---------------------------------------------------------------------------

def sync_vehicle_status(booking, save=True):
    """
    Reconcile the assigned vehicle's status with the booking's state.

        assigned, in_transit  -> vehicle on_trip, driver on_trip, trailers on_trip
        delivered, cancelled  -> vehicle available, driver available, trailers available

    Safe to call repeatedly. Only writes when a change is needed.
    """
    from .models import Vehicle, Driver, Trailer  # local import to avoid cycles

    vehicle = booking.assigned_vehicle
    driver = booking.assigned_driver
    trailers = list(booking.assigned_trailers.all()) if booking.pk else []

    should_be_busy = booking.status in ('assigned', 'in_transit')
    desired_vehicle_status = 'on_trip' if should_be_busy else 'available'
    desired_driver_status = 'on_trip' if should_be_busy else 'available'
    desired_trailer_status = 'on_trip' if should_be_busy else 'available'

    changed = False

    if vehicle and vehicle.status != desired_vehicle_status:
        vehicle.status = desired_vehicle_status
        if save:
            vehicle.save()
        changed = True

    if driver and driver.status != desired_driver_status:
        driver.status = desired_driver_status
        if save:
            driver.save()
        changed = True

    for t in trailers:
        if t.status != desired_trailer_status:
            t.status = desired_trailer_status
            if save:
                t.save()
            changed = True

    return changed

def combined_capacity(vehicle, trailers=None):
    """
    Total tonnage capacity = vehicle + sum(trailers).
    Returns a Decimal.
    """
    base = Decimal(str(vehicle.tonnage or 0))
    extra = sum(
        (Decimal(str(t.tonnage or 0)) for t in (trailers or [])),
        Decimal('0'),
    )
    return base + extra


def requires_trailer(vehicle, booking):
    """
    True when the booking's cargo exceeds the vehicle's solo tonnage
    and the vehicle is a semi-truck (the only type that can pull trailers).
    """
    if not vehicle or vehicle.vehicle_type != 'semi_truck':
        return False
    cargo_t = Decimal(str(booking.cargo_weight_kg or 0)) / 1000
    solo_t = Decimal(str(vehicle.tonnage or 0))
    return cargo_t > solo_t