import type { CalculatorAction, Digit } from '../calculator/calculatorReducer'

interface KeypadProps {
  onAction: (action: CalculatorAction) => void
}

interface KeyProps {
  label: string
  accessibleName?: string
  className?: string
  onPress: () => void
}

const DIGIT_ROWS: readonly (readonly Digit[])[] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
]

function Key({ label, accessibleName, className = '', onPress }: KeyProps) {
  return (
    <button type="button" className={`key ${className}`.trim()} aria-label={accessibleName} onClick={onPress}>
      {label}
    </button>
  )
}

function Keypad({ onAction }: KeypadProps) {
  const digitKey = (digit: Digit, className?: string) => (
    <Key key={digit} label={digit} className={className} onPress={() => onAction({ type: 'digit', digit })} />
  )

  return (
    <div className="keypad" role="group" aria-label="Keypad">
      <Key label="C" accessibleName="Clear" className="key-function" onPress={() => onAction({ type: 'clear' })} />
      <Key
        label="±"
        accessibleName="Toggle sign"
        className="key-function"
        onPress={() => onAction({ type: 'toggleSign' })}
      />
      <Key
        label="⌫"
        accessibleName="Backspace"
        className="key-function"
        onPress={() => onAction({ type: 'backspace' })}
      />
      {DIGIT_ROWS.flatMap((row) => row.map((digit) => digitKey(digit)))}
      {digitKey('0', 'key-wide')}
      <Key label="." accessibleName="Decimal point" onPress={() => onAction({ type: 'decimal' })} />
    </div>
  )
}

export default Keypad
