"""State-machine tests for the finance review workflow.

These tests exercise the service layer directly. Guards that belong to the
HTTP layer (role checks, request-level permissions) are covered separately in
test_finance_api.py.
"""
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from finance import services
from finance.models import FinanceReviewLog
from wholesale.models import WeeklySalesCashIn


# ---------------------------------------------------------------------------
# Happy-path transitions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestApproveTransitions:

    def test_pending_to_approved_sets_reviewer_and_timestamp(
        self, cash_in, finance_officer,
    ):
        services.approve_record(cash_in, finance_officer, notes='Looks good')
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'approved'
        assert cash_in.finance_reviewed_by_id == finance_officer.pk
        assert cash_in.finance_reviewed_at is not None
        assert cash_in.finance_notes == 'Looks good'

    def test_approve_writes_log(self, cash_in, finance_officer):
        # NOTE: we filter by record_id only — the exact value stored in
        # FinanceReviewLog.record_type is an implementation detail. If you
        # want to assert it here, first print one log to see its convention.
        services.approve_record(cash_in, finance_officer)
        logs = FinanceReviewLog.objects.filter(record_id=cash_in.pk)
        assert logs.count() == 1
        log = logs.first()
        assert log.actor_id == finance_officer.pk
        assert log.to_status == 'approved'
        assert 'approv' in (log.action or '').lower()


@pytest.mark.django_db
class TestRejectTransitions:

    def test_pending_to_rejected(self, cash_in, finance_officer):
        services.reject_record(cash_in, finance_officer, reason='Amount mismatch')
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'rejected'

    def test_reject_writes_log_with_reason(self, cash_in, finance_officer):
        services.reject_record(cash_in, finance_officer, reason='Amount mismatch')
        log = FinanceReviewLog.objects.get(record_id=cash_in.pk)
        assert log.to_status == 'rejected'
        assert 'Amount mismatch' in (log.reason or '')


@pytest.mark.django_db
class TestQueryTransitions:

    def test_pending_to_queried(self, cash_in, finance_officer):
        services.query_record(cash_in, finance_officer, reason='Clarify reference')
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'queried'

    def test_query_writes_log(self, cash_in, finance_officer):
        services.query_record(cash_in, finance_officer, reason='Clarify reference')
        log = FinanceReviewLog.objects.get(record_id=cash_in.pk)
        assert log.to_status == 'queried'
        assert 'Clarify reference' in (log.reason or '')


@pytest.mark.django_db
class TestResubmitTransitions:

    def test_queried_resubmit_returns_to_pending(
        self, cash_in, finance_officer, cashier_user,
    ):
        services.query_record(cash_in, finance_officer, reason='x')
        services.resubmit_record(cash_in, cashier_user)
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'pending'

    def test_rejected_resubmit_returns_to_pending(
        self, cash_in, finance_officer, cashier_user,
    ):
        services.reject_record(cash_in, finance_officer, reason='x')
        services.resubmit_record(cash_in, cashier_user)
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'pending'

    def test_resubmit_clears_review_metadata(
        self, cash_in, finance_officer, cashier_user,
    ):
        services.query_record(cash_in, finance_officer, reason='x')
        services.resubmit_record(cash_in, cashier_user)
        cash_in.refresh_from_db()
        assert cash_in.finance_reviewed_by_id is None
        assert cash_in.finance_reviewed_at is None

    def test_resubmit_writes_log(
        self, cash_in, finance_officer, cashier_user,
    ):
        services.query_record(cash_in, finance_officer, reason='x')
        FinanceReviewLog.objects.all().delete()
        services.resubmit_record(cash_in, cashier_user)
        assert FinanceReviewLog.objects.filter(record_id=cash_in.pk).count() == 1

    def test_resubmit_pending_is_blocked_or_noop(self, cash_in, cashier_user):
        initial = cash_in.finance_status
        try:
            services.resubmit_record(cash_in, cashier_user)
        except (ValidationError, PermissionError):
            pass
        cash_in.refresh_from_db()
        assert cash_in.finance_status == initial


