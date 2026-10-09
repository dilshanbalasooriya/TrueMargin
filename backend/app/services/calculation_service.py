from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple
from app.schemas.calculation import (
    CalculationRequest,
    CalculationResponse,
    BucketInput,
    BucketBreakdownOutput,
    LineItemInput,
    LineItemOutput,
)

FOUR_PLACES = Decimal("0.0001")


def _round_num(val: Decimal) -> Decimal:
    return val.quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def calculate_cost_sheet(request: CalculationRequest) -> CalculationResponse:
    """
    Pure calculation engine for unit cost and pricing metrics.
    No database side-effects or external state dependencies.
    """
    good_units = request.units_produced - request.defective_units
    
    processed_buckets: List[BucketBreakdownOutput] = []
    total_cost = Decimal("0.0")
    total_unit_cost = Decimal("0.0")

    # Step 1: Process each bucket & apply reconciliation rule
    for bucket in request.buckets:
        if bucket.hidden:
            continue

        bucket_breakdown, bucket_effective_total, bucket_cost_per_unit = _process_bucket(
            bucket=bucket,
            default_good_units=good_units
        )
        
        processed_buckets.append(bucket_breakdown)
        total_cost += bucket_effective_total
        total_unit_cost += bucket_cost_per_unit

    # Step 2: Compute percentage share per bucket
    for b in processed_buckets:
        if total_unit_cost > Decimal("0.0"):
            b.percentage_of_total = _round_num((b.cost_per_unit / total_unit_cost) * Decimal("100.0"))
        else:
            b.percentage_of_total = Decimal("0.0")

    # Step 3: Compute pricing, profit, and equivalent markup/margin
    pricing_type = request.pricing_type.lower()
    pricing_pct = request.pricing_percentage

    if pricing_type == "margin":
        # Price = Unit Cost / (1 - Margin%)
        margin_decimal = pricing_pct / Decimal("100.0")
        suggested_price = total_unit_cost / (Decimal("1.0") - margin_decimal)
        # Equivalent Markup% = (Margin% / (100 - Margin%)) * 100
        equivalent = (pricing_pct / (Decimal("100.0") - pricing_pct)) * Decimal("100.0")
    else:
        # Default: Markup. Price = Unit Cost * (1 + Markup%)
        markup_decimal = pricing_pct / Decimal("100.0")
        suggested_price = total_unit_cost * (Decimal("1.0") + markup_decimal)
        # Equivalent Margin% = (Markup% / (100 + Markup%)) * 100
        equivalent = (pricing_pct / (Decimal("100.0") + pricing_pct)) * Decimal("100.0")

    profit_per_unit = suggested_price - total_unit_cost
    total_expected_profit = profit_per_unit * good_units

    return CalculationResponse(
        units_produced=_round_num(request.units_produced),
        defective_units=_round_num(request.defective_units),
        good_units=_round_num(good_units),
        total_cost=_round_num(total_cost),
        unit_cost=_round_num(total_unit_cost),
        pricing_type=pricing_type,
        pricing_percentage=_round_num(pricing_pct),
        suggested_price=_round_num(suggested_price),
        profit_per_unit=_round_num(profit_per_unit),
        total_expected_profit=_round_num(total_expected_profit),
        equivalent_markup_or_margin=_round_num(equivalent),
        bucket_breakdown=processed_buckets,
    )


def _process_bucket(
    bucket: BucketInput,
    default_good_units: Decimal
) -> Tuple[BucketBreakdownOutput, Decimal, Decimal]:
    """Processes bucket items, enforces the Reconciliation Rule, and computes cost per unit."""
    bucket_units = bucket.units_covered if (bucket.units_covered and bucket.units_covered > 0) else default_good_units
    declared_total = bucket.declared_total
    
    output_items: List[LineItemOutput] = []
    items_sum_amount = Decimal("0.0")
    items_sum_cost_per_unit = Decimal("0.0")

    # Evaluate line items if Level 2 or 3
    for item in bucket.items:
        # Determine explicit or calculated line amount
        item_amount = item.amount if item.amount is not None else (item.quantity * item.unit_price)
        item_units = item.units_covered if (item.units_covered and item.units_covered > 0) else bucket_units
        item_cost_per_unit = item_amount / item_units

        items_sum_amount += item_amount
        items_sum_cost_per_unit += item_cost_per_unit

        output_items.append(
            LineItemOutput(
                name=item.name,
                quantity=_round_num(item.quantity),
                unit=item.unit,
                unit_price=_round_num(item.unit_price),
                amount=_round_num(item_amount),
                units_covered=_round_num(item_units),
                cost_per_unit=_round_num(item_cost_per_unit),
                kind=item.kind,
                pinned=item.pinned,
                details=item.details,
            )
        )

    # Reconciliation Logic
    if not bucket.items:
        status = "no_items"
        effective_total = declared_total
        cost_per_unit = declared_total / bucket_units
    else:
        if items_sum_amount < declared_total:
            # Difference creates an unallocated line item
            status = "unallocated_added"
            unallocated_amount = declared_total - items_sum_amount
            unallocated_cpu = unallocated_amount / bucket_units

            output_items.append(
                LineItemOutput(
                    name="Unallocated",
                    quantity=Decimal("1.0"),
                    unit=None,
                    unit_price=_round_num(unallocated_amount),
                    amount=_round_num(unallocated_amount),
                    units_covered=_round_num(bucket_units),
                    cost_per_unit=_round_num(unallocated_cpu),
                    kind="system_unallocated",
                    pinned=False,
                    details={},
                )
            )
            effective_total = declared_total
            cost_per_unit = declared_total / bucket_units

        elif items_sum_amount > declared_total:
            status = "exceeded"
            effective_total = items_sum_amount
            cost_per_unit = items_sum_cost_per_unit
        else:
            status = "matched"
            effective_total = declared_total
            cost_per_unit = items_sum_cost_per_unit

    breakdown = BucketBreakdownOutput(
        type=bucket.type,
        label=bucket.label,
        level=bucket.level,
        method=bucket.method,
        hidden=bucket.hidden,
        declared_total=_round_num(declared_total),
        effective_total=_round_num(effective_total),
        units_covered=_round_num(bucket_units),
        cost_per_unit=_round_num(cost_per_unit),
        percentage_of_total=Decimal("0.0"),  # Populated in main function
        reconciliation_status=status,
        items=output_items,
    )

    return breakdown, effective_total, cost_per_unit