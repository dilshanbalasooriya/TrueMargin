import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import CostSheet, SheetVersion, Bucket, LineItem, WorkspaceMember
from app.schemas.calculation import CalculationRequest, BucketInput, LineItemInput
from app.schemas.cost_sheet import (
    CostSheetCreateRequest,
    VersionCreateRequest,
    CostSheetResponse,
    SheetVersionSummary,
    SheetVersionDetailResponse,
    VersionCompareResponse,
    BucketDelta,
)
from app.services.calculation_service import calculate_cost_sheet


class CostSheetService:

    # --------------------------------------------------------------------------
    # TENANT ACCESS SECURITY GUARD
    # --------------------------------------------------------------------------
    def verify_sheet_access(
        self, sheet_id: uuid.UUID, user_id: uuid.UUID, required_role: str, db: Session
    ) -> CostSheet:
        """Ensures the sheet exists and the user belongs to its parent workspace with required permissions."""
        sheet = db.get(CostSheet, sheet_id)
        if not sheet or sheet.archived_at:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cost sheet not found or has been archived.",
            )

        stmt = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == sheet.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        membership = db.exec(stmt).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this cost sheet's workspace.",
            )

        role_hierarchy = {"viewer": 1, "editor": 2, "owner": 3}
        if role_hierarchy.get(membership.role, 0) < role_hierarchy.get(
            required_role, 3
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires '{required_role}' permission or higher.",
            )

        return sheet

    # --------------------------------------------------------------------------
    # COST SHEET CRUD & READS
    # --------------------------------------------------------------------------
    def create_cost_sheet(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: CostSheetCreateRequest,
        db: Session,
    ) -> CostSheetResponse:
        calc_result = calculate_cost_sheet(payload.calculation_data)

        sheet = CostSheet(
            workspace_id=workspace_id,
            name=payload.name,
            kind=payload.kind,
            unit_label=payload.unit_label,
            basis=payload.basis,
            period_start=payload.period_start,
            period_end=payload.period_end,
        )
        db.add(sheet)
        db.flush()

        version = self._persist_version(
            sheet_id=sheet.id,
            version_number=1,
            user_id=user_id,
            change_note="Initial version created",
            calc_result=calc_result,
            db=db,
        )

        sheet.current_version_id = version.id
        db.add(sheet)
        db.commit()
        db.refresh(sheet)

        return self._format_sheet_response(sheet, version)

    def delete_cost_sheet(
        self,
        sheet_id: uuid.UUID,
        user_id: uuid.UUID,
        permanent: bool,
        db: Session,
    ) -> None:
        """
        Deletes a cost sheet.
        - If permanent=False: Soft-deletes by setting archived_at timestamp.
        - If permanent=True: Hard-deletes sheet, versions, buckets, and line items completely.
        """
        # Security check: Ensure user has 'owner' or 'editor' permission on workspace
        sheet = self.verify_sheet_access(
            sheet_id=sheet_id,
            user_id=user_id,
            required_role="owner" if permanent else "editor",
            db=db,
        )

        if not permanent:
            # Soft delete: Archive sheet
            sheet.archived_at = datetime.now(timezone.utc)
            db.add(sheet)
            db.commit()
            return

        # Hard delete: Permanent purge across relational child trees
        # Step 1: Break parent foreign key cyclic reference
        sheet.current_version_id = None
        db.add(sheet)
        db.flush()

        # Step 2: Fetch all version IDs for this cost sheet
        version_stmt = select(SheetVersion.id).where(SheetVersion.sheet_id == sheet_id)
        version_ids = db.exec(version_stmt).all()

        if version_ids:
            # Step 3: Fetch all bucket IDs belonging to these versions
            bucket_stmt = select(Bucket.id).where(Bucket.version_id.in_(version_ids))
            bucket_ids = db.exec(bucket_stmt).all()

            if bucket_ids:
                # Step 4: Delete all line items
                line_item_stmt = select(LineItem).where(
                    LineItem.bucket_id.in_(bucket_ids)
                )
                for line_item in db.exec(line_item_stmt).all():
                    db.delete(line_item)

                # Step 5: Delete all buckets
                bucket_delete_stmt = select(Bucket).where(Bucket.id.in_(bucket_ids))
                for bucket in db.exec(bucket_delete_stmt).all():
                    db.delete(bucket)

            # Step 6: Delete all versions
            version_delete_stmt = select(SheetVersion).where(
                SheetVersion.id.in_(version_ids)
            )
            for version in db.exec(version_delete_stmt).all():
                db.delete(version)

        # Step 7: Delete parent cost sheet
        db.delete(sheet)
        db.commit()

    def get_workspace_sheets(
        self, workspace_id: uuid.UUID, db: Session
    ) -> List[CostSheetResponse]:
        stmt = select(CostSheet).where(
            CostSheet.workspace_id == workspace_id,
            CostSheet.archived_at == None,
        )
        sheets = db.exec(stmt).all()

        responses = []
        for sheet in sheets:
            current_v = (
                db.get(SheetVersion, sheet.current_version_id)
                if sheet.current_version_id
                else None
            )
            responses.append(self._format_sheet_response(sheet, current_v))
        return responses

    def get_sheet_by_id(
        self, sheet_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> CostSheetResponse:
        """NEW: Retrieve a single cost sheet by ID with security validation."""
        sheet = self.verify_sheet_access(sheet_id, user_id, "viewer", db)
        current_v = (
            db.get(SheetVersion, sheet.current_version_id)
            if sheet.current_version_id
            else None
        )
        return self._format_sheet_response(sheet, current_v)

    # --------------------------------------------------------------------------
    # VERSION MANAGEMENT
    # --------------------------------------------------------------------------
    def create_new_version(
        self,
        sheet_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: VersionCreateRequest,
        db: Session,
    ) -> SheetVersionDetailResponse:
        sheet = self.verify_sheet_access(sheet_id, user_id, "editor", db)

        stmt = (
            select(SheetVersion.version_number)
            .where(SheetVersion.sheet_id == sheet_id)
            .order_by(SheetVersion.version_number.desc())
        )
        latest_v_num = db.exec(stmt).first() or 0
        new_v_num = latest_v_num + 1

        calc_result = calculate_cost_sheet(payload.calculation_data)

        version = self._persist_version(
            sheet_id=sheet.id,
            version_number=new_v_num,
            user_id=user_id,
            change_note=payload.change_note or f"Version {new_v_num}",
            calc_result=calc_result,
            db=db,
        )

        sheet.current_version_id = version.id
        db.add(sheet)
        db.commit()

        return self.get_version_detail(version.id, user_id, db)

    def get_version_history(
        self, sheet_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> List[SheetVersionSummary]:
        """NEW: List version history summaries for a cost sheet."""
        self.verify_sheet_access(sheet_id, user_id, "viewer", db)

        stmt = (
            select(SheetVersion)
            .where(SheetVersion.sheet_id == sheet_id)
            .order_by(SheetVersion.version_number.desc())
        )
        versions = db.exec(stmt).all()

        summaries = []
        for v in versions:
            snap = v.totals_snapshot
            summaries.append(
                SheetVersionSummary(
                    id=v.id,
                    version_number=v.version_number,
                    change_note=v.change_note,
                    units_produced=v.units_produced,
                    defective_units=v.defective_units,
                    good_units=Decimal(str(snap.get("good_units", 0))),
                    total_cost=Decimal(str(snap.get("total_cost", 0))),
                    unit_cost=Decimal(str(snap.get("unit_cost", 0))),
                    created_at=v.created_at,
                )
            )
        return summaries

    def get_version_detail(
        self, version_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> SheetVersionDetailResponse:
        version = db.get(SheetVersion, version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version record not found.",
            )

        self.verify_sheet_access(version.sheet_id, user_id, "viewer", db)

        snap = version.totals_snapshot
        return SheetVersionDetailResponse(
            id=version.id,
            sheet_id=version.sheet_id,
            version_number=version.version_number,
            change_note=version.change_note,
            units_produced=version.units_produced,
            defective_units=version.defective_units,
            good_units=Decimal(str(snap.get("good_units", 0))),
            total_cost=Decimal(str(snap.get("total_cost", 0))),
            unit_cost=Decimal(str(snap.get("unit_cost", 0))),
            pricing_type=snap.get("pricing_type", "markup"),
            pricing_percentage=Decimal(str(snap.get("pricing_percentage", 0))),
            suggested_price=Decimal(str(snap.get("suggested_price", 0))),
            profit_per_unit=Decimal(str(snap.get("profit_per_unit", 0))),
            total_expected_profit=Decimal(str(snap.get("total_expected_profit", 0))),
            equivalent_markup_or_margin=Decimal(
                str(snap.get("equivalent_markup_or_margin", 0))
            ),
            created_at=version.created_at,
            bucket_breakdown=snap.get("bucket_breakdown", []),
        )

    def compare_versions(
        self, v1_id: uuid.UUID, v2_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> VersionCompareResponse:
        v1 = db.get(SheetVersion, v1_id)
        v2 = db.get(SheetVersion, v2_id)
        if not v1 or not v2:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or both versions were not found.",
            )

        self.verify_sheet_access(v1.sheet_id, user_id, "viewer", db)

        snap1 = v1.totals_snapshot
        snap2 = v2.totals_snapshot

        u_cost1 = Decimal(str(snap1.get("unit_cost", 0)))
        u_cost2 = Decimal(str(snap2.get("unit_cost", 0)))
        unit_diff = u_cost2 - u_cost1

        b1_map = {
            b["type"]: Decimal(str(b["cost_per_unit"]))
            for b in snap1.get("bucket_breakdown", [])
        }
        b2_map = {
            b["type"]: Decimal(str(b["cost_per_unit"]))
            for b in snap2.get("bucket_breakdown", [])
        }

        all_types = set(b1_map.keys()).union(set(b2_map.keys()))
        deltas: List[BucketDelta] = []

        for b_type in sorted(all_types):
            cpu1 = b1_map.get(b_type, Decimal("0.0"))
            cpu2 = b2_map.get(b_type, Decimal("0.0"))
            diff = cpu2 - cpu1
            pct = ((diff / cpu1) * Decimal("100.0")) if cpu1 > 0 else Decimal("0.0")

            deltas.append(
                BucketDelta(
                    type=b_type,
                    label=b_type.capitalize(),
                    v1_cost_per_unit=cpu1,
                    v2_cost_per_unit=cpu2,
                    diff_cost_per_unit=diff,
                    percentage_change=pct.quantize(Decimal("0.01")),
                )
            )

        return VersionCompareResponse(
            sheet_id=v1.sheet_id,
            v1_version_number=v1.version_number,
            v2_version_number=v2.version_number,
            v1_unit_cost=u_cost1,
            v2_unit_cost=u_cost2,
            unit_cost_diff=unit_diff,
            bucket_deltas=deltas,
        )

    def restore_version(
        self,
        sheet_id: uuid.UUID,
        version_id: uuid.UUID,
        user_id: uuid.UUID,
        db: Session,
    ) -> SheetVersionDetailResponse:
        """Copies older version state and appends as new version with correct input schema transformation."""
        self.verify_sheet_access(sheet_id, user_id, "editor", db)

        target_v = db.get(SheetVersion, version_id)
        if not target_v or target_v.sheet_id != sheet_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target version to restore was not found.",
            )

        snap = target_v.totals_snapshot

        # MAP OUTPUT SCHEMA BACK TO INPUT SCHEMA TO PREVENT VALIDATION FAILURE
        transformed_buckets: List[BucketInput] = []
        for b in snap.get("bucket_breakdown", []):
            transformed_items: List[LineItemInput] = []
            for item in b.get("items", []):
                # Omit auto-generated unallocated lines during restore so engine re-reconciles fresh
                if item.get("kind") == "system_unallocated":
                    continue

                transformed_items.append(
                    LineItemInput(
                        name=item["name"],
                        quantity=Decimal(str(item.get("quantity", 1))),
                        unit=item.get("unit"),
                        unit_price=Decimal(str(item.get("unit_price", 0))),
                        amount=Decimal(str(item.get("amount", 0))),
                        units_covered=(
                            Decimal(str(item.get("units_covered", 0)))
                            if item.get("units_covered")
                            else None
                        ),
                        kind=item.get("kind", "user"),
                        pinned=item.get("pinned", False),
                        details=item.get("details", {}),
                    )
                )

            transformed_buckets.append(
                BucketInput(
                    type=b["type"],
                    label=b["label"],
                    declared_total=Decimal(str(b.get("declared_total", 0))),
                    units_covered=(
                        Decimal(str(b.get("units_covered", 0)))
                        if b.get("units_covered")
                        else None
                    ),
                    level=b.get("level", 1),
                    method=b.get("method"),
                    hidden=b.get("hidden", False),
                    items=transformed_items,
                )
            )

        calc_payload = CalculationRequest(
            units_produced=target_v.units_produced,
            defective_units=target_v.defective_units,
            pricing_type=snap.get("pricing_type", "markup"),
            pricing_percentage=Decimal(str(snap.get("pricing_percentage", 0))),
            buckets=transformed_buckets,
        )

        req = VersionCreateRequest(
            change_note=f"Restored from Version {target_v.version_number}",
            calculation_data=calc_payload,
        )
        return self.create_new_version(sheet_id, user_id, req, db)

    def archive_sheet(
        self, sheet_id: uuid.UUID, user_id: uuid.UUID, db: Session
    ) -> None:
        sheet = self.verify_sheet_access(sheet_id, user_id, "owner", db)
        sheet.archived_at = datetime.now(timezone.utc)
        db.add(sheet)
        db.commit()

    # --------------------------------------------------------------------------
    # PRIVATE PERSISTENCE & FORMATTING HELPERS
    # --------------------------------------------------------------------------
    def _persist_version(
        self,
        sheet_id: uuid.UUID,
        version_number: int,
        user_id: uuid.UUID,
        change_note: str,
        calc_result,
        db: Session,
    ) -> SheetVersion:
        version = SheetVersion(
            sheet_id=sheet_id,
            version_number=version_number,
            change_note=change_note,
            units_produced=calc_result.units_produced,
            defective_units=calc_result.defective_units,
            totals_snapshot=calc_result.model_dump(mode="json"),
            created_by=user_id,
        )
        db.add(version)
        db.flush()

        for b_out in calc_result.bucket_breakdown:
            bucket = Bucket(
                version_id=version.id,
                type=b_out.type,
                label=b_out.label,
                declared_total=b_out.declared_total,
                units_covered=b_out.units_covered,
                effective_total=b_out.effective_total,
                level=b_out.level,
                method=b_out.method,
                hidden=b_out.hidden,
            )
            db.add(bucket)
            db.flush()

            for item in b_out.items:
                line = LineItem(
                    bucket_id=bucket.id,
                    name=item.name,
                    quantity=item.quantity,
                    unit=item.unit,
                    unit_price=item.unit_price,
                    amount=item.amount,
                    units_covered=item.units_covered,
                    kind=item.kind,
                    pinned=item.pinned,
                    details=item.details,
                )
                db.add(line)

        return version

    def _format_sheet_response(
        self, sheet: CostSheet, current_version: Optional[SheetVersion]
    ) -> CostSheetResponse:
        v_summary = None
        if current_version:
            snap = current_version.totals_snapshot
            v_summary = SheetVersionSummary(
                id=current_version.id,
                version_number=current_version.version_number,
                change_note=current_version.change_note,
                units_produced=current_version.units_produced,
                defective_units=current_version.defective_units,
                good_units=Decimal(str(snap.get("good_units", 0))),
                total_cost=Decimal(str(snap.get("total_cost", 0))),
                unit_cost=Decimal(str(snap.get("unit_cost", 0))),
                created_at=current_version.created_at,
            )

        return CostSheetResponse(
            id=sheet.id,
            workspace_id=sheet.workspace_id,
            name=sheet.name,
            kind=sheet.kind,
            unit_label=sheet.unit_label,
            basis=sheet.basis,
            period_start=sheet.period_start,
            period_end=sheet.period_end,
            current_version_id=sheet.current_version_id,
            archived_at=sheet.archived_at,
            current_version=v_summary,
        )


cost_sheet_service = CostSheetService()
