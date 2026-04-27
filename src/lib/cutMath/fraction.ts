/**
 * Convert a decimal inch value into a mixed fraction
 * { whole, numerator, denominator } rounded to the nearest 1/denominator.
 * Default denominator is 16 (matches shop-floor rebar precision).
 */
export interface InchFraction {
  whole: number;
  numerator: number;
  denominator: number;
}

export function inchesToFraction(
  inch: number,
  denominator: number = 16,
): InchFraction | number {
  if (!Number.isFinite(inch)) return NaN;
  if (inch === 0) {
    return { whole: 0, numerator: 0, denominator: 1 };
  }
  if (inch < 0) {
    throw new Error("Negative values are not allowed");
  }

  const whole = Math.floor(inch);
  const frac = inch - whole;
  const num = Math.round(frac * denominator);
  const den = denominator;

  // Roll over if rounding pushes fraction to 1
  if (num === den) {
    return { whole: whole + 1, numerator: 0, denominator: 1 };
  }

  // Reduce the fraction
  if (num === 0) return { whole, numerator: 0, denominator: 1 };
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(num, den);
  return { whole, numerator: num / g, denominator: den / g };
}
