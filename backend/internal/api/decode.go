package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
)

// maxBodyBytes is generous for the largest payload (two float64 literals) while keeping a
// misbehaving client from making the server buffer anything significant.
const maxBodyBytes = 1 << 10

const unknownFieldPrefix = "json: unknown field "

var (
	errUnsupportedContentType = errors.New("Content-Type must be application/json")
	errTrailingData           = errors.New("request body must contain a single JSON object")
)

// decodeJSON strictly decodes the request body into dst: the content type must be JSON, the
// body is size-limited, unknown fields are rejected, and nothing may follow the JSON value.
//
// Request structs should use pointer fields so a missing (or null) field is distinguishable from
// a zero value. On failure it has already written the 400 invalid_request response and returns
// false, so callers just return.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := readJSON(w, r, dst); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest, describeDecodeError(err))
		return false
	}
	return true
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return errUnsupportedContentType
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}

	// A second Decode that hits EOF proves the body held exactly one value.
	switch err := dec.Decode(&json.RawMessage{}); {
	case err == nil:
		return errTrailingData
	case !errors.Is(err, io.EOF):
		return err
	}
	return nil
}

// describeDecodeError turns decoder errors into client-safe messages without leaking Go type
// names or decoder internals.
func describeDecodeError(err error) string {
	var (
		syntaxErr *json.SyntaxError
		typeErr   *json.UnmarshalTypeError
		tooLarge  *http.MaxBytesError
	)
	switch {
	case errors.Is(err, errUnsupportedContentType), errors.Is(err, errTrailingData):
		return err.Error()
	case errors.As(err, &tooLarge):
		return fmt.Sprintf("request body must not exceed %d bytes", tooLarge.Limit)
	case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
		return "request body is not valid JSON"
	case errors.As(err, &typeErr):
		if typeErr.Field == "" {
			return "request body must be a JSON object"
		}
		return fmt.Sprintf("field %q has an invalid type", typeErr.Field)
	case errors.Is(err, io.EOF):
		return "request body must not be empty"
	case strings.HasPrefix(err.Error(), unknownFieldPrefix):
		// encoding/json has no typed error for this; the message already quotes the field name.
		return "unknown field " + strings.TrimPrefix(err.Error(), unknownFieldPrefix)
	default:
		return "request body is invalid"
	}
}
