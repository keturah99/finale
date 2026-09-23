"""
Permission smoke test.

Runs entirely inside the backend container — no external binaries needed.
Uses urllib (stdlib) instead of curl.

Run with:
    docker compose exec -T backend python manage.py shell \
        -c "exec(open('/app/scripts/permission_test.py').read())"
"""

import json
import urllib.request
import urllib.error

BASE = 'http://localhost:8000'
PASSWORD = 'testpass123'


def get_token(username, password=PASSWORD):
    """Return a JWT access token for `username`."""
    req = urllib.request.Request(
        f'{BASE}/api/core/auth/login/',
        data=json.dumps({'username': username, 'password': password}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode())
    return body['access']


def http_code(token, url, method='GET'):
    """Send a request and return the HTTP status code."""
    req = urllib.request.Request(
        f'{BASE}{url}',
        headers={'Authorization': f'Bearer {token}'},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


# (username, url, expected_status)
TESTS = [
    # Superuser sees everything
    ('admin',     '/api/inventory/products/',   200),
    ('admin',     '/api/payroll/records/',      200),
    ('admin',     '/api/transport/bookings/',   200),
    ('admin',     '/api/reporting/logs/',       200),

    # Inventory clerk: can read inventory, blocked elsewhere
    ('inv_clerk', '/api/inventory/products/',   200),
    ('inv_clerk', '/api/payroll/records/',      403),
    ('inv_clerk', '/api/reporting/logs/',       403),

    # Inventory manager: read+write inventory, blocked from payroll
    ('inv_mgr',   '/api/inventory/products/',   200),
    ('inv_mgr',   '/api/payroll/records/',      403),

    # Payroll officer
    ('payroll',   '/api/payroll/records/',      200),
    ('payroll',   '/api/inventory/products/',   403),

    # Transport clerk
    ('transport', '/api/transport/bookings/',   200),
    ('transport', '/api/payroll/records/',      403),

    # Reporting analyst
    ('ranalyst',  '/api/reporting/logs/',       200),
    ('ranalyst',  '/api/reporting/dashboard/',  200),
    ('ranalyst',  '/api/payroll/records/',      403),

    # No roles -> blocked on role-restricted endpoints
    ('nobody',    '/api/inventory/products/',   403),
    ('nobody',    '/api/payroll/records/',      403),
    # ... but dashboard is open to any authenticated user
    ('nobody',    '/api/reporting/dashboard/',  200),
]


def main():
    print(f"{'user':12} {'endpoint':32} {'expected':>9} {'got':>5} {'':>3}")
    print('-' * 70)

    tokens = {}
    for username, url, expected in TESTS:
        if username not in tokens:
            try:
                tokens[username] = get_token(username)
            except Exception as e:
                print(f"{username:12} could not log in: {e}")
                continue

        got = http_code(tokens[username], url)
        mark = 'OK' if got == expected else 'FAIL'
        print(f"{username:12} {url:32} {expected:>9} {got:>5} {mark:>4}")


main()