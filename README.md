# Sezzle Calculator
**Note: The AI harness used to generate the code for this application to work was Claude Code using the Haiku 5.5 and Sonnet 5.5 models.**

Repository for the Sezzle Calculator code.

## API

All endpoints live under `/api/v1`, accept and return JSON, and require `Content-Type: application/json`.

### Errors

Every error uses the same envelope:

```json
{"error": {"code": "invalid_request", "message": "field \"b\" is required"}}
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Malformed JSON, wrong content type, missing or mistyped field, unknown field, or a body over 1 KiB |
| 404 | `not_found` | Unknown route |
| 405 | `method_not_allowed` | Wrong HTTP method (the `Allow` header lists the right one) |
| 422 | `result_not_finite` | The inputs are valid but the result overflows or is undefined, and JSON cannot represent it |

### `POST /api/v1/add`

Returns `a + b`. Both fields are required numbers.

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 2, "b": 3}'
```

```json
{"result": 5}
```

Adding two numbers whose sum overflows a 64-bit float fails with `422`:

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 1.7976931348623157e308, "b": 1.7976931348623157e308}'
```

```json
{"error": {"code": "result_not_finite", "message": "result is not a finite number"}}
```

### `POST /api/v1/power`

Returns `a` raised to the power `b` (`a` is the base, `b` the exponent). Both fields are required numbers.

```bash
curl -X POST http://localhost:8080/api/v1/power \
  -H 'Content-Type: application/json' \
  -d '{"a": 2, "b": 10}'
```

```json
{"result": 1024}
```

Negative and fractional exponents work (`{"a": 2, "b": -2}` returns `0.25`), and `0^0` is `1`, matching Go's `math.Pow`. Inputs with no finite answer fail with `422 result_not_finite`:

- the result overflows a 64-bit float (`10^400`)
- a negative base with a fractional exponent, which has no real result (`(-8)^0.5`)
- a zero base with a negative exponent, which is a division by zero in disguise (`0^-1`)

```bash
curl -X POST http://localhost:8080/api/v1/power \
  -H 'Content-Type: application/json' \
  -d '{"a": -8, "b": 0.5}'
```

```json
{"error": {"code": "result_not_finite", "message": "result is not a finite number"}}
```
