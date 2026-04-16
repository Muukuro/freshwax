import { type LucideIcon } from "lucide-react";

export function StatsCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: LucideIcon;
}) {
  return (
    <article className="panel relative overflow-hidden">
      {Icon && (
        <Icon
          className="absolute -right-4 -top-4 h-24 w-24 text-[var(--signal)] opacity-[0.13]"
          strokeWidth={0.8}
        />
      )}
      <p className="eyebrow">{label}</p>
      <div className="mt-3 font-display text-5xl leading-none text-[var(--text)]">{value}</div>
      <p className="mt-3 max-w-xs text-sm leading-7 text-[var(--muted)]">{detail}</p>
    </article>
  );
}
