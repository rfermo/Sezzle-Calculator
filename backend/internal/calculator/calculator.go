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

// Power returns base raised to exp. It follows math.Pow, so 0^0 is 1. Results that overflow or are
// undefined (e.g. a negative base with a fractional exponent) are reported as ErrResultNotFinite,
// as is a zero base with a negative exponent, which math.Pow evaluates to +Inf.
func Power(base, exp float64) (float64, error) {
	return requireFinite(math.Pow(base, exp))
}

func requireFinite(result float64) (float64, error) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrResultNotFinite
	}
	return result, nil
}
