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
  externalProviders = [],
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
  externalProviders?: {
    label: string;
    href?: string;
    note?: string;
  }[];
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

      {externalProviders.length > 0 ? (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Or continue with
          </p>
          <div className="grid gap-3">
            {externalProviders.map((provider) =>
              provider.href ? (
                <Link key={provider.label} className="ghost-button w-full justify-center" href={provider.href}>
                  {provider.label}
                </Link>
              ) : (
                <div
                  key={provider.label}
                  className="ghost-button pointer-events-none w-full justify-center opacity-60"
                >
                  {provider.label}
                  {provider.note ? ` • ${provider.note}` : ""}
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-[var(--muted)]">
        {footerText}{" "}
        <Link className="text-[var(--accent)] transition hover:text-[var(--accent-strong)]" href={footerHref}>
          {footerLabel}
        </Link>
      </p>
    </div>
  );
}
