import { Copy, Link2, RotateCw, Unplug } from "lucide-react";

import { importDeezerFollowsAction, importLastfmArtistsAction } from "@/app/actions/follows";
import {
  disconnectDeezerAction,
  disconnectLastfmAction,
  rotateCalendarTokenAction,
  saveLastfmUsernameAction,
  updateSettingsAction,
} from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { isDeezerOAuthConfigured } from "@/lib/providers/deezer";
import { isLastfmConfigured } from "@/lib/providers/lastfm";
import { absoluteUrl } from "@/lib/utils";

const deezerStatusText: Record<string, string> = {
  connected: "Deezer account connected. You can import your followed artists now.",
  denied: "Deezer authorization was canceled before the account could be linked.",
  "not-configured": "Add Deezer app credentials in the environment before connecting an account.",
  "state-mismatch": "The Deezer OAuth state check failed. Start the connection flow again.",
  "missing-code": "Deezer did not return an authorization code.",
  "already-linked": "That Deezer account is already linked to another local user.",
  error: "The Deezer callback failed before the account could be linked.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ deezer?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const calendarUrl = absoluteUrl(`/calendar/${user.calendarToken?.token ?? ""}.ics`);
  const deezerConfigured = isDeezerOAuthConfigured();
  const lastfmConfigured = isLastfmConfigured();
  const deezerStatus = params.deezer ? deezerStatusText[params.deezer] : null;

  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel">
        <p className="eyebrow">Filtering</p>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">Tune what counts as relevant</h2>

        <form action={updateSettingsAction} className="mt-8 grid gap-6 md:grid-cols-2">
          <label className="field">
            <span>Timezone</span>
            <input defaultValue={user.timezone} name="timezone" type="text" />
          </label>
          <label className="field">
            <span>Future horizon (days)</span>
            <input
              defaultValue={user.settings?.futureHorizonDays ?? 180}
              min="14"
              name="futureHorizonDays"
              type="number"
            />
          </label>
          <label className="field">
            <span>Missed-release window (days)</span>
            <input
              defaultValue={user.settings?.discoveryWindowDays ?? 30}
              min="1"
              name="discoveryWindowDays"
              type="number"
            />
          </label>
          <div className="field gap-3">
            <span>Release types</span>
            <label className="check">
              <input
                defaultChecked={user.settings?.includeSingles ?? true}
                name="includeSingles"
                type="checkbox"
              />
              Singles
            </label>
            <label className="check">
              <input
                defaultChecked={user.settings?.includeEps ?? true}
                name="includeEps"
                type="checkbox"
              />
              EPs
            </label>
            <label className="check">
              <input
                defaultChecked={user.settings?.includeCompilations ?? false}
                name="includeCompilations"
                type="checkbox"
              />
              Compilations
            </label>
            <label className="check">
              <input
                defaultChecked={user.settings?.includeLive ?? false}
                name="includeLive"
                type="checkbox"
              />
              Live releases
            </label>
            <label className="check">
              <input
                defaultChecked={user.settings?.includeReissues ?? false}
                name="includeReissues"
                type="checkbox"
              />
              Reissues and remasters
            </label>
            <label className="check">
              <input
                defaultChecked={user.settings?.hideIgnored ?? true}
                name="hideIgnored"
                type="checkbox"
              />
              Hide ignored items
            </label>
          </div>

          <div className="md:col-span-2">
            <SubmitButton className="primary-button" pendingLabel="Saving...">
              Save settings
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <article className="panel">
          <p className="eyebrow">Import sources</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">Seed your watchlist</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Import sources only add artists into your local watchlist. After that, Freshwax keeps
            using Deezer for artist search and release metadata sync.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Last.fm</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">Import your top artists</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Save a public Last.fm username and import the artists you listen to most. The importer
            only auto-follows artists that resolve to an exact normalized Deezer name match.
          </p>

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
            <SubmitButton
              className={`primary-button ${lastfmConfigured ? "" : "pointer-events-none opacity-60"}`}
              pendingLabel="Saving..."
            >
              Save Last.fm username
            </SubmitButton>
          </form>

          <div className="panel-muted mt-6 p-4 text-sm text-[var(--muted)]">
            {user.lastfmConnection ? (
              <>
                Username{" "}
                <span className="font-medium text-[var(--text)]">
                  {user.lastfmConnection.lastfmUserName}
                </span>
                . Last imported{" "}
                {user.lastfmConnection.lastImportedAt
                  ? user.lastfmConnection.lastImportedAt.toLocaleString()
                  : "never"}
                .
              </>
            ) : lastfmConfigured ? (
              "No Last.fm username is saved yet."
            ) : (
              "Last.fm import is disabled until LASTFM_API_KEY is configured."
            )}
          </div>

          {user.lastfmConnection ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={importLastfmArtistsAction}>
                <SubmitButton
                  className={`primary-button ${lastfmConfigured ? "" : "pointer-events-none opacity-60"}`}
                  pendingLabel="Importing..."
                >
                  <Link2 className="h-4 w-4" />
                  Import from Last.fm
                </SubmitButton>
              </form>
              <form action={disconnectLastfmAction}>
                <SubmitButton className="ghost-button" pendingLabel="Removing...">
                  <Unplug className="h-4 w-4" />
                  Remove Last.fm
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <p className="eyebrow">Deezer</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">Optional followed-artist import</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Link an optional Deezer account to pull your current followed artists into the local
            watchlist when you already have a working Deezer app. Imported artists still sync through
            the app&apos;s existing worker pipeline.
          </p>

          {deezerStatus ? (
            <div className="mt-6 rounded-[0.9rem] border border-[rgba(45,109,246,0.16)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--text)]">
              {deezerStatus}
            </div>
          ) : null}

          <div className="panel-muted mt-6 p-4 text-sm text-[var(--muted)]">
            {user.deezerConnection ? (
              <>
                Connected as{" "}
                <span className="font-medium text-[var(--text)]">
                  {user.deezerConnection.deezerUserName ?? `User ${user.deezerConnection.deezerUserId}`}
                </span>
                . Last imported{" "}
                {user.deezerConnection.lastImportedAt
                  ? user.deezerConnection.lastImportedAt.toLocaleString()
                  : "never"}
                .
              </>
            ) : deezerConfigured ? (
              "No Deezer account is linked yet."
            ) : (
              "Deezer OAuth is disabled until DEEZER_APP_ID and DEEZER_APP_SECRET are configured."
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {user.deezerConnection ? (
              <>
                <form action={importDeezerFollowsAction}>
                  <SubmitButton className="primary-button" pendingLabel="Importing...">
                    <Link2 className="h-4 w-4" />
                    Import followed artists
                  </SubmitButton>
                </form>
                <form action={disconnectDeezerAction}>
                  <SubmitButton className="ghost-button" pendingLabel="Disconnecting...">
                    <Unplug className="h-4 w-4" />
                    Disconnect Deezer
                  </SubmitButton>
                </form>
              </>
            ) : (
              <a
                className={`primary-button ${deezerConfigured ? "" : "pointer-events-none opacity-60"}`}
                href={deezerConfigured ? "/api/deezer/connect" : undefined}
              >
                <Link2 className="h-4 w-4" />
                Connect Deezer
              </a>
            )}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Private iCalendar feed</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">Use in any calendar client</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            The URL below is tokenized and private. It only includes upcoming releases for artists you
            currently follow.
          </p>

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

        <article className="panel">
          <p className="eyebrow">Operational notes</p>
          <ul className="space-y-3 text-sm leading-7 text-[var(--muted)]">
            <li>The worker schedules periodic sync jobs in Redis with BullMQ.</li>
            <li>Deezer powers search and release metadata collection.</li>
            <li>Last.fm import uses a public username plus an operator-supplied API key.</li>
            <li>Optional Deezer account linking imports followed artists when existing OAuth credentials are available.</li>
            <li>TIDAL URLs are generated as search links when exact cross-provider IDs are unavailable.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
