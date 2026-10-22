import { act, renderHook } from '@testing-library/react'
import { add, ApiError, divide, multiply, power, sqrt, subtract } from '../api/client'
import type { CalculatorAction, Digit } from './calculatorReducer'
import { useCalculator } from './useCalculator'

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  add: vi.fn(),
  subtract: vi.fn(),
  multiply: vi.fn(),
  divide: vi.fn(),
  power: vi.fn(),
  sqrt: vi.fn(),
}))

const addMock = vi.mocked(add)
const subtractMock = vi.mocked(subtract)
const multiplyMock = vi.mocked(multiply)
const divideMock = vi.mocked(divide)
const powerMock = vi.mocked(power)
const sqrtMock = vi.mocked(sqrt)

const digit = (value: Digit): CalculatorAction => ({ type: 'digit', digit: value })
const plus: CalculatorAction = { type: 'operator', operator: '+' }
const minus: CalculatorAction = { type: 'operator', operator: '−' }
const times: CalculatorAction = { type: 'operator', operator: '×' }
const dividedBy: CalculatorAction = { type: 'operator', operator: '÷' }
const raisedTo: CalculatorAction = { type: 'operator', operator: 'xʸ' }
const equals: CalculatorAction = { type: 'equals' }
const squareRoot: CalculatorAction = { type: 'unary', operation: 'sqrt' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup() {
  const { result } = renderHook(() => useCalculator())
  const press = async (...actions: CalculatorAction[]) => {
    await act(async () => {
      for (const action of actions) {
        result.current.dispatch(action)
      }
    })
  }
  return { result, press }
}

describe('useCalculator', () => {
  afterEach(() => {
    addMock.mockReset()
    subtractMock.mockReset()
    multiplyMock.mockReset()
    divideMock.mockReset()
    powerMock.mockReset()
    sqrtMock.mockReset()
  })

  it('calls power, not add, with the base and exponent for the power operator', async () => {
    powerMock.mockResolvedValue(1024)
    const { result, press } = setup()

    await press(digit('2'), raisedTo, digit('1'), digit('0'), equals)

    expect(powerMock).toHaveBeenCalledExactlyOnceWith(2, 10)
    expect(addMock).not.toHaveBeenCalled()
    expect(result.current.display).toBe('1024')
  })

  it('exposes the message when power has no finite result', async () => {
    powerMock.mockRejectedValue(new ApiError('result_not_finite', 'result is not a finite number'))
    const { result, press } = setup()

    await press(digit('0'), raisedTo, digit('1'), { type: 'toggleSign' }, equals)

    expect(result.current).toMatchObject({ error: 'result is not a finite number', display: '-1' })
  })

  it('starts idle on zero', () => {
    const { result } = setup()

    expect(result.current).toMatchObject({ display: '0', error: null, isLoading: false })
  })

  it('calls add once with both operands when equals is pressed', async () => {
    addMock.mockResolvedValue(5)
    const { result, press } = setup()

    await press(digit('2'), plus, digit('3'), equals)

    expect(addMock).toHaveBeenCalledExactlyOnceWith(2, 3)
    expect(result.current.display).toBe('5')
  })

  it('calls subtract, and not add, for the minus operator', async () => {
    subtractMock.mockResolvedValue(-3)
    const { result, press } = setup()

    await press(digit('5'), minus, digit('8'), equals)

    expect(subtractMock).toHaveBeenCalledExactlyOnceWith(5, 8)
    expect(addMock).not.toHaveBeenCalled()
    expect(result.current.display).toBe('-3')
  })

  it('calls multiply, not add, for the multiplication operator', async () => {
    multiplyMock.mockResolvedValue(42)
    const { result, press } = setup()

    await press(digit('6'), times, digit('7'), equals)

    expect(multiplyMock).toHaveBeenCalledExactlyOnceWith(6, 7)
    expect(addMock).not.toHaveBeenCalled()
    expect(result.current.display).toBe('42')
  })

  it('reports loading until the request settles', async () => {
    const request = deferred<number>()
    addMock.mockReturnValue(request.promise)
    const { result, press } = setup()

    await press(digit('2'), plus, digit('3'), equals)
    expect(result.current.isLoading).toBe(true)

    await act(async () => request.resolve(5))
    expect(result.current.isLoading).toBe(false)
  })

  it('does not call add for an operator alone', async () => {
    const { press } = setup()

    await press(digit('2'), plus)

    expect(addMock).not.toHaveBeenCalled()
  })

  it('calls add for a chained operator with the next operator pending', async () => {
    addMock.mockResolvedValueOnce(3).mockResolvedValueOnce(6)
    const { result, press } = setup()

    await press(digit('1'), plus, digit('2'), plus)
    expect(addMock).toHaveBeenLastCalledWith(1, 2)
    expect(result.current.display).toBe('3')

    await press(digit('3'), equals)
    expect(addMock).toHaveBeenLastCalledWith(3, 3)
    expect(result.current.display).toBe('6')
  })

  it('exposes the message of an ApiError', async () => {
    addMock.mockRejectedValue(new ApiError('result_not_finite', 'result is not a finite number'))
    const { result, press } = setup()

    await press(digit('2'), plus, digit('3'), equals)

    expect(result.current).toMatchObject({
      error: 'result is not a finite number',
      isLoading: false,
      display: '3',
    })
  })

  it('calls divide, not add, for the divide operator', async () => {
    divideMock.mockResolvedValue(0.25)
    const { result, press } = setup()

    await press(digit('1'), dividedBy, digit('4'), equals)

    expect(divideMock).toHaveBeenCalledExactlyOnceWith(1, 4)
    expect(addMock).not.toHaveBeenCalled()
    expect(result.current.display).toBe('0.25')
  })

  it('replaces the technical division_by_zero message with a friendly one', async () => {
    divideMock.mockRejectedValue(new ApiError('division_by_zero', 'division by zero'))
    const { result, press } = setup()

    await press(digit('1'), dividedBy, digit('0'), equals)

    expect(result.current).toMatchObject({
      error: 'Cannot divide by zero.',
      isLoading: false,
      display: '0',
    })
  })

  it('calls sqrt once with the displayed number as soon as the key is pressed', async () => {
    sqrtMock.mockResolvedValue(12)
    const { result, press } = setup()

    await press(digit('1'), digit('4'), digit('4'), squareRoot)

    expect(sqrtMock).toHaveBeenCalledExactlyOnceWith(144)
    expect(addMock).not.toHaveBeenCalled()
    expect(result.current.display).toBe('12')
  })

  it('reports loading while sqrt is in flight', async () => {
    const request = deferred<number>()
    sqrtMock.mockReturnValue(request.promise)
    const { result, press } = setup()

    await press(digit('9'), squareRoot)
    expect(result.current.isLoading).toBe(true)

    await act(async () => request.resolve(3))
    expect(result.current.isLoading).toBe(false)
  })

  it('applies sqrt to the right-hand operand and then adds it to the left', async () => {
    sqrtMock.mockResolvedValue(4)
    addMock.mockResolvedValue(13)
    const { result, press } = setup()

    await press(digit('9'), plus, digit('1'), digit('6'), squareRoot)
    expect(sqrtMock).toHaveBeenCalledExactlyOnceWith(16)
    expect(result.current.display).toBe('4')

    await press(equals)
    expect(addMock).toHaveBeenCalledExactlyOnceWith(9, 4)
    expect(result.current.display).toBe('13')
  })

  it('exposes the message of an ApiError from sqrt', async () => {
    sqrtMock.mockRejectedValue(
      new ApiError('negative_square_root', 'Cannot take the square root of a negative number'),
    )
    const { result, press } = setup()

    await press(digit('4'), { type: 'toggleSign' }, squareRoot)

    expect(result.current).toMatchObject({
      error: 'Cannot take the square root of a negative number',
      isLoading: false,
      display: '-4',
    })
  })

  it('hides the details of an unexpected error', async () => {
    addMock.mockRejectedValue(new Error('stack trace with internals'))
    const { result, press } = setup()

    await press(digit('2'), plus, digit('3'), equals)

    expect(result.current.error).toBe('Something went wrong. Please try again.')
  })
})
