import { NavLink } from 'react-router-dom'
import { ChartColumn, Receipt, Tag, Settings, type LucideIcon } from 'lucide-react'

interface Tab {
  to: string
  label: string
  Icon: LucideIcon
}

const tabs: Tab[] = [
  { to: '/', label: 'Spend', Icon: ChartColumn },
  { to: '/receipts', label: 'Receipts', Icon: Receipt },
  { to: '/insights', label: 'Items', Icon: Tag },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

/**
 * The four tab roots.
 *
 * Fixed rather than a flex sibling so content scrolls beneath the translucent
 * bar, which is the only reason its blur is worth having. Screens reserve
 * `--tab-bar-h` of bottom clearance to compensate; PageShell does it for them.
 */
export default function BottomNav() {
  return (
    <nav
      className="chrome-blur fixed bottom-0 left-0 right-0 z-40 flex border-t border-border pb-[env(safe-area-inset-bottom,17px)]"
      style={{ height: 'var(--tab-bar-h)' }}
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center text-tab ${
              isActive ? 'font-semibold text-accent' : 'font-normal text-ink-2'
            }`
          }
        >
          <Icon size={20} strokeWidth={1.5} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
