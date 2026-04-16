import { AuthCard } from "@/components/auth-card";
import { signUp } from "@/app/actions/auth";
import { getExternalAuthAvailabilityNote, isExternalAuthImplemented } from "@/lib/external-auth";
import { STREAMING_PROVIDERS, getProviderCapability, getProviderLabel, isProviderConfigured } from "@/lib/platforms";

const SIGNUP_ERRORS: Record<string, string> = {
  exists: "An account with that email already exists.",
  invalid: "Enter your name, a valid email address, and a password with at least 8 characters.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const externalProviders = STREAMING_PROVIDERS.filter((provider) => getProviderCapability(provider).supportsLogin).map(
    (provider) => ({
      label: `Sign up with ${getProviderLabel(provider)}`,
      href: isProviderConfigured(provider) && isExternalAuthImplemented(provider)
        ? `/api/auth/${provider.toLowerCase()}/connect`
        : undefined,
      note: getExternalAuthAvailabilityNote(provider),
    }),
  );

  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-promo hidden md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
              Self-hosted setup
            </p>
            <h1 className="font-display mt-4 max-w-lg text-6xl leading-[0.92] tracking-[-0.05em] text-white">
              Build a release desk that feels closer to a control room than a content app.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-blue-100/78">
              Local auth, Deezer-first metadata, optional TIDAL links, and filters that shape your own
              watchlist instead of handing your listening habits to someone else&apos;s feed.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[0.9rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">Catalog</p>
              <p className="mt-2 text-lg font-semibold text-white">Deezer artist search</p>
            </div>
            <div className="rounded-[0.9rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">Discovery</p>
              <p className="mt-2 text-lg font-semibold text-white">Late releases surfaced</p>
            </div>
          </div>
        </section>

        <AuthCard
          action={signUp}
          ctaLabel="Create account"
          emailAutoComplete="email"
          error={params.error ? SIGNUP_ERRORS[params.error] : undefined}
          footerHref="/login"
          footerLabel="Sign in"
          footerText="Already have an account?"
          externalProviders={externalProviders}
          includeName
          passwordAutoComplete="new-password"
          subtitle="Self-hosted and local-first, with optional external sign-in from the music platforms you actually use."
          title="Start your release desk"
        />
      </div>
    </main>
  );
}
