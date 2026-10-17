"""
Finance module models.

Provides:
  - FinanceReviewableModel  — abstract base for records that pass
    through a review-and-approval workflow
  - FinanceReviewLog        — immutable audit trail of every review action
"""

from django.conf import settings
from django.db import models


# ---------------------------------------------------------------------------
# Abstract base — inherited by any record that flows through finance review
# ---------------------------------------------------------------------------

class FinanceReviewableModel(models.Model):
    """
    Abstract base for records that pass through finance review.

    Wholesale clerks and cashiers create these. Finance officers
    approve, reject, or query them. Approved records flow into
    financial reports; unapproved ones stay flagged.
    """
    FINANCE_STATUS = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('queried', 'Query Raised'),
    ]

    finance_status = models.CharField(
        max_length=10,
        choices=FINANCE_STATUS,
        default='pending',
        db_index=True,
    )
    finance_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='%(class)s_reviews',
    )
    finance_reviewed_at = models.DateTimeField(null=True, blank=True)
    finance_notes = models.TextField(
        blank=True,
        help_text='Reason for rejection or query; approval notes.',
    )

    # Automated discrepancy flags computed on save.
    # Each entry: { "code": "...", "severity": "warning|critical", "message": "..." }
    flags = models.JSONField(default=list, blank=True)

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# Audit log — every review action recorded immutably
# ---------------------------------------------------------------------------

class FinanceReviewLog(models.Model):
    """
    Immutable audit trail of every finance review action.

    Indexed on (record_type, record_id) so the history for a single
    record loads quickly.
    """
    ACTION_CHOICES = [
        ('submit', 'Submitted'),
        ('approve', 'Approved'),
        ('reject', 'Rejected'),
        ('query', 'Query Raised'),
        ('resubmit', 'Resubmitted'),
        ('reopen', 'Reopened'),
    ]

    record_type = models.CharField(max_length=40)
    record_id = models.PositiveIntegerField()
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='finance_actions',
    )
    reason = models.TextField(blank=True)
    from_status = models.CharField(max_length=10, blank=True)
    to_status = models.CharField(max_length=10, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['record_type', 'record_id']),
        ]
        verbose_name = 'Finance review log'
        verbose_name_plural = 'Finance review log'

    def __str__(self):
        return (
            f"{self.get_action_display()} "
            f"{self.record_type}#{self.record_id} "
            f"by {self.actor}"
        )