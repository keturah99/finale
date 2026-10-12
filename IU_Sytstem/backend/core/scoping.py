"""
QuerySet scoping helpers.

A viewset mixes in ScopedViewSetMixin and declares one or more scope
fields. The mixin's `scope_queryset` filters the base queryset according
to the request's user.

Scoping rules:
  - Superusers bypass all scoping.
  - If `user.department_id` is set, the queryset is filtered by the
    declared `department_field`.
  - If `user.wholesale_id` is set, the queryset is filtered by the
    declared `wholesale_field`.
  - Setting a field to None disables that axis for the viewset.
"""

from django.db.models import Q


class ScopedViewSetMixin:
    # Declared per viewset
    department_field: str | None = None
    wholesale_field: str | None = None
    # For models with two potential wholesale references
    # (e.g. InterWholesaleTransfer), use OR filtering instead.
    wholesale_or_fields: tuple[str, str] | None = None

    def scope_queryset(self, qs, request):
        user = request.user
        if not user.is_authenticated or user.is_superuser:
            return qs

        if self.department_field and user.department_id:
            code = user.department.code
            qs = qs.filter(**{self.department_field: code})

        if self.wholesale_field and user.wholesale_id:
            qs = qs.filter(**{self.wholesale_field: user.wholesale_id})

        if self.wholesale_or_fields and user.wholesale_id:
            a, b = self.wholesale_or_fields
            qs = qs.filter(
                Q(**{f'{a}__id': user.wholesale_id})
                | Q(**{f'{b}__id': user.wholesale_id})
            )

        return qs