import { Link } from 'react-router-dom'

/**
 * Floating "add receipt" button, on the four tab roots only.
 *
 * Sits 23px above the tab bar rather than at a fixed offset from the bottom,
 * so it keeps that gap on a device whose home indicator makes the bar taller.
 */
export default function NewReceiptFab() {
  return (
    <Link
      to="/receipts/new"
      aria-label="New receipt"
      className="fixed right-4 z-40 flex h-[58px] w-[58px] items-center justify-center rounded-fab bg-accent text-[30px] font-light leading-none text-white shadow-fab active:bg-accent-pressed"
      style={{ bottom: 'calc(var(--tab-bar-h) + 23px)' }}
    >
      <span aria-hidden>+</span>
    </Link>
  )
}
