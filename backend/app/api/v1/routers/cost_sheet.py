import uuid
from typing import List
from fastapi import APIRouter, Depends, status, Query
from sqlmodel import Session

from app.api.v1.dependencies import get_db, get_current_user_id, WorkspaceAccess
from app.models import Workspace
from app.schemas.cost_sheet import (
    CostSheetCreateRequest,
    VersionCreateRequest,
    CostSheetResponse,
    SheetVersionSummary,
    SheetVersionDetailResponse,
    VersionCompareResponse,
)
from app.services.cost_sheet_service import cost_sheet_service

router = APIRouter(tags=["Cost Sheets & Versioning"])


@router.post(
    "/workspaces/{workspace_id}/cost-sheets",
    response_model=CostSheetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create cost sheet & Version 1 (Draft Claiming)",
)
def create_cost_sheet(
    workspace_id: uuid.UUID,
    payload: CostSheetCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    workspace: Workspace = Depends(WorkspaceAccess(required_role="editor")),
    db: Session = Depends(get_db),
) -> CostSheetResponse:
    return cost_sheet_service.create_cost_sheet(workspace_id, user_id, payload, db)


@router.get(
    "/workspaces/{workspace_id}/cost-sheets",
    response_model=List[CostSheetResponse],
    status_code=status.HTTP_200_OK,
    summary="List all active cost sheets in workspace",
)
def list_cost_sheets(
    workspace_id: uuid.UUID,
    workspace: Workspace = Depends(WorkspaceAccess(required_role="viewer")),
    db: Session = Depends(get_db),
) -> List[CostSheetResponse]:
    return cost_sheet_service.get_workspace_sheets(workspace_id, db)


@router.get(
    "/cost-sheets/{sheet_id}",
    response_model=CostSheetResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single cost sheet metadata & active version summary",
)
def get_cost_sheet_by_id(
    sheet_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> CostSheetResponse:
    return cost_sheet_service.get_sheet_by_id(sheet_id, user_id, db)


@router.post(
    "/cost-sheets/{sheet_id}/versions",
    response_model=SheetVersionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new version for an existing cost sheet",
)
def create_new_version(
    sheet_id: uuid.UUID,
    payload: VersionCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> SheetVersionDetailResponse:
    return cost_sheet_service.create_new_version(sheet_id, user_id, payload, db)


@router.get(
    "/cost-sheets/{sheet_id}/versions",
    response_model=List[SheetVersionSummary],
    status_code=status.HTTP_200_OK,
    summary="List version history summaries for a cost sheet",
)
def list_version_history(
    sheet_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> List[SheetVersionSummary]:
    return cost_sheet_service.get_version_history(sheet_id, user_id, db)


@router.get(
    "/cost-sheets/versions/{version_id}",
    response_model=SheetVersionDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed snapshot of a specific version",
)
def get_version_detail(
    version_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> SheetVersionDetailResponse:
    return cost_sheet_service.get_version_detail(version_id, user_id, db)


@router.get(
    "/cost-sheets/versions/compare",
    response_model=VersionCompareResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare two versions side-by-side",
)
def compare_versions(
    v1_id: uuid.UUID = Query(...),
    v2_id: uuid.UUID = Query(...),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> VersionCompareResponse:
    return cost_sheet_service.compare_versions(v1_id, v2_id, user_id, db)


@router.post(
    "/cost-sheets/{sheet_id}/versions/{version_id}/restore",
    response_model=SheetVersionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Restore an old version as the latest version",
)
def restore_version(
    sheet_id: uuid.UUID,
    version_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> SheetVersionDetailResponse:
    return cost_sheet_service.restore_version(sheet_id, version_id, user_id, db)


@router.delete(
    "/cost-sheets/{sheet_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete or archive a cost sheet",
    description=(
        "Soft-archives a sheet by default. Pass ?permanent=true to permanently purge "
        "the cost sheet and all associated versions, buckets, and line items."
    ),
)
def delete_cost_sheet(
    sheet_id: uuid.UUID,
    permanent: bool = Query(
        default=False,
        description="Set to true for permanent hard delete, or false for soft archive.",
    ),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    cost_sheet_service.delete_cost_sheet(sheet_id, user_id, permanent, db)
    return None