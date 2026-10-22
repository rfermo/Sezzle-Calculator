import { useEffect, useReducer } from 'react'
import { add, ApiError, subtract } from '../api/client'
import { calculatorReducer, initialState, type Operator } from './calculatorReducer'

const OPERATIONS: Record<Operator, (a: number, b: number) => Promise<number>> = {
  '+': add,
  '−': subtract,
}

const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please try again.'

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_ERROR_MESSAGE
}

/** Connects the pure reducer to the API: whenever the reducer requests a calculation, perform it and report the outcome. */
export function useCalculator() {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const { calculation } = state

  useEffect(() => {
    if (calculation === null) {
      return
    }
    // Drops the outcome if this request was superseded or the calculator unmounted while it was in flight.
    let cancelled = false
    OPERATIONS[calculation.operator](calculation.left, calculation.right).then(
      (result) => {
        if (!cancelled) {
          dispatch({ type: 'calculationSucceeded', result })
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          dispatch({ type: 'calculationFailed', message: errorMessage(error) })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [calculation])

  return { display: state.display, error: state.error, isLoading: calculation !== null, dispatch }
}
