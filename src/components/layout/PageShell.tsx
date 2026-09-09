interface PageShellProps {
  title: string
  children: React.ReactNode
}

/**
 * Chrome for a tab-root screen.
 *
 * The redesign has no navigation bar on these screens — the screen's name is a
 * large title that scrolls away with the content, iOS-style — so this is a
 * scroll container and a heading, nothing more.
 *
 * Horizontal padding is deliberately not imposed on `children`: the dashboard
 * pads its whole body, while Receipts runs its month cards to their own
 * margins under unpadded month headers. Each screen pads itself.
 */
export default function PageShell({ title, children }: PageShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <main className="flex-1 overflow-y-auto">
        <h1 className="px-4 pb-3.5 pt-1.5 text-title-lg">{title}</h1>
        {children}
        {/* Clearance for the fixed tab bar the content scrolls beneath. */}
        <div aria-hidden style={{ height: 'var(--tab-bar-h)' }} />
      </main>
    </div>
  )
}
