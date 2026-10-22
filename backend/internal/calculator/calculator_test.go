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

func TestSubtract(t *testing.T) {
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr error
	}{
		{"positive result", 8, 5, 3, nil},
		{"negative result", 5, 8, -3, nil},
		{"negative operands", -2, -5, 3, nil},
		{"subtracting a negative adds", 2, -3, 5, nil},
		{"equal operands give zero", 7, 7, 0, nil},
		{"zero minus zero", 0, 0, 0, nil},
		{"subtracting zero is the identity", 4.5, 0, 4.5, nil},
		{"zero minus a number negates it", 0, 4.5, -4.5, nil},
		// Operands are binary-exact so the comparison does not depend on rounding.
		{"decimals", 3.75, 1.25, 2.5, nil},
		{"largest finite value", math.MaxFloat64, 0, math.MaxFloat64, nil},
		{"positive overflow", math.MaxFloat64, -math.MaxFloat64, 0, ErrResultNotFinite},
		{"negative overflow", -math.MaxFloat64, math.MaxFloat64, 0, ErrResultNotFinite},
		{"infinity minus infinity is NaN", math.Inf(1), math.Inf(1), 0, ErrResultNotFinite},
		{"infinite operand", math.Inf(-1), 1, 0, ErrResultNotFinite},
		{"NaN operand", 1, math.NaN(), 0, ErrResultNotFinite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Subtract(tt.a, tt.b)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Subtract(%v, %v) error = %v, want %v", tt.a, tt.b, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Subtract(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
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
