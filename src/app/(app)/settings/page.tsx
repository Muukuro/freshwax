import { Copy, Link2, RotateCw, Unplug } from "lucide-react";
import { Provider } from "@prisma/client";
import Link from "next/link";

import { PlatformIcon } from "@/components/platform-link";
import { PushNotificationSettings } from "@/components/push-notification-settings";
import { TimezoneField } from "@/components/timezone-field";

import { importDeezerFollowsAction, importLastfmArtistsAction, importTidalFollowsAction } from "@/app/actions/follows";
import { ImportForm } from "@/components/import-form";
import { SyncAdminPanel } from "@/components/sync-admin-panel";
import { SyncQueueStatus } from "@/components/sync-queue-status";
import {
  disconnectAppleMusicAction,
  disconnectDeezerAction,
  disconnectLastfmAction,
  disconnectSpotifyAction,
  disconnectTidalAction,
  dismissAccountMergeAction,
  confirmAccountMergeAction,
  rotateCalendarTokenAction,
  saveLastfmUsernameAction,
  updateNotificationSettingsAction,
  updatePlatformPreferencesAction,
  updateSettingsAction,
} from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { getPendingAccountMergeForUser } from "@/lib/account-merge";
import { env } from "@/lib/env";
import { getExternalAuthAvailabilityNote, isExternalAuthImplemented } from "@/lib/external-auth";
import { absoluteUrl } from "@/lib/utils";
import {
  STREAMING_PROVIDERS,
  getProviderAvailabilityNote,
  getProviderCapability,
  getProviderLabel,
  isProviderConfigured,
} from "@/lib/platforms";
import { isLastfmConfigured } from "@/lib/providers/lastfm";
import { getCoreModeSummary } from "@/lib/source-strategy";
import { getUserSyncAdminLogs } from "@/lib/sync-admin";
import { getUserSyncQueueStatus } from "@/lib/sync-queue-status";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { getFallbackTimeZones, getSupportedTimeZones } from "@/lib/timezone";

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

