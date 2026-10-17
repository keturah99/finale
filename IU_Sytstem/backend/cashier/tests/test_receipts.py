"""PDF receipt generation tests."""
import pytest

from cashier.services import generate_receipt_pdf


@pytest.mark.django_db
class TestReceiptGeneration:

    def test_returns_pdf_bytes(self, cash_in):
        out = generate_receipt_pdf(cash_in)
        assert isinstance(out, (bytes, bytearray))
        assert len(out) > 0

    def test_pdf_magic_header(self, cash_in):
        out = generate_receipt_pdf(cash_in)
        assert bytes(out[:4]) == b'%PDF'

    def test_pdf_is_not_trivially_small(self, cash_in):
        """Real receipts include header + at least one page — expect >1KB."""
        out = generate_receipt_pdf(cash_in)
        assert len(out) > 1024

    def test_receipt_endpoint_returns_pdf(self, client_cashier, cash_in):
        r = client_cashier.get(f'/api/cashier/submissions/cash-ins/{cash_in.pk}/receipt/')
        assert r.status_code == 200
        assert r['Content-Type'].startswith('application/pdf')
        content = b''.join(r.streaming_content) if getattr(r, 'streaming_content', None) else r.content
        assert content[:4] == b'%PDF'

    def test_receipt_endpoint_requires_auth(self, anon_client, cash_in):
        r = anon_client.get(f'/api/cashier/submissions/cash-ins/{cash_in.pk}/receipt/')
        assert r.status_code in (401, 403)

    def test_other_cashier_cannot_download_foreign_receipt(
        self, client_other_cashier, cash_in,
    ):
        r = client_other_cashier.get(
            f'/api/cashier/submissions/cash-ins/{cash_in.pk}/receipt/',
        )
        assert r.status_code in (403, 404)