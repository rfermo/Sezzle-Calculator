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

func TestSqrt(t *testing.T) {
	tests := []struct {
		name    string
		a       float64
		want    float64
		wantErr error
	}{
		{"zero", 0, 0, nil},
		{"one", 1, 1, nil},
		{"perfect square", 144, 12, nil},
		{"large perfect square", 1e12, 1e6, nil},
		{"decimal perfect square", 0.25, 0.5, nil},
		{"non-perfect square", 2, math.Sqrt2, nil},
		{"fraction below one", 0.01, 0.1, nil},
		{"largest finite value", math.MaxFloat64, math.Sqrt(math.MaxFloat64), nil},
		{"smallest denormal", math.SmallestNonzeroFloat64, math.Sqrt(math.SmallestNonzeroFloat64), nil},
		{"negative", -4, 0, ErrNegativeSquareRoot},
		{"negative fraction", -0.25, 0, ErrNegativeSquareRoot},
		{"negative infinity", math.Inf(-1), 0, ErrNegativeSquareRoot},
		{"positive infinity", math.Inf(1), 0, ErrResultNotFinite},
		{"NaN", math.NaN(), 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Sqrt(tt.a)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Sqrt(%v) error = %v, want %v", tt.a, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Sqrt(%v) = %v, want %v", tt.a, got, tt.want)
			}
		})
	}
}

func TestSqrtOfNegativeZeroIsPositiveZero(t *testing.T) {
	got, err := Sqrt(math.Copysign(0, -1))

	if err != nil {
		t.Fatalf("Sqrt(-0) error = %v, want nil", err)
	}
	if math.Signbit(got) {
		t.Errorf("Sqrt(-0) = -0, want +0 (JSON would encode it as \"-0\")")
	}
}
