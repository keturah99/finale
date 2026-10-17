"""
Finance module services.

Two responsibilities:

  1. Flag computation — called from each reviewable model's save()
     to populate `flags` with automated discrepancy warnings.

  2. State transitions — approve / reject / query / resubmit / reopen,
     each writing a FinanceReviewLog entry.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import FinanceReviewLog


# ---------------------------------------------------------------------------
# Decimal helper
# ---------------------------------------------------------------------------

def _dec(value, default=Decimal('0.00')):
    if value is None or value == '':
        return default
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _flag(code, severity, message):
    return {'code': code, 'severity': severity, 'message': message}


# ---------------------------------------------------------------------------
# Cash-in flags
# ---------------------------------------------------------------------------

def compute_cash_in_flags(record) -> list:
    """
    Compute discrepancy flags for a WeeklySalesCashIn.

    Compares the cash-in amount against the cycle's issued stock value
    and checks for missing reference, late submission, and possible
    duplication.
    """
    flags = []
    cycle = getattr(record, 'weekly_sales', None)
    amount = _dec(getattr(record, 'amount', 0))

    if cycle is None:
        return flags

    # Expected revenue = value of stock issued to this cycle
    expected = _dec(
        cycle.stock_outs.aggregate(t=Sum('total_value'))['t']
    )

    if expected > 0:
        ratio = amount / expected
        if ratio < Decimal('0.8'):
            diff_pct = int((1 - ratio) * 100)
            flags.append(_flag(
                'low_cash_in', 'warning',
                f'Cash-in K {amount:,.2f} is {diff_pct}% below expected '
                f'K {expected:,.2f}.',
            ))
        elif ratio > Decimal('1.2'):
            diff_pct = int((ratio - 1) * 100)
            flags.append(_flag(
                'high_cash_in', 'warning',
                f'Cash-in K {amount:,.2f} exceeds expected '
                f'K {expected:,.2f} by {diff_pct}%.',
            ))

    # Missing bank reference
    if not (getattr(record, 'reference', '') or '').strip():
        flags.append(_flag(
            'no_reference', 'info',
            'No bank slip or reference provided.',
        ))

    # Late submission — more than 3 days after cycle end
    if cycle.end_date:
        try:
            if date.today() > cycle.end_date + timedelta(days=3):
                flags.append(_flag(
                    'late_submission', 'info',
                    f'Submitted after the 3-day grace window '
                    f'(cycle ended {cycle.end_date}).',
                ))
        except Exception:
            pass

    # Possible duplicate — same amount on same day at same cycle
    if record.pk:
        dupe_qs = (
            record.__class__.objects
            .filter(weekly_sales=cycle, amount=amount)
            .exclude(pk=record.pk)
            .filter(received_at__date=timezone.now().date())
        )
        if dupe_qs.exists():
            flags.append(_flag(
                'possible_duplicate', 'warning',
                'Another cash-in for the same amount was recorded today.',
            ))

    return flags


# ---------------------------------------------------------------------------
# Expense flags
# ---------------------------------------------------------------------------

def compute_expense_flags(record) -> list:
    """
    Compute discrepancy flags for a WeeklySalesExpense.
    """
    flags = []
    cycle = getattr(record, 'weekly_sales', None)
    amount = _dec(getattr(record, 'amount', 0))

    if cycle is None:
        return flags

    # Large expense without attachment (receipt upload not modeled yet,
    # so this flags every large expense as a manual-review item)
    if amount > Decimal('5000.00'):
        flags.append(_flag(
            'large_expense', 'warning',
            f'Expense K {amount:,.2f} exceeds K 5,000.00 — verify documentation.',
        ))

    # Expense ratio
    cycle_revenue = _dec(
        cycle.stock_outs.aggregate(t=Sum('total_value'))['t']
    )
    if cycle_revenue > 0:
        ratio = amount / cycle_revenue
        if ratio > Decimal('0.3'):
            pct = int(ratio * 100)
            flags.append(_flag(
                'high_expense_ratio', 'warning',
                f'Expense is {pct}% of cycle issued stock value.',
            ))

    # Possible duplicate — same description, amount, and day
    if record.pk and (getattr(record, 'description', '') or '').strip():
        dupe_qs = (
            record.__class__.objects
            .filter(
                weekly_sales=cycle,
                amount=amount,
                description=record.description,
            )
            .exclude(pk=record.pk)
            .filter(recorded_at__date=timezone.now().date())
        )
        if dupe_qs.exists():
            flags.append(_flag(
                'possible_duplicate', 'warning',
                'Another expense with the same description and amount was recorded today.',
            ))

    return flags


# ---------------------------------------------------------------------------
# Damage flags
# ---------------------------------------------------------------------------

def compute_damage_flags(record) -> list:
    """
    Compute discrepancy flags for a damage record.

    Works for both WholesaleDamage and WeeklySalesDamage — both
    expose `total_loss_value`, `quantity`, and an optional `image`.
    """
    flags = []
    loss = _dec(getattr(record, 'total_loss_value', 0))

    if loss > Decimal('2000.00'):
        flags.append(_flag(
            'large_loss', 'warning',
            f'Loss value K {loss:,.2f} exceeds the K 2,000.00 threshold.',
        ))

    if not getattr(record, 'image', None):
        flags.append(_flag(
            'no_evidence', 'info',
            'No photograph attached as evidence.',
        ))

    # Damage rate vs stock issued — only if the record belongs to a cycle
    cycle = (
        getattr(record, 'weekly_sales', None)
        or getattr(getattr(record, 'weekly_sales', None), 'weekly_sales', None)
    )
    if cycle is None and hasattr(record, 'weekly_sales'):
        cycle = record.weekly_sales

    if cycle is not None:
        cycle_value = _dec(
            cycle.stock_outs.aggregate(t=Sum('total_value'))['t']
        )
        if cycle_value > 0:
            ratio = loss / cycle_value
            if ratio > Decimal('0.05'):
                pct = int(ratio * 100)
                flags.append(_flag(
                    'high_damage_rate', 'warning',
                    f'Damage is {pct}% of cycle issued stock value.',
                ))

    return flags


# ---------------------------------------------------------------------------
# Record-type registry
# ---------------------------------------------------------------------------

def _record_type(record) -> str:
    """Return the string label used in the audit log."""
    name = record.__class__.__name__
    mapping = {
        'WeeklySalesCashIn': 'cash_in',
        'WeeklySalesExpense': 'expense',
        'WeeklySalesDamage': 'damage',
        'WholesaleDamage': 'damage',
    }
    return mapping.get(name, name.lower())


def _log(record, action, actor, reason='', from_status='', to_status=''):
    """Write a FinanceReviewLog entry for a review action."""
    FinanceReviewLog.objects.create(
        record_type=_record_type(record),
        record_id=record.pk,
        action=action,
        actor=actor,
        reason=reason or '',
        from_status=from_status,
        to_status=to_status,
    )


# ---------------------------------------------------------------------------
# State transition guards
# ---------------------------------------------------------------------------

FINANCE_ROLES = {'finance_officer', 'finance_manager'}
MANAGER_ROLES = {'finance_manager'}


def _has_role(user, roles: set) -> bool:
    if user.is_superuser:
        return True
    return user.roles.filter(name__in=roles).exists()


def _require_finance(user):
    if not _has_role(user, FINANCE_ROLES):
        raise ValidationError(
            'Only finance officers or managers may perform this action.'
        )


def _require_manager(user):
    if not _has_role(user, MANAGER_ROLES):
        raise ValidationError(
            'Only finance managers may perform this action.'
        )


def _require_author(record, user):
    """The user must be the original author or a superuser."""
    if user.is_superuser:
        return
    author_field = None
    for field in ('received_by', 'recorded_by', 'reported_by'):
        if hasattr(record, field):
            author_field = field
            break
    if author_field is None:
        raise ValidationError('Cannot determine record author.')
    author = getattr(record, author_field, None)
    if author is None or author.pk != user.pk:
        raise ValidationError('Only the original author may modify this record.')


# ---------------------------------------------------------------------------
# State transitions
# ---------------------------------------------------------------------------

@transaction.atomic
def approve_record(record, user, notes=''):
    """
    Transition a pending record to approved.

    Only finance officers or managers may call this.
    The record's `finance_reviewed_by` and `finance_reviewed_at` are set.
    """
    _require_finance(user)

    if record.finance_status == 'approved':
        raise ValidationError('Record is already approved.')
    if record.finance_status not in ('pending', 'queried', 'rejected'):
        raise ValidationError(
            f'Cannot approve a record in status "{record.finance_status}".'
        )

    from_status = record.finance_status
    record.finance_status = 'approved'
    record.finance_reviewed_by = user
    record.finance_reviewed_at = timezone.now()
    record.finance_notes = notes or ''
    record.save()

    _log(record, 'approve', user, reason=notes,
         from_status=from_status, to_status='approved')

    return record


@transaction.atomic
def reject_record(record, user, reason):
    """
    Transition a pending or queried record to rejected.

    A reason is mandatory and is shown to the cashier.
    """
    _require_finance(user)

    if not reason or not reason.strip():
        raise ValidationError('A reason is required when rejecting a record.')

    if record.finance_status == 'approved':
        raise ValidationError('Approved records cannot be rejected directly — reopen first.')
    if record.finance_status == 'rejected':
        raise ValidationError('Record is already rejected.')

    from_status = record.finance_status
    record.finance_status = 'rejected'
    record.finance_reviewed_by = user
    record.finance_reviewed_at = timezone.now()
    record.finance_notes = reason
    record.save()

    _log(record, 'reject', user, reason=reason,
         from_status=from_status, to_status='rejected')

    return record


@transaction.atomic
def query_record(record, user, reason):
    """
    Raise a query on a pending record.

    The cashier sees the query reason and can respond by editing
    and resubmitting.
    """
    _require_finance(user)

    if not reason or not reason.strip():
        raise ValidationError('A reason is required when raising a query.')

    if record.finance_status != 'pending':
        raise ValidationError(
            f'Can only query a pending record (current: {record.finance_status}).'
        )

    from_status = record.finance_status
    record.finance_status = 'queried'
    record.finance_reviewed_by = user
    record.finance_reviewed_at = timezone.now()
    record.finance_notes = reason
    record.save()

    _log(record, 'query', user, reason=reason,
         from_status=from_status, to_status='queried')

    return record


@transaction.atomic
def resubmit_record(record, user):
    """
    Cashier resubmits a queried or rejected record after editing.

    Only the original author or a superuser may resubmit.
    The record returns to `pending` and prior review metadata is cleared.
    """
    _require_author(record, user)

    if record.finance_status not in ('queried', 'rejected'):
        raise ValidationError(
            f'Only queried or rejected records can be resubmitted '
            f'(current: {record.finance_status}).'
        )

    from_status = record.finance_status

    # Recompute flags — the record may have been edited
    flags = []
    if _record_type(record) == 'cash_in':
        flags = compute_cash_in_flags(record)
    elif _record_type(record) == 'expense':
        flags = compute_expense_flags(record)
    elif _record_type(record) == 'damage':
        flags = compute_damage_flags(record)

    record.finance_status = 'pending'
    record.finance_reviewed_by = None
    record.finance_reviewed_at = None
    record.finance_notes = ''
    record.flags = flags
    record.save()

    _log(record, 'resubmit', user, reason='',
         from_status=from_status, to_status='pending')

    return record


@transaction.atomic
def reopen_record(record, user, reason):
    """
    Finance manager reopens an approved record.

    The record returns to `pending` for re-review.
    """
    _require_manager(user)

    if not reason or not reason.strip():
        raise ValidationError('A reason is required when reopening a record.')

    if record.finance_status != 'approved':
        raise ValidationError('Only approved records can be reopened.')

    from_status = record.finance_status
    record.finance_status = 'pending'
    record.finance_reviewed_by = None
    record.finance_reviewed_at = None
    record.finance_notes = ''
    record.save()

    _log(record, 'reopen', user, reason=reason,
         from_status=from_status, to_status='pending')

    return record


# ---------------------------------------------------------------------------
# Log helper for creation
# ---------------------------------------------------------------------------

def log_submission(record, user):
    """
    Write a 'submit' entry when a record is first created.

    Called manually from viewsets after perform_create so the audit
    trail starts at the moment of first submission.
    """
    _log(record, 'submit', user, reason='',
         from_status='', to_status='pending')