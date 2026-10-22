import { useReducer } from 'react'
import { calculatorReducer, initialState } from './calculator/calculatorReducer'
import Display from './components/Display'
import Keypad from './components/Keypad'

function App() {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)

  return (
    <main className="calculator">
      <h1>Calculator</h1>
      <Display value={state.display} />
      <Keypad onAction={dispatch} />
    </main>
  )
}

export default App
