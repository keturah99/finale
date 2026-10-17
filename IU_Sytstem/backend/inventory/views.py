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
from rest_framework.permissions import IsAuthenticated
from .services import record_stock_movement

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


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        data = serializer.validated_data
        record_stock_movement(
            product=data['product'],
            movement_type=data['movement_type'],
            quantity=data['quantity'],
            reference=data.get('reference', ''),
            notes=data.get('notes', ''),
            user=self.request.user
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