"""Cashier app fixtures."""
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core.models import User, Role
from inventory.models import Product
from wholesale.models import (
    Wholesale,
    WeeklySales,
    WeeklySalesCashIn,
    WeeklySalesExpense,
    WeeklySalesDamage,
)


def _role(name):
    r, _ = Role.objects.get_or_create(name=name, defaults={'description': name})
    return r


def _user(username, roles=(), **extra):
    u = User.objects.create_user(username=username, password='pw12345!', **extra)
    for r in roles:
        u.roles.add(_role(r))
    u.refresh_from_db()
    return u


@pytest.fixture
def wholesale(db):
    return Wholesale.objects.create(name='WS-A', location='Lusaka')


@pytest.fixture
def product(db):
    return Product.objects.create(
        sku='S-1', name='Sugar 2kg', department='groceries',
        unit_price=Decimal('35.00'),
    )


@pytest.fixture
def cashier(db, wholesale):
    u = _user('cashier', roles=['cashier'])
    u.wholesale = wholesale
    u.save()
    return u


@pytest.fixture
def other_cashier(db, wholesale):
    u = _user('cashier_other', roles=['cashier'])
    u.wholesale = wholesale
    u.save()
    return u


@pytest.fixture
def finance_officer(db):
    return _user('fin', roles=['finance_officer'])


@pytest.fixture
def weekly_sales(db, wholesale, cashier):
    return WeeklySales.objects.create(
        wholesale=wholesale,
        year=2026, week_number=15, label='Wk 15 — 2026',
        start_date=date(2026, 4, 6), end_date=date(2026, 4, 12),
        status='open', seller=cashier,
    )


@pytest.fixture
def cash_in(weekly_sales, cashier):
    return WeeklySalesCashIn.objects.create(
        weekly_sales=weekly_sales, amount=Decimal('500'),
        received_by=cashier, reference='R1',
    )


@pytest.fixture
def expense(weekly_sales, cashier):
    return WeeklySalesExpense.objects.create(
        weekly_sales=weekly_sales, amount=Decimal('80'),
        description='Fuel', recorded_by=cashier,
    )


@pytest.fixture
def damage(weekly_sales, product, cashier):
    return WeeklySalesDamage.objects.create(
        weekly_sales=weekly_sales, product=product,
        quantity=1, selling_price=Decimal('35.00'),
        total_loss_value=Decimal('35.00'), recorded_by=cashier,
    )


@pytest.fixture
def client_cashier(cashier):
    c = APIClient()
    c.force_authenticate(user=cashier)
    return c


@pytest.fixture
def client_other_cashier(other_cashier):
    c = APIClient()
    c.force_authenticate(user=other_cashier)
    return c


@pytest.fixture
def anon_client():
    return APIClient()