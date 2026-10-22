import type { Digit, KeyAction } from '../calculator/calculatorReducer'

interface KeypadProps {
  onAction: (action: KeyAction) => void
  disabled?: boolean
}

interface KeyProps {
  label: string
  accessibleName?: string
  className?: string
  disabled: boolean
  onPress: () => void
}

const DIGIT_ROWS: readonly (readonly Digit[])[] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
]

function Key({ label, accessibleName, className = '', disabled, onPress }: KeyProps) {
  return (
    <button
      type="button"
      className={`key ${className}`.trim()}
      aria-label={accessibleName}
      disabled={disabled}
      onClick={onPress}
    >
      {label}
    </button>
  )
}

function Keypad({ onAction, disabled = false }: KeypadProps) {
  const digitKey = (digit: Digit, className?: string) => (
    <Key
      key={digit}
      label={digit}
      className={className}
      disabled={disabled}
      onPress={() => onAction({ type: 'digit', digit })}
    />
  )

  return (
    <div className="keypad" role="group" aria-label="Keypad">
      <div className="keypad-extra">
        <Key
          label="xʸ"
          accessibleName="Power"
          className="key-operator"
          disabled={disabled}
          onPress={() => onAction({ type: 'operator', operator: 'xʸ' })}
        />
        <Key
          label="√"
          accessibleName="Square root"
          className="key-operator"
          disabled={disabled}
          onPress={() => onAction({ type: 'unary', operation: 'sqrt' })}
        />
      </div>
      <div className="keypad-main">
        <Key
          label="C"
          accessibleName="Clear"
          className="key-function"
          disabled={disabled}
          onPress={() => onAction({ type: 'clear' })}
        />
        <Key
          label="±"
          accessibleName="Toggle sign"
          className="key-function"
          disabled={disabled}
          onPress={() => onAction({ type: 'toggleSign' })}
        />
        <Key
          label="⌫"
          accessibleName="Backspace"
          className="key-function"
          disabled={disabled}
          onPress={() => onAction({ type: 'backspace' })}
        />
        {DIGIT_ROWS.flatMap((row) => row.map((digit) => digitKey(digit)))}
        {digitKey('0', 'key-wide')}
        <Key
          label="."
          accessibleName="Decimal point"
          disabled={disabled}
          onPress={() => onAction({ type: 'decimal' })}
        />
      </div>
      <div className="keypad-operators">
        <Key
          label="÷"
          accessibleName="Divide"
          className="key-operator"
          disabled={disabled}
          onPress={() => onAction({ type: 'operator', operator: '÷' })}
        />
        <Key
          label="×"
          accessibleName="Multiply"
          className="key-operator"
          disabled={disabled}
          onPress={() => onAction({ type: 'operator', operator: '×' })}
        />
        <Key
          label="+"
          accessibleName="Add"
          className="key-operator"
          disabled={disabled}
          onPress={() => onAction({ type: 'operator', operator: '+' })}
        />
        <Key
          label="−"
          accessibleName="Subtract"
          className="key-operator"
          disabled={disabled}
          onPress={() => onAction({ type: 'operator', operator: '−' })}
        />
        <Key
          label="="
          accessibleName="Equals"
          className="key-operator key-equals"
          disabled={disabled}
          onPress={() => onAction({ type: 'equals' })}
        />
      </div>
    </div>
  )
}

export default Keypad
