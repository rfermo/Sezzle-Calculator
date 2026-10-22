import { useCalculator } from './calculator/useCalculator'
import Display from './components/Display'
import Keypad from './components/Keypad'

function App() {
  const { display, error, isLoading, dispatch } = useCalculator()

  return (
    <main className="calculator">
      <h1>Calculator</h1>
      <Display value={display} />
      {error !== null && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <Keypad onAction={dispatch} disabled={isLoading} />
    </main>
  )
}

export default App