function disconnectActionFor(provider: Provider) {
  switch (provider) {
    case Provider.DEEZER:
      return disconnectDeezerAction;
    case Provider.SPOTIFY:
      return disconnectSpotifyAction;
    case Provider.TIDAL:
      return disconnectTidalAction;
    case Provider.APPLE_MUSIC:
      return disconnectAppleMusicAction;
    default:
      return null;
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ accountMerge?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const pendingAccountMerge = await getPendingAccountMergeForUser(user.id);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const supportedTimeZones = getSupportedTimeZones();
  const calendarUrl = absoluteUrl(`/calendar/${user.calendarToken?.token ?? ""}.ics`);
  const lastfmConfigured = isLastfmConfigured();
  const preferenceByProvider = new Map(
    user.platformPreferences.map((preference) => [preference.provider, preference]),
  );
  const [syncAdminLogs, queueStatus] = await Promise.all([
    getUserSyncAdminLogs(user.id),
    getUserSyncQueueStatus(user.id, { jobLimit: 20 }),
  ]);

  return (
    <div className="settings-grid settings-grid--page">
      <section className="settings-stack">
        <div className="page-intro">
          <div className="page-intro__content">
            <p className="eyebrow">Settings</p>
            <h1 className="page-intro__title">Tracking preferences</h1>
            <p className="page-intro__body">
              Set the release window, import sources, notifications, and private calendar feed for this instance.
            </p>
          </div>
        </div>

        <div className="settings-summary">
          <div>
            <p className="eyebrow">Release window</p>
            <p>{user.settings?.futureHorizonDays ?? 180} days ahead</p>
          </div>
          <div>
            <p className="eyebrow">Recent feed</p>
            <p>{user.settings?.discoveryWindowDays ?? 30} days back</p>
          </div>
          <div>
            <p className="eyebrow">Timezone</p>
            <p>{timeZone}</p>
          </div>
        </div>

        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="panel-heading__body">
              <p className="eyebrow">Filtering</p>
              <h2 className="panel-heading__title">Release defaults</h2>
              <p className="panel-heading__text">
                These settings shape default feeds, calendar output, and notifications. The Recent Releases page can be adjusted temporarily without changing them.
              </p>
            </div>
          </div>

          <form action={updateSettingsAction} className="mt-8 settings-stack">
            <div className="settings-cluster">
              <TimezoneField
                defaultValue={timeZone}
                name="timezone"
                supportedTimeZones={supportedTimeZones.length > 0 ? supportedTimeZones : getFallbackTimeZones()}
              />
            </div>
            <div className="settings-cluster">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field h-full justify-between">
                  <span>Show upcoming releases for the next N days</span>
                  <input
                    defaultValue={user.settings?.futureHorizonDays ?? 180}
                    min="14"
                    name="futureHorizonDays"
                    type="number"
                  />
                </label>
                <label className="field h-full justify-between">
                  <span>Show releases from the last N days</span>
                  <input
                    defaultValue={user.settings?.discoveryWindowDays ?? 30}
                    min="1"
                    name="discoveryWindowDays"
                    type="number"
                  />
                </label>
              </div>
            </div>
            <div className="settings-cluster">
              <div className="field gap-3">
                <span>Release types and visibility</span>
                <div className="grid gap-3">
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.includeSingles ?? true}
                      name="includeSingles"
                      type="checkbox"
                    />
                    <span>Include singles</span>
                  </label>
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.includeEps ?? true}
                      name="includeEps"
                      type="checkbox"
                    />
                    <span>Include EPs</span>
                  </label>
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.includeCompilations ?? false}
                      name="includeCompilations"
                      type="checkbox"
                    />
                    <span>Include compilations</span>
                  </label>
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.includeLive ?? false}
                      name="includeLive"
                      type="checkbox"
                    />
                    <span>Include live releases</span>
                  </label>
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.includeReissues ?? false}
                      name="includeReissues"
                      type="checkbox"
                    />
                    <span>Include reissues and remasters</span>
                  </label>
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.hideClassicalComposerAppearances ?? true}
                      name="hideClassicalComposerAppearances"
                      type="checkbox"
                    />
                    <span>Hide classical composer appearances</span>
                  </label>
                  <label className="check">
                    <input
                      defaultChecked={user.settings?.hideIgnored ?? true}
                      name="hideIgnored"
                      type="checkbox"
                    />
                    <span>Hide ignored items from feeds and calendar</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <SubmitButton className="primary-button" pendingLabel="Saving...">
                Save settings
              </SubmitButton>
            </div>
          </form>
        </section>
      </section>

      <section className="settings-stack">
        {pendingAccountMerge ? (
          <article className="panel settings-panel border-[var(--accent)]">
            <div className="panel-heading">
              <div className="panel-heading__body">
                <p className="eyebrow">Account merge</p>
                <h2 className="panel-heading__title">Merge existing {pendingAccountMerge.providerLabel} account?</h2>
                <p className="panel-heading__text">
                  {pendingAccountMerge.providerLabel} is already linked to {pendingAccountMerge.sourceUser.email}.
                  You are signed in as {pendingAccountMerge.targetUser.email}. Merge the existing account into this
                  one to keep this sign-in and bring over its follows, ignores, late-find history, notifications, provider
                  links, and import settings.
                </p>
              </div>
            </div>
            {params.accountMerge === "conflict" ? (
              <div className="panel-muted mt-5 p-4 text-sm text-[var(--muted)]">
                This merge could not be completed because both accounts already have different connections for one
                provider. Disconnect the provider from this account first, then try the merge again.
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <form action={confirmAccountMergeAction}>
                <SubmitButton className="primary-button" pendingLabel="Merging...">
                  Merge into this account
                </SubmitButton>
              </form>
              <form action={dismissAccountMergeAction}>
                <SubmitButton className="ghost-button" pendingLabel="Canceling...">
                  Cancel
                </SubmitButton>
              </form>
            </div>
          </article>
        ) : params.accountMerge === "merged" ? (
          <div className="panel-muted p-4 text-sm text-[var(--muted)]">
            Account data was merged into the signed-in account.
          </div>
        ) : params.accountMerge === "conflict" ? (
          <div className="panel-muted p-4 text-sm text-[var(--muted)]">
            The account merge request expired or could not be completed. Start the provider connection flow again.
          </div>
        ) : null}

        <article className="panel settings-panel">
          <div className="panel-heading">
            <div className="panel-heading__body">
              <p className="eyebrow">Onboarding</p>
              <h2 className="panel-heading__title">Platform setup</h2>
              <p className="panel-heading__text">
                Revisit favorites, default visibility, and link behavior without changing your account.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link className="ghost-button" href="/onboarding">
              Open onboarding again
            </Link>
          </div>
        </article>

        <SyncAdminPanel logs={syncAdminLogs} queueStatus={queueStatus} timeZone={timeZone} />

        <article className="panel settings-panel">
          <div className="panel-heading">
            <div className="panel-heading__body">
              <p className="eyebrow">Core tracking</p>
              <h2 className="panel-heading__title">Streaming connections</h2>
              <p className="panel-heading__text">
                {getCoreModeSummary()}
              </p>
            </div>
            <SyncQueueStatus />
          </div>
          <div className="mt-6">
            <p className="eyebrow">Available integrations</p>
          </div>
          <div className="mt-6 space-y-4">
            {STREAMING_PROVIDERS.map((provider, index) => {
              const capability = getProviderCapability(provider);
              const connectedAs = connectionSummary(user, provider);
              const disconnectAction = disconnectActionFor(provider);
              const preference = preferenceByProvider.get(provider);
              const providerConfigured = isProviderConfigured(provider);
              return (
                <article key={provider} className="settings-provider-card space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <PlatformIcon provider={provider} />
                        <h3 className="text-xl font-semibold text-[var(--text)]">
                          {getProviderLabel(provider)}
                        </h3>
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

                  <form action={updatePlatformPreferencesAction} className="space-y-3">
                    <input defaultValue={preference?.favoriteRank ?? index + 1} name={`favoriteRank:${provider}`} type="hidden" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input name={`favorite:${provider}`} type="hidden" value="off" />
                        <input className="mt-0.5 shrink-0" defaultChecked={preference?.isFavorite ?? false} name={`favorite:${provider}`} type="checkbox" value="on" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">Favorite</p>
                          <p className="text-xs leading-5 text-[var(--muted)]">Pin to the top of link rows</p>
                        </div>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input name={`showArtistLinks:${provider}`} type="hidden" value="off" />
                        <input className="mt-0.5 shrink-0" defaultChecked={preference?.showArtistLinks ?? capability.supportsArtistLinks} name={`showArtistLinks:${provider}`} type="checkbox" value="on" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">Artist links</p>
                          <p className="text-xs leading-5 text-[var(--muted)]">Show artist profile links on your watchlist</p>
                        </div>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input name={`showReleaseLinks:${provider}`} type="hidden" value="off" />
                        <input className="mt-0.5 shrink-0" defaultChecked={preference?.showReleaseLinks ?? capability.supportsReleaseLinks} name={`showReleaseLinks:${provider}`} type="checkbox" value="on" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">Release links</p>
                          <p className="text-xs leading-5 text-[var(--muted)]">Show release links in feeds and calendar</p>
                        </div>
                      </label>
                    </div>
                    <SubmitButton className="ghost-button" pendingLabel="Saving...">
                      Save
                    </SubmitButton>
                  </form>

                  <div className={`flex flex-wrap gap-3 ${providerConfigured ? "border-t border-[var(--panel-border)] pt-4" : ""}`}>
                    {capability.supportsLogin &&
                    providerConfigured &&
                    isExternalAuthImplemented(provider) ? (
                      <a className="ghost-button" href={`/api/auth/${provider.toLowerCase()}/connect`}>
                        <Link2 className="h-4 w-4" />
                        {connectedAs ? "Reconnect" : `Connect ${getProviderLabel(provider)}`}
                      </a>
                    ) : null}

                    {provider === Provider.TIDAL && user.tidalConnection ? (
                      <ImportForm action={importTidalFollowsAction} />
                    ) : null}

                    {provider === Provider.DEEZER && user.deezerConnection ? (
                      <ImportForm action={importDeezerFollowsAction} />
                    ) : null}

                    {disconnectAction && connectedAs ? (
                      <form action={disconnectAction}>
                        <SubmitButton className="ghost-button" pendingLabel="Disconnecting...">
                          <Unplug className="h-4 w-4" />
                          Disconnect
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="panel settings-panel">
          <div className="panel-heading">
            <div className="panel-heading__body">
              <p className="eyebrow">Last.fm</p>
              <h2 className="panel-heading__title">Username import</h2>
            </div>
          </div>
          <form action={saveLastfmUsernameAction} className="mt-6 space-y-4">
            <label className="field">
              <span>Last.fm username</span>
              <input
                defaultValue={user.lastfmConnection?.lastfmUserName ?? ""}
                name="lastfmUserName"
                placeholder="your-lastfm-name"
                type="text"
              />
            </label>
            <label className="field">
              <span>Minimum listens to import</span>
              <input
                defaultValue={user.lastfmConnection?.importMinPlaycount ?? 10}
                min="1"
                name="importMinPlaycount"
                type="number"
              />
            </label>
            <SubmitButton
              className={`primary-button ${lastfmConfigured ? "" : "pointer-events-none opacity-60"}`}
              pendingLabel="Saving..."
            >
              Save Last.fm settings
            </SubmitButton>
          </form>

          {user.lastfmConnection ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <ImportForm
                  action={importLastfmArtistsAction}
                  label="Import from Last.fm"
                  className="ghost-button"
                />
                <form action={disconnectLastfmAction}>
                  <SubmitButton className="ghost-button" pendingLabel="Removing...">
                    <Unplug className="h-4 w-4" />
                    Remove Last.fm
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel settings-panel">
          <div className="panel-heading">
            <div className="panel-heading__body">
              <p className="eyebrow">Notifications</p>
              <h2 className="panel-heading__title">Release alerts</h2>
              <p className="panel-heading__text">
                Enable browser push for this device and choose which alerts Freshwax should send.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <PushNotificationSettings vapidPublicKey={env.WEB_PUSH_PUBLIC_KEY ?? null} />
          </div>

          <form action={updateNotificationSettingsAction} className="mt-6 space-y-3">
            <label className="check">
              <input
                defaultChecked={user.settings?.notifyOnReleaseDay ?? true}
                name="notifyOnReleaseDay"
                type="checkbox"
              />
              Release day alerts at 09:00 in your timezone
            </label>
            <label className="check">
              <input
                defaultChecked={user.settings?.notifyOnDiscovery ?? false}
                name="notifyOnDiscovery"
                type="checkbox"
              />
              Newly found release alerts
            </label>
            <SubmitButton className="ghost-button" pendingLabel="Saving...">
              Save notification settings
            </SubmitButton>
          </form>
        </article>

        <article className="panel settings-panel">
          <div className="panel-heading">
            <div className="panel-heading__body">
              <p className="eyebrow">Private iCalendar feed</p>
              <h2 className="panel-heading__title">Use in any calendar client</h2>
            </div>
          </div>
          <div className="panel-muted mt-6 p-4">
            <code className="block overflow-x-auto text-sm text-[var(--accent-strong)]">{calendarUrl}</code>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="ghost-button" href={calendarUrl}>
              <Copy className="h-4 w-4" />
              Open feed
            </a>
            <form action={rotateCalendarTokenAction}>
              <SubmitButton className="ghost-button" pendingLabel="Rotating...">
                <RotateCw className="h-4 w-4" />
                Rotate token
              </SubmitButton>
            </form>
          </div>
        </article>
      </section>
    </div>
  );
}
