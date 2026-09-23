from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import RolePermission
from core.roles import SUPPLY_CHAIN_OFFICER

from .models import (
    Farmer, Crop, ProducePurchase, ProductionBatch, PendingCollection
)
from .serializers import (
    FarmerSerializer, CropSerializer, ProducePurchaseSerializer,
    ProductionBatchSerializer, PendingCollectionSerializer,
)


class FarmerViewSet(viewsets.ModelViewSet):
    queryset = Farmer.objects.all()
    serializer_class = FarmerSerializer
    permission_classes = [RolePermission]
    read_roles = [SUPPLY_CHAIN_OFFICER]
    write_roles = [SUPPLY_CHAIN_OFFICER]

    @action(detail=True, methods=['get'])
    def purchases(self, request, pk=None):
        farmer = self.get_object()
        qs = farmer.purchases.all()
        return Response(ProducePurchaseSerializer(qs, many=True).data)


class CropViewSet(viewsets.ModelViewSet):
    queryset = Crop.objects.all()
    serializer_class = CropSerializer
    permission_classes = [RolePermission]
    read_roles = [SUPPLY_CHAIN_OFFICER]
    write_roles = [SUPPLY_CHAIN_OFFICER]


class ProducePurchaseViewSet(viewsets.ModelViewSet):
    queryset = ProducePurchase.objects.select_related('farmer', 'crop').all()
    serializer_class = ProducePurchaseSerializer
    permission_classes = [RolePermission]
    read_roles = [SUPPLY_CHAIN_OFFICER]
    write_roles = [SUPPLY_CHAIN_OFFICER]

    def get_queryset(self):
        qs = super().get_queryset()
        crop = self.request.query_params.get('crop')
        status = self.request.query_params.get('status')
        if crop:
            qs = qs.filter(crop__name=crop)
        if status:
            qs = qs.filter(payment_status=status)
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class ProductionBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductionBatch.objects.all()
    serializer_class = ProductionBatchSerializer
    permission_classes = [RolePermission]
    read_roles = [SUPPLY_CHAIN_OFFICER]
    write_roles = [SUPPLY_CHAIN_OFFICER]

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        batch = self.get_object()
        qty = request.data.get('finished_product_qty_kg')
        name = request.data.get('finished_product_name')
        date = request.data.get('completion_date')
        if qty is not None:
            batch.finished_product_qty_kg = qty
        if name:
            batch.finished_product_name = name
        if date:
            batch.completion_date = date
        batch.status = 'completed'
        batch.save()
        return Response(ProductionBatchSerializer(batch).data)


class PendingCollectionViewSet(viewsets.ModelViewSet):
    queryset = PendingCollection.objects.all()
    serializer_class = PendingCollectionSerializer
    permission_classes = [RolePermission]
    read_roles = [SUPPLY_CHAIN_OFFICER]
    write_roles = [SUPPLY_CHAIN_OFFICER]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_collected(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'collected'
        obj.save()
        return Response({'status': 'collected'})