export function normalizeDecimalInput(value: string, locale: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const groupSeparators = parts
    .filter((part) => part.type === 'group')
    .map((part) => part.value);
  const decimalSeparator = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const localeDigits = new Intl.NumberFormat(locale, { useGrouping: false }).format(9876543210);
  const digitMap = new Map(
    Array.from(localeDigits).map((digit, index) => [digit, String(9 - index)]),
  );

  let normalized = Array.from(trimmed, (character) => digitMap.get(character) ?? character).join('');
  for (const separator of groupSeparators) {
    normalized = normalized.split(separator).join('');
  }
  if (decimalSeparator !== '.') {
    normalized = normalized.replace(decimalSeparator, '.');
  }
  return normalized;
}

export function parseDecimalInput(value: string, locale: string): number | null {
  const normalized = normalizeDecimalInput(value, locale);
  if (!normalized || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
