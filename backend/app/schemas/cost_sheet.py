import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

from app.schemas.calculation import CalculationRequest, BucketBreakdownOutput


class CostSheetCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, example="Standard Aluminium Window Frame")
    kind: Literal["product", "service"] = "product"
    unit_label: str = Field(..., min_length=1, example="piece, kg, hour, job")
    basis: Literal["batch", "monthly"] = Field(
        ...,
        description="Whether units_produced describes one batch or one month.",
    )
    currency_code: str = Field(default="LKR", min_length=3, max_length=3)
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    calculation_data: CalculationRequest

    @field_validator("unit_label")
    @classmethod
    def validate_unit_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("unit_label must not be blank.")
        return value


class VersionCreateRequest(BaseModel):
    change_note: Optional[str] = Field(None, example="Updated raw material flour price")
    currency_code: str = Field(default="LKR", min_length=3, max_length=3)
    calculation_data: CalculationRequest


class SheetVersionSummary(BaseModel):
    id: uuid.UUID
    version_number: int
    change_note: Optional[str]
    units_produced: Decimal
    defective_units: Decimal
    good_units: Decimal
    total_cost: Decimal
    unit_cost: Decimal
    currency_code: str = "LKR"
    created_at: datetime


class CostSheetResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    kind: str
    unit_label: str
    basis: str
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    current_version_id: Optional[uuid.UUID]
    archived_at: Optional[datetime]
    current_version: Optional[SheetVersionSummary] = None


class SheetVersionDetailResponse(SheetVersionSummary):
    sheet_id: uuid.UUID
    unit_label: str
    pricing_type: str
    pricing_percentage: Decimal
    target_selling_price: Optional[Decimal] = None
    cash_total_cost: Decimal = Decimal("0")
    economic_total_cost: Decimal = Decimal("0")
    cash_unit_cost: Decimal = Decimal("0")
    economic_unit_cost: Decimal = Decimal("0")
    cost_view: Literal["cash", "economic"] = "economic"
    default_units_covered_scope: Literal["all", "overhead_only"] = "all"
    suggested_price: Decimal
    profit_per_unit: Decimal
    total_expected_profit: Decimal
    equivalent_markup_or_margin: Decimal
    break_even_units: Optional[Decimal] = None
    is_loss_making: bool = False
    bucket_breakdown: List[BucketBreakdownOutput]


class BucketDelta(BaseModel):
    type: str
    label: str
    v1_cost_per_unit: Decimal
    v2_cost_per_unit: Decimal
    diff_cost_per_unit: Decimal
    percentage_change: Decimal


class VersionCompareResponse(BaseModel):
    sheet_id: uuid.UUID
    v1_version_number: int
    v2_version_number: int
    v1_unit_cost: Decimal
    v2_unit_cost: Decimal
    unit_cost_diff: Decimal
    bucket_deltas: List[BucketDelta]