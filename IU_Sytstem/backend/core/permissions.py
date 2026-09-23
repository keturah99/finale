from rest_framework.permissions import BasePermission, SAFE_METHODS


class RolePermission(BasePermission):
    """
    Grants access based on the user's assigned roles.

    Views declare:
        read_roles  = [ROLE_A, ROLE_B]   # for GET/HEAD/OPTIONS
        write_roles = [ROLE_MANAGER]     # for POST/PUT/PATCH/DELETE

    If a list is not set, falls back to `required_roles` on the view.
    If none are set, any authenticated user is allowed.
    Superusers always bypass the check.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        if request.method in SAFE_METHODS:
            roles = getattr(view, 'read_roles', None)
        else:
            roles = getattr(view, 'write_roles', None)

        if roles is None:
            roles = getattr(view, 'required_roles', None)

        if not roles:
            return True

        return user.roles.filter(name__in=roles).exists()


class IsSuperUser(BasePermission):
    """Only superusers allowed — for the most sensitive endpoints."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.is_superuser)