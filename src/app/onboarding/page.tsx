import Link from "next/link";
import { CheckCircle2, Link2, Music4, SkipForward } from "lucide-react";
import { Provider } from "@prisma/client";

import { completeOnboardingAction } from "@/app/actions/settings";
import { PlatformIcon } from "@/components/platform-link";
import { SubmitButton } from "@/components/submit-button";
import { TimezoneField } from "@/components/timezone-field";
import { requireUser } from "@/lib/auth";
import { getExternalAuthAvailabilityNote, isExternalAuthImplemented } from "@/lib/external-auth";
import { getProviderAvailabilityNote, getProviderCapability, getProviderLabel, STREAMING_PROVIDERS } from "@/lib/platforms";
import { getCoreModeSummary } from "@/lib/source-strategy";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

function connectionSummary(user: Awaited<ReturnType<typeof requireUser>>, provider: Provider) {
  switch (provider) {
    case Provider.DEEZER:
      return user.deezerConnection
        ? user.deezerConnection.deezerUserName ?? `User ${user.deezerConnection.deezerUserId}`
        : null;
    case Provider.SPOTIFY:
      return user.spotifyConnection
        ? user.spotifyConnection.spotifyUserName ?? `User ${user.spotifyConnection.spotifyUserId}`
        : null;
    case Provider.TIDAL:
      return user.tidalConnection
        ? user.tidalConnection.tidalUserName ?? `User ${user.tidalConnection.tidalUserId}`
        : null;
    case Provider.APPLE_MUSIC:
      return user.appleMusicConnection
        ? user.appleMusicConnection.storefront ?? "Connected via MusicKit"
        : null;
    default:
      return user.externalIdentities.find((identity) => identity.provider === provider)?.displayName ?? null;
  }
}

export default async function OnboardingPage() {
  const user = await requireUser();
  const timeZone = getEffectiveTimeZone(user.timezone);
  const preferenceByProvider = new Map(
    user.platformPreferences.map((preference) => [preference.provider, preference]),
  );

  return (
    <main className="auth-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
        <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">Onboarding</p>
            <h1 className="font-display mt-3 text-5xl leading-[0.94] tracking-[-0.05em] text-[var(--text)]">
              Choose the platforms Freshwax should care about first.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Pick your favorite listening destinations, decide which services may seed your
              watchlist, and choose which links should show up on artists and releases. You can skip
              every connection step and finish this later in Settings because core tracking works
              without platform credentials.
            </p>
          </div>

          <div className="panel-muted space-y-4 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--text)]">1. Favorite platforms</p>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Use favorites to order links and import actions across the app.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Link2 className="mt-1 h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--text)]">2. Connection targets</p>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Platform connections stay optional, even when this instance is not configured yet.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Music4 className="mt-1 h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--text)]">3. Release view defaults</p>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Save the link and filter defaults you want before landing on the dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <form action={completeOnboardingAction} className="grid gap-6">
          <section className="panel">
            <p className="eyebrow">Favorite platforms</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {STREAMING_PROVIDERS.map((provider, index) => {
                const capability = getProviderCapability(provider);
                const preference = preferenceByProvider.get(provider);
                const connectedAs = connectionSummary(user, provider);

                return (
                  <article key={provider} className="panel-muted space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <PlatformIcon provider={provider} />
                          <h2 className="text-xl font-semibold text-[var(--text)]">
                            {getProviderLabel(provider)}
                          </h2>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {capability.description}
                        </p>
                      </div>
                      <span className="status-pill px-2 py-1 text-xs">
                        {connectedAs
                          ? `Connected as ${connectedAs}`
                          : capability.supportsLogin
                          ? getExternalAuthAvailabilityNote(provider)
                          : getProviderAvailabilityNote(provider)}
                      </span>
                    </div>

                    <input
                      defaultValue={preference?.favoriteRank ?? index + 1}
                      name={`favoriteRank:${provider}`}
                      type="hidden"
                    />

                    <label className="check">
                      <input name={`favorite:${provider}`} type="hidden" value="off" />
                      <input
                        defaultChecked={preference?.isFavorite ?? false}
                        name={`favorite:${provider}`}
                        type="checkbox"
                        value="on"
                      />
                      Mark as favorite
                    </label>

                    <label className="check">
                      <input name={`showArtistLinks:${provider}`} type="hidden" value="off" />
                      <input
                        defaultChecked={preference?.showArtistLinks ?? capability.supportsArtistLinks}
                        name={`showArtistLinks:${provider}`}
                        type="checkbox"
                        value="on"
                      />
                      Show artist links
                    </label>

                    <label className="check">
                      <input name={`showReleaseLinks:${provider}`} type="hidden" value="off" />
                      <input
                        defaultChecked={preference?.showReleaseLinks ?? capability.supportsReleaseLinks}
                        name={`showReleaseLinks:${provider}`}
                        type="checkbox"
                        value="on"
                      />
                      Show release links
                    </label>

                    {capability.supportsLogin && isExternalAuthImplemented(provider) && !connectedAs ? (
                      <Link className="ghost-button" href={`/api/auth/${provider.toLowerCase()}/connect`}>
                        <Link2 className="h-4 w-4" />
                        {`Connect ${getProviderLabel(provider)}`}
                      </Link>
                    ) : connectedAs ? (
                      <div className="ghost-button pointer-events-none opacity-80">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <p className="eyebrow">Release defaults</p>
              <TimezoneField defaultValue={timeZone} name="timezone" />
              <label className="check">
                <input defaultChecked name="includeSingles" type="checkbox" />
                Include singles
              </label>
              <label className="check">
                <input defaultChecked name="includeEps" type="checkbox" />
                Include EPs
              </label>
              <label className="check">
                <input name="includeCompilations" type="checkbox" />
                Include compilations
              </label>
              <label className="check">
                <input name="includeLive" type="checkbox" />
                Include live releases
              </label>
              <label className="check">
                <input name="includeReissues" type="checkbox" />
                Include reissues and remasters
              </label>
            </div>

            <div className="panel-muted space-y-4 p-4">
              <p className="text-sm leading-7 text-[var(--muted)]">
                {getCoreModeSummary()}
              </p>

              <div className="flex flex-wrap gap-3">
                <SubmitButton className="primary-button" pendingLabel="Saving...">
                  Finish setup
                </SubmitButton>
                <SubmitButton className="ghost-button" formAction={completeOnboardingAction} pendingLabel="Skipping...">
                  <SkipForward className="h-4 w-4" />
                  Skip import for now
                </SubmitButton>
              </div>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}
