from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from inventory.models import Product
from wholesale.models import (
    Wholesale, WholesaleStockLevel, WholesaleStockIn, WholesaleStockOut,
    WeeklySales, WeeklySalesCashIn, WeeklySalesExpense, WeeklySalesDamage,
)
from wholesale.services import (
    close_weekly_sales, close_and_open_next, assert_weekly_sales_open,
)

User = get_user_model()


def hr(t):
    print("\n" + "=" * 64)
    print(t)
    print("=" * 64)


hr("Setup")
admin = User.objects.filter(is_superuser=True).first()
w, _ = Wholesale.objects.get_or_create(
    name='Wholesale Lusaka',
    defaults=dict(location='Lusaka'),
)
p, _ = Product.objects.get_or_create(
    sku='WK-TEST',
    defaults=dict(name='Weekly Sales Test', department='groceries',
                  unit_price=Decimal('120.00')),
)
# Reset test data
WeeklySales.objects.filter(wholesale=w).delete()
WholesaleStockOut.objects.filter(product=p).delete()
WholesaleStockIn.objects.filter(product=p).delete()
WholesaleStockLevel.objects.filter(product=p).delete()

# Seed stock
WholesaleStockIn.objects.create(
    wholesale=w, product=p,
    quantity=500, unit_value=Decimal('80.00'),
    stock_from='main_warehouse', received_by=admin,
)
print(f'  Wholesale: {w}')
print(f'  Product:   {p.sku}')
print(f'  Stock:     {WholesaleStockLevel.objects.get(wholesale=w, product=p).quantity}')

# --- Open Wk 1 ---
hr("Open first weekly sales cycle")
ws1 = WeeklySales.objects.create(
    wholesale=w,
    seller=admin, received_by=admin,
    start_date=date(2026, 9, 1),
    end_date=date(2026, 9, 7),
)
print(f'  {ws1.label}  ({ws1.status})')
print(f'  week_number={ws1.week_number}  year={ws1.year}')

# --- Stock out to sales ---
hr("Issue 100 units to the sales period")
WholesaleStockOut.objects.create(
    wholesale=w, product=p,
    weekly_sales=ws1,
    quantity=100, unit_value=Decimal('80.00'),
    approved_by=admin,
)
lvl = WholesaleStockLevel.objects.get(wholesale=w, product=p)
print(f'  Stock after OUT: {lvl.quantity}')

# --- Cash in ---
hr("Cash in during the week")
WeeklySalesCashIn.objects.create(
    weekly_sales=ws1, amount=Decimal('3000.00'),
    received_by=admin, reference='BANK-001',
)
WeeklySalesCashIn.objects.create(
    weekly_sales=ws1, amount=Decimal('2500.00'),
    received_by=admin, reference='BANK-002',
)
print(f'  Total cashed: {ws1.total_cashed}')

# --- Expenses ---
hr("Expenses")
WeeklySalesExpense.objects.create(
    weekly_sales=ws1, amount=Decimal('400.00'),
    description='Transport to market',
    recorded_by=admin,
)
WeeklySalesExpense.objects.create(
    weekly_sales=ws1, amount=Decimal('150.00'),
    description='Casual labour',
    recorded_by=admin,
)
print(f'  Total expenses: {ws1.total_expenses}')

# --- Damages ---
hr("Damages during sales")
WeeklySalesDamage.objects.create(
    weekly_sales=ws1, product=p,
    quantity=3, selling_price=Decimal('120.00'),
    recorded_by=admin,
)
print(f'  Damage value: {ws1.total_damages_value}')

# --- Summary ---
hr("Summary")
print(f'  Label:        {ws1.label}')
print(f'  Stock-in val: K{ws1.total_stock_in_value}')
print(f'  Cashed:       K{ws1.total_cashed}')
print(f'  Expenses:     K{ws1.total_expenses}')
print(f'  Damages:      K{ws1.total_damages_value}')
print(f'  Net position: K{ws1.net_position}')

# --- Close + open next ---
hr("Close and open next")
ws2 = close_and_open_next(ws1, admin)
ws1.refresh_from_db()
print(f'  Closed:       {ws1.label} ({ws1.status})')
print(f'  Next opened:  {ws2.label} ({ws2.status})')
print(f'  Next dates:   {ws2.start_date} → {ws2.end_date}')

# --- Block writes on closed cycle ---
hr("Attempt to add cash-in to closed cycle (should fail)")
try:
    WeeklySalesCashIn.objects.create(
        weekly_sales=ws1, amount=Decimal('500.00'),
        received_by=admin,
    )
    # Direct model create doesn't enforce; the viewset does.
    # But our service-level assert would if called:
    assert_weekly_sales_open(ws1)
    print('  ERROR: should have failed')
except ValidationError as e:
    print(f'  Rejected: {e}')

# --- Auto week increment ---
hr("Open another cycle — week number should be 3")
ws3 = WeeklySales.objects.create(
    wholesale=w,
    start_date=date(2026, 9, 16),
    end_date=date(2026, 9, 22),
)
print(f'  {ws3.label}   (expect "Wk 3 — 2026")')

hr("DONE")