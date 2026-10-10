export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatPriceDelta(cents: number): string {
  if (cents === 0) return '';
  const sign = cents > 0 ? '+' : '−';
  return ` ${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
