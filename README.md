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
| 422 | `division_by_zero` | The divisor is `0` (or `-0`) |
| 422 | `result_not_finite` | The inputs are valid but the result overflows or is undefined, and JSON cannot represent it |
| 422 | `negative_square_root` | `sqrt` was given a negative number, which has no real square root |

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

### `POST /api/v1/subtract`

Returns `a - b`. Both fields are required numbers.

```bash
curl -X POST http://localhost:8080/api/v1/subtract \
  -H 'Content-Type: application/json' \
  -d '{"a": 5, "b": 8}'
```

```json
{"result": -3}
```

A difference that overflows a 64-bit float fails with `422 result_not_finite`, like `add`.

### `POST /api/v1/multiply`

Returns `a * b`. Both fields are required numbers. A product that overflows a 64-bit float fails with `422 result_not_finite`, as for `add`; a product too small to represent rounds to `0`.

```bash
curl -X POST http://localhost:8080/api/v1/multiply \
  -H 'Content-Type: application/json' \
  -d '{"a": 6, "b": 7}'
```

```json
{"result": 42}
```

### `POST /api/v1/divide`

Returns `a / b`. Both fields are required numbers.

```bash
curl -X POST http://localhost:8080/api/v1/divide \
  -H 'Content-Type: application/json' \
  -d '{"a": 1, "b": 4}'
```

```json
{"result": 0.25}
```

A zero divisor fails with `422 division_by_zero`. This includes `0 / 0`, which is reported as a division by zero rather than as an undefined result:

```bash
curl -X POST http://localhost:8080/api/v1/divide \
  -H 'Content-Type: application/json' \
  -d '{"a": 1, "b": 0}'
```

```json
{"error": {"code": "division_by_zero", "message": "division by zero"}}
```

A quotient that overflows a 64-bit float (e.g. `1.7976931348623157e308 / 0.5`) fails with `422 result_not_finite`.

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

### `POST /api/v1/sqrt`

Returns the square root of `a`. This is the only endpoint that takes a single operand: `a` is a required number and any other field, including `b`, is rejected with `400 invalid_request`.

```bash
curl -X POST http://localhost:8080/api/v1/sqrt \
  -H 'Content-Type: application/json' \
  -d '{"a": 144}'
```

```json
{"result": 12}
```

A negative number fails with `422`:

```bash
curl -X POST http://localhost:8080/api/v1/sqrt \
  -H 'Content-Type: application/json' \
  -d '{"a": -4}'
```

```json
{"error": {"code": "negative_square_root", "message": "Cannot take the square root of a negative number"}}
```

### `POST /api/v1/percentage`

Returns **`a` percent of `b`**, that is `a * b / 100`. Both fields are required numbers, and the order matters: `a` is the percent and `b` is the amount it is taken of, so `{"a": 15, "b": 200}` is 15% of 200.

```bash
curl -X POST http://localhost:8080/api/v1/percentage \
  -H 'Content-Type: application/json' \
  -d '{"a": 15, "b": 200}'
```

```json
{"result": 30}
```

The calculator's `%` key is a binary operator that follows this order: `15 % 200 =` shows `30`. Values over 100 and negative values are valid (`150` percent of `80` is `120`). A result that overflows a 64-bit float fails with `422 result_not_finite`, as for `add`. The product `a * b` is allowed to exceed the float range when `a * b / 100` does not.
