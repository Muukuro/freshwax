import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";

export function AuthCard({
  title,
  subtitle,
  action,
  ctaLabel,
  error,
  emailAutoComplete = "email",
  footerLabel,
  footerHref,
  footerText,
  includeName = false,
  passwordAutoComplete = "current-password",
}: {
  title: string;
  subtitle: string;
  action: (formData: FormData) => Promise<void>;
  ctaLabel: string;
  error?: string;
  emailAutoComplete?: React.InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  footerLabel: string;
  footerHref: string;
  footerText: string;
  includeName?: boolean;
  passwordAutoComplete?: React.InputHTMLAttributes<HTMLInputElement>["autoComplete"];
}) {
  return (
    <div className="panel mx-auto w-full max-w-md p-8">
      <p className="eyebrow">Freshwax</p>
      <h1 className="font-display mt-4 text-5xl leading-none tracking-[-0.04em] text-[var(--text)]">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{subtitle}</p>

      <form action={action} className="mt-8 space-y-4">
        {error ? (
          <p className="auth-feedback auth-feedback--error" role="alert">
            {error}
          </p>
        ) : null}
        {includeName ? (
          <label className="field">
            <span>Name</span>
            <input autoComplete="name" name="name" placeholder="Alex" required type="text" />
          </label>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input
            autoCapitalize="none"
            autoComplete={emailAutoComplete}
            autoCorrect="off"
            name="email"
            placeholder="you@example.com"
            required
            spellCheck={false}
            type="email"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            autoComplete={passwordAutoComplete}
            name="password"
            placeholder="At least 8 characters"
            required
            type="password"
          />
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
