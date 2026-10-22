package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/rfermo/sezzle-calculator/backend/internal/calculator"
)

// operandsRequest is the body of a binary operation. Pointer fields tell a missing operand
// apart from an explicit 0.
type operandsRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

type resultResponse struct {
	Result float64 `json:"result"`
}

// binaryOperation is the shape of every two-operand function in the calculator package.
type binaryOperation func(a, b float64) (float64, error)

// handleBinary adapts a binaryOperation into a handler, so adding an operation is one function
// plus one route and the decoding, validation and error mapping stay identical across them.
func handleBinary(op binaryOperation) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req operandsRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		a, ok := requireOperand(w, "a", req.A)
		if !ok {
			return
		}
		b, ok := requireOperand(w, "b", req.B)
		if !ok {
			return
		}

		result, err := op(a, b)
		if err != nil {
			writeOperationError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resultResponse{Result: result})
	}
}

// requireOperand unwraps a decoded operand, writing the 400 response itself when it is absent.
func requireOperand(w http.ResponseWriter, name string, value *float64) (float64, bool) {
	if value == nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest, fmt.Sprintf("field %q is required", name))
		return 0, false
	}
	return *value, true
}

// writeOperationError maps calculator errors to responses. Anything unrecognised is a bug on our
// side, so it is logged and reported as a 500 without leaking the error text.
func writeOperationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, calculator.ErrResultNotFinite):
		writeError(w, http.StatusUnprocessableEntity, codeResultNotFinite, err.Error())
	default:
		slog.Error("operation failed", "error", err)
		writeError(w, http.StatusInternalServerError, codeInternal, "internal server error")
	}
}
