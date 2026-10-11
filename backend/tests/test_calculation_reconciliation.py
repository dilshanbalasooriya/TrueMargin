import unittest
from decimal import Decimal

from app.schemas.calculation import (
    BucketInput,
    CalculationRequest,
    LineItemInput,
)
from app.services.calculation_service import calculate_cost_sheet


def calculate_bucket(
    declared_total: str,
    bucket_units: str,
    items: list[LineItemInput],
):
    request = CalculationRequest(
        units_produced=Decimal("10"),
        buckets=[
            BucketInput(
                type="material",
                label="Materials",
                declared_total=Decimal(declared_total),
                units_covered=Decimal(bucket_units),
                level=2,
                items=items,
            )
        ],
    )
    return calculate_cost_sheet(request).bucket_breakdown[0]


class TestUnitCoverageReconciliation(unittest.TestCase):
    def test_matches_when_cost_per_unit_matches_with_different_coverage(self):
        bucket = calculate_bucket(
            "30",
            "10",
            [
                LineItemInput(name="Rice", amount=Decimal("10"), units_covered=Decimal("10")),
                LineItemInput(name="Oil", amount=Decimal("10"), units_covered=Decimal("5")),
            ],
        )

        self.assertEqual(bucket.reconciliation_status, "matched")
        self.assertEqual(bucket.cost_per_unit, Decimal("3.0000"))

    def test_adds_unallocated_amount_using_bucket_coverage(self):
        bucket = calculate_bucket(
            "50",
            "10",
            [LineItemInput(name="Rice", amount=Decimal("10"), units_covered=Decimal("5"))],
        )

        self.assertEqual(bucket.reconciliation_status, "unallocated_added")
        self.assertEqual(bucket.items[-1].amount, Decimal("30.0000"))
        self.assertEqual(bucket.cost_per_unit, Decimal("5.0000"))

    def test_exceeded_total_is_expressed_at_bucket_coverage(self):
        bucket = calculate_bucket(
            "30",
            "10",
            [
                LineItemInput(name="Rice", amount=Decimal("20"), units_covered=Decimal("10")),
                LineItemInput(name="Oil", amount=Decimal("10"), units_covered=Decimal("2")),
            ],
        )

        self.assertEqual(bucket.reconciliation_status, "exceeded")
        self.assertEqual(bucket.effective_total, Decimal("70.0000"))
        self.assertEqual(bucket.cost_per_unit, Decimal("7.0000"))
