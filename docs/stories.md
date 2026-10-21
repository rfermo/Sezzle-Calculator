# Calculator App: Stories

Work breakdown for the requirements in [requirements.md](requirements.md). Each story is a separate, reviewable commit/PR.

## Shared design decisions

| Decision | Choice | Why |
|---|---|---|
| Repo layout | `backend/`, `frontend/`, root `Dockerfile` | Clear layer boundaries; each layer builds and tests independently |
| Backend stack | Go (stdlib `net/http`, Go 1.22+ method routing), no web framework | The API is tiny; stdlib avoids a dependency and is idiomatic |
| Backend layout | `cmd/server` (wiring), `internal/calculator` (pure math, no HTTP), `internal/api` (handlers, JSON, errors) | Math is unit-testable without HTTP; handlers are thin |
| API shape | One endpoint per operation: `POST /api/v1/{add,subtract,multiply,divide,power,sqrt,percentage}` | Every operation story is a purely additive diff (new function + handler + route + client fn + key). A single `/calculate` endpoint would make every story edit a shared switch |
| Request/response | `{"a": n, "b": n}` → `{"result": n}`; `sqrt` takes only `a` | Uniform and easy to document |
| Input validation | Fields are pointers so missing is distinguishable from `0`; unknown fields rejected; body size capped; `Content-Type: application/json` required | Fail loudly on bad input |
| Errors | `{"error": {"code": "...", "message": "..."}}`. HTTP 400 `invalid_request`; HTTP 422 for domain errors (`division_by_zero`, `negative_square_root`, `result_not_finite`) | Malformed input (400) and valid input with no mathematical answer (422) are different failures, so clients can handle them differently. 404/405 also return this envelope |
| Numeric type | `float64` end to end | Matches JSON/JS numbers. Results of `NaN`/`±Inf` are rejected as `result_not_finite` since JSON can't encode them |
| Frontend stack | Vite + React + TypeScript (strict), Vitest + React Testing Library, ESLint | Current standard toolchain; Vitest shares Vite config |
| Frontend model | Keypad-style calculator. A pure reducer owns state; async API calls live in a hook, not in the reducer | Reducer is trivially unit-testable; the I/O boundary is isolated |
| Float display | Format results to ~12 significant digits and trim trailing zeros | Hides `0.1 + 0.2 = 0.30000000000000004` without changing what the backend returns |
| Dev wiring | Vite proxies `/api` → `localhost:8080`, so no CORS code | Same-origin in dev and in Docker |
| Production | One container: Go server serves the API and the built frontend | Avoids a process supervisor or nginx sidecar for a single-image deployment |
| Coverage targets | Backend ≥ 90% (math package ~100%), frontend ≥ 80% | Enforced by a make target / npm script |
| Percentage semantics | `percentage(a, b)` = **a% of b** = `a * b / 100` | A stateless, easily documented API; the phone-style "percent of the left operand" is stateful in the UI |

## Dependency order

S1 and S2 can run in parallel → S3 (needs S2) → S4 (needs S1 + S3) → S5–S10 (each needs only S4, independent of each other) → S11 → S12.

## S1: Backend scaffolding (Go)

**Scope:** `backend/` Go module; `cmd/server/main.go` with `PORT` env config, graceful shutdown, and request-logging and panic-recovery middleware; `internal/api` with router, `writeJSON`/`writeError` helpers, the error envelope, and a shared request-decoding helper (strict JSON, size limit, pointer fields) that operation stories reuse; `GET /healthz`; `Makefile` targets `test`, `coverage`, `run`, `lint` (`go vet` + `gofmt` check).

**Acceptance criteria**
- `make run` starts the server; `GET /healthz` returns `200 {"status":"ok"}`.
- Unknown routes return 404 and wrong methods return 405, both using the JSON error envelope.
- The request-decoding helper rejects malformed JSON, unknown fields, an oversized body and a wrong content type with `400 invalid_request`.
- Unit tests (`httptest`) cover the health handler, the error envelope, 404/405, each decode failure mode, and panic recovery.
- `make coverage` produces a coverage profile and an HTML report; `.gitignore` excludes build and coverage output.

## S2: Frontend scaffolding (React + TS)

**Scope:** `frontend/` created with Vite (React + TS strict); Vitest + RTL + jest-dom; ESLint; Vite dev proxy for `/api`; typed API client foundation (`ApiError` with `code`/`message`, a generic `postOperation` that parses the error envelope and handles network failures); scripts `dev`, `build`, `test`, `coverage`, `lint`; placeholder `App`.

**Acceptance criteria**
- `npm run dev` serves the app, `npm run build` type-checks and builds without warnings, and `npm run lint` is clean.
- `postOperation` is unit-tested with mocked `fetch` for: success, 4xx/422 error envelope → `ApiError`, non-JSON error body, and network failure.
- A smoke test renders `App`.
- `npm run coverage` produces a report; `node_modules` and coverage output are git-ignored.

## S3: Calculator UI shell (frontend only)

**Scope:** `Display` and `Keypad` components; digits 0–9, decimal point, clear (C), backspace, and sign toggle (±); a pure `calculatorReducer` managing the entry state; responsive CSS (mobile-first, usable at 320px, large tap targets); accessible markup (button labels, `aria-live` on the display, keyboard-operable). No operations yet; this exists so the operation stories are small additive diffs.

**Acceptance criteria**
- Reducer unit tests: digit entry, leading-zero handling, a single decimal point only, backspace to `0`, clear, sign toggle, and a max-digit limit.
- Component tests: clicking keys updates the display; keys are reachable by label.
- Layout verified at mobile and desktop widths (manual check noted in the PR).

## S4: Addition (backend + frontend)

Establishes the pattern every later operation follows, including the binary-operator flow.

