package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestAdd(t *testing.T) {
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr error
	}{
		{"positive", 2, 3, 5, nil},
		{"negative", -2, -3, -5, nil},
		{"mixed signs", -5, 3, -2, nil},
		{"cancels to zero", 7, -7, 0, nil},
		{"zero plus zero", 0, 0, 0, nil},
		{"zero is the identity", 0, 4.5, 4.5, nil},
		// Operands are binary-exact so the comparison does not depend on rounding.
		{"decimals", 1.5, 2.25, 3.75, nil},
		{"negative decimals", -0.5, -0.25, -0.75, nil},
		{"largest finite value", math.MaxFloat64, 0, math.MaxFloat64, nil},
		{"positive overflow", math.MaxFloat64, math.MaxFloat64, 0, ErrResultNotFinite},
		{"negative overflow", -math.MaxFloat64, -math.MaxFloat64, 0, ErrResultNotFinite},
		{"infinity plus negative infinity is NaN", math.Inf(1), math.Inf(-1), 0, ErrResultNotFinite},
		{"infinite operand", math.Inf(1), 1, 0, ErrResultNotFinite},
		{"NaN operand", math.NaN(), 1, 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Add(tt.a, tt.b)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Add(%v, %v) error = %v, want %v", tt.a, tt.b, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Add(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestPercentage(t *testing.T) {
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr error
	}{
		{"percent of a whole number", 15, 200, 30, nil},
		{"fifty percent halves", 50, 80, 40, nil},
		{"zero percent", 0, 200, 0, nil},
		{"percent of zero", 15, 0, 0, nil},
		{"over one hundred percent", 150, 80, 120, nil},
		{"negative percent", -10, 50, -5, nil},
		{"percent of a negative", 10, -50, -5, nil},
		{"two negatives", -10, -50, 5, nil},
		// Operands are binary-exact so the comparison does not depend on rounding.
		{"decimal percent", 12.5, 80, 10, nil},
		{"fractional result", 0.5, 50, 0.25, nil},
		{"product overflows but the result fits", 1e200, 1e110, 1e308, nil},
		{"result overflows", math.MaxFloat64, math.MaxFloat64, 0, ErrResultNotFinite},
		{"negative overflow", -math.MaxFloat64, math.MaxFloat64, 0, ErrResultNotFinite},
		{"infinite operand", math.Inf(1), 1, 0, ErrResultNotFinite},
		{"infinity times zero is NaN", math.Inf(1), 0, 0, ErrResultNotFinite},
		{"NaN operand", math.NaN(), 1, 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Percentage(tt.a, tt.b)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Percentage(%v, %v) error = %v, want %v", tt.a, tt.b, err, tt.wantErr)
			}
			// Dividing first (the overflow fallback) rounds differently, so allow a tiny relative error.
			if math.Abs(got-tt.want) > 1e-12*math.Abs(tt.want) {
				t.Errorf("Percentage(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
