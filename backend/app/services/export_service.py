import csv
from html import escape
import io
import json
from pathlib import Path
import uuid
from decimal import Decimal
from typing import Dict, Any, List
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session
import jinja2

from app.models import SheetVersion, CostSheet
from app.services.cost_sheet_service import cost_sheet_service

# Load Jinja2 templates directory
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=jinja2.select_autoescape(["html", "xml"]),
)

# Internationalization mappings for reports
REPORT_TRANSLATIONS: Dict[str, Dict[str, Any]] = {
    "en": {
        "doc_title": "Executive Cost Sheet Document",
        "doc_subtitle": "Ready for Print & PDF Export",
        "doc_type": "Executive Costing & Margin Analysis",
        "doc_date": "Document Date",
        "basis": "Basis",
        "basis_batch": "Batch Basis",
        "basis_monthly": "Monthly Basis",
        "currency": "Currency",
        "sold_as": "Sold as",
        "cost_perspective": "Cost Perspective",
        "perspective_economic": "Full Economic Cost",
        "perspective_cash": "Cash-Only Cost",
        "version": "Version",
        "unit_cost": "Unit Cost",
        "cash_unit_cost": "Cash",
        "suggested_price": "Suggested Product Price",
        "delivered_price": "Delivered",
        "profit_per_unit": "Profit Per Unit",
        "pricing_markup": "Markup",
        "pricing_margin": "Margin",
        "production_output": "Production Output",
        "good_units": "Good Units",
        "total_cost": "Total Cost",
        "cost_distribution": "Cost Distribution Structure",
        "breakdown_title": "Itemized Cost Buckets Breakdown",
        "break_even": "Break-Even Quantity",
        "units": "units",
        "split_required": "Fixed/variable split required",
        "not_reached": "Not reachable at this price",
        "col_item": "Line Item",
        "col_qty": "Quantity / Unit",
        "col_unit_price": "Unit Price",
        "col_total": "Total",
        "col_behavior": "Behavior",
        "col_cost_type": "Cost Type",
        "behavior_variable": "Variable",
        "behavior_fixed": "Fixed",
        "type_cash": "Cash",
        "type_imputed": "Imputed",
        "lump_sum": "Lump Sum",
        "lump_sum_entry": "Lump-sum allocation entry",
        "loss_warning_title": "Attention: Pricing Warning",
        "loss_warning_desc": "The configured selling price is below the economic unit cost. Adjust your margin or reduce cost drivers to maintain profitability.",
        "version_note": "Version Note",
        "footer_system": "TrueMargin Automated Cost Intelligence System · Confidential Report",
        "footer_page": "Generated for",
        "btn_download_pdf": "Download PDF File",
        "btn_print": "Print Document",
        "generating_pdf": "Generating PDF…",
        "categories": {
            "material": "Materials",
            "labor": "Labor",
            "transport": "Transport",
            "overhead": "Overhead",
            "machinery": "Machinery & Equipment",
            "custom_fees": "Custom Fees",
            "other": "Other Costs",
        },
    },
    "si": {
        "doc_title": "විධායක පිරිවැය සහ ලාභ ආන්තික වාර්තාව",
        "doc_subtitle": "මුද්‍රණයට සහ PDF බාගත කිරීමට සූදානම්",
        "doc_type": "විධායක පිරිවැය සහ ලාභ ආන්තික විශ්ලේෂණය",
        "doc_date": "ලේඛනගත දිනය",
        "basis": "පදනම",
        "basis_batch": "කාණ්ඩ පදනම (Batch)",
        "basis_monthly": "මාසික පදනම (Monthly)",
        "currency": "මුදල් වර්ගය",
        "sold_as": "විකිණුම් ඒකකය",
        "cost_perspective": "පිරිවැය දෘෂ්ටිය",
        "perspective_economic": "සම්පූර්ණ ආර්ථික පිරිවැය",
        "perspective_cash": "සෘජු මුදල් පිරිවැය",
        "version": "සංශෝධනය",
        "unit_cost": "ඒකකයක පිරිවැය",
        "cash_unit_cost": "සෘජු මුදල්",
        "suggested_price": "යෝජිත නිෂ්පාදන මිල",
        "delivered_price": "බෙදාහැරීම සහිත",
        "profit_per_unit": "ඒකකයක ලාභය",
        "pricing_markup": "මිල වැඩි කිරීම (Markup)",
        "pricing_margin": "ලාභ ආන්තිකය (Margin)",
        "production_output": "නිෂ්පාදන ප්‍රමාණය",
        "good_units": "දෝෂ රහිත ඒකක",
        "total_cost": "මුළු පිරිවැය",
        "cost_distribution": "පිරිවැය බෙදීයාමේ ව්‍යුහය",
        "breakdown_title": "කාණ්ඩගත පිරිවැය අයිතම විග්‍රහය",
        "break_even": "ලාභ-අලාභ නොවන සීමාව",
        "units": "ඒකක",
        "split_required": "ස්ථාවර/විචල්‍ය වෙන්කිරීම අවශ්‍යයි",
        "not_reached": "ළඟා විය නොහැක",
        "col_item": "පිරිවැය අයිතමය",
        "col_qty": "ප්‍රමාණය / ඒකකය",
        "col_unit_price": "ඒකක මිල",
        "col_total": "මුළු එකතුව",
        "col_behavior": "ස්වභාවය",
        "col_cost_type": "පිරිවැය වර්ගය",
        "behavior_variable": "විචල්‍ය",
        "behavior_fixed": "ස්ථාවර",
        "type_cash": "සෘජු මුදල්",
        "type_imputed": "ඇස්තමේන්තුගත",
        "lump_sum": "තොග එකතුව",
        "lump_sum_entry": "තොග ප්‍රතිපාදන සටහන",
        "loss_warning_title": "අවධානයට: මිල අනතුරු ඇඟවීමයි",
        "loss_warning_desc": "වින්‍යාස කරන ලද විකුණුම් මිල සම්පූර්ණ ඒකක පිරිවැයට වඩා අඩුය. ලාභදායීතාවය පවත්වා ගැනීමට ඔබේ ලාභ ආන්තිකය වැඩි කරන්න හෝ පිරිවැය අඩු කරන්න.",
        "version_note": "සංශෝධන සටහන",
        "footer_system": "TrueMargin ස්වයංක්‍රීය පිරිවැය බුද්ධි පද්ධතිය · රහස්‍ය වාර්තාවකි",
        "footer_page": "සඳහා නිර්මාණය කරන ලදී",
        "btn_download_pdf": "PDF ගොනුව බාගන්න",
        "btn_print": "ලේඛනය මුද්‍රණය කරන්න",
        "generating_pdf": "PDF සකසමින්…",
        "categories": {
            "material": "අමුද්‍රව්‍ය පිරිවැය",
            "labor": "ශ්‍රම පිරිවැය",
            "transport": "ප්‍රවාහන පිරිවැය",
            "overhead": "පොදු කාර්ය පිරිවැය",
            "machinery": "යන්ත්‍ර සූත්‍ර හා උපකරණ",
            "custom_fees": "වෙනත් විශේෂිත ගාස්තු",
            "other": "වෙනත් පිරිවැය",
        },
    },
}


