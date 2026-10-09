from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class LineItemInput(BaseModel):
    name: str
    quantity: Decimal = Field(default=Decimal("1.0"))
    unit: Optional[str] = None
    unit_price: Decimal = Field(default=Decimal("0.0"))
    amount: Optional[Decimal] = None  # Explicit amount or calculated from qty * unit_price
    units_covered: Optional[Decimal] = None
    kind: str = "user"  # 'user' or 'system_unallocated'
    pinned: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)


class BucketInput(BaseModel):
    type: str  # material, labor, transport, overhead, machinery, custom
    label: str
    declared_total: Decimal = Field(default=Decimal("0.0"))
    units_covered: Optional[Decimal] = None
    level: int = Field(default=1, ge=1, le=3)
    method: Optional[str] = None
    hidden: bool = False
    items: List[LineItemInput] = Field(default_factory=list)


class CalculationRequest(BaseModel):
    units_produced: Decimal = Field(gt=0, description="Total units manufactured/delivered")
    defective_units: Decimal = Field(default=Decimal("0.0"), ge=0, description="Scrap or defective units")
    buckets: List[BucketInput]
    pricing_type: str = Field(default="markup", description="'markup' or 'margin'")
    pricing_percentage: Decimal = Field(default=Decimal("0.0"), ge=0)

    @field_validator("defective_units")
    @classmethod
    def validate_defects(cls, v: Decimal, info) -> Decimal:
        units_produced = info.data.get("units_produced")
        if units_produced is not None and v >= units_produced:
            raise ValueError("Defective units must be strictly less than total units produced.")
        return v

    @field_validator("pricing_percentage")
    @classmethod
    def validate_pricing(cls, v: Decimal, info) -> Decimal:
        pricing_type = info.data.get("pricing_type")
        if pricing_type == "margin" and v >= Decimal("100.0"):
            raise ValueError("Margin percentage must be strictly less than 100%.")
        return v


class LineItemOutput(BaseModel):
    name: str
    quantity: Decimal
    unit: Optional[str]
    unit_price: Decimal
    amount: Decimal
    units_covered: Decimal
    cost_per_unit: Decimal
    kind: str
    pinned: bool
    details: Dict[str, Any]


class BucketBreakdownOutput(BaseModel):
    type: str
    label: str
    level: int
    method: Optional[str]
    hidden: bool
    declared_total: Decimal
    effective_total: Decimal
    units_covered: Decimal
    cost_per_unit: Decimal
    percentage_of_total: Decimal
    reconciliation_status: str  # 'no_items', 'matched', 'unallocated_added', 'exceeded'
    items: List[LineItemOutput]


class CalculationResponse(BaseModel):
    units_produced: Decimal
    defective_units: Decimal
    good_units: Decimal
    total_cost: Decimal
    unit_cost: Decimal
    pricing_type: str
    pricing_percentage: Decimal
    suggested_price: Decimal
    profit_per_unit: Decimal
    total_expected_profit: Decimal
    equivalent_markup_or_margin: Decimal
    bucket_breakdown: List[BucketBreakdownOutput]