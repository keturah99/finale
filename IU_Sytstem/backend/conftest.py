"""
Root-level pytest bootstrap.

Ensures Django is fully initialised before any app models are imported.
pytest-django normally handles this, but a stray import in a test file
or fixture can trigger model loading too early.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unified_system.settings')
django.setup()
