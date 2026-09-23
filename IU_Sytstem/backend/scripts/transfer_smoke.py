from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from inventory.models import Product
from wholesale.models import (
    Wholesale, WholesaleStockLevel,
    WholesaleStockIn, InterWholesaleTransfer,
)
from wholesale.services import (
    approve_transfer, receive_transfer, cancel_transfer,
)

User = get_user_model()


def hr(t):
    print("\n" + "=" * 60)
    print(t)
    print("=" * 60)


def stock(w, p):
    lvl, _ = WholesaleStockLevel.objects.get_or_create(
        wholesale=w, product=p,
        defaults={'quantity': 0, 'average_cost': Decimal('0.00')},
    )
    lvl.refresh_from_db()
    return lvl


hr("Setup")
admin = User.objects.filter(is_superuser=True).first()

w_a, _ = Wholesale.objects.get_or_create(
    name='Wholesale Lusaka',
    defaults=dict(location='Lusaka'),
)
w_b, _ = Wholesale.objects.get_or_create(
    name='Wholesale Kitwe',
    defaults=dict(location='Kitwe'),
)
print(f'  Outlet A: {w_a}')
print(f'  Outlet B: {w_b}')

p, _ = Product.objects.get_or_create(
    sku='TRF-TEST',
    defaults=dict(name='Transfer Test Product', department='groceries',
                  unit_price=Decimal('100.00')),
)
print(f'  Product: {p.sku}')

# Clean slate
InterWholesaleTransfer.objects.filter(product=p).delete()
WholesaleStockIn.objects.filter(product=p).delete()
WholesaleStockLevel.objects.filter(product=p).delete()

# --- Seed A with 200 units ---
hr("Seed Wholesale A with 200 units @ K80")
WholesaleStockIn.objects.create(
    wholesale=w_a, product=p,
    quantity=200, unit_value=Decimal('80.00'),
    stock_from='main_warehouse', received_by=admin,
)
la = stock(w_a, p)
lb = stock(w_b, p)
print(f'  A: {la.quantity}  B: {lb.quantity}')

# --- Create transfer ---
hr("Create transfer: 50 units A → B")
t = InterWholesaleTransfer.objects.create(
    from_wholesale=w_a, to_wholesale=w_b,
    product=p, quantity=50, unit_value=Decimal('80.00'),
    initiated_by=admin, reference='TRF-001',
)
la.refresh_from_db(); lb.refresh_from_db()
print(f'  Status: {t.status}')
print(f'  A: {la.quantity}  B: {lb.quantity}   (expect 200 / 0)')

# --- Approve ---
hr("Approve — source should decrement")
approve_transfer(t, admin)
la.refresh_from_db(); lb.refresh_from_db()
print(f'  Status: {t.status}')
print(f'  A: {la.quantity}  B: {lb.quantity}   (expect 150 / 0)')

# --- Receive ---
hr("Receive — destination should increment")
receive_transfer(t, admin)
la.refresh_from_db(); lb.refresh_from_db()
print(f'  Status: {t.status}')
print(f'  A: {la.quantity}  B: {lb.quantity}   (expect 150 / 50)')
print(f'  B avg cost: {lb.average_cost}   (expect 80.00)')

# --- Second transfer, cancelled mid-flight ---
hr("Create + approve + cancel a second transfer")
t2 = InterWholesaleTransfer.objects.create(
    from_wholesale=w_a, to_wholesale=w_b,
    product=p, quantity=30, unit_value=Decimal('80.00'),
    initiated_by=admin,
)
approve_transfer(t2, admin)
la.refresh_from_db()
print(f'  After approve — A: {la.quantity}   (expect 120)')

cancel_transfer(t2, admin)
la.refresh_from_db()
print(f'  After cancel  — A: {la.quantity}   (expect 150)')
print(f'  Status: {t2.status}')

# --- Try to over-transfer ---
hr("Attempt transfer of 1000 (insufficient)")
t3 = InterWholesaleTransfer.objects.create(
    from_wholesale=w_a, to_wholesale=w_b,
    product=p, quantity=1000, unit_value=Decimal('80.00'),
    initiated_by=admin,
)
try:
    approve_transfer(t3, admin)
    print('  ERROR: should have failed')
except ValidationError as e:
    print(f'  Rejected: {e}')

# --- Try same-wholesale transfer ---
hr("Attempt same-wholesale transfer (should fail at clean())")
t4 = InterWholesaleTransfer(
    from_wholesale=w_a, to_wholesale=w_a,
    product=p, quantity=10, unit_value=Decimal('80.00'),
    initiated_by=admin,
)
try:
    t4.full_clean()
    t4.save()
    print('  ERROR: should have failed')
except ValidationError as e:
    print(f'  Rejected: {e}')

hr("DONE")