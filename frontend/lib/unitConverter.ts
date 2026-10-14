// Frontend unit conversion utility matching backend/app/services/unit_converter.py

export type UnitFamily = 'mass' | 'volume' | 'length' | 'area' | 'count';

export interface UnitDefinition {
  family: UnitFamily;
  scaleToBase: number; // multiplier to reach base unit
}

// Base units:
// Mass: gram (g)
// Volume: milliliter (ml)
// Length: millimeter (mm)
// Area: square millimeter (sqmm)
// Count: piece (pcs)

export const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  // Mass (Base: g)
  g: { family: 'mass', scaleToBase: 1 },
  kg: { family: 'mass', scaleToBase: 1000 },
  mg: { family: 'mass', scaleToBase: 0.001 },
  lb: { family: 'mass', scaleToBase: 453.59237 },
  oz: { family: 'mass', scaleToBase: 28.349523125 },

  // Volume (Base: ml)
  ml: { family: 'volume', scaleToBase: 1 },
  l: { family: 'volume', scaleToBase: 1000 },
  gal: { family: 'volume', scaleToBase: 3785.411784 },
  floz: { family: 'volume', scaleToBase: 29.5735295625 },
  cup: { family: 'volume', scaleToBase: 250 },
  tbsp: { family: 'volume', scaleToBase: 15 },
  tsp: { family: 'volume', scaleToBase: 5 },

  // Length (Base: mm)
  mm: { family: 'length', scaleToBase: 1 },
  cm: { family: 'length', scaleToBase: 10 },
  m: { family: 'length', scaleToBase: 1000 },
  in: { family: 'length', scaleToBase: 25.4 },
  ft: { family: 'length', scaleToBase: 304.8 },
  yd: { family: 'length', scaleToBase: 914.4 },

  // Area (Base: sqmm)
  sqmm: { family: 'area', scaleToBase: 1 },
  sqcm: { family: 'area', scaleToBase: 100 },
  sqm: { family: 'area', scaleToBase: 1000000 },
  sqin: { family: 'area', scaleToBase: 645.16 },
  sqft: { family: 'area', scaleToBase: 92903.04 },

  // Count (Base: pcs)
  pcs: { family: 'count', scaleToBase: 1 },
  dz: { family: 'count', scaleToBase: 12 },
  gross: { family: 'count', scaleToBase: 144 },
  pack: { family: 'count', scaleToBase: 1 },
  box: { family: 'count', scaleToBase: 1 },
  sheet: { family: 'count', scaleToBase: 1 },
  bottle: { family: 'count', scaleToBase: 1 },
  can: { family: 'count', scaleToBase: 1 },
  bag: { family: 'count', scaleToBase: 1 },
  roll: { family: 'count', scaleToBase: 1 },
};

export const UNIT_ALIASES: Record<string, string> = {
  // Mass
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kgs: 'kg',
  milligram: 'mg',
  milligrams: 'mg',
  mgs: 'mg',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',

  // Volume
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  ltr: 'l',
  ltrs: 'l',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  mls: 'ml',
  gallon: 'gal',
  gallons: 'gal',
  'fluid ounce': 'floz',
  'fluid ounces': 'floz',
  'fl oz': 'floz',
  'fl.oz': 'floz',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cups: 'cup',

  // Length
  meter: 'm',
  meters: 'm',
  metre: 'm',
  metres: 'm',
  mtr: 'm',
  mtrs: 'm',
  centimeter: 'cm',
  centimeters: 'cm',
  centimetre: 'cm',
  centimetres: 'cm',
  cms: 'cm',
  millimeter: 'mm',
  millimeters: 'mm',
  millimetre: 'mm',
  millimetres: 'mm',
  inch: 'in',
  inches: 'in',
  foot: 'ft',
  feet: 'ft',
  yard: 'yd',
  yards: 'yd',

  // Count
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  unit: 'pcs',
  units: 'pcs',
  item: 'pcs',
  items: 'pcs',
  nos: 'pcs',
  no: 'pcs',
  dozen: 'dz',
  dozens: 'dz',
  doz: 'dz',
  packet: 'pack',
  packets: 'pack',
  pkt: 'pack',
  pkts: 'pack',
  boxes: 'box',
  sheets: 'sheet',
  bottles: 'bottle',
  cans: 'can',
  bags: 'bag',
  rolls: 'roll',
};

