export const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export type Digit = (typeof DIGITS)[number]

/** Matches the ~12 significant digits results are formatted to, so entered values display losslessly. */
export const MAX_DIGITS = 12

export interface CalculatorState {
  /** The number being entered, kept as a string so `0.` and `-0.50` survive until submitted. */
  display: string
}

export type CalculatorAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'clear' }
  | { type: 'backspace' }
  | { type: 'toggleSign' }

export const initialState: CalculatorState = { display: '0' }

function countDigits(display: string): number {
  return display.replace(/[^0-9]/g, '').length
}

function enterDigit(display: string, digit: Digit): string {
  // A lone zero is replaced rather than extended, so `0` then `5` shows `5`, not `05`.
  if (display === '0') {
    return digit
  }
  if (countDigits(display) >= MAX_DIGITS) {
    return display
  }
  return display + digit
}

function enterDecimal(display: string): string {
  if (display.includes('.') || countDigits(display) >= MAX_DIGITS) {
    return display
  }
  return `${display}.`
}

function deleteLastCharacter(display: string): string {
  const remaining = display.slice(0, -1)
  // A bare sign is not a number, and `-0` would display a negative zero.
  return remaining === '' || remaining === '-' || remaining === '-0' ? '0' : remaining
}

function toggleSign(display: string): string {
  // Zero has no sign, and toggling it would produce a negative zero. `0.` is not a lone zero, so `-0.5` is still typeable.
  if (display === '0') {
    return display
  }
  return display.startsWith('-') ? display.slice(1) : `-${display}`
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'digit':
      return { display: enterDigit(state.display, action.digit) }
    case 'decimal':
      return { display: enterDecimal(state.display) }
    case 'clear':
      return initialState
    case 'backspace':
      return { display: deleteLastCharacter(state.display) }
    case 'toggleSign':
      return { display: toggleSign(state.display) }
  }
}
