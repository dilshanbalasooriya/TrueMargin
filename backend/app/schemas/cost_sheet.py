import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.calculation import CalculationRequest, BucketBreakdownOutput


class CostSheetCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, example="Standard Aluminium Window Frame")
    kind: str = Field(default="product", description="'product' or 'service'")
    unit_label: str = Field(default="unit", example="unit, kg, hour, job")
    basis: str = Field(default="batch", description="'batch' or 'period'")
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    calculation_data: CalculationRequest


class VersionCreateRequest(BaseModel):
    change_note: Optional[str] = Field(None, example="Updated raw material flour price")
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
    pricing_type: str
    pricing_percentage: Decimal
    suggested_price: Decimal
    profit_per_unit: Decimal
    total_expected_profit: Decimal
    equivalent_markup_or_margin: Decimal
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