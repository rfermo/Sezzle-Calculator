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

func TestPower(t *testing.T) {
	tests := []struct {
		name      string
		base, exp float64
		want      float64
		wantErr   error
	}{
		{"integer exponent", 2, 10, 1024, nil},
		{"exponent of one", 7, 1, 7, nil},
		{"negative base with even exponent", -3, 2, 9, nil},
		{"negative base with odd exponent", -3, 3, -27, nil},
		{"negative exponent", 2, -2, 0.25, nil},
		{"fractional exponent", 9, 0.5, 3, nil},
		{"zero exponent", 5, 0, 1, nil},
		{"zero exponent with negative base", -5, 0, 1, nil},
		{"zero base", 0, 3, 0, nil},
		{"zero to the zero is one, matching math.Pow", 0, 0, 1, nil},
		{"one to any power", 1, 1e300, 1, nil},
		{"positive overflow", 10, 400, 0, ErrResultNotFinite},
		{"negative overflow", -10, 401, 0, ErrResultNotFinite},
		{"negative base with fractional exponent is undefined", -8, 0.5, 0, ErrResultNotFinite},
		{"zero base with negative exponent is infinite", 0, -1, 0, ErrResultNotFinite},
		{"negative zero base with negative odd exponent is infinite", math.Copysign(0, -1), -1, 0, ErrResultNotFinite},
		{"NaN operand", math.NaN(), 2, 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Power(tt.base, tt.exp)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Power(%v, %v) error = %v, want %v", tt.base, tt.exp, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Power(%v, %v) = %v, want %v", tt.base, tt.exp, got, tt.want)
			}
		})
	}
}
