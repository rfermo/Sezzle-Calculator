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

// ErrNegativeSquareRoot means the square root of a negative number was requested, which has no
// real result.
var ErrNegativeSquareRoot = errors.New("Cannot take the square root of a negative number")

// Add returns a + b.
func Add(a, b float64) (float64, error) {
	return requireFinite(a + b)
}

// Subtract returns a - b.
func Subtract(a, b float64) (float64, error) {
	return requireFinite(a - b)
}

// Multiply returns a * b. Products too small to represent underflow to zero rather than failing.
func Multiply(a, b float64) (float64, error) {
	return requireFinite(a * b)
}

// Divide returns a / b. A zero divisor is rejected explicitly because float64 division would
// otherwise yield ±Inf, or NaN for 0/0, which would be reported as a generic non-finite result.
func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return requireFinite(a / b)
}

// Power returns base raised to exp. It follows math.Pow, so 0^0 is 1. Results that overflow or are
// undefined (e.g. a negative base with a fractional exponent) are reported as ErrResultNotFinite,
// as is a zero base with a negative exponent, which math.Pow evaluates to +Inf.
func Power(base, exp float64) (float64, error) {
	return requireFinite(math.Pow(base, exp))
}

// Sqrt returns the square root of a. Negative inputs are rejected explicitly rather than left to
// math.Sqrt's NaN, so callers can tell a domain error from an overflow.
func Sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, ErrNegativeSquareRoot
	}
	// math.Sqrt(-0) is -0, which JSON would encode as "-0".
	if a == 0 {
		return 0, nil
	}
	return requireFinite(math.Sqrt(a))
}

func requireFinite(result float64) (float64, error) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrResultNotFinite
	}
	return result, nil
}
