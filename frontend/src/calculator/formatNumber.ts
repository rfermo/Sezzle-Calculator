/** Enough to hide binary float noise (`0.1 + 0.2`) while keeping every digit a user can type. */
export const SIGNIFICANT_DIGITS = 12

/**
 * Formats a result for the display. Rounding to significant digits and converting back to a number
 * drops the trailing zeros that `toPrecision` pads on, and normalises `-0` to `0`.
 */
export function formatNumber(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)))
}
