export function getSupportedCurrencies(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('currency');
  }
  return ['LKR', 'USD'];
}

export function isValidCurrencyCode(currencyCode: string): boolean {
  if (!/^[A-Z]{3}$/.test(currencyCode)) return false;

  try {
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
    });
    return true;
  } catch {
    return false;
  }
}

export function getCurrencyLabel(currencyCode: string, locale: string): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: 'currency' });
    return `${currencyCode} — ${displayNames.of(currencyCode) ?? currencyCode}`;
  } catch {
    return currencyCode;
  }
}