**Backend:** `calculator.Add(a, b)`; `POST /api/v1/add` handler and route.
**Frontend:** `add(a, b)` client function; `+` key; reducer support for a pending binary operator and the `=` key; a `useCalculator` hook that performs the API call on `=`, with loading state (keys disabled while pending); an error banner for any `ApiError` or network failure; display formatting helper (significant-digit trimming).
**Docs:** add an "API" section to README with the add endpoint and a `curl` example.

**Acceptance criteria**
- Backend: table-driven tests for `Add` (positive, negative, zero, decimals, overflow → `result_not_finite`); handler tests for 200, missing field, wrong type, unknown field, malformed JSON, and wrong method.
- Frontend: reducer tests for operator-then-operand-then-`=`, replacing a pending operator, and chaining (`1 + 2 + 3`); hook/component tests with mocked API for success, loading state, and error display; formatting helper tests (`0.1 + 0.2` shows `0.3`).
- Manual end-to-end check (dev servers): `2 + 3 =` shows `5`.

## S5: Subtraction

**Backend:** `Subtract`; `POST /api/v1/subtract`. **Frontend:** client fn, `−` key, reducer wiring. **Docs:** README API entry.

**Acceptance criteria**
- Table tests including negative results and overflow; handler error-path tests.
- Frontend client, key and reducer tests.
- Manual e2e: `5 − 8 =` shows `-3`.

## S6: Multiplication

**Backend:** `Multiply`; `POST /api/v1/multiply`. **Frontend:** client fn, `×` key, reducer wiring. **Docs:** README API entry.

**Acceptance criteria**
- Table tests including zero, negatives, decimals and overflow; handler error-path tests.
- Frontend client, key and reducer tests.
- Manual e2e: `6 × 7 =` shows `42`.

## S7: Division

First domain error. **Backend:** `Divide` returning a typed `ErrDivisionByZero`; handler maps it to `422 division_by_zero`; `POST /api/v1/divide`. **Frontend:** client fn, `÷` key, user-friendly message for `division_by_zero`. **Docs:** README API entry including the error response.

**Acceptance criteria**
- Table tests including divide-by-zero (`0` and `-0`) and fractional results.
- Handler test asserts the 422 status and error code.
- Frontend test asserts the message is shown and the calculator state is recoverable (the next key press or `C` clears the error).
- Manual e2e: `1 ÷ 0 =` shows the error.

## S8: Exponentiation

**Backend:** `Power(base, exp)`; `POST /api/v1/power`; returns `result_not_finite` for results that overflow or are `NaN` (e.g. `(-8)^0.5`). **Frontend:** client fn, `xʸ` key, reducer wiring. **Docs:** README API entry.

**Acceptance criteria**
- Table tests for integer, negative, fractional and zero exponents, `0^0` (documented as `1`, matching `math.Pow`), overflow, and negative base with fractional exponent; handler tests.
- Frontend client, key and reducer tests.
- Manual e2e: `2 xʸ 10 =` shows `1024`.

## S9: Square root (first unary operation)

**Backend:** `Sqrt(a)` returning `ErrNegativeSquareRoot` → `422 negative_square_root`; `POST /api/v1/sqrt` takes only `a`. **Frontend:** client fn, `√` key; the reducer/hook applies a unary operation immediately to the current display value (no `=` needed) and handles it mid-expression (`9 + 16 √` operates on `16`). **Docs:** README API entry.

**Acceptance criteria**
- Table tests (`0`, perfect squares, non-perfect squares, negative → error); handler tests including rejection of an unexpected `b` field.
- Frontend tests for immediate application, mid-expression use, and error display.
- Manual e2e: `144 √` shows `12`.

## S10: Percentage

**Backend:** `Percentage(a, b)` = `a * b / 100`; `POST /api/v1/percentage`. **Frontend:** client fn, `%` key as a binary operator (`15 % 200 =` → `30`). **Docs:** README API entry stating the semantics explicitly.

**Acceptance criteria**
- Table tests (zero, negative, over 100%, decimals, overflow); handler tests.
- Frontend client, key and reducer tests.
- Manual e2e: `15 % 200 =` shows `30`.

## S11: Dockerfile (full-stack)

**Scope:** multi-stage `Dockerfile`: (1) Node stage builds the frontend, (2) Go stage builds a static binary, (3) minimal runtime stage (non-root user) containing the binary and the built assets. Small backend change: serve static files from `STATIC_DIR` with an `index.html` fallback, registered after the API routes so `/api/*` and 404 JSON behaviour are unaffected. `.dockerignore`; `HEALTHCHECK` on `/healthz`.

**Acceptance criteria**
- `docker build -t calculator .` succeeds and `docker run -p 8080:8080 calculator` serves the UI at `/` and the API at `/api/v1/*` on one port.
- Unit tests for the static handler: serves `index.html` at `/`, serves an asset, falls back to `index.html` for unknown non-API paths, and still returns JSON 404 for unknown `/api/` paths.
- The container runs as non-root; the image contains no dev dependencies or sources.
- README gets a Docker section.

## S12: Documentation and coverage wrap-up

**Scope:** finish the README to meet the deliverables: prerequisites, setup, how to run frontend and backend (dev), how to run tests, how to generate the coverage report (and the current coverage numbers), full API reference with `curl` examples and error cases (consolidating the per-story entries), design decisions and assumptions (the table above), and the Docker instructions. Update `docs/prompts.md` with the prompts used.

**Acceptance criteria**
- A fresh clone can follow the README to run both layers and the tests with no undocumented steps (verified by following it literally).
- Backend and frontend coverage meet the targets above, and the numbers in the README are from an actual run.
- Every `curl` example in the README has been executed against a running server.
