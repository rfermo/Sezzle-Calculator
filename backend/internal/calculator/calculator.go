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

// Percentage returns a percent of b, that is a * b / 100. For example, Percentage(15, 200) is 30.
func Percentage(a, b float64) (float64, error) {
	// a*b can overflow even when a*b/100 fits, so only then divide first. Dividing first always
	// would round slightly differently for ordinary inputs.
	if product := a * b; !math.IsInf(product, 0) {
		return requireFinite(product / 100)
	}
	return requireFinite(a / 100 * b)
}

func requireFinite(result float64) (float64, error) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrResultNotFinite
	}
	return result, nil
}
