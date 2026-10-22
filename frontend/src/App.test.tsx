import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

function press(...labels: string[]) {
  for (const label of labels) {
    fireEvent.click(screen.getByRole('button', { name: label }))
  }
}

const display = () => screen.getByRole('status', { name: 'Display' })

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

    const labels = [...'0123456789', 'Decimal point', 'Clear', 'Backspace', 'Toggle sign']
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
})
