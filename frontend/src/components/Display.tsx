interface DisplayProps {
  value: string
}

function Display({ value }: DisplayProps) {
  return (
    <div className="display" role="status" aria-live="polite" aria-atomic="true" aria-label="Display">
      {value}
    </div>
  )
}

export default Display
