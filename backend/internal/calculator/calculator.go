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

// ErrNegativeSquareRoot means the square root of a negative number was requested, which has no
// real result.
var ErrNegativeSquareRoot = errors.New("Cannot take the square root of a negative number")

// Add returns a + b.
func Add(a, b float64) (float64, error) {
	return requireFinite(a + b)
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