class ExportService:
    @staticmethod
    def _html_text(value: Any) -> str:
        return escape(str(value if value is not None else ""), quote=True)

    @staticmethod
    def _fmt_money(value: Any, currency: str = "") -> str:
        try:
            val = Decimal(str(value if value is not None else 0))
            formatted = f"{val:,.2f}"
            return f"{currency} {formatted}".strip() if currency else formatted
        except Exception:
            return f"{currency} {value}".strip() if currency else str(value)

    @staticmethod
    def _fmt_qty(value: Any) -> str:
        try:
            val = Decimal(str(value if value is not None else 0))
            if val == val.to_integral():
                return f"{int(val):,}"
            return f"{val:,.2f}".rstrip("0").rstrip(".")
        except Exception:
            return str(value or "0")

    @staticmethod
    def _fmt_percent(value: Any) -> str:
        try:
            val = Decimal(str(value if value is not None else 0))
            if val == val.to_integral():
                return f"{int(val)}%"
            return f"{val:,.2f}".rstrip("0").rstrip(".") + "%"
        except Exception:
            return f"{value}%"

    def generate_csv_export(
        self, version_id: uuid.UUID, user_id: uuid.UUID, db: Session, locale: str = "en"
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
        t = REPORT_TRANSLATIONS.get(locale, REPORT_TRANSLATIONS["en"])

        output = io.StringIO()
        writer = csv.writer(output)

        # Header Metadata
        writer.writerow([t["doc_title"].upper()])
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
        writer.writerow(["Total Cost", str(snap.get("total_cost", "0.00"))])
        writer.writerow(["Unit Cost", str(snap.get("unit_cost", "0.00"))])
        writer.writerow(["Cash Unit Cost", str(snap.get("cash_unit_cost", "0.00"))])
        writer.writerow(["Suggested Product Price", str(snap.get("suggested_product_price", "0.00"))])
        writer.writerow(["Suggested Delivered Price", str(snap.get("suggested_delivered_price", "0.00"))])
        writer.writerow(["Pricing Type", snap.get("pricing_type", "markup")])
        writer.writerow(["Pricing Percentage", f"{snap.get('pricing_percentage', 0)}%"])
        writer.writerow(["Profit Per Unit", str(snap.get("profit_per_unit", "0.00"))])
        writer.writerow(["Break Even Units", str(snap.get("break_even_units", "N/A"))])
        writer.writerow([])

        # Itemized Breakdown
        writer.writerow(["ITEMIZED COST BREAKDOWN"])
        writer.writerow([
            "Category",
            "Item Name",
            "Quantity",
            "Unit of Measure",
            "Unit Price",
            "Total Amount",
            "Cost Behavior",
            "Is Imputed",
            "Fixed Amount",
            "Variable Amount",
            "Details (JSON)",
        ])

        for bucket in snap.get("bucket_breakdown", []):
            b_type = bucket.get("type", "other")
            b_label = t["categories"].get(b_type, bucket.get("label", b_type))
            items = bucket.get("items", [])
            if not items:
                writer.writerow([
                    b_label,
                    "Lump Sum Allocation",
                    "1",
                    "lump",
                    str(bucket.get("effective_total", 0)),
                    str(bucket.get("effective_total", 0)),
                    "fixed",
                    "False",
                    str(bucket.get("effective_total", 0)),
                    "0.00",
                    "{}",
                ])
            else:
                for item in items:
                    amount = Decimal(str(item.get("amount", 0)))
                    fixed_amount = Decimal(str(item.get(
                        "fixed_amount",
                        amount if item.get("cost_behavior") == "fixed" else 0,
                    )))
                    writer.writerow([
                        b_label,
                        item.get("name", ""),
                        str(item.get("quantity", "")),
                        item.get("unit", ""),
                        str(item.get("unit_price", "")),
                        str(amount),
                        item.get("cost_behavior", "variable"),
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
        self, version_id: uuid.UUID, user_id: uuid.UUID, db: Session, locale: str = "en"
    ) -> Response:
        """
        Generates an executive-grade HTML print view rendered from a clean Jinja2 template.
        Supports both English ('en') and Sinhala ('si') natively with client-side PDF downloads.
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
        is_si = locale == "si"
        t = REPORT_TRANSLATIONS.get(locale, REPORT_TRANSLATIONS["en"])

        created_str = (
            version.created_at.strftime("%Y-%m-%d · %H:%M")
            if version.created_at
            else "N/A"
        )

        total_cost_dec = Decimal(str(snap.get("total_cost", 0)))
        bucket_colors = {
            "material": "#2563eb",
            "labor": "#059669",
            "overhead": "#d97706",
            "transport": "#7c3aed",
            "machinery": "#db2777",
            "custom_fees": "#0891b2",
        }

        # Build visual cost distribution bars and legend
        bars = []
        legends = []
        for b in snap.get("bucket_breakdown", []):
            b_type = b.get("type", "other")
            color = bucket_colors.get(b_type, "#64748b")
            label = t["categories"].get(b_type, b.get("label", b_type))
            items = b.get("items", [])
            eff_val = Decimal(str(b.get("effective_total", 0)))
            items_sum = sum((Decimal(str(it.get("amount", 0))) for it in items), Decimal(0))
            category_total = max(eff_val, items_sum)
            pct = (category_total / total_cost_dec * 100) if total_cost_dec > 0 else Decimal(0)
            if pct > 0:
                bars.append({
                    "pct": f"{pct:.1f}",
                    "color": color,
                    "label": label,
                })
                legends.append({
                    "pct": f"{pct:.1f}",
                    "color": color,
                    "label": label,
                })

        # Process buckets and items
        buckets_data = []
        for b in snap.get("bucket_breakdown", []):
            b_type = b.get("type", "other")
            color = bucket_colors.get(b_type, "#0284c7")
            label = t["categories"].get(b_type, b.get("label", b_type))
            items = b.get("items", [])
            eff_val = Decimal(str(b.get("effective_total", 0)))
            items_sum = sum((Decimal(str(it.get("amount", 0))) for it in items), Decimal(0))
            category_total = max(eff_val, items_sum)
            pct_of_total = (category_total / total_cost_dec * 100) if total_cost_dec > 0 else Decimal(0)

            items_list = []
            for item in items:
                amount = Decimal(str(item.get("amount", 0)))
                qty = Decimal(str(item.get("quantity", 1) or 1))
                raw_unit_price = item.get("unit_price")
                if raw_unit_price is not None and Decimal(str(raw_unit_price)) > 0:
                    unit_price_val = self._fmt_money(raw_unit_price)
                elif qty > 0 and amount > 0:
                    unit_price_val = self._fmt_money(amount / qty)
                else:
                    unit_price_val = "—"

                fixed_amount = Decimal(str(item.get(
                    "fixed_amount",
                    amount if item.get("cost_behavior") == "fixed" else 0,
                )))
                variable_amount = amount - fixed_amount
                is_fixed = fixed_amount > 0 and variable_amount == 0
                is_imputed = bool(item.get("is_imputed"))

                qty_formatted = self._fmt_qty(qty)
                unit_label = item.get("unit") or ""
                qty_unit_str = f"{qty_formatted} {unit_label}".strip() if unit_label else qty_formatted

                items_list.append({
                    "name": item.get("name"),
                    "qty_unit_str": qty_unit_str,
                    "unit_price_str": unit_price_val,
                    "amount_str": self._fmt_money(amount),
                    "is_variable": not is_fixed,
                    "is_imputed": is_imputed,
                })

            if items:
                badge_text = f"{len(items)} {'අයිතම' if is_si else 'items'}"
            else:
                badge_text = t["lump_sum"]

            if pct_of_total > 0:
                badge_text += f" · {pct_of_total:.1f}%"

            buckets_data.append({
                "label": label,
                "color": color,
                "badge_text": badge_text,
                "total_str": self._fmt_money(category_total, currency_code),
                "items": items_list,
            })

        # Break even computation
        be_units = snap.get("break_even_units")
        if be_units is not None:
            break_even_str = f"{self._fmt_qty(be_units)} {t['units']}"
        elif snap.get("break_even_ready", False):
            break_even_str = t["not_reached"]
        else:
            break_even_str = t["split_required"]

        # Meta and Labels
        basis_label = t["basis_batch"] if sheet.basis == "batch" else t["basis_monthly"]
        cost_perspective_label = (
            t["perspective_economic"]
            if snap.get("cost_view", "economic") == "economic"
            else t["perspective_cash"]
        )
        pricing_type_label = (
            t["pricing_markup"]
            if snap.get("pricing_type", "markup") == "markup"
            else t["pricing_margin"]
        )

        safe_sheet_name = sheet.name.replace(" ", "_")
        pdf_filename = f"{safe_sheet_name}_v{version.version_number}.pdf"

        # Assemble template context
        context = {
            "locale": locale,
            "t": t,
            "sheet": sheet,
            "version": version,
            "snap": snap,
            "currency_code": currency_code,
            "created_str": created_str,
            "basis_label": basis_label,
            "cost_perspective_label": cost_perspective_label,
            "pricing_type_label": pricing_type_label,
            "break_even_str": break_even_str,
            "unit_cost_str": self._fmt_money(snap.get("unit_cost"), currency_code),
            "cash_unit_cost_str": self._fmt_money(snap.get("cash_unit_cost", snap.get("unit_cost")), currency_code),
            "suggested_product_price_str": self._fmt_money(snap.get("suggested_product_price", snap.get("suggested_price")), currency_code),
            "suggested_delivered_price_str": self._fmt_money(snap.get("suggested_delivered_price", snap.get("suggested_price")), currency_code),
            "profit_per_unit_str": self._fmt_money(snap.get("profit_per_unit"), currency_code),
            "pricing_pct_str": self._fmt_percent(snap.get("pricing_percentage", 0)),
            "units_produced_str": self._fmt_qty(version.units_produced),
            "good_units_str": self._fmt_qty(snap.get("good_units", 0)),
            "total_cost_str": self._fmt_money(snap.get("total_cost"), currency_code),
            "distribution": {
                "bars": bars,
                "legends": legends,
            },
            "buckets": buckets_data,
            "pdf_filename": pdf_filename,
        }

        template = jinja_env.get_template("cost_sheet_report.html")
        html_content = template.render(context)

        return Response(content=html_content, media_type="text/html")


export_service = ExportService()