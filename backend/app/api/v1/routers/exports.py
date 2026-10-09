import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session

from app.api.v1.dependencies import get_db, get_current_user_id
from app.services.export_service import export_service

router = APIRouter(tags=["Exports & Documentation"])


@router.get(
    "/cost-sheets/versions/{version_id}/export/csv",
    status_code=status.HTTP_200_OK,
    summary="Export version breakdown to CSV file",
)
def export_version_csv(
    version_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return export_service.generate_csv_export(version_id, user_id, db)


@router.get(
    "/cost-sheets/versions/{version_id}/export/pdf",
    status_code=status.HTTP_200_OK,
    summary="Generate print-ready document view for PDF export",
)
def export_version_pdf(
    version_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Response:
    return export_service.generate_html_summary(version_id, user_id, db)