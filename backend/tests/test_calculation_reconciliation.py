import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
import uuid
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWKClientConnectionError
from pydantic import ValidationError

from app.schemas.calculation import (
    BucketInput,
    CalculationRequest,
    LineItemInput,
)
from app.schemas.cost_sheet import CostSheetCreateRequest
from app.services.calculation_service import calculate_cost_sheet
from app.api.v1.dependencies import get_current_user_id


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
        default_units_covered_scope="all",
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
        self.assertEqual(bucket.itemized_total, Decimal("30.0000"))
        self.assertEqual(bucket.itemization_percentage, Decimal("100.0000"))

    def test_adds_unallocated_amount_using_bucket_coverage(self):
        bucket = calculate_bucket(
            "50",
            "10",
            [LineItemInput(name="Rice", amount=Decimal("10"), units_covered=Decimal("5"))],
        )

        self.assertEqual(bucket.reconciliation_status, "unallocated_added")
        self.assertEqual(bucket.items[-1].amount, Decimal("30.0000"))
        self.assertEqual(bucket.cost_per_unit, Decimal("5.0000"))
        self.assertEqual(bucket.itemized_total, Decimal("20.0000"))
        self.assertEqual(bucket.itemization_percentage, Decimal("40.0000"))

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
        self.assertEqual(bucket.itemized_total, Decimal("70.0000"))
        self.assertEqual(bucket.itemization_percentage, Decimal("100.0000"))

    def test_quantity_and_unit_price_are_included_in_itemized_total(self):
        bucket = calculate_bucket(
            "12",
            "10",
            [
                LineItemInput(
                    name="Material",
                    quantity=Decimal("3"),
                    unit_price=Decimal("4"),
                ),
            ],
        )

        self.assertEqual(bucket.reconciliation_status, "matched")
        self.assertEqual(bucket.items[0].amount, Decimal("12.0000"))
        self.assertEqual(bucket.itemized_total, Decimal("12.0000"))

    def test_purchase_quantity_and_unit_are_preserved_for_amount_entries(self):
        bucket = calculate_bucket(
            "12",
            "10",
            [
                LineItemInput(
                    name="Rice",
                    quantity=Decimal("3"),
                    unit="kg",
                    amount=Decimal("12"),
                    details={"wastage_percentage": "10"},
                ),
            ],
        )

        self.assertEqual(bucket.items[0].quantity, Decimal("3.0000"))
        self.assertEqual(bucket.items[0].unit, "kg")
        self.assertEqual(bucket.items[0].unit_price, Decimal("4.0000"))


class TestAuthenticationTokenVerification(unittest.TestCase):
    def credentials(self, token: str = "token") -> HTTPAuthorizationCredentials:
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    @patch("app.api.v1.dependencies.jwt.decode", return_value={"sub": str(uuid.uuid4())})
    @patch(
        "app.api.v1.dependencies.jwks_client.get_signing_key_from_jwt",
        return_value=SimpleNamespace(key="public-key"),
    )
    @patch(
        "app.api.v1.dependencies.jwt.get_unverified_header",
        return_value={"alg": "RS256"},
    )
    def test_verifies_asymmetric_token_using_jwks(
        self,
        header,
        get_signing_key,
        decode,
    ):
        user_id = get_current_user_id(self.credentials())

        self.assertIsInstance(user_id, uuid.UUID)
        self.assertEqual(header.return_value, {"alg": "RS256"})
        get_signing_key.assert_called_once_with("token")
        self.assertEqual(decode.call_args.kwargs["algorithms"], ["RS256"])
        self.assertEqual(decode.call_args.args[1], "public-key")

    @patch("app.api.v1.dependencies.jwt.decode", return_value={"sub": str(uuid.uuid4())})
    @patch(
        "app.api.v1.dependencies.jwt.get_unverified_header",
        return_value={"alg": "HS256"},
    )
    def test_verifies_legacy_token_using_configured_secret(self, header, decode):
        from app.api.v1.dependencies import settings

        get_current_user_id(self.credentials())

        self.assertEqual(header.return_value, {"alg": "HS256"})
        self.assertEqual(decode.call_args.args[1], settings.SUPABASE_JWT_SECRET)
        self.assertEqual(decode.call_args.kwargs["algorithms"], ["HS256"])

    @patch(
        "app.api.v1.dependencies.jwt.get_unverified_header",
        return_value={"alg": "none"},
    )
    def test_rejects_unsupported_algorithm_without_fallback(self, header):
        with self.assertRaises(HTTPException) as error:
            get_current_user_id(self.credentials())

        self.assertEqual(header.return_value, {"alg": "none"})
        self.assertEqual(error.exception.status_code, 401)

    @patch(
        "app.api.v1.dependencies.jwks_client.get_signing_key_from_jwt",
        side_effect=PyJWKClientConnectionError("unavailable"),
    )
    @patch(
        "app.api.v1.dependencies.jwt.get_unverified_header",
        return_value={"alg": "ES256"},
    )
    def test_reports_jwks_connection_failure_as_service_unavailable(
        self,
        header,
        get_signing_key,
    ):
        with self.assertRaises(HTTPException) as error:
            get_current_user_id(self.credentials())

        self.assertEqual(header.return_value, {"alg": "ES256"})
        self.assertEqual(error.exception.status_code, 503)
        get_signing_key.assert_called_once_with("token")


