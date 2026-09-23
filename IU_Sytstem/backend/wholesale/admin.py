from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Wholesale, WholesaleStockLevel,
    WholesaleStockIn, WholesaleStockOut, WholesaleDamage,
)
from .models import InterWholesaleTransfer
from .models import (
    WeeklySales, WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage,
)


@admin.register(Wholesale)
class WholesaleAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'manager', 'phone', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'location')


@admin.register(WholesaleStockLevel)
class WholesaleStockLevelAdmin(admin.ModelAdmin):
    list_display = ('wholesale', 'product', 'quantity_colored',
                    'average_cost', 'total_value_display', 'last_updated')
    list_filter = ('wholesale',)
    search_fields = ('product__sku', 'product__name')
    readonly_fields = ('last_updated',)

    @admin.display(description='Qty')
    def quantity_colored(self, obj):
        color = 'red' if obj.quantity <= 0 else (
            'orange' if obj.quantity < 10 else 'green'
        )
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.quantity,
        )

    @admin.display(description='Value (K)')
    def total_value_display(self, obj):
        return f"{obj.total_value:,.2f}"


@admin.register(WholesaleStockIn)
class WholesaleStockInAdmin(admin.ModelAdmin):
    list_display = ('wholesale', 'product', 'quantity', 'unit_value',
                    'total_value', 'stock_from', 'received_by', 'received_at')
    list_filter = ('wholesale', 'stock_from', 'received_at')
    search_fields = ('product__sku', 'product__name', 'reference')
    readonly_fields = ('total_value', 'received_at')
    date_hierarchy = 'received_at'


@admin.register(WholesaleStockOut)
class WholesaleStockOutAdmin(admin.ModelAdmin):
    list_display = ('wholesale', 'product', 'quantity', 'unit_value',
                    'total_value', 'approved_by', 'issued_at')
    list_filter = ('wholesale', 'issued_at')
    search_fields = ('product__sku', 'product__name')
    readonly_fields = ('total_value', 'issued_at')
    date_hierarchy = 'issued_at'


@admin.register(WholesaleDamage)
class WholesaleDamageAdmin(admin.ModelAdmin):
    list_display = ('wholesale', 'product', 'quantity', 'selling_price',
                    'total_loss_value', 'reported_by', 'reported_at',
                    'thumbnail')
    list_filter = ('wholesale', 'reported_at')
    search_fields = ('product__sku', 'product__name')
    readonly_fields = ('total_loss_value', 'reported_at')
    date_hierarchy = 'reported_at'

    @admin.display(description='Image')
    def thumbnail(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="height:40px;" />', obj.image.url
            )
        return '—'

@admin.register(InterWholesaleTransfer)
class InterWholesaleTransferAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'from_wholesale', 'to_wholesale', 'product',
        'quantity', 'unit_value', 'total_value',
        'status_badge', 'initiated_by', 'initiated_at',
    )
    list_filter = ('status', 'from_wholesale', 'to_wholesale', 'initiated_at')
    search_fields = ('product__sku', 'product__name', 'reference')
    readonly_fields = (
        'total_value', 'initiated_at',
        'approved_at', 'received_at', 'cancelled_at',
    )
    date_hierarchy = 'initiated_at'

    actions = ['action_approve', 'action_receive', 'action_cancel']

    @admin.display(description='Status')
    def status_badge(self, obj):
        colors = {
            'pending': '#a67c00',
            'in_transit': '#b35c00',
            'received': '#1a7a1a',
            'cancelled': '#a61a1a',
        }
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 4px; font-weight: bold;">{}</span>',
            colors.get(obj.status, '#555'),
            obj.get_status_display(),
        )

    # --- Bulk actions ---

    @admin.action(description='Approve selected transfers (pending → in_transit)')
    def action_approve(self, request, queryset):
        from .services import approve_transfer
        from django.core.exceptions import ValidationError
        approved = 0
        for t in queryset:
            try:
                approve_transfer(t, request.user)
                approved += 1
            except ValidationError as e:
                self.message_user(
                    request, f'#{t.pk}: {e}', level='error',
                )
        self.message_user(request, f'{approved} transfer(s) approved.')

    @admin.action(description='Receive selected transfers (in_transit → received)')
    def action_receive(self, request, queryset):
        from .services import receive_transfer
        from django.core.exceptions import ValidationError
        received = 0
        for t in queryset:
            try:
                receive_transfer(t, request.user)
                received += 1
            except ValidationError as e:
                self.message_user(
                    request, f'#{t.pk}: {e}', level='error',
                )
        self.message_user(request, f'{received} transfer(s) received.')

    @admin.action(description='Cancel selected transfers')
    def action_cancel(self, request, queryset):
        from .services import cancel_transfer
        from django.core.exceptions import ValidationError
        cancelled = 0
        for t in queryset:
            try:
                cancel_transfer(t, request.user)
                cancelled += 1
            except ValidationError as e:
                self.message_user(
                    request, f'#{t.pk}: {e}', level='error',
                )
        self.message_user(request, f'{cancelled} transfer(s) cancelled.')


