import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship, Column, Numeric, JSON


# ==============================================================================
# 1. CORE SYSTEM & AUTHENTICATION MODELS
# ==============================================================================

class Profile(SQLModel, table=True):
    __tablename__ = "profiles"

    id: uuid.UUID = Field(primary_key=True, description="Matches Supabase auth.users ID")
    display_name: str
    country: Optional[str] = Field(default="LK")
    currency: Optional[str] = Field(default="LKR")
    rounding_preference: Optional[int] = Field(default=2)


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="profiles.id")
    name: str
    country: str = Field(default="LK")
    currency: str = Field(default="LKR")

    sheets: List["CostSheet"] = Relationship(back_populates="workspace")


class WorkspaceMember(SQLModel, table=True):
    __tablename__ = "workspace_members"

    workspace_id: uuid.UUID = Field(foreign_key="workspaces.id", primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="profiles.id", primary_key=True)
    role: str = Field(default="viewer")  # 'owner', 'editor', 'viewer'


# ==============================================================================
# 2. COST SHEET & IMMUTABLE VERSIONING MODELS
# ==============================================================================

class CostSheet(SQLModel, table=True):
    __tablename__ = "cost_sheets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    workspace_id: uuid.UUID = Field(foreign_key="workspaces.id", index=True)
    name: str
    kind: str = Field(default="product")  # 'product' or 'service'
    unit_label: Optional[str] = Field(default="unit")
    basis: str = Field(default="batch")  # 'batch' or 'period'
    period_start: Optional[datetime] = Field(default=None)
    period_end: Optional[datetime] = Field(default=None)
    current_version_id: Optional[uuid.UUID] = Field(default=None)
    archived_at: Optional[datetime] = Field(default=None)

    workspace: Workspace = Relationship(back_populates="sheets")
    versions: List["SheetVersion"] = Relationship(back_populates="sheet")


class SheetVersion(SQLModel, table=True):
    __tablename__ = "sheet_versions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sheet_id: uuid.UUID = Field(foreign_key="cost_sheets.id", index=True)
    version_number: int
    change_note: Optional[str] = Field(default=None)
    units_produced: Decimal = Field(sa_column=Column(Numeric(14, 4)))
    defective_units: Decimal = Field(default=0, sa_column=Column(Numeric(14, 4)))

    # JSONB snapshot of all calculated outputs & inputs for instant rendering
    totals_snapshot: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    created_by: uuid.UUID = Field(foreign_key="profiles.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    sheet: CostSheet = Relationship(back_populates="versions")
    buckets: List["Bucket"] = Relationship(back_populates="version")


class Bucket(SQLModel, table=True):
    __tablename__ = "buckets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    version_id: uuid.UUID = Field(foreign_key="sheet_versions.id", index=True)
    type: str  # material, labor, transport, overhead, machinery, custom
    label: str

    declared_total: Decimal = Field(default=0, sa_column=Column(Numeric(14, 4)))
    units_covered: Decimal = Field(sa_column=Column(Numeric(14, 4)))
    effective_total: Decimal = Field(default=0, sa_column=Column(Numeric(14, 4)))

    level: int = Field(default=1)  # 1, 2, or 3
    method: Optional[str] = Field(default=None)
    hidden: bool = Field(default=False)

    version: SheetVersion = Relationship(back_populates="buckets")
    line_items: List["LineItem"] = Relationship(back_populates="bucket")


class LineItem(SQLModel, table=True):
    __tablename__ = "line_items"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    bucket_id: uuid.UUID = Field(foreign_key="buckets.id", index=True)
    name: str
    quantity: Decimal = Field(default=1, sa_column=Column(Numeric(14, 4)))
    unit: Optional[str] = Field(default=None)
    unit_price: Decimal = Field(default=0, sa_column=Column(Numeric(14, 4)))
    amount: Decimal = Field(default=0, sa_column=Column(Numeric(14, 4)))
    units_covered: Decimal = Field(sa_column=Column(Numeric(14, 4)))

    kind: str = Field(default="user")  # 'user' or 'system_unallocated'
    pinned: bool = Field(default=False)
    sort_order: int = Field(default=0)

    # JSON details for Level 3 calculations (depreciation parameters, EPF/ETF statutory flags, etc.)
    details: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    bucket: Bucket = Relationship(back_populates="line_items")


# ==============================================================================
# 3. WORKSPACE REUSABLE LIBRARIES (CATALOG)
# ==============================================================================

class Material(SQLModel, table=True):
    __tablename__ = "materials"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    workspace_id: uuid.UUID = Field(foreign_key="workspaces.id", index=True)
    name: str
    unit: str  # e.g., kg, meter, liter, sheet
    unit_price: Decimal = Field(sa_column=Column(Numeric(14, 4)))
    supplier: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)


class Worker(SQLModel, table=True):
    __tablename__ = "workers"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    workspace_id: uuid.UUID = Field(foreign_key="workspaces.id", index=True)
    name: str
    role: str
    pay_type: str = Field(default="hourly")  # 'hourly', 'monthly', 'piece_rate'
    rate: Decimal = Field(sa_column=Column(Numeric(14, 4)))
    statutory_eligible: bool = Field(default=True)


class Asset(SQLModel, table=True):
    __tablename__ = "assets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    workspace_id: uuid.UUID = Field(foreign_key="workspaces.id", index=True)
    name: str
    purchase_price: Decimal = Field(sa_column=Column(Numeric(14, 4)))
    salvage_value: Decimal = Field(default=0, sa_column=Column(Numeric(14, 4)))
    useful_life_years: Optional[Decimal] = Field(default=5, sa_column=Column(Numeric(6, 2)))
    lifetime_capacity_units: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(14, 4)))
    default_depreciation_method: str = Field(default="straight_line_time")


class CostPool(SQLModel, table=True):
    __tablename__ = "cost_pools"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    workspace_id: uuid.UUID = Field(foreign_key="workspaces.id", index=True)
    name: str  # e.g., Factory Rent, Electricity, Software Subscriptions
    monthly_amount: Decimal = Field(sa_column=Column(Numeric(14, 4)))
    business_use_pct: Decimal = Field(default=100, sa_column=Column(Numeric(5, 2)))
    default_allocation_basis: str = Field(default="units_produced")