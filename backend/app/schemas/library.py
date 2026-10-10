import uuid
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MaterialCreate(BaseModel):
    name: str = Field(..., min_length=1)
    unit: str = Field(..., min_length=1)
    unit_price: Decimal
    supplier: Optional[str] = None
    notes: Optional[str] = None


class MaterialResponse(MaterialCreate):
    id: uuid.UUID
    workspace_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class WorkerCreate(BaseModel):
    name: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    pay_type: str = Field(default="hourly")
    rate: Decimal
    statutory_eligible: bool = True


class WorkerResponse(WorkerCreate):
    id: uuid.UUID
    workspace_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1)
    purchase_price: Decimal
    salvage_value: Decimal = Decimal("0")
    useful_life_years: Optional[Decimal] = Decimal("5")
    lifetime_capacity_units: Optional[Decimal] = None
    default_depreciation_method: str = "straight_line_time"


class AssetResponse(AssetCreate):
    id: uuid.UUID
    workspace_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class CostPoolCreate(BaseModel):
    name: str = Field(..., min_length=1)
    monthly_amount: Decimal
    business_use_pct: Decimal = Decimal("100")
    default_allocation_basis: str = "units_produced"


class CostPoolResponse(CostPoolCreate):
    id: uuid.UUID
    workspace_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)
