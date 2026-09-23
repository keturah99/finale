from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import F

from core.permissions import RolePermission
from core.roles import INVENTORY_MANAGER, INVENTORY_CLERK

from .models import Product, StockLevel, StockMovement, StockAlert
from .serializers import (
    ProductSerializer, StockMovementSerializer,
    StockAlertSerializer, StockLevelSerializer,
)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [RolePermission]
    read_roles = [INVENTORY_MANAGER, INVENTORY_CLERK]
    write_roles = [INVENTORY_MANAGER]

    def get_queryset(self):
        qs = super().get_queryset()
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department=dept)
        return qs

    def perform_create(self, serializer):
        product = serializer.save()
        StockLevel.objects.create(product=product, quantity_on_hand=0)


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.all()
    serializer_class = StockMovementSerializer
    permission_classes = [RolePermission]
    read_roles = [INVENTORY_MANAGER, INVENTORY_CLERK]
    write_roles = [INVENTORY_MANAGER]

    def perform_create(self, serializer):
        with transaction.atomic():
            movement = serializer.save(performed_by=self.request.user)
            level, _ = StockLevel.objects.get_or_create(
                product=movement.product
            )
            if movement.movement_type == 'in':
                level.quantity_on_hand = F('quantity_on_hand') + movement.quantity
            elif movement.movement_type == 'out':
                level.quantity_on_hand = F('quantity_on_hand') - movement.quantity
            else:
                level.quantity_on_hand = movement.quantity
            level.save()
            level.refresh_from_db()

            # Low-stock alert
            if level.quantity_on_hand <= movement.product.reorder_level:
                alert_type = 'out' if level.quantity_on_hand <= 0 else 'low'
                StockAlert.objects.create(
                    product=movement.product,
                    alert_type=alert_type,
                    message=f"{movement.product.name} is at "
                            f"{level.quantity_on_hand} (reorder at "
                            f"{movement.product.reorder_level})",
                )


class StockAlertViewSet(viewsets.ModelViewSet):
    queryset = StockAlert.objects.filter(is_resolved=False)
    serializer_class = StockAlertSerializer
    permission_classes = [RolePermission]
    read_roles = [INVENTORY_MANAGER, INVENTORY_CLERK]
    write_roles = [INVENTORY_MANAGER]

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.is_resolved = True
        alert.save()
        return Response({'status': 'resolved'})