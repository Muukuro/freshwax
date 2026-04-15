export function StatsCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="panel relative overflow-hidden">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[1.2rem] bg-[linear-gradient(135deg,_rgba(215,255,100,0.7),_rgba(45,109,246,0.14))]" />
      <p className="eyebrow">{label}</p>
      <div className="mt-3 font-display text-5xl leading-none text-[var(--text)]">{value}</div>
      <p className="mt-3 max-w-xs text-sm leading-7 text-[var(--muted)]">{detail}</p>
    </article>
  );
}
