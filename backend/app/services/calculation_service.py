from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from typing import List, Tuple

from app.schemas.calculation import (
    BucketBreakdownOutput,
    BucketInput,
    CalculationRequest,
    CalculationResponse,
    LineItemInput,
    LineItemOutput,
)

FOUR_PLACES = Decimal("0.0001")
ZERO = Decimal("0")
HUNDRED = Decimal("100")


def _round_num(value: Decimal) -> Decimal:
    return value.quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def calculate_cost_sheet(request: CalculationRequest) -> CalculationResponse:
    """Calculate cash and economic costs, pricing, and break-even metrics."""
    good_units = request.units_produced - request.defective_units
    buckets: List[BucketBreakdownOutput] = []
    cash_total = economic_total = cash_unit = economic_unit = ZERO
    cash_fixed = economic_fixed = ZERO
    break_even_ready = True
    has_costs = False

    for bucket in request.buckets:
        if bucket.hidden:
            continue
        result, bucket_cash, bucket_economic = _process_bucket(
            bucket,
            good_units,
            request.default_units_covered_scope,
        )
        buckets.append(result)
        cash_total += bucket_cash
        economic_total += bucket_economic
        cash_unit += result.cash_cost_per_unit
        economic_unit += result.economic_cost_per_unit
        cash_fixed += result.fixed_cash_total
        economic_fixed += result.fixed_economic_total
        if bucket_cash > ZERO or bucket_economic > ZERO:
            has_costs = True
            unallocated_amount = max(
                bucket_cash - sum(
                    (
                        item.amount
                        for item in result.items
                        if item.kind != "system_unallocated" and not item.is_imputed
                    ),
                    ZERO,
                ),
                ZERO,
            )
            if (
                result.reconciliation_status == "unallocated_added"
                or not bucket.items
                or bucket.level < 3
                or any(
                    item.kind != "system_unallocated"
                    and item.amount > ZERO
                    and "variable_percentage" not in item.details
                    for item in result.items
                )
                or unallocated_amount > ZERO
            ):
                break_even_ready = False

    view = request.cost_view
    total_cost = cash_total if view == "cash" else economic_total
    unit_cost = cash_unit if view == "cash" else economic_unit
    for bucket in buckets:
        bucket_cost = bucket.cash_cost_per_unit if view == "cash" else bucket.economic_cost_per_unit
        bucket.percentage_of_total = (
            _round_num(bucket_cost / unit_cost * HUNDRED) if unit_cost > ZERO else ZERO
        )
        bucket.cost_per_unit = _round_num(bucket_cost)
        bucket.effective_total = _round_num(
            bucket.declared_total if bucket.reconciliation_status != "exceeded" else bucket.itemized_total
        )
        if view == "economic":
            bucket.effective_total = _round_num(bucket.economic_cost_per_unit * bucket.units_covered)

    pricing_type = request.pricing_type.lower()
    percentage = request.pricing_percentage
    if request.target_selling_price is not None:
        price = request.target_selling_price
        profit = price - unit_cost
        if pricing_type == "margin":
            equivalent = profit / price * HUNDRED if price > ZERO else ZERO
        else:
            equivalent = profit / unit_cost * HUNDRED if unit_cost > ZERO else ZERO
    elif pricing_type == "margin":
        margin = percentage / HUNDRED
        price = unit_cost / (Decimal("1") - margin)
        equivalent = percentage / (HUNDRED - percentage) * HUNDRED
    else:
        markup = percentage / HUNDRED
        price = unit_cost * (Decimal("1") + markup)
        equivalent = percentage / (HUNDRED + percentage) * HUNDRED

    profit_per_unit = price - unit_cost
    fixed_total = cash_fixed if view == "cash" else economic_fixed
    fixed_per_unit = fixed_total / good_units
    variable_unit_cost = max(unit_cost - fixed_per_unit, ZERO)
    contribution = price - variable_unit_cost
    break_even = (
        None
        if not has_costs or not break_even_ready or contribution <= ZERO
        else ZERO
        if fixed_total == ZERO
        else (fixed_total / contribution).to_integral_value(rounding=ROUND_CEILING)
    )

    return CalculationResponse(
        unit_label=request.unit_label,
        units_produced=_round_num(request.units_produced),
        defective_units=_round_num(request.defective_units),
        good_units=_round_num(good_units),
        default_units_covered_scope=request.default_units_covered_scope,
        total_cost=_round_num(total_cost),
        unit_cost=_round_num(unit_cost),
        cash_total_cost=_round_num(cash_total),
        economic_total_cost=_round_num(economic_total),
        cash_unit_cost=_round_num(cash_unit),
        economic_unit_cost=_round_num(economic_unit),
        cost_view=view,
        pricing_type=pricing_type,
        pricing_percentage=_round_num(percentage),
        target_selling_price=(
            _round_num(request.target_selling_price)
            if request.target_selling_price is not None
            else None
        ),
        suggested_price=_round_num(price),
        profit_per_unit=_round_num(profit_per_unit),
        total_expected_profit=_round_num(profit_per_unit * good_units),
        equivalent_markup_or_margin=_round_num(equivalent),
        break_even_units=break_even,
        break_even_ready=has_costs and break_even_ready,
        is_loss_making=price < unit_cost,
        bucket_breakdown=buckets,
    )


