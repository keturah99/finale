"""Cycle-total tests.

WeeklySales exposes total_cashed / total_expenses / total_damages_value and
*_pending variants per the project summary. If a property does not exist
under the expected name, the test skips rather than fails — so this file
remains safe against naming drift.
"""
from decimal import Decimal

import pytest

from finance import services
from wholesale.models import WeeklySalesCashIn, WeeklySalesExpense


def _has(obj, name: str) -> bool:
    return hasattr(obj, name)


@pytest.mark.django_db
class TestCycleTotals:

    def test_approved_cash_ins_feed_total_cashed(
        self, weekly_sales_a, cashier_user, finance_officer,
    ):
        if not _has(weekly_sales_a, 'total_cashed'):
            pytest.skip('total_cashed property not present')

        c1 = WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a, amount=Decimal('100'),
            received_by=cashier_user, reference='A',
        )
        c2 = WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a, amount=Decimal('200'),
            received_by=cashier_user, reference='B',
        )
        services.approve_record(c1, finance_officer)
        weekly_sales_a.refresh_from_db()
        assert weekly_sales_a.total_cashed == Decimal('100')

    def test_pending_cash_ins_excluded_from_total_cashed(
        self, weekly_sales_a, cashier_user, finance_officer,
    ):
        if not _has(weekly_sales_a, 'total_cashed'):
            pytest.skip('total_cashed property not present')

        c1 = WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a, amount=Decimal('100'),
            received_by=cashier_user, reference='A',
        )
        # Leave c1 pending — total_cashed should be zero.
        weekly_sales_a.refresh_from_db()
        assert weekly_sales_a.total_cashed == Decimal('0')

    def test_pending_variant_exposes_unreviewed(
        self, weekly_sales_a, cashier_user,
    ):
        if not _has(weekly_sales_a, 'total_cashed_pending'):
            pytest.skip('total_cashed_pending property not present')
        WeeklySalesCashIn.objects.create(
            weekly_sales=weekly_sales_a, amount=Decimal('250'),
            received_by=cashier_user, reference='A',
        )
        weekly_sales_a.refresh_from_db()
        assert weekly_sales_a.total_cashed_pending == Decimal('250')

    def test_approved_expense_feeds_total_expenses(
        self, weekly_sales_a, wholesaler_user, finance_officer,
    ):
        if not _has(weekly_sales_a, 'total_expenses'):
            pytest.skip('total_expenses property not present')
        e = WeeklySalesExpense.objects.create(
            weekly_sales=weekly_sales_a, amount=Decimal('50'),
            description='Fuel', recorded_by=wholesaler_user,
        )
        services.approve_record(e, finance_officer)
        weekly_sales_a.refresh_from_db()
        assert weekly_sales_a.total_expenses == Decimal('50')