import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.api.v1.dependencies import get_db, get_current_user_id
from app.schemas.library import (
    MaterialCreate, MaterialResponse,
    WorkerCreate, WorkerResponse,
    AssetCreate, AssetResponse,
    CostPoolCreate, CostPoolResponse,
)
from app.services.library_service import library_service

router = APIRouter(prefix="/workspaces/{workspace_id}/library", tags=["Workspace Reusable Libraries"])

# --- MATERIALS ROUTES ---
@router.post("/materials", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(
    workspace_id: uuid.UUID, payload: MaterialCreate,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> MaterialResponse:
    return library_service.create_material(workspace_id, user_id, payload, db)

@router.get("/materials", response_model=List[MaterialResponse])
def list_materials(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> List[MaterialResponse]:
    return library_service.list_materials(workspace_id, user_id, db)

@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    workspace_id: uuid.UUID, material_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    library_service.delete_material(workspace_id, material_id, user_id, db)

# --- WORKERS ROUTES ---
@router.post("/workers", response_model=WorkerResponse, status_code=status.HTTP_201_CREATED)
def create_worker(
    workspace_id: uuid.UUID, payload: WorkerCreate,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> WorkerResponse:
    return library_service.create_worker(workspace_id, user_id, payload, db)

@router.get("/workers", response_model=List[WorkerResponse])
def list_workers(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> List[WorkerResponse]:
    return library_service.list_workers(workspace_id, user_id, db)

@router.delete("/workers/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_worker(
    workspace_id: uuid.UUID, worker_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    library_service.delete_worker(workspace_id, worker_id, user_id, db)

# --- ASSETS ROUTES ---
@router.post("/assets", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    workspace_id: uuid.UUID, payload: AssetCreate,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> AssetResponse:
    return library_service.create_asset(workspace_id, user_id, payload, db)

@router.get("/assets", response_model=List[AssetResponse])
def list_assets(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> List[AssetResponse]:
    return library_service.list_assets(workspace_id, user_id, db)

@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    workspace_id: uuid.UUID, asset_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    library_service.delete_asset(workspace_id, asset_id, user_id, db)

# --- COST POOLS ROUTES ---
@router.post("/cost-pools", response_model=CostPoolResponse, status_code=status.HTTP_201_CREATED)
def create_cost_pool(
    workspace_id: uuid.UUID, payload: CostPoolCreate,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> CostPoolResponse:
    return library_service.create_cost_pool(workspace_id, user_id, payload, db)

@router.get("/cost-pools", response_model=List[CostPoolResponse])
def list_cost_pools(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> List[CostPoolResponse]:
    return library_service.list_cost_pools(workspace_id, user_id, db)

@router.delete("/cost-pools/{pool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_pool(
    workspace_id: uuid.UUID, pool_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    library_service.delete_cost_pool(workspace_id, pool_id, user_id, db)