def _detail(item: LineItemInput, key: str, default: str = "0") -> Decimal:
    try:
        value = Decimal(str(item.details.get(key, default)))
    except (ValueError, TypeError, ArithmeticError) as error:
        raise ValueError(f"Invalid numeric detail: {key}") from error
    if not value.is_finite():
        raise ValueError(f"Invalid numeric detail: {key}")
    return value


def _calculate_line_amount(item: LineItemInput, covered_units: Decimal) -> Decimal:
    details = item.details
    method = item.details.get("depreciation_method", "none")
    if method == "units":
        purchase = _detail(item, "purchase_price")
        salvage = _detail(item, "salvage_value")
        lifetime = _detail(item, "lifetime_units")
        if salvage > purchase or lifetime <= ZERO:
            raise ValueError("Depreciation requires salvage <= purchase price and positive lifetime units.")
        amount = (purchase - salvage) * covered_units / lifetime
    elif method == "periods":
        purchase = _detail(item, "purchase_price")
        salvage = _detail(item, "salvage_value")
        life = _detail(item, "useful_life_periods")
        if salvage > purchase or life <= ZERO:
            raise ValueError("Depreciation requires salvage <= purchase price and positive useful life.")
        amount = (purchase - salvage) / life
    elif method == "none":
        amount = item.amount if item.amount is not None else item.quantity * item.unit_price
    else:
        raise ValueError("Unsupported depreciation method.")

    amortization_method = details.get(
        "amortization_method",
        "units" if details.get("amortization_units") is not None else "none",
    )
    amortization_units = _detail(item, "amortization_units")
    if amortization_method == "units":
        amount = amount / amortization_units * covered_units
    elif amortization_method == "periods":
        amount /= amortization_units

    wastage = _detail(item, "wastage_percentage")
    if wastage >= HUNDRED:
        raise ValueError("Wastage percentage must be below 100.")
    if wastage > ZERO:
        amount /= Decimal("1") - wastage / HUNDRED

    scrap = _detail(item, "scrap_recovery_amount")
    if scrap > amount:
        raise ValueError("Scrap recovery cannot exceed the calculated cost.")
    amount -= scrap
    amount *= Decimal("1") + (
        _detail(item, "statutory_percentage") + _detail(item, "bonus_percentage")
    ) / HUNDRED
    allocation_measure = details.get("allocation_measure")
    if allocation_measure is not None:
        allocation_percentage = (
            _detail(item, "allocation_measure")
            / _detail(item, "allocation_total_measure")
            * HUNDRED
        )
    else:
        allocation_percentage = _detail(item, "allocation_percentage", "100")
    amount *= allocation_percentage / HUNDRED
    return amount


