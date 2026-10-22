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
