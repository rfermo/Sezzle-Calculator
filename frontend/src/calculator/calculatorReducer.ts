import { formatNumber, SIGNIFICANT_DIGITS } from './formatNumber'

export const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export type Digit = (typeof DIGITS)[number]

/** Matches the significant digits results are formatted to, so entered values display losslessly. */
export const MAX_DIGITS = SIGNIFICANT_DIGITS

export type Operator = '+'

/** An operation on the displayed number alone, applied as soon as its key is pressed. */
export type UnaryOperation = 'sqrt'

/** A binary operator waiting for its right-hand operand. */
export interface PendingOperation {
  operator: Operator
  left: number
}

/**
 * An API request the reducer wants made. The reducer stays pure by describing the I/O here;
 * `useCalculator` performs it and reports back with `calculationSucceeded` or `calculationFailed`.
 */
export type Calculation =
  | {
      kind: 'binary'
      operator: Operator
      left: number
      right: number
      /** The operator to leave pending once the result arrives, when the request was triggered by chaining. */
      next: Operator | null
    }
  | { kind: 'unary'; operation: UnaryOperation; operand: number }

export interface CalculatorState {
  /** The number on screen, kept as a string so `0.` and `-0.50` survive until submitted. */
  display: string
  pending: PendingOperation | null
  /**
   * `editing`: the display is a number being typed. `settled`: it holds a finished value (a result,
   * or an operand already captured in `pending`), so the next digit starts a fresh number.
   * `operand`: like `settled`, but the value is also the right-hand operand of `pending` (the result
   * of a unary operation mid-expression), so `=` or another operator can use it. Only occurs while
   * `pending` is set.
   */
  entry: 'editing' | 'settled' | 'operand'
  /** Non-null while a request is in flight. */
  calculation: Calculation | null
  error: string | null
}

export type KeyAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'clear' }
  | { type: 'backspace' }
  | { type: 'toggleSign' }
  | { type: 'operator'; operator: Operator }
  | { type: 'unary'; operation: UnaryOperation }
  | { type: 'equals' }

type CalculationOutcome =
  | { type: 'calculationSucceeded'; result: number }
  | { type: 'calculationFailed'; message: string }

export type CalculatorAction = KeyAction | CalculationOutcome

export const initialState: CalculatorState = {
  display: '0',
  pending: null,
  entry: 'editing',
  calculation: null,
  error: null,
}

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

/** Typing over a settled value starts a new number, which is the same as typing onto a lone zero. */
function typedDisplay(state: CalculatorState): string {
  return state.entry === 'editing' ? state.display : '0'
}

function requestCalculation(pending: PendingOperation, display: string, next: Operator | null): Calculation {
  return { kind: 'binary', operator: pending.operator, left: pending.left, right: Number(display), next }
}

function chooseOperator(state: CalculatorState, operator: Operator): CalculatorState {
  if (state.pending === null) {
    return { ...state, pending: { operator, left: Number(state.display) }, entry: 'settled' }
  }
  if (state.entry === 'settled') {
    // No right-hand operand yet, so this is a change of mind rather than a chained calculation.
    return { ...state, pending: { ...state.pending, operator } }
  }
  return { ...state, calculation: requestCalculation(state.pending, state.display, operator) }
}

function evaluate(state: CalculatorState): CalculatorState {
  // Without a right-hand operand there is nothing to compute, so `=` is ignored.
  if (state.pending === null || state.entry === 'settled') {
    return state
  }
  return { ...state, calculation: requestCalculation(state.pending, state.display, null) }
}

/** Unlike a binary operator this needs no second operand, so it always acts on whatever is displayed. */
function applyUnary(state: CalculatorState, operation: UnaryOperation): CalculatorState {
  return { ...state, calculation: { kind: 'unary', operation, operand: Number(state.display) } }
}

function applyKey(state: CalculatorState, action: KeyAction): CalculatorState {
  switch (action.type) {
    case 'digit':
      return { ...state, display: enterDigit(typedDisplay(state), action.digit), entry: 'editing' }
    case 'decimal':
      return { ...state, display: enterDecimal(typedDisplay(state)), entry: 'editing' }
    case 'clear':
      return initialState
    case 'backspace':
      // A settled value is not being typed, so there is nothing to delete from it.
      return state.entry === 'editing' ? { ...state, display: deleteLastCharacter(state.display) } : state
    case 'toggleSign':
      // After an operator the display still shows the captured left operand; negating it would not change the calculation.
      return state.entry === 'settled' && state.pending !== null
        ? state
        : { ...state, display: toggleSign(state.display) }
    case 'operator':
      return chooseOperator(state, action.operator)
    case 'unary':
      return applyUnary(state, action.operation)
    case 'equals':
      return evaluate(state)
  }
}

function completeCalculation(state: CalculatorState, result: number): CalculatorState {
  const { calculation } = state
  if (calculation === null) {
    return state
  }
  const display = formatNumber(result)
  if (calculation.kind === 'unary') {
    // The expression in progress is untouched: the result replaces only the number it was applied to.
    return { ...state, display, entry: state.pending === null ? 'settled' : 'operand', calculation: null, error: null }
  }
  return {
    display,
    // Chaining continues from the displayed value, so what the user sees is what the next step uses.
    pending: calculation.next === null ? null : { operator: calculation.next, left: Number(display) },
    entry: 'settled',
    calculation: null,
    error: null,
  }
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'calculationSucceeded':
      return completeCalculation(state, action.result)
    case 'calculationFailed':
      // Display and pending operation are kept so the user can retry with `=`.
      return state.calculation === null ? state : { ...state, calculation: null, error: action.message }
    default:
      // The keys are disabled while a request is in flight; ignoring them here keeps the reducer safe on its own.
      return state.calculation === null ? { ...applyKey(state, action), error: null } : state
  }
}
