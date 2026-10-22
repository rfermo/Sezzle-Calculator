import {
  calculatorReducer,
  initialState,
  MAX_DIGITS,
  type CalculatorAction,
  type CalculatorState,
  type Digit,
} from './calculatorReducer'

function run(actions: CalculatorAction[], from: CalculatorState = initialState): CalculatorState {
  return actions.reduce(calculatorReducer, from)
}

function digits(sequence: string): CalculatorAction[] {
  return [...sequence].map((digit) => ({ type: 'digit', digit: digit as Digit }))
}

const decimal: CalculatorAction = { type: 'decimal' }
const clear: CalculatorAction = { type: 'clear' }
const backspace: CalculatorAction = { type: 'backspace' }
const toggleSign: CalculatorAction = { type: 'toggleSign' }

describe('calculatorReducer', () => {
  describe('digit entry', () => {
    it('starts at zero', () => {
      expect(initialState.display).toBe('0')
    })

    it('appends digits in order', () => {
      expect(run(digits('1234')).display).toBe('1234')
    })

    it('replaces a leading zero instead of extending it', () => {
      expect(run(digits('05')).display).toBe('5')
    })

    it('keeps a single zero when zero is pressed repeatedly', () => {
      expect(run(digits('000')).display).toBe('0')
    })

    it('keeps zeros after a nonzero digit', () => {
      expect(run(digits('100')).display).toBe('100')
    })

    it('starts a fresh number after backspacing a negative digit to zero', () => {
      expect(run([...digits('5'), toggleSign, backspace, ...digits('7')]).display).toBe('7')
    })
  })

  describe('decimal point', () => {
    it('appends a decimal point to zero', () => {
      expect(run([decimal]).display).toBe('0.')
    })

    it('appends a decimal point after digits', () => {
      expect(run([...digits('12'), decimal, ...digits('5')]).display).toBe('12.5')
    })

    it('keeps zeros after the decimal point', () => {
      expect(run([decimal, ...digits('050')]).display).toBe('0.050')
    })

    it('allows only one decimal point', () => {
      expect(run([...digits('1'), decimal, decimal, ...digits('2'), decimal]).display).toBe('1.2')
    })
  })

  describe('max digit limit', () => {
    const atLimit = '1'.repeat(MAX_DIGITS)

    it('ignores digits beyond the limit', () => {
      expect(run(digits(atLimit + '2')).display).toBe(atLimit)
    })

    it('ignores a decimal point once the limit is reached', () => {
      expect(run([...digits(atLimit), decimal]).display).toBe(atLimit)
    })

    it('does not count the decimal point or sign toward the limit', () => {
      const state = run([...digits('1'), toggleSign, decimal, ...digits('1'.repeat(MAX_DIGITS - 1))])

      expect(state.display).toBe(`-1.${'1'.repeat(MAX_DIGITS - 1)}`)
    })

    it('counts digits after the decimal point', () => {
      const state = run([...digits('1'), decimal, ...digits('1'.repeat(MAX_DIGITS))])

      expect(state.display).toBe(`1.${'1'.repeat(MAX_DIGITS - 1)}`)
    })

    it('accepts input again after backspace frees a digit', () => {
      expect(run([...digits(atLimit), backspace, ...digits('2')]).display).toBe(
        `${'1'.repeat(MAX_DIGITS - 1)}2`,
      )
    })
  })

  describe('backspace', () => {
    it('removes the last digit', () => {
      expect(run([...digits('123'), backspace]).display).toBe('12')
    })

    it('returns to zero when the last digit is removed', () => {
      expect(run([...digits('7'), backspace]).display).toBe('0')
    })

    it('stays at zero when there is nothing to remove', () => {
      expect(run([backspace]).display).toBe('0')
    })

    it('removes a trailing decimal point', () => {
      expect(run([...digits('3'), decimal, backspace]).display).toBe('3')
    })

    it('allows the decimal point to be re-entered after removing it', () => {
      expect(run([...digits('3'), decimal, backspace, decimal, ...digits('5')]).display).toBe('3.5')
    })

    it('returns to zero from a negative single digit rather than leaving a bare sign', () => {
      expect(run([...digits('5'), toggleSign, backspace]).display).toBe('0')
    })

    it('returns to zero from a negative zero point rather than leaving -0', () => {
      expect(run([decimal, toggleSign, backspace]).display).toBe('0')
    })
  })

  describe('clear', () => {
    it('resets to the initial state', () => {
      expect(run([...digits('12'), decimal, ...digits('5'), toggleSign, clear])).toEqual(initialState)
    })
  })

  describe('sign toggle', () => {
    it('negates a positive number', () => {
      expect(run([...digits('42'), toggleSign]).display).toBe('-42')
    })

    it('restores a negative number', () => {
      expect(run([...digits('42'), toggleSign, toggleSign]).display).toBe('42')
    })

    it('leaves zero unsigned', () => {
      expect(run([toggleSign]).display).toBe('0')
    })

    it('negates a number with a trailing decimal point', () => {
      expect(run([...digits('4'), decimal, toggleSign]).display).toBe('-4.')
    })

    it('allows entering a negative fraction', () => {
      expect(run([decimal, toggleSign, ...digits('5')]).display).toBe('-0.5')
    })

    it('keeps accepting digits after negation', () => {
      expect(run([...digits('4'), toggleSign, ...digits('2')]).display).toBe('-42')
    })
  })

  it('does not mutate the previous state', () => {
    const state = Object.freeze({ display: '12' })

    expect(calculatorReducer(state, { type: 'digit', digit: '3' })).toEqual({ display: '123' })
    expect(state.display).toBe('12')
  })
})
