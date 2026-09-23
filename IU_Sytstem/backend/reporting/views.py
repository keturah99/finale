from datetime import datetime

from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.permissions import RolePermission
from core.roles import (
    REPORTING_ANALYST,
    PAYROLL_OFFICER,
    INVENTORY_MANAGER,
    TRANSPORT_MANAGER,
    SUPPLY_CHAIN_OFFICER,
)

from .models import ReportLog
from .serializers import ReportLogSerializer
from .services import build_report, render_report, REPORT_BUILDERS


# Roles allowed to generate reports
REPORT_GENERATION_ROLES = [
    REPORTING_ANALYST,
    PAYROLL_OFFICER,
    INVENTORY_MANAGER,
    TRANSPORT_MANAGER,
    SUPPLY_CHAIN_OFFICER,
]


def _user_can_generate_reports(user) -> bool:
    """Return True if `user` is a superuser or holds one of the allowed roles."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.roles.filter(name__in=REPORT_GENERATION_ROLES).exists()


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """
    Return the executive dashboard KPI aggregate.

    Open to any authenticated user. The payload is a read-only summary
    with no personally identifiable information.
    """
    _, data = build_report('executive_dashboard', {})
    return Response(data)


# ---------------------------------------------------------------------------
# Report catalogue
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_list(request):
    """
    List the report types that can be generated.

    Available to any authenticated user, so the frontend can build
    a menu without hardcoding names.
    """
    available = sorted(list(REPORT_BUILDERS.keys()) + ['executive_dashboard'])
    return Response(available)


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def generate_report(request, report_type):
    """
    Generate a report in the requested format.

    Query params (or POST body):
        format      -> 'json' | 'csv' | 'xlsx' | 'pdf'  (default: json)
        start, end, department, crop, status, run_id    (report-specific filters)

    Returns the file inline with a Content-Disposition header. Every
    successful generation is recorded in ReportLog.
    """
    # --- Role check ---
    if not _user_can_generate_reports(request.user):
        return Response(
            {'error': 'You do not have permission to generate reports'},
            status=403,
        )

    # --- Collect parameters ---
    if request.method == 'POST':
        params = {**request.query_params.dict(), **request.data}
    else:
        params = request.query_params.dict()

    fmt = params.pop('format', 'json')
    if fmt not in ('json', 'csv', 'xlsx', 'pdf'):
        return Response(
            {'error': f'Unsupported format "{fmt}". '
                      f'Choose from json, csv, xlsx, pdf.'},
            status=400,
        )

    # --- Render ---
    try:
        content, content_type, ext, row_count = render_report(
            report_type, fmt, params
        )
    except ValueError as exc:
        return Response({'error': str(exc)}, status=400)

    # --- Audit log ---
    filename = (
        f"{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
    )
    ReportLog.objects.create(
        report_type=report_type,
        report_format=fmt,
        parameters=params,
        file_name=filename,
        row_count=row_count,
        generated_by=request.user,
    )

    # --- Response ---
    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['X-Row-Count'] = str(row_count)
    return response


# ---------------------------------------------------------------------------
# Report audit log
# ---------------------------------------------------------------------------

class ReportLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only history of every report generated.

    Only REPORTING_ANALYST (or superusers) can view this.
    """
    queryset = ReportLog.objects.select_related('generated_by').all()
    serializer_class = ReportLogSerializer
    permission_classes = [RolePermission]
    read_roles = [REPORTING_ANALYST]