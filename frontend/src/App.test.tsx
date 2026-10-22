import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { jsonResponse } from './test/jsonResponse'

function press(...labels: string[]) {
  for (const label of labels) {
    fireEvent.click(screen.getByRole('button', { name: label }))
  }
}

const display = () => screen.getByRole('status', { name: 'Display' })

const fetchMock = vi.spyOn(globalThis, 'fetch')

afterEach(() => {
  fetchMock.mockReset()
})

describe('App', () => {
  it('renders the calculator heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Calculator' })).toBeInTheDocument()
  })

  it('shows zero initially', () => {
    render(<App />)

    expect(display()).toHaveTextContent(/^0$/)
  })

  it('exposes every key as a button reachable by its label', () => {
    render(<App />)

    const labels = [...'0123456789', 'Decimal point', 'Clear', 'Backspace', 'Toggle sign', 'Add', 'Subtract', 'Multiply', 'Divide', 'Power', 'Square root', 'Percentage', 'Equals']
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled()
    }
  })

  it('updates the display as digits are clicked', () => {
    render(<App />)

    press('1', '2', '3')

    expect(display()).toHaveTextContent(/^123$/)
  })

  it('enters a decimal number', () => {
    render(<App />)

    press('3', 'Decimal point', '1', '4')

    expect(display()).toHaveTextContent(/^3\.14$/)
  })

  it('toggles the sign', () => {
    render(<App />)

    press('8', 'Toggle sign')

    expect(display()).toHaveTextContent(/^-8$/)
  })

  it('removes the last character with backspace', () => {
    render(<App />)

    press('4', '5', 'Backspace')

    expect(display()).toHaveTextContent(/^4$/)
  })

  it('resets the display with clear', () => {
    render(<App />)

    press('9', '9', 'Clear')

    expect(display()).toHaveTextContent(/^0$/)
  })

  it('announces display changes politely and as a whole', () => {
    render(<App />)

    expect(display()).toHaveAttribute('aria-live', 'polite')
    expect(display()).toHaveAttribute('aria-atomic', 'true')
  })

  describe('subtraction', () => {
    it('sends both operands to the API and shows a negative result', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: -3 }))
      render(<App />)

      press('5', 'Subtract', '8', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^-3$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/subtract',
        expect.objectContaining({ method: 'POST', body: '{"a":5,"b":8}' }),
      )
    })

    it('uses the last operator pressed when the operator is changed before the second operand', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 1 }))
      render(<App />)

      press('4', 'Add', 'Subtract', '3', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^1$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/v1/subtract', expect.anything())
    })

    it('chains different operators one step at a time', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ result: 13 }))
        .mockResolvedValueOnce(jsonResponse({ result: 10 }))
      render(<App />)

      press('9', 'Add', '4', 'Subtract')
      await waitFor(() => expect(display()).toHaveTextContent(/^13$/))
      press('3', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^10$/))
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/add', expect.objectContaining({ body: '{"a":9,"b":4}' }))
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/subtract',
        expect.objectContaining({ body: '{"a":13,"b":3}' }),
      )
    })

    it('shows the backend message in an alert when the request is rejected', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'result_not_finite', message: 'result is not a finite number' } }, 422),
      )
      render(<App />)

      press('9', 'Subtract', '9', 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('result is not a finite number')
    })
  })

  describe('multiplication', () => {
    it('sends both operands to the multiply endpoint and shows the product', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 42 }))
      render(<App />)

      press('6', 'Multiply', '7', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^42$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/multiply',
        expect.objectContaining({ method: 'POST', body: '{"a":6,"b":7}' }),
      )
    })

    it('mixes operators in one chain, each step using its own endpoint', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ result: 5 }))
        .mockResolvedValueOnce(jsonResponse({ result: 20 }))
      render(<App />)

      press('2', 'Add', '3', 'Multiply')
      await waitFor(() => expect(display()).toHaveTextContent(/^5$/))
      press('4', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^20$/))
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/add', expect.objectContaining({ body: '{"a":2,"b":3}' }))
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/multiply',
        expect.objectContaining({ body: '{"a":5,"b":4}' }),
      )
    })

    it('shows the backend message when the product overflows', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'result_not_finite', message: 'result is not a finite number' } }, 422),
      )
      render(<App />)

      press('9', 'Multiply', '9', 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('result is not a finite number')
    })
  })

  describe('addition', () => {
    it('sends both operands to the API and shows the result', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 5 }))
      render(<App />)

      press('2', 'Add', '3', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^5$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/add',
        expect.objectContaining({ method: 'POST', body: '{"a":2,"b":3}' }),
      )
    })

    it('hides floating-point noise in the result', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 0.1 + 0.2 }))
      render(<App />)

      press('0', 'Decimal point', '1', 'Add', 'Decimal point', '2', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^0\.3$/))
    })

    it('evaluates a chain one step at a time', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ result: 3 }))
        .mockResolvedValueOnce(jsonResponse({ result: 6 }))
      render(<App />)

      press('1', 'Add', '2', 'Add')
      await waitFor(() => expect(display()).toHaveTextContent(/^3$/))
      press('3', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^6$/))
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/add',
        expect.objectContaining({ body: '{"a":3,"b":3}' }),
      )
    })

    it('does not call the API until equals is pressed', () => {
      render(<App />)

      press('2', 'Add', '3')

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('disables every key while the request is pending', async () => {
      let respond: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => (respond = resolve)))
      render(<App />)

      press('2', 'Add', '3', 'Equals')

      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled()
      }

      respond(jsonResponse({ result: 5 }))

      await waitFor(() => expect(display()).toHaveTextContent(/^5$/))
      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeEnabled()
      }
    })

    it('shows the backend message in an alert when the request is rejected', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'result_not_finite', message: 'result is not a finite number' } }, 422),
      )
      render(<App />)

      press('9', 'Add', '9', 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('result is not a finite number')
      expect(display()).toHaveTextContent(/^9$/)
      expect(screen.getByRole('button', { name: 'Equals' })).toBeEnabled()
    })

    it('shows a message when the server cannot be reached', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      render(<App />)

      press('1', 'Add', '1', 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
    })

    it('lets the user retry after an error', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(jsonResponse({ result: 2 }))
      render(<App />)

      press('1', 'Add', '1', 'Equals')
      await screen.findByRole('alert')
      press('Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^2$/))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('dismisses the error on the next key press', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      render(<App />)

      press('1', 'Add', '1', 'Equals')
      await screen.findByRole('alert')
      press('Clear')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(display()).toHaveTextContent(/^0$/)
    })
  })

  describe('division', () => {
    const divisionByZero = () =>
      jsonResponse({ error: { code: 'division_by_zero', message: 'division by zero' } }, 422)

    it('sends both operands to the API and shows the quotient', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 0.25 }))
      render(<App />)

      press('1', 'Divide', '4', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^0\.25$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/divide',
        expect.objectContaining({ method: 'POST', body: '{"a":1,"b":4}' }),
      )
    })

    it('shows a friendly message when dividing by zero', async () => {
      fetchMock.mockResolvedValue(divisionByZero())
      render(<App />)

      press('1', 'Divide', '0', 'Equals')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Cannot divide by zero.')
      expect(alert).not.toHaveTextContent('division by zero')
    })

    it('clears the error and recovers with the next digit', async () => {
      fetchMock.mockResolvedValueOnce(divisionByZero()).mockResolvedValueOnce(jsonResponse({ result: 0.2 }))
      render(<App />)

      press('1', 'Divide', '0', 'Equals')
      await screen.findByRole('alert')
      press('5')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      press('Equals')
      await waitFor(() => expect(display()).toHaveTextContent(/^0\.2$/))
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/divide',
        expect.objectContaining({ body: '{"a":1,"b":5}' }),
      )
    })

    it('clears the error and resets the calculator with Clear', async () => {
      fetchMock.mockResolvedValue(divisionByZero())
      render(<App />)

      press('1', 'Divide', '0', 'Equals')
      await screen.findByRole('alert')
      press('Clear')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(display()).toHaveTextContent(/^0$/)
      expect(screen.getByRole('button', { name: 'Equals' })).toBeEnabled()
    })
  })

  describe('exponentiation', () => {
    it('sends the base and exponent to the power endpoint and shows the result', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 1024 }))
      render(<App />)

      press('2', 'Power', '1', '0', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^1024$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/power',
        expect.objectContaining({ method: 'POST', body: '{"a":2,"b":10}' }),
      )
    })

    it('shows the backend message when the result is not a finite number', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'result_not_finite', message: 'result is not a finite number' } }, 422),
      )
      render(<App />)

      press('8', 'Toggle sign', 'Power', 'Decimal point', '5', 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('result is not a finite number')
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/power', expect.objectContaining({ body: '{"a":-8,"b":0.5}' }))
    })

    it('does not call the API until equals is pressed', () => {
      render(<App />)

      press('2', 'Power', '3')

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('percentage', () => {
    it('sends the percent first and shows the percent of the second operand', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 30 }))
      render(<App />)

      press('1', '5', 'Percentage', '2', '0', '0', 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^30$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/percentage',
        expect.objectContaining({ method: 'POST', body: '{"a":15,"b":200}' }),
      )
    })

    it('shows the backend message when the result is not a finite number', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'result_not_finite', message: 'result is not a finite number' } }, 422),
      )
      render(<App />)

      press('1', 'Percentage', '2', 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('result is not a finite number')
    })

    it('does not call the API until equals is pressed', () => {
      render(<App />)

      press('1', '5', 'Percentage', '2', '0', '0')

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('square root', () => {
    it('applies immediately to the displayed number, without equals', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: 12 }))
      render(<App />)

      press('1', '4', '4', 'Square root')

      await waitFor(() => expect(display()).toHaveTextContent(/^12$/))
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/sqrt',
        expect.objectContaining({ method: 'POST', body: '{"a":144}' }),
      )
    })

    it('operates on the right-hand operand mid-expression and keeps the expression going', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ result: 4 }))
        .mockResolvedValueOnce(jsonResponse({ result: 13 }))
      render(<App />)

      press('9', 'Add', '1', '6', 'Square root')
      await waitFor(() => expect(display()).toHaveTextContent(/^4$/))
      press('Equals')

      await waitFor(() => expect(display()).toHaveTextContent(/^13$/))
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/v1/sqrt',
        expect.objectContaining({ body: '{"a":16}' }),
      )
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/add',
        expect.objectContaining({ body: '{"a":9,"b":4}' }),
      )
    })

    it('shows the backend message in an alert for a negative number', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code: 'negative_square_root', message: 'Cannot take the square root of a negative number' } },
          422,
        ),
      )
      render(<App />)

      press('4', 'Toggle sign', 'Square root')

      expect(await screen.findByRole('alert')).toHaveTextContent('Cannot take the square root of a negative number')
      expect(display()).toHaveTextContent(/^-4$/)
      expect(screen.getByRole('button', { name: 'Square root' })).toBeEnabled()
    })

    it('recovers from the error by correcting the number', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: 'negative_square_root', message: 'negative' } }, 422),
        )
        .mockResolvedValueOnce(jsonResponse({ result: 2 }))
      render(<App />)

      press('4', 'Toggle sign', 'Square root')
      await screen.findByRole('alert')
      press('Toggle sign')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      press('Square root')
      await waitFor(() => expect(display()).toHaveTextContent(/^2$/))
    })

    it('disables every key while the request is pending', () => {
      fetchMock.mockReturnValue(new Promise<Response>(() => {}))
      render(<App />)

      press('9', 'Square root')

      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled()
      }
    })
  })
})
