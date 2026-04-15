import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";

export function AuthCard({
  title,
  subtitle,
  action,
  ctaLabel,
  footerLabel,
  footerHref,
  footerText,
  includeName = false,
}: {
  title: string;
  subtitle: string;
  action: (formData: FormData) => Promise<void>;
  ctaLabel: string;
  footerLabel: string;
  footerHref: string;
  footerText: string;
  includeName?: boolean;
}) {
  return (
    <div className="panel mx-auto w-full max-w-md p-8">
      <p className="eyebrow">Freshwax</p>
      <h1 className="font-display mt-4 text-5xl leading-none tracking-[-0.04em] text-[var(--text)]">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{subtitle}</p>

      <form action={action} className="mt-8 space-y-4">
        {includeName ? (
          <label className="field">
            <span>Name</span>
            <input name="name" placeholder="Alex" required type="text" />
          </label>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input name="email" placeholder="you@example.com" required type="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" placeholder="At least 8 characters" required type="password" />
        </label>
        <SubmitButton className="primary-button w-full" pendingLabel="Entering...">
          {ctaLabel}
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        {footerText}{" "}
        <Link className="text-[var(--accent)] transition hover:text-[var(--accent-strong)]" href={footerHref}>
          {footerLabel}
        </Link>
      </p>
    </div>
  );
}
