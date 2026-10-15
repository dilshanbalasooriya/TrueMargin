import csv
from html import escape
import io
import json
import uuid
from decimal import Decimal
from typing import Dict, Any
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session

from app.models import SheetVersion, CostSheet
from app.services.cost_sheet_service import cost_sheet_service


class ExportService:
    @staticmethod
    def _html_text(value: Any) -> str:
        return escape(str(value if value is not None else ""), quote=True)

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
        writer.writerow(["Currency", snap.get("currency_code", "LKR")])
        writer.writerow([])

        # Production Totals Summary
        writer.writerow(["SUMMARY TOTALS"])
        writer.writerow(["Units Produced", str(version.units_produced)])
        writer.writerow(["Defective Units", str(version.defective_units)])
        writer.writerow(["Good Units", str(snap.get("good_units", 0))])
        writer.writerow(["Total Cost", str(snap.get("total_cost", "0.0000"))])
        writer.writerow(["Unit Cost", str(snap.get("unit_cost", "0.0000"))])
        writer.writerow(["Cost View", snap.get("cost_view", "economic")])
        writer.writerow(["Cash Total Cost", str(snap.get("cash_total_cost", snap.get("total_cost", 0)))])
        writer.writerow(["Economic Total Cost", str(snap.get("economic_total_cost", snap.get("total_cost", 0)))])
        writer.writerow(["Cash Unit Cost", str(snap.get("cash_unit_cost", snap.get("unit_cost", 0)))])
        writer.writerow(["Economic Unit Cost", str(snap.get("economic_unit_cost", snap.get("unit_cost", 0)))])
        writer.writerow(["Seller-Paid Delivery per Unit", str(snap.get("seller_paid_delivery_per_unit", 0))])
        writer.writerow(["Customer-Paid Delivery per Unit", str(snap.get("customer_paid_delivery_per_unit", 0))])
        writer.writerow(["Pricing Type", snap.get("pricing_type", "markup")])
        writer.writerow(["Pricing Percentage", f"{snap.get('pricing_percentage', 0)}%"])
        target_price = snap.get("target_selling_price")
        writer.writerow(["Target Selling Price", str(target_price if target_price is not None else "N/A")])
        writer.writerow(["Suggested Product Price", str(snap.get("suggested_product_price", snap.get("suggested_price", "0.0000")))])
        writer.writerow(["Suggested Delivered Price", str(snap.get("suggested_delivered_price", snap.get("suggested_price", "0.0000")))])
        writer.writerow(["Profit Per Unit", str(snap.get("profit_per_unit", "0.0000"))])
        break_even_units = snap.get("break_even_units")
        break_even_status = (
            str(break_even_units)
            if break_even_units is not None
            else "Not reached"
            if snap.get("break_even_ready", False)
            else "Level 3 cost split incomplete"
        )
        writer.writerow(["Break-even Units", break_even_status])
        writer.writerow(["Loss Making", str(snap.get("is_loss_making", False))])
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
            "Imputed",
            "Fixed Amount",
            "Variable Amount",
            "Advanced Details",
        ])

        for bucket in snap.get("bucket_breakdown", []):
            b_type = bucket.get("type")
            b_label = bucket.get("label")
            items = bucket.get("items", [])

            if not items:
                effective_total = Decimal(str(bucket.get("effective_total", 0)))
                fixed_total = Decimal(str(bucket.get(
                    "fixed_economic_total" if snap.get("cost_view") == "economic" else "fixed_cash_total",
                    effective_total if bucket.get("cost_behavior") == "fixed" else 0,
                )))
                writer.writerow([
                    b_type,
                    b_label,
                    "[Bucket Lump Sum]",
                    "1",
                    "batch",
                    str(bucket.get("effective_total", 0)),
                    str(bucket.get("effective_total", 0)),
                    "declared",
                    "False",
                    str(fixed_total),
                    str(effective_total - fixed_total),
                    "",
                ])
            else:
                for item in items:
                    amount = Decimal(str(item.get("amount", 0)))
                    fixed_amount = Decimal(str(item.get(
                        "fixed_amount",
                        amount if item.get("cost_behavior") == "fixed" else 0,
                    )))
                    writer.writerow([
                        b_type,
                        b_label,
                        item.get("name"),
                        str(item.get("quantity", 1)),
                        item.get("unit") or "-",
                        str(item.get("unit_price", 0)),
                        str(item.get("amount", 0)),
                        item.get("kind", "user"),
                        str(item.get("is_imputed", False)),
                        str(fixed_amount),
                        str(amount - fixed_amount),
                        json.dumps(item.get("details", {}), ensure_ascii=False, sort_keys=True),
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
        currency_code = snap.get("currency_code", "LKR")

        buckets_html = ""
        for b in snap.get("bucket_breakdown", []):
            items_html = ""
            for item in b.get("items", []):
                amount = Decimal(str(item.get("amount", 0)))
                fixed_amount = Decimal(str(item.get(
                    "fixed_amount",
                    amount if item.get("cost_behavior") == "fixed" else 0,
                )))
                items_html += f"""
                <tr>
                    <td>{self._html_text(item.get('name'))}</td>
                    <td>{self._html_text(item.get('quantity'))} {self._html_text(item.get('unit') or '')}</td>
                    <td>{self._html_text(item.get('unit_price'))}</td>
                    <td><strong>{self._html_text(item.get('amount'))}</strong></td>
                    <td>{self._html_text(str(fixed_amount))}</td>
                    <td>{self._html_text(str(amount - fixed_amount))}</td>
                    <td>{self._html_text('Imputed' if item.get('is_imputed') else 'Cash')}</td>
                </tr>
                """

            buckets_html += f"""
            <div class="bucket-section">
                <h3>{self._html_text(b.get('label'))} ({self._html_text(str(b.get('type', '')).capitalize())}) - Total: {self._html_text(currency_code)} {self._html_text(b.get('effective_total'))}</h3>
                <table>
                    <thead>
                        <tr><th>Item</th><th>Purchase qty/unit</th><th>Unit Price</th><th>Amount</th><th>Fixed</th><th>Variable</th><th>Cost treatment</th></tr>
                    </thead>
                    <tbody>
                        {items_html or "<tr><td colspan='5'>Lump sum bucket entry</td></tr>"}
                    </tbody>
                </table>
            </div>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{self._html_text(sheet.name)} - Version {version.version_number}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; color: #333; }}
                h1 {{ margin-bottom: 5px; }}
                .meta {{ color: #666; margin-bottom: 20px; }}
                .summary-card {{ background: #f4f6f8; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
                .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }}
                .summary-item label {{ font-size: 12px; color: #666; display: block; }}
                .summary-item value {{ font-size: 18px; font-weight: bold; }}
                .loss-warning {{ color: #b91c1c; font-weight: bold; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f8f9fa; }}
                .bucket-section {{ margin-bottom: 25px; }}
            </style>
        </head>
        <body>
            <h1>{self._html_text(sheet.name)}</h1>
            <div class="meta">Version {version.version_number} | Basis: {self._html_text(sheet.basis)} | Cost view: {self._html_text(snap.get('cost_view', 'economic'))} | Note: {self._html_text(version.change_note or 'N/A')}</div>
            
            <div class="summary-card">
                <h2>Production & Pricing Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item"><label>Units Produced</label><value>{self._html_text(version.units_produced)}</value></div>
                    <div class="summary-item"><label>Good Units</label><value>{self._html_text(snap.get('good_units', 0))}</value></div>
                    <div class="summary-item"><label>Total Batch Cost</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('total_cost'))}</value></div>
                    <div class="summary-item"><label>Cash Total Cost</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('cash_total_cost', snap.get('total_cost')))}</value></div>
                    <div class="summary-item"><label>Economic Total Cost</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('economic_total_cost', snap.get('total_cost')))}</value></div>
                    <div class="summary-item"><label>Unit Cost</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('unit_cost'))}</value></div>
                    <div class="summary-item"><label>Cash Unit Cost</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('cash_unit_cost', snap.get('unit_cost')))}</value></div>
                    <div class="summary-item"><label>Economic Unit Cost</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('economic_unit_cost', snap.get('unit_cost')))}</value></div>
                    <div class="summary-item"><label>Seller-Paid Delivery / Unit</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('seller_paid_delivery_per_unit', 0))}</value></div>
                    <div class="summary-item"><label>Customer-Paid Delivery / Unit</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('customer_paid_delivery_per_unit', 0))}</value></div>
                    <div class="summary-item"><label>Suggested Product Price</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('suggested_product_price', snap.get('suggested_price')))}</value></div>
                    <div class="summary-item"><label>Suggested Delivered Price</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('suggested_delivered_price', snap.get('suggested_price')))}</value></div>
                    <div class="summary-item"><label>Profit / Unit</label><value>{self._html_text(currency_code)} {self._html_text(snap.get('profit_per_unit'))}</value></div>
                    <div class="summary-item"><label>Break-even Units</label><value>{self._html_text(snap.get('break_even_units') if snap.get('break_even_units') is not None else 'Not reached' if snap.get('break_even_ready', False) else 'Level 3 cost split incomplete')}</value></div>
                </div>
                {f"<p class='loss-warning'>Warning: the selling price is below the selected cost per unit.</p>" if snap.get('is_loss_making') else ""}
            </div>

            <h2>Cost Breakdown</h2>
            {buckets_html}
        </body>
        </html>
        """

        return Response(content=html_content, media_type="text/html")


export_service = ExportService()