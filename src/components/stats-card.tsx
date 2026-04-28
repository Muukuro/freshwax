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
    <article className="panel metric-card">
      {Icon && (
        <Icon
          className="absolute -right-5 -top-5 h-24 w-24 text-[var(--signal)] opacity-[0.11]"
          strokeWidth={0.8}
        />
      )}
      <p className="eyebrow">{label}</p>
      <div className="metric-card__value font-display text-[var(--text)]">{value}</div>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}
