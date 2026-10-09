import unittest
from decimal import Decimal

from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from models.models import (
    Bucket,
    BucketType,
    CostSheet,
    LineItem,
    LineItemType,
    PricingMethod,
    ProductionBasis,
    Profile,
    SheetKind,
    SheetVersion,
    Workspace,
)
from schemas.cost_sheet import (
    CostBucketInput,
    CostLineItemInput,
    CostSheetVersionInput,
)


class SQLModelSchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        SQLModel.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_level_two_cost_sheet_relations_and_decimal_fields(self) -> None:
        with Session(self.engine) as session:
            profile = Profile(email="owner@example.com")
            session.add(profile)
            session.commit()
            session.refresh(profile)

            workspace = Workspace(owner_id=profile.id, name="Bakery")
            session.add(workspace)
            session.commit()

            sheet = CostSheet(
                workspace_id=workspace.id,
                name="Bread",
                kind=SheetKind.PRODUCT,
                basis=ProductionBasis.BATCH,
            )
            session.add(sheet)
            session.commit()

            version = SheetVersion(
                sheet_id=sheet.id,
                version_number=1,
                units_produced=Decimal("100"),
                pricing_method=PricingMethod.MARKUP,
                pricing_rate=Decimal("0.25"),
                currency_code="USD",
                unit_cost=Decimal("2.500000"),
                created_by=profile.id,
            )
            session.add(version)
            session.commit()

            bucket = Bucket(
                version_id=version.id,
                bucket_type=BucketType.MATERIAL,
                label="Materials",
                declared_amount=Decimal("250"),
                declared_units_covered=Decimal("100"),
            )
            session.add(bucket)
            session.commit()

            item = LineItem(
                bucket_id=bucket.id,
                name="Flour",
                item_type=LineItemType.MATERIAL,
                amount=Decimal("200"),
                units_covered=Decimal("100"),
                quantity=Decimal("50"),
                unit="kg",
                unit_price=Decimal("4"),
            )
            session.add(item)
            session.commit()

            loaded_item = session.exec(select(LineItem)).one()
            loaded_version = session.get(SheetVersion, version.id)

            self.assertEqual(loaded_item.amount, Decimal("200.000000"))
            self.assertEqual(loaded_item.bucket_id, bucket.id)
            self.assertEqual(loaded_version.pricing_method, PricingMethod.MARKUP)
            self.assertEqual(loaded_version.currency_code, "USD")

    def test_models_expose_expected_level_two_tables(self) -> None:
        self.assertTrue(
            {
                "profiles",
                "workspaces",
                "cost_sheets",
                "sheet_versions",
                "buckets",
                "line_items",
                "materials",
                "workers",
            }.issubset(SQLModel.metadata.tables)
        )

    def test_input_models_derive_material_amount_and_default_unit_coverage(self) -> None:
        item = CostLineItemInput(
            name="Flour",
            item_type=LineItemType.MATERIAL,
            quantity=Decimal("2.5"),
            unit="kg",
            unit_price=Decimal("4"),
        )
        self.assertEqual(item.amount, Decimal("10"))

        buckets = [
            CostBucketInput(
                bucket_type=bucket_type,
                label=bucket_type.value,
                declared_amount=Decimal("0"),
                is_none=True,
            )
            for bucket_type in BucketType
        ]
        version = CostSheetVersionInput(
            units_produced=Decimal("12"),
            pricing_method=PricingMethod.MARKUP,
            currency_code="usd",
            buckets=buckets,
        )
        self.assertEqual(version.currency_code, "USD")
        self.assertTrue(
            all(bucket.declared_units_covered == Decimal("12") for bucket in version.buckets)
        )

    def test_input_models_reject_zero_bucket_without_none_confirmation(self) -> None:
        with self.assertRaises(ValueError):
            CostBucketInput(
                bucket_type=BucketType.MATERIAL,
                label="Materials",
                declared_amount=Decimal("0"),
            )

    def test_database_rejects_duplicate_bucket_type_in_one_version(self) -> None:
        with Session(self.engine) as session:
            profile = Profile(email="duplicate@example.com")
            session.add(profile)
            session.commit()

            workspace = Workspace(owner_id=profile.id, name="Workspace")
            session.add(workspace)
            session.commit()

            sheet = CostSheet(
                workspace_id=workspace.id,
                name="Sheet",
                kind=SheetKind.SERVICE,
                basis=ProductionBasis.BATCH,
            )
            session.add(sheet)
            session.commit()

            version = SheetVersion(
                sheet_id=sheet.id,
                version_number=1,
                units_produced=Decimal("1"),
                pricing_method=PricingMethod.MARGIN,
                created_by=profile.id,
            )
            session.add(version)
            session.commit()

            session.add_all(
                [
                    Bucket(
                        version_id=version.id,
                        bucket_type=BucketType.MATERIAL,
                        label=label,
                        declared_amount=Decimal("0"),
                        declared_units_covered=Decimal("1"),
                    )
                    for label in ("Materials", "Supplies")
                ]
            )
            with self.assertRaises(IntegrityError):
                session.commit()
