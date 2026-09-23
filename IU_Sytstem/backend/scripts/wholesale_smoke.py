from decimal import Decimal
from django.contrib.auth import get_user_model

from inventory.models import Product
from wholesale.models import (
    Wholesale, WholesaleStockLevel,
    WholesaleStockIn, WholesaleStockOut, WholesaleDamage,
)

User = get_user_model()


def hr(t):
    print("\n" + "=" * 60)
    print(t)
    print("=" * 60)


hr("Setup")
w, _ = Wholesale.objects.get_or_create(
    name='Wholesale Lusaka',
    defaults=dict(location='Lusaka Industrial', phone='0977111222'),
)
print(f'  Outlet: {w}')

p, _ = Product.objects.get_or_create(
    sku='WHS-TEST',
    defaults=dict(
        name='Test Product 25kg',
        department='groceries',
        unit_price=Decimal('150.00'),
    ),
)
print(f'  Product: {p.sku} — {p.name}')

admin = User.objects.filter(is_superuser=True).first()
print(f'  Admin: {admin}')

# Clear previous test data
WholesaleStockIn.objects.filter(wholesale=w, product=p).delete()
WholesaleStockOut.objects.filter(wholesale=w, product=p).delete()
WholesaleDamage.objects.filter(wholesale=w, product=p).delete()
WholesaleStockLevel.objects.filter(wholesale=w, product=p).delete()

# --- Stock IN ---
hr("Stock IN #1: 100 units @ K100")
si1 = WholesaleStockIn.objects.create(
    wholesale=w, product=p,
    quantity=100, unit_value=Decimal('100.00'),
    stock_from='main_warehouse', received_by=admin,
)
lvl = WholesaleStockLevel.objects.get(wholesale=w, product=p)
print(f'  Stock level: {lvl.quantity}  avg cost: {lvl.average_cost}')

# --- Stock IN #2 at a different cost (tests weighted avg) ---
hr("Stock IN #2: 50 units @ K130")
si2 = WholesaleStockIn.objects.create(
    wholesale=w, product=p,
    quantity=50, unit_value=Decimal('130.00'),
    stock_from='supplier', received_by=admin,
)
lvl.refresh_from_db()
print(f'  Stock level: {lvl.quantity}  avg cost: {lvl.average_cost}')
print(f'  Expected avg: (100*100 + 50*130) / 150 = 110.00')

# --- Stock OUT ---
hr("Stock OUT: 30 units @ K110")
WholesaleStockOut.objects.create(
    wholesale=w, product=p,
    quantity=30, unit_value=Decimal('110.00'), approved_by=admin,
)
lvl.refresh_from_db()
print(f'  Stock level: {lvl.quantity}')

# --- Damage ---
hr("Damage: 5 units @ selling K150")
dmg = WholesaleDamage.objects.create(
    wholesale=w, product=p,
    quantity=5, selling_price=Decimal('150.00'), reported_by=admin,
)
lvl.refresh_from_db()
print(f'  Stock level: {lvl.quantity}')
print(f'  Loss value: {dmg.total_loss_value}')

# --- Edit the damage down to 3 (delta test) ---
hr("Edit damage to 3 units")
dmg.quantity = 3
dmg.save()
lvl.refresh_from_db()
print(f'  Stock level: {lvl.quantity}  (should be +2 from previous)')

# --- Delete the stock-in (reversal test) ---
hr("Delete Stock IN #2 (reverse 50)")
si2.delete()
lvl.refresh_from_db()
print(f'  Stock level: {lvl.quantity}')

# --- Try to over-issue (should raise) ---
hr("Attempt OUT of 1000 (should fail)")
from django.core.exceptions import ValidationError
try:
    WholesaleStockOut.objects.create(
        wholesale=w, product=p,
        quantity=1000, unit_value=Decimal('100.00'), approved_by=admin,
    )
    print('  ERROR: should have failed!')
except ValidationError as e:
    print(f'  Rejected: {e}')

hr("DONE")