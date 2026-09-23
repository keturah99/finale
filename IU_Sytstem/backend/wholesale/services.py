"""
Wholesale service layer.

Single responsibility: keep WholesaleStockLevel consistent with the
movement records (stock-in, stock-out, damage).

All functions are idempotent within a transaction: they apply the
delta between the record's current state and its previous state.
"""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from django.utils import timezone


from .models import WholesaleStockLevel, Wholesale, WeeklySales
from datetime import timedelta



# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _apply_quantity_delta(wholesale, product, delta, unit_cost=None):
    """
    Atomically add `delta` (may be negative) to the stock level for
    (wholesale, product). Rejects if the result would be negative.

    When `unit_cost` is provided and delta > 0, updates the weighted
    average cost:
        new_avg = (old_qty * old_avg + delta * unit_cost) / (old_qty + delta)
    """
    if delta == 0:
        return

    with transaction.atomic():
        level, _ = WholesaleStockLevel.objects.select_for_update().get_or_create(
            wholesale=wholesale,
            product=product,
            defaults={'quantity': 0, 'average_cost': Decimal('0.00')},
        )

        new_qty = level.quantity + delta
        if new_qty < 0:
            raise ValidationError(
                f'Insufficient stock at {wholesale.name} for {product.sku}: '
                f'have {level.quantity}, need {-delta}'
            )

        # Update weighted average cost on incoming stock
        if delta > 0 and unit_cost is not None:
            old_total = (level.average_cost or Decimal('0.00')) * level.quantity
            incoming_total = Decimal(str(unit_cost)) * delta
            level.average_cost = (old_total + incoming_total) / new_qty

        level.quantity = new_qty
        level.save()


# ---------------------------------------------------------------------------
# Per-record handlers
# ---------------------------------------------------------------------------

def sync_stock_in(stock_in, old_quantity=0, old_unit_value=None):
    """
    Called from WholesaleStockIn.save().

    - delta = new_quantity - old_quantity (positive means more arriving)
    - updates weighted average cost using the new unit_value
    """
    delta = (stock_in.quantity or 0) - (old_quantity or 0)
    if delta > 0:
        _apply_quantity_delta(
            stock_in.wholesale, stock_in.product, delta,
            unit_cost=stock_in.unit_value,
        )
    elif delta < 0:
        # Reversal: the record was reduced, remove stock without cost change
        _apply_quantity_delta(stock_in.wholesale, stock_in.product, delta)


def reverse_stock_in(stock_in):
    """Called from WholesaleStockIn.delete() — remove the full effect."""
    _apply_quantity_delta(stock_in.wholesale, stock_in.product, -stock_in.quantity)


def sync_stock_out(stock_out, old_quantity=0):
    """Called from WholesaleStockOut.save(). Decrement on increase."""
    delta = (stock_out.quantity or 0) - (old_quantity or 0)
    # Stock-out subtracts; a positive delta reduces stock
    _apply_quantity_delta(stock_out.wholesale, stock_out.product, -delta)


def reverse_stock_out(stock_out):
    """Called from WholesaleStockOut.delete() — restore full quantity."""
    _apply_quantity_delta(stock_out.wholesale, stock_out.product, stock_out.quantity)


def sync_damage(damage, old_quantity=0):
    """Called from WholesaleDamage.save(). Decrement on increase."""
    delta = (damage.quantity or 0) - (old_quantity or 0)
    _apply_quantity_delta(damage.wholesale, damage.product, -delta)


def reverse_damage(damage):
    """Called from WholesaleDamage.delete() — restore full quantity."""
    _apply_quantity_delta(damage.wholesale, damage.product, damage.quantity)




@transaction.atomic
def approve_transfer(transfer, user):
    """
    Move a transfer from pending -> in_transit and decrement the
    source stock level.
    """
    if transfer.status != 'pending':
        raise ValidationError(
            f'Only pending transfers can be approved (current: {transfer.status})'
        )

    _apply_quantity_delta(
        transfer.from_wholesale, transfer.product, -transfer.quantity,
    )

    transfer.status = 'in_transit'
    transfer.approved_by = user
    transfer.approved_at = timezone.now()
    transfer.save(update_fields=[
        'status', 'approved_by', 'approved_at',
    ])
    return transfer


@transaction.atomic
def receive_transfer(transfer, user):
    """
    Move a transfer from in_transit -> received and increment the
    destination stock level.
    """
    if transfer.status != 'in_transit':
        raise ValidationError(
            f'Only in-transit transfers can be received (current: {transfer.status})'
        )

    _apply_quantity_delta(
        transfer.to_wholesale, transfer.product, transfer.quantity,
        unit_cost=transfer.unit_value,
    )

    transfer.status = 'received'
    transfer.received_by = user
    transfer.received_at = timezone.now()
    transfer.save(update_fields=[
        'status', 'received_by', 'received_at',
    ])
    return transfer


@transaction.atomic
def cancel_transfer(transfer, user):
    """
    Cancel a transfer. If it was already in_transit, restore the source
    stock level first.
    """
    if transfer.status not in ('pending', 'in_transit'):
        raise ValidationError(
            f'Cannot cancel a transfer in status "{transfer.status}"'
        )

    if transfer.status == 'in_transit':
        _apply_quantity_delta(
            transfer.from_wholesale, transfer.product, transfer.quantity,
        )

    transfer.status = 'cancelled'
    transfer.cancelled_by = user
    transfer.cancelled_at = timezone.now()
    transfer.save(update_fields=[
        'status', 'cancelled_by', 'cancelled_at',
    ])
    return transfer

def _assert_open(weekly_sales):
    if weekly_sales.status != 'open':
        raise ValidationError(
            f'Weekly sales "{weekly_sales.label}" is {weekly_sales.status}; '
            f'no further entries allowed.'
        )


def assert_weekly_sales_open(weekly_sales):
    """Public alias used by views/serializers."""
    _assert_open(weekly_sales)


@transaction.atomic
def close_weekly_sales(weekly_sales, user=None):
    """Mark a weekly sales cycle as closed."""
    if weekly_sales.status == 'closed':
        raise ValidationError('Weekly sales already closed')

    weekly_sales.status = 'closed'
    weekly_sales.closed_at = timezone.now()
    weekly_sales.save(update_fields=['status', 'closed_at'])
    return weekly_sales


@transaction.atomic
def close_and_open_next(weekly_sales, user=None, days=None):
    """
    Close the given cycle and open the next one at the same wholesale.

    - `days` optionally sets the length of the new cycle (default 7).
    - Week number and label are auto-generated.
    """
    if weekly_sales.status == 'closed':
        raise ValidationError('Weekly sales already closed')

    # Lock this wholesale's row so two concurrent opens can't grab the
    # same week number.
    Wholesale.objects.select_for_update().get(pk=weekly_sales.wholesale_id)

    close_weekly_sales(weekly_sales, user)

    new_start = weekly_sales.end_date + timedelta(days=1)
    new_end = new_start + timedelta(days=(days or 7) - 1)

    new_cycle = WeeklySales.objects.create(
        wholesale=weekly_sales.wholesale,
        seller=weekly_sales.seller,
        received_by=weekly_sales.received_by,
        start_date=new_start,
        end_date=new_end,
        status='open',
    )
    return new_cycle