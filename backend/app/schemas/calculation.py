from decimal import Decimal, InvalidOperation
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


def _detail_decimal(details: Dict[str, Any], field_name: str, default: str = "0") -> Decimal:
    try:
        value = Decimal(str(details.get(field_name, default)))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be a valid number.") from error
    if not value.is_finite():
        raise ValueError(f"{field_name} must be a finite number.")
    return value


class LineItemInput(BaseModel):
    name: str
    quantity: Decimal = Field(default=Decimal("1.0"), gt=0)
    unit: Optional[str] = None
    unit_price: Decimal = Field(default=Decimal("0.0"), ge=0)
    amount: Optional[Decimal] = Field(default=None, ge=0)
    units_covered: Optional[Decimal] = Field(default=None, gt=0)
    kind: str = "user"  # 'user' or 'system_unallocated'
    pinned: bool = False
    is_imputed: bool = False
    cost_behavior: Literal["variable", "fixed"] = "variable"
    details: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_details(self):
        percentage_fields = (
            "wastage_percentage",
            "statutory_percentage",
            "bonus_percentage",
            "allocation_percentage",
            "variable_percentage",
        )
        for field_name in percentage_fields:
            value = self.details.get(field_name)
            if value is not None:
                parsed = _detail_decimal(self.details, field_name)
                if parsed < 0 or parsed > 100 or field_name == "wastage_percentage" and parsed >= 100:
                    raise ValueError(f"{field_name} must be between 0 and 100.")

        for field_name in (
            "scrap_recovery_amount",
            "purchase_price",
            "salvage_value",
            "lifetime_units",
            "useful_life_periods",
            "amortization_units",
            "allocation_measure",
            "allocation_total_measure",
        ):
            value = self.details.get(field_name)
            if value is not None:
                parsed = _detail_decimal(self.details, field_name)
                if parsed < 0:
                    raise ValueError(f"{field_name} must be zero or greater.")

        for field_name in (
            "depreciation_method",
            "allocation_basis",
            "amortization_method",
            "direction",
            "delivery_treatment",
        ):
            value = self.details.get(field_name)
            if value is not None and not isinstance(value, str):
                raise ValueError(f"{field_name} must be text.")
        depreciation_method = self.details.get("depreciation_method", "none")
        if depreciation_method not in {"none", "units", "periods"}:
            raise ValueError("depreciation_method must be none, units, or periods.")
        amortization_method = self.details.get(
            "amortization_method",
            "units" if self.details.get("amortization_units") is not None else "none",
        )
        if amortization_method not in {"none", "units", "periods"}:
            raise ValueError("amortization_method must be none, units, or periods.")
        if self.details.get("allocation_basis", "quantity") not in {
            "quantity",
            "weight",
            "volume",
        }:
            raise ValueError("allocation_basis must be quantity, weight, or volume.")
        if self.details.get("direction", "shared") not in {"inbound", "outbound", "shared"}:
            raise ValueError("direction must be inbound, outbound, or shared.")
        if self.details.get("delivery_treatment", "seller_paid") not in {
            "seller_paid",
            "customer_paid",
        }:
            raise ValueError("delivery_treatment must be seller_paid or customer_paid.")
        if depreciation_method == "units" and _detail_decimal(self.details, "lifetime_units") <= 0:
            raise ValueError("lifetime_units must be greater than zero for units depreciation.")
        if depreciation_method == "periods" and _detail_decimal(self.details, "useful_life_periods") <= 0:
            raise ValueError("useful_life_periods must be greater than zero for periods depreciation.")
        if depreciation_method != "none":
            if self.details.get("purchase_price") is None:
                raise ValueError("purchase_price is required for depreciation.")
            if _detail_decimal(self.details, "salvage_value") > _detail_decimal(self.details, "purchase_price"):
                raise ValueError("salvage_value cannot exceed purchase_price.")
        if amortization_method != "none" and (
            self.details.get("amortization_units") is None
            or _detail_decimal(self.details, "amortization_units") <= 0
        ):
            raise ValueError("amortization_units must be greater than zero for amortization.")
        if amortization_method == "none" and self.details.get("amortization_units") is not None:
            raise ValueError("Select an amortization method when amortization_units is provided.")
        allocation_measure = self.details.get("allocation_measure")
        allocation_total = self.details.get("allocation_total_measure")
        if (allocation_measure is None) != (allocation_total is None):
            raise ValueError("Both allocation measure and total measure are required.")
        if allocation_measure is not None and (
            _detail_decimal(self.details, "allocation_measure") <= 0
            or _detail_decimal(self.details, "allocation_total_measure") <= 0
            or _detail_decimal(self.details, "allocation_measure")
            > _detail_decimal(self.details, "allocation_total_measure")
        ):
            raise ValueError("Allocation measures must be positive and the assigned share cannot exceed the total.")

        # Recipe / BOM validation
        recipe_method = self.details.get("method") or self.details.get("cost_method")
        has_recipe_data = (
            recipe_method in {"recipe", "bom"}
            or self.details.get("usage_quantity") is not None
            or self.details.get("usage_unit") is not None
        )
        if has_recipe_data:
            if self.details.get("usage_quantity") is None:
                raise ValueError("usage_quantity is required for recipe/BOM items.")
            usage_qty = _detail_decimal(self.details, "usage_quantity")
            if usage_qty <= Decimal("0"):
                raise ValueError("usage_quantity must be greater than zero.")

            usage_unit = self.details.get("usage_unit")
            if not usage_unit or not str(usage_unit).strip():
                raise ValueError("usage_unit is required for recipe/BOM items.")

            purchase_qty = (
                _detail_decimal(self.details, "purchase_quantity")
                if self.details.get("purchase_quantity") is not None
                else self.quantity
            )
            if purchase_qty <= Decimal("0"):
                raise ValueError("purchase_quantity must be greater than zero.")

            purchase_unit = (
                str(self.details.get("purchase_unit")).strip()
                if self.details.get("purchase_unit") is not None
                else (self.unit.strip() if self.unit else "")
            )
            if not purchase_unit:
                raise ValueError("purchase_unit is required for recipe/BOM items.")

            from app.services.unit_converter import are_units_compatible

            if not are_units_compatible(purchase_unit, str(usage_unit).strip()):
                raise ValueError(
                    f"Incompatible recipe units: '{purchase_unit}' and '{usage_unit}'. "
                    f"Both units must be of the same measurement type (e.g., mass, volume, or length)."
                )

        return self


