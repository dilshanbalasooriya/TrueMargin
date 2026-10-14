from decimal import Decimal
import unittest

from app.schemas.calculation import (
    BucketInput,
    CalculationRequest,
    LineItemInput,
)
from app.services.calculation_service import calculate_cost_sheet
from app.services.unit_converter import (
    convert_units,
    are_units_compatible,
    calculate_recipe_coverage,
    normalize_unit,
)


class TestRecipeBOMCalculation(unittest.TestCase):
    def test_unit_converter_weight(self):
        # 50 kg to g -> 50,000 g
        self.assertEqual(convert_units(Decimal("50"), "kg", "g"), Decimal("50000"))
        # 250 g to kg -> 0.25 kg
        self.assertEqual(convert_units(Decimal("250"), "g", "kg"), Decimal("0.25"))

    def test_unit_converter_volume(self):
        # 4 Liters to ml -> 4,000 ml
        self.assertEqual(convert_units(Decimal("4"), "l", "ml"), Decimal("4000"))
        # 250 ml to l -> 0.25 l
        self.assertEqual(convert_units(Decimal("250"), "ml", "l"), Decimal("0.25"))

    def test_unit_converter_length(self):
        # 50 m to cm -> 5,000 cm
        self.assertEqual(convert_units(Decimal("50"), "m", "cm"), Decimal("5000"))

    def test_unit_compatibility(self):
        self.assertTrue(are_units_compatible("kg", "g"))
        self.assertTrue(are_units_compatible("l", "ml"))
        self.assertTrue(are_units_compatible("m", "cm"))
        self.assertFalse(are_units_compatible("kg", "l"))
        self.assertFalse(are_units_compatible("m", "g"))

    def test_recipe_coverage_calculation(self):
        # 50 kg flour purchase, 250 g per cake -> 200 cakes
        coverage = calculate_recipe_coverage(
            purchase_quantity=Decimal("50"),
            purchase_unit="kg",
            usage_quantity=Decimal("250"),
            usage_unit="g",
        )
        self.assertEqual(coverage, Decimal("200"))

        # 4 L paint purchase, 200 ml per chair -> 20 chairs
        coverage = calculate_recipe_coverage(
            purchase_quantity=Decimal("4"),
            purchase_unit="l",
            usage_quantity=Decimal("200"),
            usage_unit="ml",
        )
        self.assertEqual(coverage, Decimal("20"))

    def test_recipe_calculation_in_cost_sheet(self):
        """
        User enters:
        Flour: 50 kg bought for LKR 10,000. Usage per cake: 250 g.
        Sugar: 10 kg bought for LKR 3,000. Usage per cake: 100 g.
        Production batch: 100 cakes.
        """
        request = CalculationRequest(
            unit_label="cake",
            units_produced=Decimal("100"),
            default_units_covered_scope="all",
            buckets=[
                BucketInput(
                    type="material",
                    label="Materials",
                    declared_total=Decimal("0"),
                    level=2,
                    items=[
                        LineItemInput(
                            name="Flour",
                            quantity=Decimal("50"),
                            unit="kg",
                            amount=Decimal("10000"),
                            details={
                                "method": "recipe",
                                "usage_quantity": "250",
                                "usage_unit": "g",
                            },
                        ),
                        LineItemInput(
                            name="Sugar",
                            quantity=Decimal("10"),
                            unit="kg",
                            amount=Decimal("3000"),
                            details={
                                "method": "recipe",
                                "usage_quantity": "100",
                                "usage_unit": "g",
                            },
                        ),
                    ],
                )
            ],
        )

        response = calculate_cost_sheet(request)
        material_bucket = response.bucket_breakdown[0]

        # Flour: 50,000g / 250g = 200 cakes covered. Cost = 10,000 / 200 = LKR 50.00 / cake.
        flour_item = material_bucket.items[0]
        self.assertEqual(flour_item.units_covered, Decimal("200.0000"))
        self.assertEqual(flour_item.cost_per_unit, Decimal("50.0000"))
        self.assertEqual(flour_item.details["calculated_coverage"], "200.0000")
        self.assertEqual(flour_item.details["cost_per_recipe_unit"], "50.0000")

        # Sugar: 10,000g / 100g = 100 cakes covered. Cost = 3,000 / 100 = LKR 30.00 / cake.
        sugar_item = material_bucket.items[1]
        self.assertEqual(sugar_item.units_covered, Decimal("100.0000"))
        self.assertEqual(sugar_item.cost_per_unit, Decimal("30.0000"))
        self.assertEqual(sugar_item.details["calculated_coverage"], "100.0000")
        self.assertEqual(sugar_item.details["cost_per_recipe_unit"], "30.0000")

        # Total unit cost = 50 + 30 = LKR 80.00 per cake
        self.assertEqual(response.unit_cost, Decimal("80.0000"))
        # Total cost for 100 cakes = 80 * 100 = LKR 8,000.00
        self.assertEqual(response.total_cost, Decimal("8000.0000"))

    def test_recipe_with_wastage(self):
        """Recipe calculation combined with 5% ingredient wastage."""
        request = CalculationRequest(
            unit_label="cake",
            units_produced=Decimal("100"),
            default_units_covered_scope="all",
            buckets=[
                BucketInput(
                    type="material",
                    label="Materials",
                    declared_total=Decimal("0"),
                    level=2,
                    items=[
                        LineItemInput(
                            name="Flour",
                            quantity=Decimal("50"),
                            unit="kg",
                            amount=Decimal("10000"),
                            details={
                                "method": "recipe",
                                "usage_quantity": "250",
                                "usage_unit": "g",
                                "wastage_percentage": "5",
                            },
                        )
                    ],
                )
            ],
        )

        response = calculate_cost_sheet(request)
        flour_item = response.bucket_breakdown[0].items[0]

        # Base CPU = 50. With 5% wastage: 50 / (1 - 0.05) = 52.6316
        expected_cpu = (Decimal("10000") / Decimal("0.95")) / Decimal("200")
        self.assertAlmostEqual(float(flour_item.cost_per_unit), float(expected_cpu), places=4)

    def test_incompatible_recipe_units_raises_error(self):
        """Passing kg for purchase and ml for usage without conversion must raise ValueError."""
        with self.assertRaises(ValueError) as ctx:
            LineItemInput(
                name="Flour",
                quantity=Decimal("50"),
                unit="kg",
                amount=Decimal("10000"),
                details={
                    "method": "recipe",
                    "usage_quantity": "250",
                    "usage_unit": "ml",  # Incompatible with kg!
                },
            )
        self.assertIn("Incompatible recipe units", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
