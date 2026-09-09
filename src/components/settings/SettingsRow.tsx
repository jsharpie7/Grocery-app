interface SettingsRowProps {
  label: React.ReactNode
  /** Right-hand value, shown as a disclosure value. */
  value?: React.ReactNode
  /** Makes the whole row a button. */
  onClick?: () => void
  /** Chevron: on by default for a tappable row, off for one that acts rather
   *  than discloses (Sign out opens nothing). */
  chevron?: boolean
  expanded?: boolean
  children?: React.ReactNode
}

/**
 * One row in a grouped settings card.
 *
 * The design draws disclosure rows with a chevron, implying pushed sub-screens.
 * They expand in place instead: every setting here is one or two controls, and
 * a push-and-return for a single text field costs two navigations to change
 * one value.
 */
export default function SettingsRow({
  label, value, onClick, chevron = true, expanded, children,
}: SettingsRowProps) {
  const showChevron = !!onClick && chevron
  const body = (
    <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
      <span className="flex-none text-row">{label}</span>
      {/* The value takes the slack and truncates: a long email should shorten,
          not push the row past the card. */}
      {value != null && <span className="min-w-0 flex-1 truncate text-right text-row text-ink-3">{value}</span>}
      {showChevron && (
        <span
          aria-hidden
          className={`flex-none text-nav text-ink-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        >
          ›
        </span>
      )}
    </div>
  )

  return (
    <div className="border-t border-hairline first:border-t-0">
      {onClick ? (
        <button
          onClick={onClick}
          aria-expanded={children ? expanded : undefined}
          className="w-full active:bg-canvas"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {expanded && children && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