class BucketInput(BaseModel):
    type: str  # material, labor, transport, overhead, machinery, custom
    label: str
    declared_total: Decimal = Field(default=Decimal("0.0"), ge=0)
    units_covered: Optional[Decimal] = Field(default=None, gt=0)
    level: int = Field(default=1, ge=1, le=3)
    method: Optional[str] = None
    hidden: bool = False
    cost_behavior: Literal["variable", "fixed"] = "variable"
    items: List[LineItemInput] = Field(default_factory=list)


class CalculationRequest(BaseModel):
    unit_label: str = Field(
        default="unit",
        min_length=1,
        description="The user-facing name for one produced or delivered unit.",
    )
    units_produced: Decimal = Field(
        gt=0,
        description="Good and defective output over the selected batch or period.",
    )
    defective_units: Decimal = Field(default=Decimal("0.0"), ge=0, description="Scrap or defective units")
    buckets: List[BucketInput]
    default_units_covered_scope: Literal["all", "overhead_only"] = Field(
        description="Whether missing units-covered values default for all costs or only overhead.",
    )
    pricing_type: Literal["markup", "margin"] = Field(default="markup")
    pricing_percentage: Decimal = Field(default=Decimal("0.0"), ge=0)
    cost_view: Literal["cash", "economic"] = "economic"
    target_selling_price: Optional[Decimal] = Field(default=None, ge=0)

    @field_validator("unit_label")
    @classmethod
    def validate_unit_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("unit_label must not be blank.")
        return value

    @field_validator("defective_units")
    @classmethod
    def validate_defects(cls, v: Decimal, info) -> Decimal:
        units_produced = info.data.get("units_produced")
        if units_produced is not None and v >= units_produced:
            raise ValueError("Defective units must be strictly less than total units produced.")
        return v

    @field_validator("pricing_type", mode="before")
    @classmethod
    def normalize_pricing_type(cls, value: str) -> str:
        normalized = str(value).lower()
        if normalized not in {"markup", "margin"}:
            raise ValueError("Pricing type must be markup or margin.")
        return normalized

    @model_validator(mode="after")
    def validate_request_rules(self):
        if (
            self.target_selling_price is None
            and self.pricing_type == "margin"
            and self.pricing_percentage >= Decimal("100.0")
        ):
            raise ValueError("Margin percentage must be strictly less than 100%.")
        if self.default_units_covered_scope == "overhead_only":
            for bucket in self.buckets:
                if bucket.hidden or bucket.type.strip().casefold() == "overhead":
                    continue
                if bucket.units_covered is None:
                    raise ValueError(
                        "Set units_covered for every non-overhead bucket when "
                        "default_units_covered_scope is overhead_only."
                    )
        return self


class LineItemOutput(BaseModel):
    name: str
    quantity: Decimal
    unit: Optional[str]
    unit_price: Decimal
    amount: Decimal
    fixed_amount: Decimal
    variable_amount: Decimal
    units_covered: Decimal
    cost_per_unit: Decimal
    kind: str
    pinned: bool
    is_imputed: bool = False
    cost_behavior: Literal["variable", "fixed"] = "variable"
    details: Dict[str, Any]


class BucketBreakdownOutput(BaseModel):
    type: str
    label: str
    level: int
    method: Optional[str]
    hidden: bool
    declared_total: Decimal
    effective_total: Decimal
    itemized_total: Decimal
    economic_itemized_total: Decimal
    itemization_percentage: Decimal
    units_covered: Decimal
    cost_per_unit: Decimal
    cash_cost_per_unit: Decimal
    economic_cost_per_unit: Decimal
    fixed_cash_total: Decimal
    fixed_economic_total: Decimal
    cost_behavior: Literal["variable", "fixed"] = "variable"
    percentage_of_total: Decimal
    reconciliation_status: str  # 'no_items', 'matched', 'unallocated_added', 'exceeded'
    items: List[LineItemOutput]


class CalculationResponse(BaseModel):
    unit_label: str
    units_produced: Decimal
    defective_units: Decimal
    good_units: Decimal
    default_units_covered_scope: Literal["all", "overhead_only"]
    total_cost: Decimal
    unit_cost: Decimal
    cash_total_cost: Decimal
    economic_total_cost: Decimal
    cash_unit_cost: Decimal
    economic_unit_cost: Decimal
    cost_view: Literal["cash", "economic"]
    seller_paid_delivery_per_unit: Decimal = Decimal("0.0")
    customer_paid_delivery_per_unit: Decimal = Decimal("0.0")
    pricing_type: str
    pricing_percentage: Decimal
    target_selling_price: Optional[Decimal] = None
    suggested_price: Decimal
    suggested_product_price: Decimal = Decimal("0.0")
    suggested_delivered_price: Decimal = Decimal("0.0")
    profit_per_unit: Decimal
    total_expected_profit: Decimal
    equivalent_markup_or_margin: Decimal
    break_even_units: Optional[Decimal]
    break_even_ready: bool
    is_loss_making: bool
    bucket_breakdown: List[BucketBreakdownOutput]