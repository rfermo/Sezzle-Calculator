import { act, renderHook } from '@testing-library/react'
import { add, ApiError, divide } from '../api/client'
import type { CalculatorAction, Digit } from './calculatorReducer'
import { useCalculator } from './useCalculator'

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  add: vi.fn(),
  divide: vi.fn(),
}))

const addMock = vi.mocked(add)
const divideMock = vi.mocked(divide)

const digit = (value: Digit): CalculatorAction => ({ type: 'digit', digit: value })
const plus: CalculatorAction = { type: 'operator', operator: '+' }
const dividedBy: CalculatorAction = { type: 'operator', operator: '÷' }
const equals: CalculatorAction = { type: 'equals' }

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
    divideMock.mockReset()
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

  it('hides the details of an unexpected error', async () => {
    addMock.mockRejectedValue(new Error('stack trace with internals'))
    const { result, press } = setup()

    await press(digit('2'), plus, digit('3'), equals)

    expect(result.current.error).toBe('Something went wrong. Please try again.')
  })
})