class TestAdvancedCosting(unittest.TestCase):
    def calculate(self, bucket: BucketInput, **request_overrides):
        buckets = request_overrides.pop("buckets", [bucket])
        request_overrides.setdefault("default_units_covered_scope", "all")
        request = CalculationRequest(
            units_produced=Decimal("10"),
            buckets=buckets,
            **request_overrides,
        )
        return calculate_cost_sheet(request)

    def bucket(self, **overrides):
        overrides.setdefault("declared_total", Decimal("100"))
        overrides.setdefault("items", [])
        return BucketInput(
            type="labor",
            label="Labor",
            **overrides,
        )

    def test_imputed_labor_is_only_in_economic_cost(self):
        bucket = self.bucket(items=[
            LineItemInput(name="Owner time", amount=Decimal("50"), is_imputed=True),
        ])
        result = self.calculate(bucket)

        self.assertEqual(result.cash_unit_cost, Decimal("10.0000"))
        self.assertEqual(result.economic_unit_cost, Decimal("15.0000"))
        self.assertEqual(result.total_cost, Decimal("150.0000"))
        self.assertEqual(result.bucket_breakdown[0].economic_itemized_total, Decimal("50.0000"))

        cash_result = self.calculate(bucket, cost_view="cash")
        self.assertEqual(cash_result.total_cost, Decimal("100.0000"))
        self.assertEqual(cash_result.unit_cost, Decimal("10.0000"))
        self.assertEqual(cash_result.cost_view, "cash")

    def test_material_wastage_and_scrap_recovery(self):
        bucket = BucketInput(
            type="material",
            label="Materials",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Flour",
                amount=Decimal("100"),
                details={"wastage_percentage": "10", "scrap_recovery_amount": "5"},
            )],
        )
        result = self.calculate(bucket)
        self.assertEqual(result.cash_total_cost, Decimal("106.1111"))

    def test_labor_contributions_and_business_allocation(self):
        bucket = BucketInput(
            type="labor",
            label="Labor",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Wages",
                amount=Decimal("100"),
                details={
                    "statutory_percentage": "10",
                    "bonus_percentage": "5",
                    "allocation_percentage": "50",
                },
            )],
        )
        self.assertEqual(self.calculate(bucket).cash_total_cost, Decimal("57.5000"))

    def test_depreciation_allocates_asset_cost_over_output_units(self):
        bucket = BucketInput(
            type="machinery",
            label="Machinery",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Mixer",
                details={
                    "depreciation_method": "units",
                    "purchase_price": "1000",
                    "salvage_value": "100",
                    "lifetime_units": "900",
                },
            )],
        )
        self.assertEqual(self.calculate(bucket).cash_total_cost, Decimal("10.0000"))

    def test_custom_cost_amortization(self):
        bucket = BucketInput(
            type="custom_fees",
            label="Fees",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Permit",
                amount=Decimal("120"),
                details={"amortization_units": "12"},
            )],
        )
        self.assertEqual(self.calculate(bucket).cash_total_cost, Decimal("100.0000"))

    def test_custom_cost_amortization_by_period(self):
        bucket = BucketInput(
            type="custom_fees",
            label="Fees",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Permit",
                amount=Decimal("120"),
                details={
                    "amortization_method": "periods",
                    "amortization_units": "12",
                },
            )],
        )
        self.assertEqual(self.calculate(bucket).cash_total_cost, Decimal("10.0000"))

    def test_transport_allocation_uses_selected_measure_share(self):
        bucket = BucketInput(
            type="transport",
            label="Transport",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Shared delivery",
                amount=Decimal("100"),
                details={
                    "allocation_basis": "weight",
                    "allocation_measure": "2",
                    "allocation_total_measure": "10",
                },
            )],
        )
        self.assertEqual(self.calculate(bucket).cash_total_cost, Decimal("20.0000"))

    def test_machine_depreciation_by_useful_life_period(self):
        bucket = BucketInput(
            type="machinery",
            label="Machinery",
            declared_total=Decimal("0"),
            items=[LineItemInput(
                name="Oven",
                details={
                    "depreciation_method": "periods",
                    "purchase_price": "1200",
                    "salvage_value": "0",
                    "useful_life_periods": "12",
                },
            )],
        )
        self.assertEqual(self.calculate(bucket).cash_total_cost, Decimal("100.0000"))

    def test_fixed_cost_break_even_and_target_price_loss(self):
        fixed = self.bucket(
            declared_total=Decimal("100"),
            level=3,
            items=[LineItemInput(
                name="Rent",
                amount=Decimal("100"),
                details={"variable_percentage": "0"},
            )],
        )
        result = self.calculate(
            fixed,
            target_selling_price=Decimal("8"),
        )
        self.assertEqual(result.break_even_units, Decimal("13"))
        self.assertTrue(result.break_even_ready)
        self.assertTrue(result.is_loss_making)

    def test_fixed_cost_break_even_with_variable_costs(self):
        fixed = BucketInput(
            type="overhead",
            label="Rent",
            declared_total=Decimal("100"),
            level=3,
            items=[LineItemInput(
                name="Rent",
                amount=Decimal("100"),
                details={"variable_percentage": "0"},
            )],
        )
        variable = BucketInput(
            type="material",
            label="Materials",
            declared_total=Decimal("50"),
            level=3,
            items=[LineItemInput(
                name="Rice",
                amount=Decimal("50"),
                details={"variable_percentage": "100"},
            )],
        )
        result = self.calculate(
            fixed,
            buckets=[fixed, variable],
            pricing_percentage=Decimal("30"),
        )
        self.assertEqual(result.break_even_units, Decimal("7"))
        self.assertTrue(result.break_even_ready)
        self.assertEqual(result.bucket_breakdown[0].items[0].fixed_amount, Decimal("100.0000"))
        self.assertEqual(result.bucket_breakdown[1].items[0].variable_amount, Decimal("50.0000"))

    def test_break_even_is_unreachable_below_variable_cost(self):
        variable = BucketInput(
            type="material",
            label="Materials",
            declared_total=Decimal("100"),
            level=3,
            items=[LineItemInput(
                name="Materials",
                amount=Decimal("100"),
                details={"variable_percentage": "100"},
            )],
        )
        result = self.calculate(
            variable,
            target_selling_price=Decimal("5"),
        )
        self.assertTrue(result.break_even_ready)
        self.assertIsNone(result.break_even_units)

    def test_break_even_requires_level_three_split_for_every_item(self):
        bucket = self.bucket(
            declared_total=Decimal("100"),
            level=3,
            items=[
                LineItemInput(
                    name="Rent",
                    amount=Decimal("80"),
                    details={"variable_percentage": "0"},
                ),
                LineItemInput(name="Power", amount=Decimal("20")),
            ],
        )

        result = self.calculate(bucket)

        self.assertFalse(result.break_even_ready)
        self.assertIsNone(result.break_even_units)

    def test_variable_percentage_must_be_between_zero_and_one_hundred(self):
        with self.assertRaises(ValidationError):
            LineItemInput(
                name="Power",
                amount=Decimal("100"),
                details={"variable_percentage": "101"},
            )

    def test_invalid_depreciation_method_inputs_are_rejected(self):
        with self.assertRaises(ValidationError):
            LineItemInput(
                name="Machine",
                details={"depreciation_method": "units"},
            )

    def test_all_costs_default_coverage_to_good_output(self):
        bucket = BucketInput(
            type="material",
            label="Materials",
            declared_total=Decimal("100"),
        )
        request = CalculationRequest(
            units_produced=Decimal("10"),
            defective_units=Decimal("2"),
            buckets=[bucket],
            default_units_covered_scope="all",
        )

        result = calculate_cost_sheet(request)

        self.assertEqual(result.bucket_breakdown[0].units_covered, Decimal("8.0000"))
        self.assertEqual(result.default_units_covered_scope, "all")

    def test_unit_label_is_returned_for_live_calculations(self):
        request = CalculationRequest(
            unit_label=" kg ",
            units_produced=Decimal("10"),
            buckets=[],
            default_units_covered_scope="all",
        )

        result = calculate_cost_sheet(request)

        self.assertEqual(result.unit_label, "kg")

    def test_overhead_only_scope_defaults_overhead_and_keeps_overrides(self):
        overhead = BucketInput(
            type="overhead",
            label="Rent",
            declared_total=Decimal("80"),
        )
        material = BucketInput(
            type="material",
            label="Materials",
            declared_total=Decimal("30"),
            units_covered=Decimal("5"),
        )
        request = CalculationRequest(
            units_produced=Decimal("10"),
            defective_units=Decimal("2"),
            buckets=[overhead, material],
            default_units_covered_scope="overhead_only",
        )

        result = calculate_cost_sheet(request)

        self.assertEqual(result.bucket_breakdown[0].units_covered, Decimal("8.0000"))
        self.assertEqual(result.bucket_breakdown[1].units_covered, Decimal("5.0000"))
        self.assertEqual(result.default_units_covered_scope, "overhead_only")

    def test_overhead_only_requires_coverage_for_other_buckets(self):
        with self.assertRaises(ValidationError):
            CalculationRequest(
                units_produced=Decimal("10"),
                buckets=[
                    BucketInput(
                        type="material",
                        label="Materials",
                        declared_total=Decimal("100"),
                    )
                ],
                default_units_covered_scope="overhead_only",
            )

    def test_target_price_overrides_invalid_margin_percentage(self):
        request = CalculationRequest(
            units_produced=Decimal("1"),
            buckets=[],
            default_units_covered_scope="all",
            pricing_type="MARGIN",
            pricing_percentage=Decimal("100"),
            target_selling_price=Decimal("10"),
        )
        result = calculate_cost_sheet(request)
        self.assertEqual(result.pricing_type, "margin")
        self.assertEqual(result.target_selling_price, Decimal("10.0000"))


