# Sezzle Calculator

A full-stack calculator: a React + TypeScript keypad UI backed by a Go REST API that performs every operation (add, subtract, multiply, divide, exponentiation, square root and percentage).

**Note: The AI harness used to generate the code for this application to work was Claude Code using the Haiku 5.5 and Sonnet 5.5 models.** The prompts used are in [docs/prompts.md](docs/prompts.md); the requirements and the story breakdown are in [docs/requirements.md](docs/requirements.md) and [docs/stories.md](docs/stories.md).

## Contents

- [Quick start](#quick-start)
- [Prerequisites](#prerequisites)
- [Running locally](#running-locally)
- [Tests and coverage](#tests-and-coverage)
- [Docker](#docker)
- [API reference](#api-reference)
- [Design decisions and assumptions](#design-decisions-and-assumptions)
- [Project layout](#project-layout)

## Quick start

With Docker, one command builds and runs both layers on a single port:

```bash
docker build -t calculator .
docker run -p 8080:8080 calculator
```

Open <http://localhost:8080>. Without Docker, see [Running locally](#running-locally).

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Go | 1.22 or newer (the backend uses `net/http` method routing, added in 1.22) | backend |
| Node.js + npm | 24 LTS recommended (the Docker image uses it). The test toolchain needs 22.22.2+, 24.15+ or 26+ | frontend |
| Docker | any recent version | optional, for the single-image deployment |
| `make` | any | backend task runner |

No database, environment files or API keys are needed.

## Running locally

Run the two layers in two terminals. Start the backend first: the frontend dev server proxies `/api` to it.

**Backend** (<http://localhost:8080>):

```bash
cd backend
make run
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port the server listens on |
| `STATIC_DIR` | unset | Directory with the built frontend to serve. Leave it unset in dev, where Vite serves the UI |

Check that it is up: `curl http://localhost:8080/healthz` returns `{"status":"ok"}`.

**Frontend** (<http://localhost:5173>):

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to `localhost:8080` (see `frontend/vite.config.ts`), so the browser only talks to one origin and the backend needs no CORS code.

Other commands:

| Command | What it does |
|---|---|
| `make build` (in `backend/`) | Builds the server binary to `backend/bin/server` |
| `npm run build` (in `frontend/`) | Type-checks and builds the production bundle to `frontend/dist` |
| `npm run preview` (in `frontend/`) | Serves the production bundle locally |

## Tests and coverage

```bash
# Backend
cd backend
make test        # run the tests
make lint        # go vet + gofmt check
make coverage    # tests + coverage profile; fails below 90% total

# Frontend
cd frontend
npm test         # run the tests
npm run lint     # ESLint
npm run coverage # tests + coverage report; fails below 80% on any metric
```

Coverage reports:

- Backend: `backend/coverage.out` (profile) and `backend/coverage.html` (open in a browser). `make coverage` also prints the total.
- Frontend: a text summary in the terminal and an HTML report at `frontend/coverage/index.html`.

Current numbers, from a run of the commands above:

| Layer | Tests | Coverage | Enforced minimum |
|---|---|---|---|
| Backend | 366 (test cases and sub-tests) | **95.4%** of statements in total: `internal/calculator` 100%, `internal/api` 100%, `cmd/server` 79.1% | 90% |
| Frontend | 207 | **100%** statements, 97.84% branches, 100% functions, 100% lines | 80% |

The only uncovered backend code is in `cmd/server`: `main()` itself (process entry point: signal handling and `os.Exit`) and the graceful-shutdown-timeout branch in `serve`. Everything `main` calls (`run`, `serve`, config parsing) is tested. The two uncovered frontend branches are in `useCalculator.ts`.

What the tests cover:

- **Backend:** table-driven tests for each math function (including overflow, `-0` and domain errors), `httptest` handler tests for every endpoint and every request failure mode (missing field, wrong type, unknown field, malformed JSON, oversized body, wrong content type, wrong method), plus the router, 404/405 envelope, panic recovery and static file serving.
- **Frontend:** reducer unit tests, display-formatting tests, API client tests with a mocked `fetch`, hook tests, and component tests driven through the keypad with React Testing Library.

## Docker

The `Dockerfile` builds the frontend and the backend into one small image (about 23 MB). The Go server serves the UI at `/` and the API at `/api/v1/*` on a single port, so there is no CORS setup or reverse proxy.

```bash
docker build -t calculator .
docker run -p 8080:8080 calculator
```

Open <http://localhost:8080>. The build has three stages: a Node stage builds the frontend, a Go stage compiles a static binary, and a minimal Alpine stage holds only that binary and the built assets. The container runs as a non-root user, contains no sources, Node or Go toolchain, and reports its health by polling `/healthz`.

| Variable | Default in the image | Meaning |
|---|---|---|
| `PORT` | `8080` | Port the server listens on inside the container. Change the host side with `-p 9000:8080`. |
| `STATIC_DIR` | `/app/public` | Directory holding the built frontend. The server refuses to start if it has no `index.html`. |

Any `GET` outside `/api` that does not match a file returns `index.html`. Paths under `/api` keep the JSON `404`/`405` responses.

## API reference

All endpoints are under `/api/v1`, accept and return JSON, and require `Content-Type: application/json`. Every example below was run against a live server, and the output shown is what it returned. They assume the server is on `localhost:8080`.

| Method and path | Body | Result |
|---|---|---|
| `POST /api/v1/add` | `{"a", "b"}` | `a + b` |
| `POST /api/v1/subtract` | `{"a", "b"}` | `a - b` |
| `POST /api/v1/multiply` | `{"a", "b"}` | `a * b` |
| `POST /api/v1/divide` | `{"a", "b"}` | `a / b` |
| `POST /api/v1/power` | `{"a", "b"}` | `a` raised to the power `b` |
| `POST /api/v1/sqrt` | `{"a"}` | square root of `a` |
| `POST /api/v1/percentage` | `{"a", "b"}` | `a` percent of `b`, i.e. `a * b / 100` |
| `GET /healthz` | none | `{"status":"ok"}` |

Every field is a required JSON number. A success response is `{"result": <number>}` with status `200`.

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

The split is deliberate: `400` means the request itself is wrong, `422` means it is well-formed but has no mathematical answer. Clients can treat them differently (fix the request versus show the user a message).

Examples of the `400`, `404` and `405` cases:

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 2}'
```

```json
{"error":{"code":"invalid_request","message":"field \"b\" is required"}}
```

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": "2", "b": 3}'
```

```json
{"error":{"code":"invalid_request","message":"field \"a\" has an invalid type"}}
```

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 2, "b": 3, "c": 1}'
```

```json
{"error":{"code":"invalid_request","message":"unknown field \"c\""}}
```

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 2,'
```

```json
{"error":{"code":"invalid_request","message":"request body is not valid JSON"}}
```

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: text/plain' \
  -d '{"a": 2, "b": 3}'
```

```json
{"error":{"code":"invalid_request","message":"Content-Type must be application/json"}}
```

```bash
curl -X GET http://localhost:8080/api/v1/add
```

```json
{"error":{"code":"method_not_allowed","message":"method not allowed"}}
```

```bash
curl -X POST http://localhost:8080/api/v1/modulo \
  -H 'Content-Type: application/json' \
  -d '{"a": 7, "b": 2}'
```

```json
{"error":{"code":"not_found","message":"resource not found"}}
```

### `POST /api/v1/add`

Returns `a + b`.

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 2, "b": 3}'
```

```json
{"result":5}
```

The API returns the exact `float64` result. The UI rounds for display, but the API does not:

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 0.1, "b": 0.2}'
```

```json
{"result":0.30000000000000004}
```

A sum that overflows a 64-bit float fails with `422`:

```bash
curl -X POST http://localhost:8080/api/v1/add \
  -H 'Content-Type: application/json' \
  -d '{"a": 1.7976931348623157e308, "b": 1.7976931348623157e308}'
```

```json
{"error":{"code":"result_not_finite","message":"result is not a finite number"}}
```

### `POST /api/v1/subtract`

Returns `a - b`. A difference that overflows a 64-bit float fails with `422 result_not_finite`, like `add`.

```bash
curl -X POST http://localhost:8080/api/v1/subtract \
  -H 'Content-Type: application/json' \
  -d '{"a": 5, "b": 8}'
```

```json
{"result":-3}
```

### `POST /api/v1/multiply`

Returns `a * b`. A product that overflows a 64-bit float fails with `422 result_not_finite`, as for `add`; a product too small to represent rounds to `0`.

```bash
curl -X POST http://localhost:8080/api/v1/multiply \
  -H 'Content-Type: application/json' \
  -d '{"a": 6, "b": 7}'
```

```json
{"result":42}
```

### `POST /api/v1/divide`

Returns `a / b`.

```bash
curl -X POST http://localhost:8080/api/v1/divide \
  -H 'Content-Type: application/json' \
  -d '{"a": 1, "b": 4}'
```

```json
{"result":0.25}
```

A zero divisor fails with `422 division_by_zero`. This includes `0 / 0`, which is reported as a division by zero rather than as an undefined result:

```bash
curl -X POST http://localhost:8080/api/v1/divide \
  -H 'Content-Type: application/json' \
  -d '{"a": 1, "b": 0}'
```

```json
{"error":{"code":"division_by_zero","message":"division by zero"}}
```

A quotient that overflows a 64-bit float (e.g. `1.7976931348623157e308 / 0.5`) fails with `422 result_not_finite`.

### `POST /api/v1/power`

Returns `a` raised to the power `b` (`a` is the base, `b` the exponent).

```bash
curl -X POST http://localhost:8080/api/v1/power \
  -H 'Content-Type: application/json' \
  -d '{"a": 2, "b": 10}'
```

```json
{"result":1024}
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
{"error":{"code":"result_not_finite","message":"result is not a finite number"}}
```

### `POST /api/v1/sqrt`

Returns the square root of `a`. This is the only endpoint that takes a single operand: any other field, including `b`, is rejected with `400 invalid_request`.

```bash
curl -X POST http://localhost:8080/api/v1/sqrt \
  -H 'Content-Type: application/json' \
  -d '{"a": 144}'
```

```json
{"result":12}
```

A negative number fails with `422`:

```bash
curl -X POST http://localhost:8080/api/v1/sqrt \
  -H 'Content-Type: application/json' \
  -d '{"a": -4}'
```

```json
{"error":{"code":"negative_square_root","message":"Cannot take the square root of a negative number"}}
```

### `POST /api/v1/percentage`

Returns **`a` percent of `b`**, that is `a * b / 100`. The order matters: `a` is the percent and `b` is the amount it is taken of, so `{"a": 15, "b": 200}` is 15% of 200.

```bash
curl -X POST http://localhost:8080/api/v1/percentage \
  -H 'Content-Type: application/json' \
  -d '{"a": 15, "b": 200}'
```

```json
{"result":30}
```

The calculator's `%` key is a binary operator that follows this order: `15 % 200 =` shows `30`. Values over 100 and negative values are valid (`150` percent of `80` is `120`). A result that overflows a 64-bit float fails with `422 result_not_finite`, as for `add`. The product `a * b` is allowed to exceed the float range when `a * b / 100` does not.

## Design decisions and assumptions

| Decision | Choice | Why |
|---|---|---|
| Repo layout | `backend/`, `frontend/`, root `Dockerfile` | Clear layer boundaries; each layer builds and tests independently |
| Backend stack | Go, stdlib `net/http` with Go 1.22 method routing, no web framework | The API is tiny; the stdlib avoids a dependency and is idiomatic |
| Backend layout | `cmd/server` (wiring), `internal/calculator` (pure math, no HTTP), `internal/api` (handlers, JSON, errors) | Math is unit-testable without HTTP; handlers stay thin |
| API shape | One endpoint per operation: `POST /api/v1/{add,subtract,multiply,divide,power,sqrt,percentage}` | Adding an operation is a purely additive change (function + handler + route + client function + key). A single `/calculate` endpoint would make every operation edit a shared switch |
| Request and response | `{"a": n, "b": n}` → `{"result": n}`; `sqrt` takes only `a` | Uniform and easy to document |
| Input validation | Fields are pointers so a missing field is distinguishable from `0`; unknown fields are rejected; the body is capped at 1 KiB; `Content-Type: application/json` is required | Fail loudly on bad input instead of silently computing with a default |
| Errors | One JSON envelope. `400` for malformed input, `422` for valid input with no mathematical answer | Clients can handle "you sent something wrong" and "this has no answer" differently. 404/405 use the same envelope so clients parse one shape |
| Numeric type | `float64` end to end | Matches JSON and JavaScript numbers. `NaN` and `±Inf` results are rejected as `result_not_finite`, since JSON cannot encode them |
| Frontend stack | Vite + React + TypeScript (strict), Vitest + React Testing Library, ESLint | Current standard toolchain; Vitest shares the Vite config |
| Frontend model | Keypad-style calculator. A pure reducer owns the state; async API calls live in a hook, not in the reducer | The reducer is trivially unit-testable and the I/O boundary is isolated |
| Float display | Results are formatted to 12 significant digits with trailing zeros trimmed | Hides `0.1 + 0.2 = 0.30000000000000004` in the UI without changing what the backend returns |
| Dev wiring | Vite proxies `/api` to `localhost:8080` | Same-origin in dev and in Docker, so no CORS code |
| Production | One container: the Go server serves the API and the built frontend | Avoids a process supervisor or nginx sidecar for a single-image deployment |
| Percentage semantics | `percentage(a, b)` is **a% of b**, i.e. `a * b / 100` | A stateless, easily documented API. The phone-style "percent of the left operand" depends on UI state, which does not belong in a stateless endpoint |
| Coverage targets | Backend ≥ 90%, frontend ≥ 80%, both enforced by the coverage commands | A target that is only reported tends to erode |

Assumptions and known limits:

- **Precision:** arithmetic is IEEE-754 double precision, so results carry the usual floating-point error (see the `0.1 + 0.2` example). Use a decimal library and a string-based API if exact decimal arithmetic is ever required.
- **`0 / 0`** is reported as `division_by_zero`, not `result_not_finite`, because that is the cause a user can act on.
- **`0^0`** is `1`, matching Go's `math.Pow`.
- **Stateless service:** the backend keeps no history or session. Expression state (pending operator, chaining such as `1 + 2 + 3`) lives in the frontend reducer.
- **Unary `sqrt`** applies immediately to the displayed value, and mid-expression it operates on the current operand (`9 + 16 √` operates on `16`).
- **Out of scope:** authentication, rate limiting, persistence, and TLS. In a real deployment, TLS and rate limiting would be handled by a reverse proxy or gateway in front of the container.

## Project layout

```
backend/
  cmd/server/          entry point: config, graceful shutdown, wiring
  internal/calculator/ pure math functions and domain errors
  internal/api/        router, handlers, JSON helpers, middleware, static file serving
  Makefile             build, run, test, coverage, lint
frontend/
  src/api/             typed API client (ApiError, postOperation, one function per operation)
  src/calculator/      reducer, useCalculator hook, number formatting
  src/components/      Display and Keypad
docs/                  requirements, story breakdown, prompts used
Dockerfile             three-stage full-stack image
```
