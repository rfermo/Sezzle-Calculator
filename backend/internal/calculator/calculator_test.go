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

func TestDivide(t *testing.T) {
	negativeZero := math.Copysign(0, -1)
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr error
	}{
		{"exact quotient", 6, 3, 2, nil},
		{"fractional result", 1, 4, 0.25, nil},
		{"negative dividend", -6, 3, -2, nil},
		{"negative divisor", 6, -3, -2, nil},
		{"two negatives", -6, -3, 2, nil},
		{"decimal operands", 7.5, 2.5, 3, nil},
		{"zero dividend", 0, 5, 0, nil},
		{"dividing by one", 4.5, 1, 4.5, nil},
		{"zero divisor", 5, 0, 0, ErrDivisionByZero},
		{"negative zero divisor", 5, negativeZero, 0, ErrDivisionByZero},
		{"zero divided by zero", 0, 0, 0, ErrDivisionByZero},
		{"zero divided by negative zero", 0, negativeZero, 0, ErrDivisionByZero},
		{"infinite dividend by zero reports the zero divisor", math.Inf(1), 0, 0, ErrDivisionByZero},
		{"overflow", math.MaxFloat64, 0.5, 0, ErrResultNotFinite},
		{"negative overflow", -math.MaxFloat64, 0.5, 0, ErrResultNotFinite},
		{"infinity over infinity is NaN", math.Inf(1), math.Inf(1), 0, ErrResultNotFinite},
		{"NaN operand", math.NaN(), 1, 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Divide(tt.a, tt.b)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Divide(%v, %v) error = %v, want %v", tt.a, tt.b, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Divide(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
