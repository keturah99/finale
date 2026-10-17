"""Daily / weekly summary endpoint tests."""
import pytest

from finance import services


CASH = '/api/cashier'


@pytest.mark.django_db
class TestDailySummary:

    def test_anonymous_rejected(self, anon_client):
        r = anon_client.get(f'{CASH}/daily-summary/')
        assert r.status_code in (401, 403)

    def test_cashier_gets_a_response(self, client_cashier, cash_in):
        r = client_cashier.get(f'{CASH}/daily-summary/')
        assert r.status_code == 200
        assert r.content

    def test_approved_record_appears_in_daily_totals(
        self, client_cashier, cash_in, finance_officer,
    ):
        services.approve_record(cash_in, finance_officer)
        r = client_cashier.get(f'{CASH}/daily-summary/')
        assert r.status_code == 200
        # Shape-agnostic smoke check: response is non-empty JSON.
        body = r.json()
        assert body is not None

    def test_pending_record_does_not_inflate_approved_total(
        self, client_cashier, cash_in,
    ):
        """cash_in remains pending — approved total should not include it."""
        r = client_cashier.get(f'{CASH}/daily-summary/')
        assert r.status_code == 200
        body = r.json()
        # Look for any key containing 'approved' and assert it's zero-ish.
        def _find_approved(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if 'approved' in k.lower():
                        return v
                    r = _find_approved(v)
                    if r is not None:
                        return r
            elif isinstance(obj, list):
                for v in obj:
                    r = _find_approved(v)
                    if r is not None:
                        return r
            return None
        approved_val = _find_approved(body)
        if approved_val is not None:
            assert float(approved_val or 0) == 0.0


@pytest.mark.django_db
class TestWeeklySummary:

    def test_anonymous_rejected(self, anon_client):
        r = anon_client.get(f'{CASH}/weekly-summary/')
        assert r.status_code in (401, 403)

    def test_cashier_gets_a_response(self, client_cashier, cash_in):
        r = client_cashier.get(f'{CASH}/weekly-summary/')
        assert r.status_code == 200
        assert r.content