from django.db import transaction
from django.db.models import F
from .models import StockLevel, StockMovement, StockAlert

@transaction.atomic
def record_stock_movement(product, movement_type, quantity, reference="", notes="", user=None):
    """
    Records a stock movement and updates the StockLevel.
    Returns the created StockMovement instance.
    """
    movement = StockMovement.objects.create(
        product=product,
        movement_type=movement_type,
        quantity=quantity,
        reference=reference,
        notes=notes,
        performed_by=user
    )
    
    level, _ = StockLevel.objects.get_or_create(product=product)
    
    if movement_type == 'in':
        level.quantity_on_hand = F('quantity_on_hand') + quantity
    elif movement_type == 'out':
        level.quantity_on_hand = F('quantity_on_hand') - quantity
    else:
        level.quantity_on_hand = quantity
        
    level.save()
    level.refresh_from_db()

    # Low stock alert
    if level.quantity_on_hand <= product.reorder_level:
        alert_type = 'out' if level.quantity_on_hand <= 0 else 'low'
        StockAlert.objects.create(
            product=product,
            alert_type=alert_type,
            message=f"{product.name} is at {level.quantity_on_hand} (reorder at {product.reorder_level})",
        )
        
    return movement