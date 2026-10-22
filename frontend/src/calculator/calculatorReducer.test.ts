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
const plus: CalculatorAction = { type: 'operator', operator: '+' }
const minus: CalculatorAction = { type: 'operator', operator: '−' }
const times: CalculatorAction = { type: 'operator', operator: '×' }
const dividedBy: CalculatorAction = { type: 'operator', operator: '÷' }
const raisedTo: CalculatorAction = { type: 'operator', operator: 'xʸ' }
const percent: CalculatorAction = { type: 'operator', operator: '%' }
const equals: CalculatorAction = { type: 'equals' }
const sqrt: CalculatorAction = { type: 'unary', operation: 'sqrt' }
const succeed = (result: number): CalculatorAction => ({ type: 'calculationSucceeded', result })
const fail = (message: string): CalculatorAction => ({ type: 'calculationFailed', message })

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

  describe('operator and equals', () => {
    it('captures the entered number as the left operand when an operator is pressed', () => {
      const state = run([...digits('2'), plus])

      expect(state.pending).toEqual({ operator: '+', left: 2 })
      expect(state.display).toBe('2')
      expect(state.calculation).toBeNull()
    })

    it('starts a fresh number for the right operand', () => {
      expect(run([...digits('2'), plus, ...digits('3')]).display).toBe('3')
    })

    it('requests a calculation on equals', () => {
      const state = run([...digits('2'), plus, ...digits('3'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 2, right: 3, next: null })
    })

    it('parses decimals and negatives in operands', () => {
      const state = run([...digits('1'), decimal, ...digits('5'), plus, ...digits('3'), decimal, toggleSign, equals])

      expect(state.calculation).toMatchObject({ left: 1.5, right: -3 })
    })

    it('shows the result and clears the pending operator when the calculation succeeds', () => {
      const state = run([...digits('2'), plus, ...digits('3'), equals, succeed(5)])

      expect(state).toEqual({ ...initialState, display: '5', entry: 'settled' })
    })

    it('formats the result for display', () => {
      expect(run([...digits('1'), plus, ...digits('2'), equals, succeed(0.1 + 0.2)]).display).toBe('0.3')
    })

    it('ignores equals when there is no pending operator', () => {
      expect(run([...digits('7'), equals])).toEqual(run(digits('7')))
    })

    it('ignores equals while the right operand is still missing', () => {
      expect(run([...digits('7'), plus, equals]).calculation).toBeNull()
    })

    it('keeps the left operand when the operator is pressed again before an operand', () => {
      const state = run([...digits('2'), plus, plus])

      expect(state.pending).toEqual({ operator: '+', left: 2 })
      expect(state.calculation).toBeNull()
      expect(state.display).toBe('2')
    })

    describe('after a result', () => {
      const afterResult = run([...digits('2'), plus, ...digits('3'), equals, succeed(5)])

      it('starts a new number when a digit is typed', () => {
        expect(run(digits('7'), afterResult).display).toBe('7')
      })

      it('starts a new decimal when the decimal point is typed', () => {
        expect(run([decimal, ...digits('5')], afterResult).display).toBe('0.5')
      })

      it('uses the result as the left operand of the next operator', () => {
        expect(run([plus], afterResult).pending).toEqual({ operator: '+', left: 5 })
      })

      it('lets the result be negated', () => {
        expect(run([toggleSign], afterResult).display).toBe('-5')
      })

      it('does not edit the result with backspace', () => {
        expect(run([backspace], afterResult).display).toBe('5')
      })

      it('does not repeat the previous calculation on a second equals', () => {
        expect(run([equals], afterResult).calculation).toBeNull()
      })
    })

    describe('while waiting for the right operand', () => {
      const afterOperator = run([...digits('5'), plus])

      it('ignores the sign toggle because there is no operand to negate yet', () => {
        expect(run([toggleSign], afterOperator).display).toBe('5')
      })

      it('ignores backspace', () => {
        expect(run([backspace], afterOperator).display).toBe('5')
      })
    })
  })

  describe('chaining', () => {
    it('requests the pending calculation when a second operator is pressed', () => {
      const state = run([...digits('1'), plus, ...digits('2'), plus])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 1, right: 2, next: '+' })
    })

    it('continues from the result with the new operator pending', () => {
      const state = run([...digits('1'), plus, ...digits('2'), plus, succeed(3)])

      expect(state.display).toBe('3')
      expect(state.pending).toEqual({ operator: '+', left: 3 })
      expect(state.entry).toBe('settled')
    })

    it('evaluates 1 + 2 + 3 to 6', () => {
      const state = run([
        ...digits('1'),
        plus,
        ...digits('2'),
        plus,
        succeed(3),
        ...digits('3'),
        equals,
      ])
      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 3, right: 3, next: null })

      expect(run([succeed(6)], state).display).toBe('6')
    })

    it('chains from the displayed (rounded) result rather than the raw one', () => {
      const state = run([...digits('1'), plus, ...digits('2'), plus, succeed(0.1 + 0.2)])

      expect(state.pending?.left).toBe(0.3)
    })
  })

  describe('subtraction', () => {
    it('captures the entered number as the left operand when minus is pressed', () => {
      expect(run([...digits('5'), minus]).pending).toEqual({ operator: '−', left: 5 })
    })

    it('requests a subtraction on equals', () => {
      const state = run([...digits('5'), minus, ...digits('8'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '−', left: 5, right: 8, next: null })
    })

    it('shows a negative result', () => {
      expect(run([...digits('5'), minus, ...digits('8'), equals, succeed(-3)]).display).toBe('-3')
    })

    it('accepts a negative right operand', () => {
      const state = run([...digits('5'), minus, ...digits('2'), toggleSign, equals])

      expect(state.calculation).toMatchObject({ left: 5, right: -2 })
    })

    it('continues from a negative result', () => {
      const state = run([...digits('5'), minus, ...digits('8'), minus, succeed(-3), ...digits('2'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '−', left: -3, right: 2, next: null })
    })

    it('replaces a pending operator that has no right operand yet', () => {
      const state = run([...digits('5'), plus, minus])

      expect(state.pending).toEqual({ operator: '−', left: 5 })
      expect(state.calculation).toBeNull()
    })

    it('chains across different operators, applying the earlier one first', () => {
      const state = run([...digits('9'), plus, ...digits('4'), minus])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 9, right: 4, next: '−' })
      expect(run([succeed(13)], state).pending).toEqual({ operator: '−', left: 13 })
    })
  })

  describe('multiplication', () => {
    it('captures the entered number as the left operand', () => {
      expect(run([...digits('6'), times]).pending).toEqual({ operator: '×', left: 6 })
    })

    it('requests a multiply calculation on equals', () => {
      const state = run([...digits('6'), times, ...digits('7'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '×', left: 6, right: 7, next: null })
    })

    it('shows the product when the calculation succeeds', () => {
      const state = run([...digits('6'), times, ...digits('7'), equals, succeed(42)])

      expect(state).toEqual({ ...initialState, display: '42', entry: 'settled' })
    })

    it('replaces a pending operator that has no right operand yet', () => {
      const state = run([...digits('6'), plus, times])

      expect(state.pending).toEqual({ operator: '×', left: 6 })
      expect(state.calculation).toBeNull()
    })

    it('evaluates the pending operator first when a different operator follows', () => {
      const state = run([...digits('2'), plus, ...digits('3'), times])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 2, right: 3, next: '×' })
      expect(run([succeed(5)], state).pending).toEqual({ operator: '×', left: 5 })
    })

    it('chains multiplications from the displayed result', () => {
      const state = run([...digits('2'), times, ...digits('3'), times, succeed(6), ...digits('4'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '×', left: 6, right: 4, next: null })
    })

    it('keeps the multiplication so it can be retried after an error', () => {
      const failed = run([...digits('6'), times, ...digits('7'), equals, fail('boom')])

      expect(failed.pending).toEqual({ operator: '×', left: 6 })
      expect(run([equals], failed).calculation).toEqual({ kind: 'binary', operator: '×', left: 6, right: 7, next: null })
    })
  })

  describe('division', () => {
    it('captures the left operand with the divide operator pending', () => {
      expect(run([...digits('8'), dividedBy]).pending).toEqual({ operator: '÷', left: 8 })
    })

    it('requests a division on equals', () => {
      const state = run([...digits('1'), dividedBy, ...digits('4'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '÷', left: 1, right: 4, next: null })
    })

    it('replaces a pending operator that has no right operand yet', () => {
      const state = run([...digits('6'), plus, dividedBy])

      expect(state.pending).toEqual({ operator: '÷', left: 6 })
      expect(state.calculation).toBeNull()
    })

    it('chains into a division, leaving divide pending after the previous step', () => {
      const state = run([...digits('6'), plus, ...digits('2'), dividedBy])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 6, right: 2, next: '÷' })
      expect(run([succeed(8)], state).pending).toEqual({ operator: '÷', left: 8 })
    })

    it('sends a zero divisor to the API rather than judging it locally', () => {
      const state = run([...digits('1'), dividedBy, ...digits('0'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '÷', left: 1, right: 0, next: null })
    })
  })

  describe('power', () => {
    it('captures the base as the left operand', () => {
      expect(run([...digits('2'), raisedTo]).pending).toEqual({ operator: 'xʸ', left: 2 })
    })

    it('requests a calculation with the base on the left and the exponent on the right', () => {
      const state = run([...digits('2'), raisedTo, ...digits('10'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: 'xʸ', left: 2, right: 10, next: null })
    })

    it('accepts a negative or fractional exponent', () => {
      const state = run([...digits('2'), raisedTo, ...digits('1'), toggleSign, decimal, ...digits('5'), equals])

      expect(state.calculation).toMatchObject({ left: 2, right: -1.5 })
    })

    it('shows the result and clears the pending operator when the calculation succeeds', () => {
      const state = run([...digits('2'), raisedTo, ...digits('10'), equals, succeed(1024)])

      expect(state).toEqual({ ...initialState, display: '1024', entry: 'settled' })
    })

    it('replaces a pending addition when pressed before the right operand', () => {
      const state = run([...digits('2'), plus, raisedTo])

      expect(state.pending).toEqual({ operator: 'xʸ', left: 2 })
      expect(state.calculation).toBeNull()
    })

    it('is replaced by addition when pressed before the right operand', () => {
      expect(run([...digits('2'), raisedTo, plus]).pending).toEqual({ operator: '+', left: 2 })
    })

    it('evaluates the pending power before moving on to another operator', () => {
      const state = run([...digits('2'), raisedTo, ...digits('3'), plus])

      expect(state.calculation).toEqual({ kind: 'binary', operator: 'xʸ', left: 2, right: 3, next: '+' })
    })

    it('evaluates the pending addition before moving on to a power', () => {
      const state = run([...digits('2'), plus, ...digits('3'), raisedTo])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 2, right: 3, next: 'xʸ' })
    })

    it('continues from the result with a chained power pending', () => {
      const state = run([...digits('2'), raisedTo, ...digits('3'), raisedTo, succeed(8)])

      expect(state.pending).toEqual({ operator: 'xʸ', left: 8 })
      expect(state.display).toBe('8')
    })

    it('keeps the calculation so it can be retried after a domain error', () => {
      const failed = run([
        ...digits('8'),
        toggleSign,
        raisedTo,
        decimal,
        ...digits('5'),
        equals,
        fail('result is not a finite number'),
      ])

      expect(failed.error).toBe('result is not a finite number')
      expect(run([equals], failed).calculation).toEqual({ kind: 'binary', operator: 'xʸ', left: -8, right: 0.5, next: null })
    })
  })

  describe('percentage', () => {
    it('captures the entered number as the percent when the key is pressed', () => {
      const state = run([...digits('15'), percent])

      expect(state.pending).toEqual({ operator: '%', left: 15 })
      expect(state.entry).toBe('settled')
    })

    it('requests a calculation with the percent on the left and the amount on the right', () => {
      const state = run([...digits('15'), percent, ...digits('200'), equals])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '%', left: 15, right: 200, next: null })
    })

    it('shows the result and clears the pending operator when the calculation succeeds', () => {
      const state = run([...digits('15'), percent, ...digits('200'), equals, succeed(30)])

      expect(state).toEqual({ ...initialState, display: '30', entry: 'settled' })
    })

    it('replaces a pending addition when pressed before the right operand', () => {
      const state = run([...digits('15'), plus, percent])

      expect(state.pending).toEqual({ operator: '%', left: 15 })
      expect(state.calculation).toBeNull()
    })

    it('evaluates the pending percentage before moving on to another operator', () => {
      const state = run([...digits('15'), percent, ...digits('200'), plus])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '%', left: 15, right: 200, next: '+' })
      expect(run([succeed(30)], state).pending).toEqual({ operator: '+', left: 30 })
    })

    it('evaluates the pending addition before moving on to a percentage', () => {
      const state = run([...digits('1'), plus, ...digits('2'), percent])

      expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 1, right: 2, next: '%' })
    })
  })

  describe('unary operations', () => {
    it('requests the operation on the displayed number immediately, without equals', () => {
      const state = run([...digits('144'), sqrt])

      expect(state.calculation).toEqual({ kind: 'unary', operation: 'sqrt', operand: 144 })
    })

    it('parses decimals and negatives in the operand', () => {
      const state = run([...digits('2'), decimal, ...digits('5'), toggleSign, sqrt])

      expect(state.calculation).toMatchObject({ operand: -2.5 })
    })

    it('applies to the initial zero', () => {
      expect(run([sqrt]).calculation).toMatchObject({ operand: 0 })
    })

    it('applies to a previous result', () => {
      const afterResult = run([...digits('2'), plus, ...digits('7'), equals, succeed(9)])

      expect(run([sqrt], afterResult).calculation).toMatchObject({ operand: 9 })
    })

    it('shows the result and leaves nothing pending when used on its own', () => {
      const state = run([...digits('144'), sqrt, succeed(12)])

      expect(state).toEqual({ ...initialState, display: '12', entry: 'settled' })
    })

    it('formats the result for display', () => {
      expect(run([...digits('2'), sqrt, succeed(Math.SQRT2 ** 2)]).display).toBe('2')
    })

    it('starts a new number when a digit is typed after the result', () => {
      expect(run([...digits('144'), sqrt, succeed(12), ...digits('5')]).display).toBe('5')
    })

    it('uses the result as the left operand of the next binary operator', () => {
      const state = run([...digits('144'), sqrt, succeed(12), plus])

      expect(state.pending).toEqual({ operator: '+', left: 12 })
    })

    it('can be applied repeatedly', () => {
      const state = run([...digits('16'), sqrt, succeed(4), sqrt])

      expect(state.calculation).toEqual({ kind: 'unary', operation: 'sqrt', operand: 4 })
    })

    describe('mid-expression', () => {
      const midExpression = run([...digits('9'), plus, ...digits('16'), sqrt])

      it('operates on the right-hand operand and keeps the pending operator', () => {
        expect(midExpression.calculation).toEqual({ kind: 'unary', operation: 'sqrt', operand: 16 })
        expect(midExpression.pending).toEqual({ operator: '+', left: 9 })
      })

      it('replaces the right-hand operand with the result and keeps the pending operator', () => {
        const state = run([succeed(4)], midExpression)

        expect(state.display).toBe('4')
        expect(state.pending).toEqual({ operator: '+', left: 9 })
        expect(state.calculation).toBeNull()
      })

      it('lets equals use the result as the right-hand operand', () => {
        const state = run([succeed(4), equals], midExpression)

        expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 9, right: 4, next: null })
      })

      it('lets a following operator chain from the result', () => {
        const state = run([succeed(4), plus], midExpression)

        expect(state.calculation).toEqual({ kind: 'binary', operator: '+', left: 9, right: 4, next: '+' })
      })

      it('works with any binary operator, not just addition', () => {
        const state = run([...digits('2'), raisedTo, ...digits('16'), sqrt, succeed(4), equals])

        expect(state.calculation).toEqual({ kind: 'binary', operator: 'xʸ', left: 2, right: 4, next: null })
      })

      it('starts a new right-hand operand when a digit is typed after the result', () => {
        const state = run([succeed(4), ...digits('7'), equals], midExpression)

        expect(state.calculation).toMatchObject({ left: 9, right: 7 })
      })

      it('does not edit the result with backspace', () => {
        expect(run([succeed(4), backspace], midExpression).display).toBe('4')
      })

      it('lets the result be negated before equals', () => {
        const state = run([succeed(4), toggleSign, equals], midExpression)

        expect(state.calculation).toMatchObject({ left: 9, right: -4 })
      })

      it('operates on the shown left operand when no right-hand operand has been entered yet', () => {
        const state = run([...digits('9'), plus, sqrt])

        expect(state.calculation).toEqual({ kind: 'unary', operation: 'sqrt', operand: 9 })
        expect(run([succeed(3), equals], state).calculation).toMatchObject({ left: 9, right: 3 })
      })
    })

    describe('when the request fails', () => {
      const failed = run([...digits('4'), toggleSign, sqrt, fail('Cannot take the square root of a negative number')])

      it('shows the message and keeps the entered number', () => {
        expect(failed.error).toBe('Cannot take the square root of a negative number')
        expect(failed.display).toBe('-4')
        expect(failed.calculation).toBeNull()
      })

      it('lets the entry be corrected, which dismisses the error', () => {
        const state = run([toggleSign, sqrt], failed)

        expect(state.error).toBeNull()
        expect(state.calculation).toEqual({ kind: 'unary', operation: 'sqrt', operand: 4 })
      })

      it('keeps the pending operator so the expression survives the error', () => {
        const state = run([...digits('9'), plus, ...digits('4'), toggleSign, sqrt, fail('boom')])

        expect(state.pending).toEqual({ operator: '+', left: 9 })
        expect(state.display).toBe('-4')
      })

      it('is cleared by the clear key', () => {
        expect(run([clear], failed)).toEqual(initialState)
      })
    })
  })

  describe('while a calculation is in flight', () => {
    const inFlight = run([...digits('2'), plus, ...digits('3'), equals])

    it('ignores key presses', () => {
      const keys: CalculatorAction[] = [...digits('9'), decimal, backspace, toggleSign, plus, sqrt, equals, clear]

      for (const key of keys) {
        expect(run([key], inFlight)).toBe(inFlight)
      }
    })

    it('ignores an outcome when nothing is in flight', () => {
      expect(run([succeed(5)])).toEqual(initialState)
      expect(run([fail('boom')])).toEqual(initialState)
    })
  })

  describe('errors', () => {
    const failed = run([...digits('2'), plus, ...digits('3'), equals, fail('Could not reach the server.')])

    it('records the message and stops waiting', () => {
      expect(failed.error).toBe('Could not reach the server.')
      expect(failed.calculation).toBeNull()
    })

    it('keeps the entered calculation so it can be retried', () => {
      expect(failed.display).toBe('3')
      expect(failed.pending).toEqual({ operator: '+', left: 2 })
      expect(run([equals], failed).calculation).toEqual({ kind: 'binary', operator: '+', left: 2, right: 3, next: null })
    })

    it('clears the error on the next key press', () => {
      expect(run(digits('4'), failed).error).toBeNull()
    })

    it('clears the error and the calculation on clear', () => {
      expect(run([clear], failed)).toEqual(initialState)
    })

    it('clears the error when a retry succeeds', () => {
      expect(run([equals, succeed(5)], failed)).toEqual({ ...initialState, display: '5', entry: 'settled' })
    })
  })

  it('does not mutate the previous state', () => {
    const state = Object.freeze({ ...initialState, display: '12' })

    expect(calculatorReducer(state, { type: 'digit', digit: '3' }).display).toBe('123')
    expect(state.display).toBe('12')
  })
})
