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

    const labels = [...'0123456789', 'Decimal point', 'Clear', 'Backspace', 'Toggle sign', 'Add', 'Multiply', 'Equals']
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
})