@pytest.mark.django_db
class TestReopenTransitions:

    def test_approved_reopen_returns_to_pending(self, cash_in, finance_manager):
        services.approve_record(cash_in, finance_manager)
        services.reopen_record(cash_in, finance_manager, reason='New evidence')
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'pending'

    def test_reopen_clears_review_metadata(self, cash_in, finance_manager):
        services.approve_record(cash_in, finance_manager)
        services.reopen_record(cash_in, finance_manager, reason='New evidence')
        cash_in.refresh_from_db()
        assert cash_in.finance_reviewed_by_id is None
        assert cash_in.finance_reviewed_at is None

    def test_reopen_writes_log(self, cash_in, finance_manager):
        services.approve_record(cash_in, finance_manager)
        FinanceReviewLog.objects.all().delete()
        services.reopen_record(cash_in, finance_manager, reason='x')
        log = FinanceReviewLog.objects.get(record_id=cash_in.pk)
        assert log.from_status == 'approved'
        assert log.to_status == 'pending'

    def test_reopen_pending_is_blocked_or_noop(self, cash_in, finance_manager):
        initial = cash_in.finance_status
        try:
            services.reopen_record(cash_in, finance_manager, reason='x')
        except (ValidationError, PermissionError):
            pass
        cash_in.refresh_from_db()
        assert cash_in.finance_status == initial

    def test_reopen_requires_manager_role(self, cash_in, finance_officer):
        """Service-layer guard: an officer may not reopen an approved record."""
        services.approve_record(cash_in, finance_officer)
        with pytest.raises(ValidationError):
            services.reopen_record(cash_in, finance_officer, reason='x')
        cash_in.refresh_from_db()
        assert cash_in.finance_status == 'approved'


# ---------------------------------------------------------------------------
# Cross-record-type coverage
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWorkflowAppliesToAllReviewableTypes:

    def test_expense_can_be_approved(self, expense, finance_officer):
        services.approve_record(expense, finance_officer)
        expense.refresh_from_db()
        assert expense.finance_status == 'approved'

    def test_weekly_damage_can_be_rejected(self, weekly_damage, finance_officer):
        services.reject_record(weekly_damage, finance_officer, reason='x')
        weekly_damage.refresh_from_db()
        assert weekly_damage.finance_status == 'rejected'

    def test_storage_damage_can_be_queried(self, storage_damage, finance_officer):
        services.query_record(storage_damage, finance_officer, reason='x')
        storage_damage.refresh_from_db()
        assert storage_damage.finance_status == 'queried'


# ---------------------------------------------------------------------------
# Log integrity
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAuditLogIntegrity:

    def test_multiple_transitions_produce_multiple_logs(self, cash_in, finance_officer):
        services.query_record(cash_in, finance_officer, reason='x')
        # Simulate an author resubmit by flipping back to pending and clearing
        # the reviewer — equivalent to the state a resubmit leaves behind.
        cash_in.finance_status = 'pending'
        cash_in.finance_reviewed_by = None
        cash_in.finance_reviewed_at = None
        cash_in.save(update_fields=[
            'finance_status', 'finance_reviewed_by', 'finance_reviewed_at',
        ])
        services.approve_record(cash_in, finance_officer)
        assert FinanceReviewLog.objects.filter(record_id=cash_in.pk).count() >= 2

    def test_log_created_at_is_set(self, cash_in, finance_officer):
        services.approve_record(cash_in, finance_officer)
        log = FinanceReviewLog.objects.get(record_id=cash_in.pk)
        assert log.created_at is not None

    def test_log_records_from_and_to_status(self, cash_in, finance_officer):
        services.approve_record(cash_in, finance_officer)
        log = FinanceReviewLog.objects.get(record_id=cash_in.pk)
        assert log.from_status == 'pending'
        assert log.to_status == 'approved'


# ---------------------------------------------------------------------------
# log_submission
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_log_submission_creates_entry(cash_in, cashier_user):
    FinanceReviewLog.objects.all().delete()
    services.log_submission(cash_in, cashier_user)
    assert FinanceReviewLog.objects.filter(record_id=cash_in.pk).count() >= 1


# ---------------------------------------------------------------------------
# Idempotency of status string values
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_status_values_are_canonical(cash_in, finance_officer, cashier_user):
    assert cash_in.finance_status == 'pending'
    services.approve_record(cash_in, finance_officer)
    cash_in.refresh_from_db()
    assert cash_in.finance_status == 'approved'