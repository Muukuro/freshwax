import { AuthCard } from "@/components/auth-card";
import { signIn } from "@/app/actions/auth";
import { getExternalAuthAvailabilityNote, isExternalAuthImplemented } from "@/lib/external-auth";
import { STREAMING_PROVIDERS, getProviderCapability, getProviderLabel, isProviderConfigured } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-link";

const LOGIN_ERRORS: Record<string, string> = {
  credentials: "The email or password is incorrect.",
  invalid: "Enter a valid email address and a password with at least 8 characters.",
  "external-only": "This account was created through an external provider. Use that sign-in flow instead.",
  "provider-not-configured": "That provider is not configured on this Freshwax instance yet.",
  "provider-unavailable": "That provider is visible in the UI, but its login flow is not implemented on this instance yet.",
  "provider-denied": "The provider login was canceled before Freshwax could finish linking the account.",
  "provider-missing-code": "The provider did not return an authorization code.",
  "provider-state": "The provider login state check failed. Start the connection flow again.",
  "provider-link-required": "That external identity matches an existing account. Link it from Settings while signed in locally first.",
  "provider-error": "The provider callback failed before Freshwax could finish signing you in.",
  provider: "Unknown external provider.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const externalProviders = STREAMING_PROVIDERS.filter((provider) => getProviderCapability(provider).supportsLogin && isProviderConfigured(provider)).map(
    (provider) => ({
      label: `Continue with ${getProviderLabel(provider)}`,
      href: isProviderConfigured(provider) && isExternalAuthImplemented(provider)
        ? `/api/auth/${provider.toLowerCase()}/connect`
        : undefined,
      note: getExternalAuthAvailabilityNote(provider),
      icon: <PlatformIcon provider={provider} size="sm" />,
    }),
  );

  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-promo hidden md:flex md:flex-col md:justify-between">
          <div>
            <p className="brand-wordmark font-display text-xl font-semibold tracking-[-0.03em]">Freshwax</p>
            <h1 className="font-display mt-6 max-w-lg text-6xl leading-[0.92] tracking-[-0.05em] text-white">
              Catch the records you care about before they slip by.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/72">
              Follow artists you actually love, see what&apos;s dropping, and get upcoming releases
              straight into your calendar — no algorithm deciding what&apos;s worth your attention.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[0.9rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">Watchlist</p>
              <p className="mt-2 text-lg font-semibold text-white">Artists you follow, nothing more</p>
            </div>
            <div className="rounded-[0.9rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">Calendar</p>
              <p className="mt-2 text-lg font-semibold text-white">Release dates in any calendar app</p>
            </div>
          </div>
        </section>

        <AuthCard
          action={signIn}
          ctaLabel="Sign in"
          emailAutoComplete="username"
          error={params.error ? LOGIN_ERRORS[params.error] : undefined}
          footerHref="/signup"
          footerLabel="Create an account"
          footerText="No account yet?"
          externalProviders={externalProviders}
          passwordAutoComplete="current-password"
          subtitle="Your artist watchlist, upcoming releases, and a private calendar feed — all on an instance you control."
          title="Welcome back"
        />
      </div>
    </main>
  );
}
