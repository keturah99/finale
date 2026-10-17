"""Shared fixtures for finance app tests."""
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core.models import User, Role, Department
from inventory.models import Product
from wholesale.models import (
    Wholesale,
    WholesaleStockLevel,
    WeeklySales,
    WeeklySalesCashIn,
    WeeklySalesExpense,
    WeeklySalesDamage,
    WholesaleDamage,
)


# ---------- low-level helpers ----------

def _role(name: str) -> Role:
    role, _ = Role.objects.get_or_create(
        name=name, defaults={'description': name},
    )
    return role


def _user(username: str, roles=(), **extra) -> User:
    user = User.objects.create_user(
        username=username, password='pw12345!', **extra,
    )
    for r in roles:
        user.roles.add(_role(r))
    user.refresh_from_db()
    return user


# ---------- org fixtures ----------

@pytest.fixture
def dept_groceries(db):
    return Department.objects.create(code='groceries', name='Groceries')


@pytest.fixture
def wholesale_a(db):
    return Wholesale.objects.create(name='Wholesale A', location='Lusaka')


@pytest.fixture
def wholesale_b(db):
    return Wholesale.objects.create(name='Wholesale B', location='Kitwe')


@pytest.fixture
def product_a(db, dept_groceries):
    return Product.objects.create(
        sku='SKU-001',
        name='Mealie Meal 25kg',
        department='groceries',
        unit_price=Decimal('120.00'),
    )


# ---------- user fixtures ----------

@pytest.fixture
def finance_officer(db):
    return _user('fin_officer', roles=['finance_officer'])


@pytest.fixture
def finance_manager(db):
    return _user('fin_manager', roles=['finance_manager'])


@pytest.fixture
def finance_officer_scoped_a(db, wholesale_a):
    u = _user('fin_officer_a', roles=['finance_officer'])
    u.wholesale = wholesale_a
    u.save()
    return u


@pytest.fixture
def cashier_user(db, wholesale_a):
    u = _user('cashier1', roles=['cashier'])
    u.wholesale = wholesale_a
    u.save()
    return u


@pytest.fixture
def other_cashier(db, wholesale_a):
    u = _user('cashier2', roles=['cashier'])
    u.wholesale = wholesale_a
    u.save()
    return u


@pytest.fixture
def wholesaler_user(db, wholesale_a):
    u = _user('ws_clerk', roles=['wholesale_clerk'])
    u.wholesale = wholesale_a
    u.save()
    return u


@pytest.fixture
def other_user(db):
    return _user('other', roles=[])


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        username='root', password='pw12345!', email='root@example.com',
    )


# ---------- sales-cycle fixtures ----------

@pytest.fixture
def weekly_sales_a(db, wholesale_a, wholesaler_user):
    return WeeklySales.objects.create(
        wholesale=wholesale_a,
        year=2026, week_number=15, label='Wk 15 — 2026',
        start_date=date(2026, 4, 6), end_date=date(2026, 4, 12),
        status='open', seller=wholesaler_user,
    )


@pytest.fixture
def weekly_sales_b(db, wholesale_b, wholesaler_user):
    return WeeklySales.objects.create(
        wholesale=wholesale_b,
        year=2026, week_number=15, label='Wk 15 — 2026',
        start_date=date(2026, 4, 6), end_date=date(2026, 4, 12),
        status='open', seller=wholesaler_user,
    )


# ---------- stock seeding (needed for WholesaleDamage sync) ----------

@pytest.fixture
def stock_at_wholesale_a(db, wholesale_a, product_a):
    """Seed a WholesaleStockLevel so WholesaleDamage.save() doesn't raise
    'Insufficient stock'. The damage sync decrements the level by quantity."""
    return WholesaleStockLevel.objects.create(
        wholesale=wholesale_a,
        product=product_a,
        quantity=1000,
        average_cost=Decimal('100.00'),
    )


# ---------- reviewable record fixtures ----------

@pytest.fixture
def cash_in(weekly_sales_a, cashier_user):
    return WeeklySalesCashIn.objects.create(
        weekly_sales=weekly_sales_a,
        amount=Decimal('500.00'),
        received_by=cashier_user,
        reference='REF-001',
    )


@pytest.fixture
def cash_in_b(weekly_sales_b, wholesaler_user):
    return WeeklySalesCashIn.objects.create(
        weekly_sales=weekly_sales_b,
        amount=Decimal('300.00'),
        received_by=wholesaler_user,
        reference='REF-B-001',
    )


@pytest.fixture
def expense(weekly_sales_a, wholesaler_user):
    return WeeklySalesExpense.objects.create(
        weekly_sales=weekly_sales_a,
        amount=Decimal('100.00'),
        description='Transport',
        recorded_by=wholesaler_user,
    )


@pytest.fixture
def weekly_damage(weekly_sales_a, product_a, wholesaler_user):
    return WeeklySalesDamage.objects.create(
        weekly_sales=weekly_sales_a,
        product=product_a,
        quantity=2,
        selling_price=Decimal('120.00'),
        total_loss_value=Decimal('240.00'),
        recorded_by=wholesaler_user,
    )


@pytest.fixture
def storage_damage(stock_at_wholesale_a, wholesale_a, product_a, wholesaler_user):
    """Note: depends on stock_at_wholesale_a because WholesaleDamage.save()
    triggers a stock decrement via wholesale.services.sync_damage()."""
    return WholesaleDamage.objects.create(
        wholesale=wholesale_a,
        product=product_a,
        quantity=2,
        selling_price=Decimal('120.00'),
        total_loss_value=Decimal('240.00'),
        reported_by=wholesaler_user,
    )


# ---------- API client fixtures ----------

@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def client_finance_officer(finance_officer):
    c = APIClient()
    c.force_authenticate(user=finance_officer)
    return c


@pytest.fixture
def client_finance_manager(finance_manager):
    c = APIClient()
    c.force_authenticate(user=finance_manager)
    return c


@pytest.fixture
def client_finance_officer_scoped(finance_officer_scoped_a):
    c = APIClient()
    c.force_authenticate(user=finance_officer_scoped_a)
    return c


@pytest.fixture
def client_other(other_user):
    c = APIClient()
    c.force_authenticate(user=other_user)
    return c


@pytest.fixture
def client_superuser(superuser):
    c = APIClient()
    c.force_authenticate(user=superuser)
    return c


@pytest.fixture
def client_cashier(cashier_user):
    c = APIClient()
    c.force_authenticate(user=cashier_user)
    return c