def _process_bucket(
    bucket: BucketInput,
    good_units: Decimal,
    default_units_covered_scope: str,
) -> Tuple[BucketBreakdownOutput, Decimal, Decimal]:
    if bucket.units_covered is not None:
        bucket_units = bucket.units_covered
    elif (
        default_units_covered_scope == "all"
        or bucket.type.strip().casefold() == "overhead"
    ):
        bucket_units = good_units
    else:
        raise ValueError(
            "Set units_covered for every non-overhead bucket when "
            "default_units_covered_scope is overhead_only."
        )
    cash_items_cpu = economic_items_cpu = imputed_cpu = ZERO
    fixed_cash = fixed_economic = ZERO
    output_items: List[LineItemOutput] = []

    for item in bucket.items:
        details = dict(item.details)
        recipe_method = details.get("method") or details.get("cost_method")
        is_recipe = (
            recipe_method in {"recipe", "bom"}
            or ("usage_quantity" in details and "usage_unit" in details)
        )
        if is_recipe:
            from app.services.unit_converter import calculate_recipe_coverage

            usage_qty = _detail(item, "usage_quantity")
            usage_unit = str(details.get("usage_unit")).strip()
            purchase_qty = (
                _detail(item, "purchase_quantity")
                if "purchase_quantity" in details
                else item.quantity
            )
            purchase_unit = (
                str(details.get("purchase_unit")).strip()
                if "purchase_unit" in details
                else (item.unit.strip() if item.unit else "")
            )
            covered = calculate_recipe_coverage(
                purchase_qty, purchase_unit, usage_qty, usage_unit
            )
            details["calculated_coverage"] = str(_round_num(covered))
            details["method"] = "recipe"
        else:
            covered = item.units_covered if item.units_covered and item.units_covered > ZERO else bucket_units

        amount = _calculate_line_amount(item, covered)
        cpu = amount / covered
        if is_recipe:
            details["cost_per_recipe_unit"] = str(_round_num(cpu))

        variable_percentage = (
            _detail(item, "variable_percentage")
            if "variable_percentage" in details
            else HUNDRED if item.cost_behavior == "variable" else ZERO
        )
        variable_amount = amount * variable_percentage / HUNDRED
        fixed_amount = amount - variable_amount
        economic_items_cpu += cpu
        if item.is_imputed:
            imputed_cpu += cpu
        else:
            cash_items_cpu += cpu
        fixed_economic += fixed_amount
        if not item.is_imputed:
            fixed_cash += fixed_amount
        output_items.append(LineItemOutput(
            name=item.name,
            quantity=_round_num(item.quantity),
            unit=item.unit,
            unit_price=_round_num(
                item.amount / item.quantity
                if item.amount is not None and item.quantity > ZERO
                else item.unit_price
            ),
            amount=_round_num(amount),
            fixed_amount=_round_num(fixed_amount),
            variable_amount=_round_num(variable_amount),
            units_covered=_round_num(covered),
            cost_per_unit=_round_num(cpu),
            kind=item.kind,
            pinned=item.pinned,
            is_imputed=item.is_imputed,
            cost_behavior=item.cost_behavior,
            details=details,
        ))

    declared_cpu = bucket.declared_total / bucket_units
    if not bucket.items:
        status = "no_items"
        cash_cpu = declared_cpu
        cash_effective = bucket.declared_total
        economic_cpu = cash_cpu
        economic_effective = cash_effective
        if bucket.cost_behavior == "fixed":
            fixed_cash = fixed_economic = bucket.declared_total
    else:
        if cash_items_cpu < declared_cpu:
            status = "unallocated_added"
            unallocated_amount = bucket.declared_total - cash_items_cpu * bucket_units
            output_items.append(LineItemOutput(
                name="Unallocated",
                quantity=Decimal("1"),
                unit=None,
                unit_price=_round_num(unallocated_amount),
                amount=_round_num(unallocated_amount),
                fixed_amount=(
                    _round_num(unallocated_amount)
                    if bucket.cost_behavior == "fixed"
                    else ZERO
                ),
                variable_amount=(
                    ZERO
                    if bucket.cost_behavior == "fixed"
                    else _round_num(unallocated_amount)
                ),
                units_covered=_round_num(bucket_units),
                cost_per_unit=_round_num(unallocated_amount / bucket_units),
                kind="system_unallocated",
                pinned=False,
                is_imputed=False,
                cost_behavior=bucket.cost_behavior,
                details={},
            ))
            cash_cpu, cash_effective = declared_cpu, bucket.declared_total
            if bucket.cost_behavior == "fixed" and not any(
                "variable_percentage" in item.details for item in bucket.items
            ):
                fixed_cash += unallocated_amount
                fixed_economic += unallocated_amount
        elif cash_items_cpu > declared_cpu:
            status = "exceeded"
            cash_cpu = cash_items_cpu
            cash_effective = cash_cpu * bucket_units
        else:
            status = "matched"
            cash_cpu = cash_items_cpu
            cash_effective = bucket.declared_total

        economic_cpu = cash_cpu + imputed_cpu
        economic_effective = economic_cpu * bucket_units
        if bucket.cost_behavior == "fixed" and not any(
            "variable_percentage" in item.details for item in bucket.items
        ):
            fixed_cash = cash_effective
            fixed_economic = economic_effective

    bucket_output = BucketBreakdownOutput(
        type=bucket.type,
        label=bucket.label,
        level=bucket.level,
        method=bucket.method,
        hidden=bucket.hidden,
        declared_total=_round_num(bucket.declared_total),
        effective_total=_round_num(cash_effective),
        itemized_total=_round_num(cash_items_cpu * bucket_units),
        economic_itemized_total=_round_num(economic_items_cpu * bucket_units),
        itemization_percentage=_round_num(
            min(cash_items_cpu / declared_cpu * HUNDRED, HUNDRED)
            if declared_cpu > ZERO
            else HUNDRED if cash_items_cpu > ZERO else ZERO
        ),
        units_covered=_round_num(bucket_units),
        cost_per_unit=_round_num(cash_cpu),
        cash_cost_per_unit=_round_num(cash_cpu),
        economic_cost_per_unit=_round_num(economic_cpu),
        fixed_cash_total=_round_num(fixed_cash),
        fixed_economic_total=_round_num(fixed_economic),
        cost_behavior=bucket.cost_behavior,
        percentage_of_total=ZERO,
        reconciliation_status=status,
        items=output_items,
    )
    return bucket_output, cash_effective, economic_effective
