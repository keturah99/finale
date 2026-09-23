from django.contrib import admin
from .models import Vehicle, Driver, TransportBooking
from .models import Vehicle, Driver, TransportBooking, LicenseClass
from .models import (
    Vehicle, Driver, TransportBooking, LicenseClass, Trailer
)
from .eligibility import sync_vehicle_status




@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        'registration_number', 'make', 'vehicle_type',
        'tonnage', 'category', 'status', 'primary_driver',
    )
    list_filter = ('vehicle_type', 'category', 'status')
    search_fields = ('registration_number', 'make')
    autocomplete_fields = ('primary_driver',)

    fieldsets = (
        ('Identification', {
            'fields': ('registration_number', 'make', 'vehicle_type')
        }),
        ('Specifications', {
            'fields': ('tonnage', 'category')
        }),
        ('Operations', {
            'fields': ('status', 'primary_driver', 'notes')
        }),
    )


@admin.register(LicenseClass)
class LicenseClassAdmin(admin.ModelAdmin):
    list_display = ('code', 'description', 'max_tonnage',
                    'allows_trailer', 'requires_psv_for_public')
    search_fields = ('code', 'description')


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ('user', 'license_number', 'license_expiry',
                    'class_list', 'has_psv', 'status')
    list_filter = ('status', 'has_psv', 'license_classes')
    search_fields = ('user__first_name', 'user__last_name', 'license_number')
    filter_horizontal = ('license_classes',)

    @admin.display(description='Classes')
    def class_list(self, obj):
        return ', '.join(obj.class_codes) or '—'

@admin.register(TransportBooking)
class TransportBookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer_name', 'pickup_location', 'delivery_location',
                    'pickup_date', 'assigned_vehicle', 'assigned_driver', 'status')
    list_filter = ('status', 'pickup_date')
    search_fields = ('customer_name', 'customer_phone', 'delivery_location')
    readonly_fields = ('assigned_at', 'assigned_by', 'created_at', 'updated_at')

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Sync after the M2M trailers are set (they're saved after this
        # method returns, so we defer to save_related)
        self._pending_sync = obj

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        sync_vehicle_status(form.instance)


@admin.register(Trailer)
class TrailerAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'make', 'tonnage',
                    'category', 'status', 'current_booking')
    list_filter = ('status', 'category')
    search_fields = ('registration_number', 'make')

    @admin.display(description='Current booking')
    def current_booking(self, obj):
        # Reverse relation added in Step 6 when TransportBooking gains
        # assigned_trailers. Until then, this returns '—'.
        bookings = getattr(obj, 'bookings', None)
        if not bookings:
            return '—'
        active = bookings.filter(
            status__in=['pending', 'assigned', 'in_transit']
        ).first()
        return f"#{active.id}" if active else '—'