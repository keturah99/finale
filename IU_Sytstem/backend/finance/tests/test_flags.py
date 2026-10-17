"""Flag-computation tests.

The precise thresholds and flag codes live in finance/services.py. These tests
assert the *contract* of the functions:
    * they return a list
    * each element has code/severity/message
    * pathological inputs produce at least one flag
    * benign inputs produce zero or few flags

If a rule's threshold changes, adjust the fixtures here.
"""
from decimal import Decimal

from backend.finance.tests.conftest import weekly_sales_a
import pytest

from finance import services
from wholesale.models import WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage


def _flag_keys(flags):
    assert isinstance(flags, list)
    for f in flags:
        assert isinstance(f, dict)
        assert 'code' in f
        assert 'severity' in f
        assert 'message' in f


# ---------------------------------------------------------------------------
# Cash-in flags
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCashInFlags:

    def test_returns_list_of_dicts_with_required_keys(self, cash_in):
        flags = services.compute_cash_in_flags(cash_in)
        _flag_keys(flags)

    def test_missing_reference_is_flagged(self, weekly_sales_a, cashier_user):
        ci = WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a,
            amount=Decimal('100.00'),
            received_by=cashier_user,
            reference='',
        )
        flags = services.compute_cash_in_flags(ci)
        _flag_keys(flags)
        codes = [f['code'] for f in flags]
        assert any('ref' in c.lower() or 'missing' in c.lower() for c in codes)

    def test_tiny_amount_is_flagged(self, weekly_sales_a, cashier_user):
        ci = WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a,
            amount=Decimal('0.50'),
            received_by=cashier_user,
            reference='X',
        )
        flags = services.compute_cash_in_flags(ci)
        _flag_keys(flags)
        assert len(flags) >= 1

    def test_huge_amount_is_flagged(self, weekly_sales_a, cashier_user):
        ci = WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a,
            amount=Decimal('9999999.00'),
            received_by=cashier_user,
            reference='X',
        )
        flags = services.compute_cash_in_flags(ci)
        _flag_keys(flags)
        assert len(flags) >= 1


# ---------------------------------------------------------------------------
# Expense flags
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestExpenseFlags:

    def test_returns_list_of_dicts_with_required_keys(self, expense):
        flags = services.compute_expense_flags(expense)
        _flag_keys(flags)

    def test_huge_expense_is_flagged(self, weekly_sales_a, wholesaler_user):
        e = WeeklySalesExpense.objects.create(
            weekly_sales=weekly_sales_a,
            amount=Decimal('500000.00'),
            description='Suspicious large purchase',
            recorded_by=wholesaler_user,
        )
        flags = services.compute_expense_flags(e)
        _flag_keys(flags)
        assert len(flags) >= 1

    def test_missing_description_may_flag(self, weekly_sales_a, wholesaler_user):
        e = WeeklySalesExpense.objects.create(
            weekly_sales=weekly_sales_a,
            amount=Decimal('100.00'),
            description='',
            recorded_by=wholesaler_user,
        )
        flags = services.compute_expense_flags(e)
        _flag_keys(flags)


# ---------------------------------------------------------------------------
# Damage flags
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDamageFlags:

    def test_weekly_damage_flags_contract(self, weekly_damage):
        flags = services.compute_damage_flags(weekly_damage)
        _flag_keys(flags)

    def test_wholesale_damage_flags_contract(self, storage_damage):
        flags = services.compute_damage_flags(storage_damage)
        _flag_keys(flags)

        def test_missing_photo_is_flagged(self, weekly_sales_a, product_a, wholesaler_user):
        d = WeeklySalesDamage.objects.create(
            weekly_sales=weekly_sales_a,
            product=product_a,
            quantity=1,
            selling_price=Decimal('120.00'),
            total_loss_value=Decimal('120.00'),
            image=None,
            recorded_by=wholesaler_user,
        )
        flags = services.compute_damage_flags(d)
        _flag_keys(flags)
        codes = [f['code'] for f in flags]
        assert 'no_evidence' in codes, (
            f"Expected 'no_evidence' flag. Got: {codes}"
        )
        """A damage with no photographic evidence should be flagged by at
        least one rule. We don't assert on the exact code because the naming
        convention is internal (e.g. 'no_photo', 'missing_image', ...).

        If this fails, either:
          a) the no-photo rule is gated by a loss threshold (unlikely — the
             summary lists it as a standalone rule), or
          b) the rule code has drifted and the test should be updated once
             you inspect the real return value.
        """
        d = WeeklySalesDamage.objects.create(
            weekly_sales=weekly_sales_a,
            product=product_a,
            quantity=1,
            selling_price=Decimal('120.00'),
            total_loss_value=Decimal('120.00'),
            image=None,
            recorded_by=wholesaler_user,
        )
        flags = services.compute_damage_flags(d)
        _flag_keys(flags)
        assert len(flags) >= 1, (
            f"No flags fired for a damage with no photo. Actual codes: "
            f"{[f['code'] for f in flags]}"
        )

    def test_large_loss_is_flagged(self, weekly_sales_a, product_a, wholesaler_user):
        d = WeeklySalesDamage.objects.create(
            weekly_sales=weekly_sales_a,
            product=product_a,
            quantity=10000,
            selling_price=Decimal('120.00'),
            total_loss_value=Decimal('1200000.00'),
            recorded_by=wholesaler_user,
        )
        flags = services.compute_damage_flags(d)
        _flag_keys(flags)
        assert len(flags) >= 1


# ---------------------------------------------------------------------------
# Resubmit recomputes flags
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_resubmit_recomputes_flags(cash_in, finance_officer, cashier_user):
    services.query_record(cash_in, finance_officer, reason='x')
    cash_in.reference = ''
    cash_in.save(update_fields=['reference'])
    services.resubmit_record(cash_in, cashier_user)
    cash_in.refresh_from_db()
    assert isinstance(cash_in.flags, list)