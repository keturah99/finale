from reporting.services import build_report, render_report, REPORT_BUILDERS

def hr(t):
    print("\n" + "=" * 70); print(t); print("=" * 70)

hr("Available reports")
for name in sorted(REPORT_BUILDERS.keys()):
    print(f"  - {name}")

hr("Executive dashboard")
_, dash = build_report('executive_dashboard', {})
import json
print(json.dumps(dash, indent=2, default=str))

for rtype in ['inventory_summary', 'low_stock_alerts', 'produce_purchases',
              'production_batches', 'pending_collections',
              'transport_bookings', 'vehicle_utilization']:
    hr(f"{rtype}")
    headers, rows = build_report(rtype, {})
    print("  Headers:", headers)
    print(f"  Rows:    {len(rows)}")
    for r in rows[:3]:
        print("   ", r)

hr("PDF render test (produce_purchases)")
pdf_bytes, ctype, ext, count = render_report(
    'produce_purchases', 'pdf', {}
)
print(f"  type={ctype}  ext={ext}  rows={count}  size={len(pdf_bytes):,} bytes")

hr("CSV render test (inventory_summary)")
csv_text, ctype, ext, count = render_report(
    'inventory_summary', 'csv', {}
)
print(f"  type={ctype}  ext={ext}  rows={count}")
print("  Preview:")
print("  " + csv_text.replace("\n", "\n  ").rstrip())