// Popular units for quick-selection dropdowns
export const POPULAR_UNITS = [
  { value: 'kg', label: 'kg (Kilograms)', family: 'mass' },
  { value: 'g', label: 'g (Grams)', family: 'mass' },
  { value: 'mg', label: 'mg (Milligrams)', family: 'mass' },
  { value: 'l', label: 'L (Liters)', family: 'volume' },
  { value: 'ml', label: 'ml (Milliliters)', family: 'volume' },
  { value: 'tbsp', label: 'tbsp (Tablespoon)', family: 'volume' },
  { value: 'tsp', label: 'tsp (Teaspoon)', family: 'volume' },
  { value: 'm', label: 'm (Meters)', family: 'length' },
  { value: 'cm', label: 'cm (Centimeters)', family: 'length' },
  { value: 'mm', label: 'mm (Millimeters)', family: 'length' },
  { value: 'in', label: 'in (Inches)', family: 'length' },
  { value: 'pcs', label: 'pcs (Pieces / Units)', family: 'count' },
  { value: 'dz', label: 'dz (Dozen)', family: 'count' },
  { value: 'pack', label: 'pack (Packets)', family: 'count' },
  { value: 'box', label: 'box (Boxes)', family: 'count' },
  { value: 'sheet', label: 'sheet (Sheets)', family: 'count' },
  { value: 'bottle', label: 'bottle (Bottles)', family: 'count' },
  { value: 'can', label: 'can (Cans)', family: 'count' },
  { value: 'roll', label: 'roll (Rolls)', family: 'count' },
];

export function normalizeUnit(unitStr?: string): string {
  if (!unitStr) return 'pcs';
  const clean = unitStr.trim().toLowerCase();
  return UNIT_ALIASES[clean] || clean;
}

export function getUnitFamily(unitStr: string): UnitFamily | null {
  const norm = normalizeUnit(unitStr);
  return UNIT_DEFINITIONS[norm]?.family || null;
}

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const normA = normalizeUnit(unitA);
  const normB = normalizeUnit(unitB);
  if (normA === normB) return true;
  const famA = getUnitFamily(normA);
  const famB = getUnitFamily(normB);
  return famA !== null && famA === famB;
}

export function convertUnits(value: number, fromUnit: string, toUnit: string): number {
  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);
  if (normFrom === normTo) return value;

  const defFrom = UNIT_DEFINITIONS[normFrom];
  const defTo = UNIT_DEFINITIONS[normTo];

  if (!defFrom || !defTo || defFrom.family !== defTo.family) {
    throw new Error(`Cannot convert between '${fromUnit}' and '${toUnit}'.`);
  }

  const baseValue = value * defFrom.scaleToBase;
  return baseValue / defTo.scaleToBase;
}

export function calculateRecipeCoverageClient(
  purchaseQty: number,
  purchaseUnit: string,
  usageQty: number,
  usageUnit: string
): { unitsCovered?: number; error?: string } {
  if (purchaseQty <= 0) {
    return { error: 'Purchase quantity must be greater than 0' };
  }
  if (usageQty <= 0) {
    return { error: 'Usage per item must be greater than 0' };
  }

  if (!areUnitsCompatible(purchaseUnit, usageUnit)) {
    return {
      error: `Incompatible units: '${purchaseUnit}' and '${usageUnit}' are different measurement types (e.g. mass vs volume).`,
    };
  }

  try {
    const convertedPurchase = convertUnits(purchaseQty, purchaseUnit, usageUnit);
    const coverage = convertedPurchase / usageQty;
    return { unitsCovered: coverage };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Conversion failed' };
  }
}
