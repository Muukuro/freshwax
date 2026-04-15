export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="panel flex min-h-56 flex-col items-center justify-center gap-3 text-center">
      <p className="eyebrow">Nothing queued up</p>
      <h2 className="font-display text-3xl text-[var(--text)]">{title}</h2>
      <p className="max-w-lg text-sm leading-7 text-[var(--muted)]">{body}</p>
    </div>
  );
}
