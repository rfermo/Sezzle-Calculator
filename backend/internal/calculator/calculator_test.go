package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestMultiply(t *testing.T) {
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr error
	}{
		{"positive", 6, 7, 42, nil},
		{"negative times negative", -6, -7, 42, nil},
		{"mixed signs", -6, 7, -42, nil},
		{"zero annihilates", 0, 12345.5, 0, nil},
		{"zero times zero", 0, 0, 0, nil},
		{"one is the identity", 1, -4.5, -4.5, nil},
		// Operands are binary-exact so the comparison does not depend on rounding.
		{"decimals", 1.5, 2.5, 3.75, nil},
		{"negative decimals", -0.5, 0.25, -0.125, nil},
		{"largest finite value", math.MaxFloat64, 1, math.MaxFloat64, nil},
		{"positive overflow", math.MaxFloat64, 2, 0, ErrResultNotFinite},
		{"negative overflow", math.MaxFloat64, -2, 0, ErrResultNotFinite},
		{"underflow rounds to zero", math.SmallestNonzeroFloat64, 0.25, 0, nil},
		{"infinity times zero is NaN", math.Inf(1), 0, 0, ErrResultNotFinite},
		{"infinite operand", math.Inf(1), 2, 0, ErrResultNotFinite},
		{"NaN operand", math.NaN(), 1, 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Multiply(tt.a, tt.b)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Multiply(%v, %v) error = %v, want %v", tt.a, tt.b, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Multiply(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

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
