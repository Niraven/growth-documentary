import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/60 p-6">
      <span className="grid size-9 place-items-center rounded-lg border border-border bg-secondary font-display text-base text-muted-foreground">
        ∅
      </span>
      <div>
        <p className="font-display text-lg leading-snug">{title}</p>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}
