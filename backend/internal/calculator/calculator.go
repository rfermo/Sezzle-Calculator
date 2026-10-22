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

func requireFinite(result float64) (float64, error) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrResultNotFinite
	}
	return result, nil
}
