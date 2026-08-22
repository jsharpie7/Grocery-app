import { storeInitials, badgeTextColor } from '../../lib/storeBadge'

interface StoreBadgeProps {
  name: string
  color: string
  /** Tailwind size classes. Defaults to the 32px circle used in list rows. */
  className?: string
}

/** Circular monogram badge: store initials on the store's own colour. */
export default function StoreBadge({ name, color, className = 'h-8 w-8 text-xs' }: StoreBadgeProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold leading-none ${className}`}
      style={{ backgroundColor: color, color: badgeTextColor(color) }}
      aria-hidden="true"
    >
      {storeInitials(name)}
    </div>
  )
}
