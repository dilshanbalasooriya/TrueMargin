from fastapi import APIRouter, status
from app.schemas.calculation import CalculationRequest, CalculationResponse
from app.services.calculation_service import calculate_cost_sheet

router = APIRouter(prefix="/calculation", tags=["Stateless Calculation Engine"])


@router.post(
    "/compute",
    response_model=CalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute unit costs and pricing metrics (Public)",
    description="Stateless endpoint for guest or real-time frontend calculations. Runs reconciliation and pricing logic."
)
def compute_calculation(payload: CalculationRequest) -> CalculationResponse:
    return calculate_cost_sheet(payload)