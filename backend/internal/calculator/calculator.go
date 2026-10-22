// Package calculator implements the arithmetic operations. It is pure math with no knowledge of
// HTTP, so it can be unit-tested directly.
package calculator

import (
	"errors"
	"math"
)

// ErrResultNotFinite means the result overflowed or is undefined (NaN). JSON cannot encode
// either, so operations report it as an error instead of returning it.
var ErrResultNotFinite = errors.New("result is not a finite number")

// ErrDivisionByZero means the divisor was zero (either sign), so the quotient is undefined.
var ErrDivisionByZero = errors.New("division by zero")

// Add returns a + b.
func Add(a, b float64) (float64, error) {
	return requireFinite(a + b)
}

// Divide returns a / b. A zero divisor is rejected explicitly because float64 division would
// otherwise yield ±Inf, or NaN for 0/0, which would be reported as a generic non-finite result.
func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return requireFinite(a / b)
}

func requireFinite(result float64) (float64, error) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrResultNotFinite
	}
	return result, nil
}
