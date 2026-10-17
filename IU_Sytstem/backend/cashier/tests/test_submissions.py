"""Tests for cashier submission listing and resubmission."""
import pytest

from finance import services


CASH = '/api/cashier'


# ---------------------------------------------------------------------------
# my-submissions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestMySubmissions:

    def test_anonymous_rejected(self, anon_client):
        r = anon_client.get(f'{CASH}/my-submissions/')
        assert r.status_code in (401, 403)

    def test_cashier_sees_own_cash_in(self, client_cashier, cash_in):
        r = client_cashier.get(f'{CASH}/my-submissions/')
        assert r.status_code == 200

    def test_other_cashier_does_not_see_foreign_records(
        self, client_other_cashier, cash_in,
    ):
        r = client_other_cashier.get(f'{CASH}/my-submissions/')
        assert r.status_code == 200
        body = r.json()
        # Normalise: response may be {cash_ins: [...], ...} or a list.
        def _all_ids(obj):
            ids = set()
            if isinstance(obj, list):
                for x in obj:
                    if isinstance(x, dict) and 'id' in x:
                        ids.add(x['id'])
            elif isinstance(obj, dict):
                for v in obj.values():
                    ids |= _all_ids(v)
            return ids
        assert cash_in.pk not in _all_ids(body)


# ---------------------------------------------------------------------------
# Resubmit flow
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestResubmitCashIn:

    def test_resubmit_queried_succeeds(self, client_cashier, cash_in, finance_officer):
        services.query_record(cash_in, finance_officer, reason='x')
        r = client_cashier.post(
            f'{CASH}/submissions/cash-ins/{cash_in.pk}/resubmit/',
            {'reference': 'R1-updated'}, format='json',
        )
        assert r.status_code == 200
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'pending'

    def test_resubmit_rejected_succeeds(self, client_cashier, cash_in, finance_officer):
        services.reject_record(cash_in, finance_officer, reason='x')
        r = client_cashier.post(
            f'{CASH}/submissions/cash-ins/{cash_in.pk}/resubmit/',
            {}, format='json',
        )
        assert r.status_code == 200
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'pending'

    def test_resubmit_pending_is_rejected(self, client_cashier, cash_in):
        r = client_cashier.post(
            f'{CASH}/submissions/cash-ins/{cash_in.pk}/resubmit/',
            {}, format='json',
        )
        assert r.status_code in (400, 403)
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'pending'

    def test_resubmit_approved_is_rejected(
        self, client_cashier, cash_in, finance_officer,
    ):
        services.approve_record(cash_in, finance_officer)
        r = client_cashier.post(
            f'{CASH}/submissions/cash-ins/{cash_in.pk}/resubmit/',
            {}, format='json',
        )
        assert r.status_code in (400, 403)
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'approved'

    def test_only_author_can_resubmit(
        self, client_other_cashier, cash_in, finance_officer,
    ):
        services.query_record(cash_in, finance_officer, reason='x')
        r = client_other_cashier.post(
            f'{CASH}/submissions/cash-ins/{cash_in.pk}/resubmit/',
            {}, format='json',
        )
        assert r.status_code in (403, 404)


@pytest.mark.django_db
class TestResubmitExpense:

    def test_resubmit_queried_expense(self, client_cashier, expense, finance_officer):
        services.query_record(expense, finance_officer, reason='x')
        r = client_cashier.post(
            f'{CASH}/submissions/expenses/{expense.pk}/resubmit/',
            {}, format='json',
        )
        assert r.status_code == 200
        expense.refresh_from_db()
        assert expense.finance_status == 'pending'


@pytest.mark.django_db
class TestResubmitDamage:

    def test_resubmit_queried_damage(self, client_cashier, damage, finance_officer):
        services.query_record(damage, finance_officer, reason='x')
        r = client_cashier.post(
            f'{CASH}/submissions/damages/{damage.pk}/resubmit/',
            {}, format='json',
        )
        assert r.status_code == 200
        damage.refresh_from_db()
        assert damage.finance_status == 'pending'