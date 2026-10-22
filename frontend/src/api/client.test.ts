import { jsonResponse } from '../test/jsonResponse'
import { add, ApiError, divide, postOperation } from './client'

describe('postOperation', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch')

  afterEach(() => {
    fetchMock.mockReset()
  })

  it('POSTs the operands as JSON and returns the result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 5 }))

    const result = await postOperation('add', { a: 2, b: 3 })

    expect(result).toBe(5)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":2,"b":3}',
    })
  })

  it('omits an absent second operand from the request body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 12 }))

    await postOperation('sqrt', { a: 144 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/sqrt',
      expect.objectContaining({ body: '{"a":144}' }),
    )
  })

  it.each([
    [400, 'invalid_request', 'unknown field "c"'],
    [422, 'division_by_zero', 'cannot divide by zero'],
  ])('maps a %i error envelope to an ApiError', async (status, code, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code, message } }, status))

    const error = await postOperation('divide', { a: 1, b: 0 }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'ApiError', code, message })
  })

  it('reports an unexpected_response when an error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const error = await postOperation('add', { a: 1, b: 2 }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: 'unexpected_response',
      message: 'Unexpected server response (HTTP 502).',
    })
  })

  it.each([
    ['a string error', { error: 'boom' }],
    ['a missing code', { error: { message: 'boom' } }],
    ['a non-string message', { error: { code: 'internal', message: 42 } }],
  ])('reports an unexpected_response when an error body has %s', async (_case, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body, 500))

    await expect(postOperation('add', { a: 1, b: 2 })).rejects.toMatchObject({
      code: 'unexpected_response',
    })
  })

  it('reports an unexpected_response when a success body has no numeric result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 'five' }))

    await expect(postOperation('add', { a: 2, b: 3 })).rejects.toMatchObject({
      code: 'unexpected_response',
      message: 'The server returned a malformed response.',
    })
  })

  it('wraps a network failure in an ApiError and keeps the original cause', async () => {
    const networkFailure = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(networkFailure)

    const error = await postOperation('add', { a: 1, b: 2 }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'network_error', cause: networkFailure })
  })
})

describe('add', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch')

  afterEach(() => {
    fetchMock.mockReset()
  })

  it('POSTs both operands to the add endpoint and returns the sum', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 5 }))

    await expect(add(2, 3)).resolves.toBe(5)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/add', expect.objectContaining({ body: '{"a":2,"b":3}' }))
  })

  it('rejects with the backend error for an overflowing sum', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'result_not_finite', message: 'result is not a finite number' } }, 422),
    )

    await expect(add(Number.MAX_VALUE, Number.MAX_VALUE)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'result_not_finite',
    })
  })
})

describe('divide', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch')

  afterEach(() => {
    fetchMock.mockReset()
  })

  it('POSTs both operands to the divide endpoint and returns the quotient', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 0.25 }))

    await expect(divide(1, 4)).resolves.toBe(0.25)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/divide', expect.objectContaining({ body: '{"a":1,"b":4}' }))
  })

  it('rejects with the backend error code for a zero divisor', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'division_by_zero', message: 'division by zero' } }, 422),
    )

    await expect(divide(1, 0)).rejects.toMatchObject({ name: 'ApiError', code: 'division_by_zero' })
  })
})
