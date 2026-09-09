interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Names the control for screen readers; the visible label sits in the row. */
  label: string
}

/** iOS-style switch: 46×28, with a 22px knob inset 3px at either end. */
export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-[46px] flex-none rounded-chip transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-border'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-[left] duration-200 ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}
