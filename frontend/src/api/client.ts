const API_BASE = '/api/v1'

export interface Operands {
  a: number
  b?: number
}

/** A failed API call: either an error envelope from the backend or a client-side failure. */
export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.code = code
  }
}

interface ErrorEnvelope {
  error: { code: string; message: string }
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false
  }
  const { error } = body
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

function isResultBody(body: unknown): body is { result: number } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'result' in body &&
    typeof body.result === 'number'
  )
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/**
 * POSTs the operands to `/api/v1/{operation}` and returns the numeric result.
 * Every failure mode is surfaced as an `ApiError` so callers have one type to handle.
 */
export async function postOperation(operation: string, operands: Operands): Promise<number> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operands),
    })
  } catch (cause) {
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.', {
      cause,
    })
  }

  const body = await readJson(response)

  if (!response.ok) {
    if (isErrorEnvelope(body)) {
      throw new ApiError(body.error.code, body.error.message)
    }
    throw new ApiError('unexpected_response', `Unexpected server response (HTTP ${response.status}).`)
  }

  if (!isResultBody(body)) {
    throw new ApiError('unexpected_response', 'The server returned a malformed response.')
  }
  return body.result
}

export function add(a: number, b: number): Promise<number> {
  return postOperation('add', { a, b })
}

export function divide(a: number, b: number): Promise<number> {
  return postOperation('divide', { a, b })
}