class TestCostSheetInputRequirements(unittest.TestCase):
    def calculation_data(self):
        return CalculationRequest(
            units_produced=Decimal("10"),
            buckets=[],
            default_units_covered_scope="all",
        )

    def test_unit_label_is_required_for_saved_cost_sheets(self):
        with self.assertRaises(ValidationError):
            CostSheetCreateRequest(
                name="Rice packet",
                basis="monthly",
                calculation_data=self.calculation_data(),
            )

    def test_unit_label_is_trimmed_and_must_not_be_blank(self):
        payload = CostSheetCreateRequest(
            name="Rice packet",
            unit_label=" packets ",
            basis="monthly",
            calculation_data=self.calculation_data(),
        )
        self.assertEqual(payload.unit_label, "packets")

        with self.assertRaises(ValidationError):
            CostSheetCreateRequest(
                name="Rice packet",
                unit_label="   ",
                basis="batch",
                calculation_data=self.calculation_data(),
            )

    def test_production_basis_is_required_for_saved_cost_sheets(self):
        with self.assertRaises(ValidationError):
            CostSheetCreateRequest(
                name="Rice packet",
                unit_label="packet",
                calculation_data=self.calculation_data(),
            )

    def test_default_coverage_scope_is_required(self):
        with self.assertRaises(ValidationError):
            CalculationRequest(
                units_produced=Decimal("10"),
                buckets=[],
            )