class WeeklySalesCashInInline(admin.TabularInline):
    model = WeeklySalesCashIn
    extra = 0
    readonly_fields = ('received_at',)


class WeeklySalesExpenseInline(admin.TabularInline):
    model = WeeklySalesExpense
    extra = 0
    readonly_fields = ('recorded_at',)


class WeeklySalesDamageInline(admin.TabularInline):
    model = WeeklySalesDamage
    extra = 0
    readonly_fields = ('total_loss_value', 'recorded_at')


@admin.register(WeeklySales)
class WeeklySalesAdmin(admin.ModelAdmin):
    list_display = (
        'label', 'wholesale', 'seller', 'status',
        'start_date', 'end_date', 'opened_at', 'closed_at',
    )
    list_filter = ('status', 'wholesale', 'year')
    search_fields = ('label', 'wholesale__name')
    readonly_fields = ('year', 'week_number', 'label', 'opened_at', 'closed_at')
    date_hierarchy = 'start_date'
    inlines = [
        WeeklySalesCashInInline,
        WeeklySalesExpenseInline,
        WeeklySalesDamageInline,
    ]
    actions = ['action_close_and_open_next']

    @admin.action(description='Close and open next week')
    def action_close_and_open_next(self, request, queryset):
        from .services import close_and_open_next
        from django.core.exceptions import ValidationError
        for ws in queryset:
            try:
                new_ws = close_and_open_next(ws, request.user)
                self.message_user(
                    request,
                    f'{ws.label} closed; opened {new_ws.label}.',
                )
            except ValidationError as e:
                self.message_user(request, f'{ws.label}: {e}', level='error')


@admin.register(WeeklySalesCashIn)
class WeeklySalesCashInAdmin(admin.ModelAdmin):
    list_display = ('weekly_sales', 'amount', 'received_by', 'received_at', 'reference')
    list_filter = ('weekly_sales', 'received_at')
    readonly_fields = ('received_at',)
    date_hierarchy = 'received_at'


@admin.register(WeeklySalesExpense)
class WeeklySalesExpenseAdmin(admin.ModelAdmin):
    list_display = ('weekly_sales', 'amount', 'description', 'recorded_by', 'recorded_at')
    list_filter = ('weekly_sales', 'recorded_at')
    readonly_fields = ('recorded_at',)
    date_hierarchy = 'recorded_at'


@admin.register(WeeklySalesDamage)
class WeeklySalesDamageAdmin(admin.ModelAdmin):
    list_display = ('weekly_sales', 'product', 'quantity',
                    'selling_price', 'total_loss_value', 'recorded_by', 'recorded_at')
    list_filter = ('weekly_sales', 'recorded_at')
    readonly_fields = ('total_loss_value', 'recorded_at')
    date_hierarchy = 'recorded_at'