interface SettingsGroupProps {
  title: string
  children: React.ReactNode
}

/** An uppercase header over a grouped card, iOS Settings style. */
export default function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <section>
      <h2 className="mb-[7px] mt-5.5 px-1 text-group uppercase text-ink-2">{title}</h2>
      <div className="overflow-hidden rounded-card-sm bg-surface">{children}</div>
    </section>
  )
}
