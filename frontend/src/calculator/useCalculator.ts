import { useEffect, useReducer } from 'react'
import { add, ApiError, divide } from '../api/client'
import { calculatorReducer, initialState, type Operator } from './calculatorReducer'

const OPERATIONS: Record<Operator, (a: number, b: number) => Promise<number>> = {
  '+': add,
  '÷': divide,
}

const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/** Wording for domain errors, so the UI copy does not depend on the backend's technical messages. */
const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  division_by_zero: 'Cannot divide by zero.',
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return UNEXPECTED_ERROR_MESSAGE
  }
  return FRIENDLY_ERROR_MESSAGES[error.code] ?? error.message
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
