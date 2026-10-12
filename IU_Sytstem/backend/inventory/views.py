from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F

from core.permissions import RolePermission
from core.roles import INVENTORY_MANAGER, INVENTORY_CLERK, AUDITOR
from core.scoping import ScopedViewSetMixin

from .models import Product, StockLevel, StockMovement, StockAlert
from .serializers import (
    ProductSerializer, StockMovementSerializer,
    StockAlertSerializer, StockLevelSerializer,
)

READ_ROLES = [INVENTORY_MANAGER, INVENTORY_CLERK, AUDITOR]
WRITE_ROLES_MGR = [INVENTORY_MANAGER]
WRITE_ROLES_CLERK = [INVENTORY_MANAGER, INVENTORY_CLERK]


class ProductViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES_MGR
    department_field = 'department'

    def get_queryset(self):
        qs = super().get_queryset()
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department=dept)
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        product = serializer.save()
        StockLevel.objects.create(product=product, quantity_on_hand=0)


class StockMovementViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = StockMovement.objects.all()
    serializer_class = StockMovementSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES_CLERK
    department_field = 'product__department'

    def get_queryset(self):
        qs = super().get_queryset()
        return self.scope_queryset(qs, self.request)

    def perform_create(self, serializer):
        with transaction.atomic():
            movement = serializer.save(performed_by=self.request.user)
            level, _ = StockLevel.objects.get_or_create(product=movement.product)
            if movement.movement_type == 'in':
                level.quantity_on_hand = F('quantity_on_hand') + movement.quantity
            elif movement.movement_type == 'out':
                level.quantity_on_hand = F('quantity_on_hand') - movement.quantity
            else:
                level.quantity_on_hand = movement.quantity
            level.save()
            level.refresh_from_db()

            if level.quantity_on_hand <= movement.product.reorder_level:
                alert_type = 'out' if level.quantity_on_hand <= 0 else 'low'
                StockAlert.objects.create(
                    product=movement.product,
                    alert_type=alert_type,
                    message=f"{movement.product.name} is at {level.quantity_on_hand}"
                            f" (reorder at {movement.product.reorder_level})",
                )


class StockAlertViewSet(ScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = StockAlert.objects.filter(is_resolved=False)
    serializer_class = StockAlertSerializer
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES_MGR
    department_field = 'product__department'

    def get_queryset(self):
        qs = super().get_queryset()
        return self.scope_queryset(qs, self.request)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.is_resolved = True
        alert.save()
        return Response({'status': 'resolved'})