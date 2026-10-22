import { useEffect, useReducer } from 'react'
import { add, ApiError, sqrt } from '../api/client'
import {
  calculatorReducer,
  initialState,
  type Calculation,
  type Operator,
  type UnaryOperation,
} from './calculatorReducer'

const BINARY_OPERATIONS: Record<Operator, (a: number, b: number) => Promise<number>> = {
  '+': add,
}

const UNARY_OPERATIONS: Record<UnaryOperation, (a: number) => Promise<number>> = {
  sqrt,
}

function perform(calculation: Calculation): Promise<number> {
  return calculation.kind === 'unary'
    ? UNARY_OPERATIONS[calculation.operation](calculation.operand)
    : BINARY_OPERATIONS[calculation.operator](calculation.left, calculation.right)
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
    perform(calculation).then(
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
