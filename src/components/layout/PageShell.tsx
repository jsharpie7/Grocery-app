interface PageShellProps {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}

export default function PageShell({ title, children, action }: PageShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {action}
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
    </div>
  )
}
