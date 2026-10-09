import uuid
from typing import List, Type, TypeVar
from fastapi import HTTPException, status
from sqlmodel import Session, select, SQLModel

from app.models import WorkspaceMember
from app.models.library import Material, Worker, Asset, CostPool
from app.schemas.library import (
    MaterialCreate,
    WorkerCreate,
    AssetCreate,
    CostPoolCreate,
)

T = TypeVar("T", bound=SQLModel)

class LibraryService:

    def verify_workspace_access(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, required_role: str, db: Session
    ) -> None:
        stmt = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        membership = db.exec(stmt).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this workspace.",
            )

        role_hierarchy = {"viewer": 1, "editor": 2, "owner": 3}
        if role_hierarchy.get(membership.role, 0) < role_hierarchy.get(required_role, 3):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires '{required_role}' permissions or higher.",
            )

    # Generic Helper for Listing Items
    def _list_workspace_items(self, model: Type[T], workspace_id: uuid.UUID, db: Session) -> List[T]:
        stmt = select(model).where(model.workspace_id == workspace_id)
        return db.exec(stmt).all()

    # Generic Helper for Deleting Items
    def _delete_item(self, model: Type[T], item_id: uuid.UUID, workspace_id: uuid.UUID, db: Session) -> None:
        item = db.get(model, item_id)
        if not item or item.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model.__name__} record not found in this workspace.",
            )
        db.delete(item)
        db.commit()

    # --- MATERIALS ---
    def create_material(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, payload: MaterialCreate, db: Session
    ) -> Material:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        material = Material(workspace_id=workspace_id, **payload.model_dump())
        db.add(material)
        db.commit()
        db.refresh(material)
        return material

    def list_materials(self, workspace_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> List[Material]:
        self.verify_workspace_access(workspace_id, user_id, "viewer", db)
        return self._list_workspace_items(Material, workspace_id, db)

    def delete_material(self, workspace_id: uuid.UUID, material_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        self._delete_item(Material, material_id, workspace_id, db)

    # --- WORKERS ---
    def create_worker(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, payload: WorkerCreate, db: Session
    ) -> Worker:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        worker = Worker(workspace_id=workspace_id, **payload.model_dump())
        db.add(worker)
        db.commit()
        db.refresh(worker)
        return worker

    def list_workers(self, workspace_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> List[Worker]:
        self.verify_workspace_access(workspace_id, user_id, "viewer", db)
        return self._list_workspace_items(Worker, workspace_id, db)

    def delete_worker(self, workspace_id: uuid.UUID, worker_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        self._delete_item(Worker, worker_id, workspace_id, db)

    # --- ASSETS ---
    def create_asset(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, payload: AssetCreate, db: Session
    ) -> Asset:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        asset = Asset(workspace_id=workspace_id, **payload.model_dump())
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def list_assets(self, workspace_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> List[Asset]:
        self.verify_workspace_access(workspace_id, user_id, "viewer", db)
        return self._list_workspace_items(Asset, workspace_id, db)

    def delete_asset(self, workspace_id: uuid.UUID, asset_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        self._delete_item(Asset, asset_id, workspace_id, db)

    # --- COST POOLS ---
    def create_cost_pool(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, payload: CostPoolCreate, db: Session
    ) -> CostPool:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        pool = CostPool(workspace_id=workspace_id, **payload.model_dump())
        db.add(pool)
        db.commit()
        db.refresh(pool)
        return pool

    def list_cost_pools(self, workspace_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> List[CostPool]:
        self.verify_workspace_access(workspace_id, user_id, "viewer", db)
        return self._list_workspace_items(CostPool, workspace_id, db)

    def delete_cost_pool(self, workspace_id: uuid.UUID, pool_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
        self.verify_workspace_access(workspace_id, user_id, "editor", db)
        self._delete_item(CostPool, pool_id, workspace_id, db)


library_service = LibraryService()