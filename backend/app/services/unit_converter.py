from decimal import Decimal, InvalidOperation
from typing import Dict, Optional, Tuple

ZERO = Decimal("0")
ONE = Decimal("1")

# Standard Unit Conversion Tables to Base Units:
# Mass -> Base: gram (g)
# Volume -> Base: milliliter (ml)
# Length -> Base: millimeter (mm)
# Area -> Base: square millimeter (sq mm)
# Count -> Base: piece (pcs)

UNIT_DEFINITIONS: Dict[str, Tuple[str, Decimal]] = {
    # Mass (Base: g)
    "g": ("mass", ONE),
    "kg": ("mass", Decimal("1000")),
    "mg": ("mass", Decimal("0.001")),
    "lb": ("mass", Decimal("453.59237")),
    "oz": ("mass", Decimal("28.349523125")),
    
    # Volume (Base: ml)
    "ml": ("volume", ONE),
    "l": ("volume", Decimal("1000")),
    "gal": ("volume", Decimal("3785.411784")),
    "floz": ("volume", Decimal("29.5735295625")),
    "cup": ("volume", Decimal("250")),
    "tbsp": ("volume", Decimal("15")),
    "tsp": ("volume", Decimal("5")),
    
    # Length (Base: mm)
    "mm": ("length", ONE),
    "cm": ("length", Decimal("10")),
    "m": ("length", Decimal("1000")),
    "in": ("length", Decimal("25.4")),
    "ft": ("length", Decimal("304.8")),
    "yd": ("length", Decimal("914.4")),
    
    # Area (Base: sq mm)
    "sqmm": ("area", ONE),
    "sqcm": ("area", Decimal("100")),
    "sqm": ("area", Decimal("1000000")),
    "sqin": ("area", Decimal("645.16")),
    "sqft": ("area", Decimal("92903.04")),
    
    # Count (Base: pcs)
    "pcs": ("count", ONE),
    "dz": ("count", Decimal("12")),
    "gross": ("count", Decimal("144")),
    "pack": ("count", ONE),
    "box": ("count", ONE),
    "sheet": ("count", ONE),
    "bottle": ("count", ONE),
    "can": ("count", ONE),
    "bag": ("count", ONE),
    "roll": ("count", ONE),
}

UNIT_ALIASES: Dict[str, str] = {
    # Mass
    "gram": "g",
    "grams": "g",
    "gm": "g",
    "gms": "g",
    "kilogram": "kg",
    "kilograms": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "kgs": "kg",
    "milligram": "mg",
    "milligrams": "mg",
    "mgs": "mg",
    "pound": "lb",
    "pounds": "lb",
    "lbs": "lb",
    "ounce": "oz",
    "ounces": "oz",
    
    # Volume
    "liter": "l",
    "liters": "l",
    "litre": "l",
    "litres": "l",
    "ltr": "l",
    "ltrs": "l",
    "milliliter": "ml",
    "milliliters": "ml",
    "millilitre": "ml",
    "millilitres": "ml",
    "mls": "ml",
    "gallon": "gal",
    "gallons": "gal",
    "fluid ounce": "floz",
    "fluid ounces": "floz",
    "fl oz": "floz",
    "fl.oz": "floz",
    "tablespoon": "tbsp",
    "tablespoons": "tbsp",
    "teaspoon": "tsp",
    "teaspoons": "tsp",
    "cups": "cup",
    
    # Length
    "meter": "m",
    "meters": "m",
    "metre": "m",
    "metres": "m",
    "mtr": "m",
    "mtrs": "m",
    "centimeter": "cm",
    "centimeters": "cm",
    "centimetre": "cm",
    "centimetres": "cm",
    "cms": "cm",
    "millimeter": "mm",
    "millimeters": "mm",
    "millimetre": "mm",
    "millimetres": "mm",
    "inch": "in",
    "inches": "in",
    "foot": "ft",
    "feet": "ft",
    "yard": "yd",
    "yards": "yd",
    
    # Area
    "sq m": "sqm",
    "sq.m": "sqm",
    "m2": "sqm",
    "sq cm": "sqcm",
    "sq.cm": "sqcm",
    "cm2": "sqcm",
    "sq mm": "sqmm",
    "sq.mm": "sqmm",
    "mm2": "sqmm",
    "sq ft": "sqft",
    "sq.ft": "sqft",
    "ft2": "sqft",
    
    # Count
    "pc": "pcs",
    "piece": "pcs",
    "pieces": "pcs",
    "unit": "pcs",
    "units": "pcs",
    "item": "pcs",
    "items": "pcs",
    "nos": "pcs",
    "no": "pcs",
    "dozen": "dz",
    "dozens": "dz",
    "doz": "dz",
    "packets": "pack",
    "packet": "pack",
    "pkt": "pack",
    "pkts": "pack",
    "boxes": "box",
    "sheets": "sheet",
    "bottles": "bottle",
    "cans": "can",
    "bags": "bag",
    "rolls": "roll",
}


def normalize_unit(unit_str: Optional[str]) -> str:
    """Normalize unit string to canonical form."""
    if not unit_str:
        return "pcs"
    clean = unit_str.strip().lower()
    return UNIT_ALIASES.get(clean, clean)


def get_unit_family(unit_str: str) -> Optional[str]:
    """Return measurement family (mass, volume, length, area, count) or None."""
    norm = normalize_unit(unit_str)
    if norm in UNIT_DEFINITIONS:
        return UNIT_DEFINITIONS[norm][0]
    return None


def are_units_compatible(unit_a: str, unit_b: str) -> bool:
    """Check if two units can be converted between each other."""
    norm_a = normalize_unit(unit_a)
    norm_b = normalize_unit(unit_b)
    if norm_a == norm_b:
        return True
    fam_a = get_unit_family(norm_a)
    fam_b = get_unit_family(norm_b)
    return fam_a is not None and fam_a == fam_b


def convert_units(value: Decimal, from_unit: str, to_unit: str) -> Decimal:
    """Convert a numeric value from from_unit to to_unit."""
    norm_from = normalize_unit(from_unit)
    norm_to = normalize_unit(to_unit)
    
    if norm_from == norm_to:
        return value
    
    if not are_units_compatible(norm_from, norm_to):
        raise ValueError(
            f"Cannot convert between '{from_unit}' and '{to_unit}'. "
            f"Units must be of the same measurement type (e.g., mass, volume, or length)."
        )
    
    _, from_scale = UNIT_DEFINITIONS[norm_from]
    _, to_scale = UNIT_DEFINITIONS[norm_to]
    
    # Convert to base unit, then to target unit
    base_value = value * from_scale
    return base_value / to_scale


def calculate_recipe_coverage(
    purchase_quantity: Decimal,
    purchase_unit: str,
    usage_quantity: Decimal,
    usage_unit: str,
) -> Decimal:
    """
    Calculate how many finished product units are covered by a bulk purchase.
    
    Formula:
        (purchase_quantity converted to usage_unit) / usage_quantity
    """
    if usage_quantity <= ZERO:
        raise ValueError("Recipe usage quantity per unit must be greater than zero.")
    if purchase_quantity <= ZERO:
        raise ValueError("Purchase quantity must be greater than zero.")
    
    converted_purchase = convert_units(purchase_quantity, purchase_unit, usage_unit)
    return converted_purchase / usage_quantity
