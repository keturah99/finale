import re

from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Department, Role

User = get_user_model()

NRC_RE = re.compile(r'^\d{6}/\d{2}/\d$')


# ---------------------------------------------------------------------------
# Department
# ---------------------------------------------------------------------------

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'code', 'name', 'description']


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------

class RoleSerializer(serializers.ModelSerializer):
    department_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'department_codes']

    def get_department_codes(self, obj):
        return list(obj.departments.values_list('code', flat=True))

# ---------------------------------------------------------------------------
# Wholesale (minimal, to avoid circular import)
# ---------------------------------------------------------------------------

class WholesaleMiniSerializer(serializers.Serializer):
    """Read-only minimal shape for embedding in UserSerializer."""
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source='department',
        write_only=True,
        required=False,
        allow_null=True,
    )

    wholesale = WholesaleMiniSerializer(read_only=True)
    wholesale_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )

    roles = RoleSerializer(many=True, read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source='roles',
        write_only=True,
        many=True,
        required=False,
    )

    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'department',
            'department_id',
            'wholesale',
            'wholesale_id',
            'roles',
            'role_ids',
            'phone',
            'nrc',
            'password',
            'is_active',
            'is_staff',
            'is_superuser',
            'last_login',
            'date_joined',
        ]
        read_only_fields = ['last_login', 'date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def _resolve_wholesale(self, wholesale_id):
        """Look up a Wholesale by ID; returns None for null/empty."""
        if wholesale_id is None or wholesale_id == '':
            return None
        from wholesale.models import Wholesale
        try:
            return Wholesale.objects.get(pk=wholesale_id)
        except Wholesale.DoesNotExist:
            raise serializers.ValidationError({
                'wholesale_id': 'Wholesale outlet not found.'
            })

    # ---------------- Validation ----------------

    def validate_nrc(self, value):
        # Empty values become None (multiple users with no NRC is allowed)
        if value is None or value == '':
            return None

        # Format check
        if not NRC_RE.match(value):
            raise serializers.ValidationError(
                'NRC must be in the format 123456/78/9.'
            )

        # Uniqueness check — exclude the current instance on update
        qs = User.objects.filter(nrc=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A user with this NRC already exists.'
            )
        return value

    # ---------------- Write ----------------

    def create(self, validated_data):
        roles = validated_data.pop('roles', [])
        password = validated_data.pop('password', None)
        wholesale_id = validated_data.pop('wholesale_id', None)

        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        if wholesale_id:
            user.wholesale = self._resolve_wholesale(wholesale_id)

        user.save()

        if roles:
            user.roles.set(roles)
        return user

    def update(self, instance, validated_data):
        roles = validated_data.pop('roles', None)
        password = validated_data.pop('password', None)
        wholesale_id = validated_data.pop('wholesale_id', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if wholesale_id is not None:
            instance.wholesale = self._resolve_wholesale(wholesale_id)

        if password:
            instance.set_password(password)

        instance.save()

        if roles is not None:
            instance.roles.set(roles)

        return instance