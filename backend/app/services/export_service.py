import csv
import io
import uuid
from decimal import Decimal
from typing import Dict, Any
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session

from app.models import SheetVersion, CostSheet
from app.services.cost_sheet_service import cost_sheet_service


class ExportService:

    def generate_csv_export(
        self, version_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> StreamingResponse:
        """
        Generates an accounting-grade CSV breakdown of a cost sheet version.
        """
        version = db.get(SheetVersion, version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version record not found.",
            )

        sheet = cost_sheet_service.verify_sheet_access(version.sheet_id, user_id, "viewer", db)
        snap = version.totals_snapshot

        output = io.StringIO()
        writer = csv.writer(output)

        # Header Metadata
        writer.writerow(["COST SHEET BREAKDOWN REPORT"])
        writer.writerow(["Sheet Name", sheet.name])
        writer.writerow(["Version Number", f"v{version.version_number}"])
        writer.writerow(["Change Note", version.change_note or "N/A"])
        writer.writerow(["Basis", sheet.basis])
        writer.writerow([])

        # Production Totals Summary
        writer.writerow(["SUMMARY TOTALS"])
        writer.writerow(["Units Produced", str(version.units_produced)])
        writer.writerow(["Defective Units", str(version.defective_units)])
        writer.writerow(["Good Units", str(snap.get("good_units", 0))])
        writer.writerow(["Total Cost", str(snap.get("total_cost", "0.0000"))])
        writer.writerow(["Unit Cost", str(snap.get("unit_cost", "0.0000"))])
        writer.writerow(["Pricing Type", snap.get("pricing_type", "markup")])
        writer.writerow(["Pricing Percentage", f"{snap.get('pricing_percentage', 0)}%"])
        writer.writerow(["Suggested Selling Price", str(snap.get("suggested_price", "0.0000"))])
        writer.writerow(["Profit Per Unit", str(snap.get("profit_per_unit", "0.0000"))])
        writer.writerow([])

        # Itemized Bill of Materials & Cost Buckets
        writer.writerow(["ITEMIZED BUCKET BREAKDOWN"])
        writer.writerow([
            "Bucket Type",
            "Bucket Label",
            "Item Name",
            "Quantity",
            "Unit",
            "Unit Price",
            "Total Amount",
            "Item Kind",
        ])

        for bucket in snap.get("bucket_breakdown", []):
            b_type = bucket.get("type")
            b_label = bucket.get("label")
            items = bucket.get("items", [])

            if not items:
                writer.writerow([
                    b_type,
                    b_label,
                    "[Bucket Lump Sum]",
                    "1",
                    "batch",
                    str(bucket.get("effective_total", 0)),
                    str(bucket.get("effective_total", 0)),
                    "declared",
                ])
            else:
                for item in items:
                    writer.writerow([
                        b_type,
                        b_label,
                        item.get("name"),
                        str(item.get("quantity", 1)),
                        item.get("unit") or "-",
                        str(item.get("unit_price", 0)),
                        str(item.get("amount", 0)),
                        item.get("kind", "user"),
                    ])

        output.seek(0)
        filename = f"{sheet.name.replace(' ', '_')}_v{version.version_number}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    def generate_html_summary(
        self, version_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> Response:
        """
        Generates a clean HTML print view for PDF rendering or browser print/save.
        """
        version = db.get(SheetVersion, version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version record not found.",
            )

        sheet = cost_sheet_service.verify_sheet_access(version.sheet_id, user_id, "viewer", db)
        snap = version.totals_snapshot

        buckets_html = ""
        for b in snap.get("bucket_breakdown", []):
            items_html = ""
            for item in b.get("items", []):
                items_html += f"""
                <tr>
                    <td>{item.get('name')}</td>
                    <td>{item.get('quantity')} {item.get('unit') or ''}</td>
                    <td>{item.get('unit_price')}</td>
                    <td><strong>{item.get('amount')}</strong></td>
                </tr>
                """

            buckets_html += f"""
            <div class="bucket-section">
                <h3>{b.get('label')} ({b.get('type').capitalize()}) - Total: {b.get('effective_total')}</h3>
                <table>
                    <thead>
                        <tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                        {items_html or "<tr><td colspan='4'>Lump sum bucket entry</td></tr>"}
                    </tbody>
                </table>
            </div>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{sheet.name} - Version {version.version_number}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; color: #333; }}
                h1 {{ margin-bottom: 5px; }}
                .meta {{ color: #666; margin-bottom: 20px; }}
                .summary-card {{ background: #f4f6f8; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
                .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }}
                .summary-item label {{ font-size: 12px; color: #666; display: block; }}
                .summary-item value {{ font-size: 18px; font-weight: bold; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f8f9fa; }}
                .bucket-section {{ margin-bottom: 25px; }}
            </style>
        </head>
        <body>
            <h1>{sheet.name}</h1>
            <div class="meta">Version {version.version_number} | Basis: {sheet.basis} | Note: {version.change_note or 'N/A'}</div>
            
            <div class="summary-card">
                <h2>Production & Pricing Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item"><label>Units Produced</label><value>{version.units_produced}</value></div>
                    <div class="summary-item"><label>Good Units</label><value>{snap.get('good_units', 0)}</value></div>
                    <div class="summary-item"><label>Total Batch Cost</label><value>{snap.get('total_cost')}</value></div>
                    <div class="summary-item"><label>Unit Cost</label><value>{snap.get('unit_cost')}</value></div>
                    <div class="summary-item"><label>Suggested Selling Price</label><value>{snap.get('suggested_price')}</value></div>
                    <div class="summary-item"><label>Profit / Unit</label><value>{snap.get('profit_per_unit')}</value></div>
                </div>
            </div>

            <h2>Cost Breakdown</h2>
            {buckets_html}
        </body>
        </html>
        """

        return Response(content=html_content, media_type="text/html")


export_service = ExportService()