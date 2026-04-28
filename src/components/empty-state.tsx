export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="panel empty-state flex flex-col items-center justify-center gap-3">
      <p className="eyebrow">Nothing queued up</p>
      <h2 className="empty-state__title font-display text-[var(--text)]">{title}</h2>
      <p className="empty-state__body">{body}</p>
    </div>
  );
}
