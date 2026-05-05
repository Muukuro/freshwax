import { Provider, ProviderMappingSource } from "@prisma/client";
import { Link2, Trash2 } from "lucide-react";

import {
  removeArtistProviderMappingAction,
  removeReleaseProviderMappingAction,
  saveArtistProviderMappingAction,
  saveReleaseProviderMappingAction,
} from "@/app/actions/provider-mappings";
import { SubmitButton } from "@/components/submit-button";
import { currentMappingValue } from "@/lib/provider-mapping-corrections";
import { STREAMING_PROVIDERS, getProviderLabel } from "@/lib/platforms";

type ArtistMapping = {
  provider: Provider;
  providerArtistId: string;
  url: string | null;
  source: ProviderMappingSource;
  manuallyCorrectedAt: Date | null;
};

type ReleaseMapping = {
  provider: Provider;
  providerReleaseId: string;
  url: string | null;
  source: ProviderMappingSource;
  manuallyCorrectedAt: Date | null;
};

type Props =
  | {
      target: "artist";
      targetId: string;
      mappings: ArtistMapping[];
    }
  | {
      target: "release";
      targetId: string;
      mappings: ReleaseMapping[];
    };

function mappingId(mapping: ArtistMapping | ReleaseMapping) {
  return "providerArtistId" in mapping
    ? mapping.providerArtistId
    : mapping.providerReleaseId;
}

export function ProviderMappingCorrectionPanel(props: Props) {
  const mappingByProvider = new Map(
    props.mappings.map((mapping) => [mapping.provider, mapping]),
  );
  const saveAction =
    props.target === "artist"
      ? saveArtistProviderMappingAction
      : saveReleaseProviderMappingAction;
  const removeAction =
    props.target === "artist"
      ? removeArtistProviderMappingAction
      : removeReleaseProviderMappingAction;
  const targetField = props.target === "artist" ? "artistId" : "releaseId";

  return (
    <section className="panel space-y-4">
      <div className="section-bar">
        <div>
          <p className="eyebrow">Manual provider mappings</p>
          <h2 className="section-bar__title">Correct exact catalog links</h2>
        </div>
      </div>

      <div className="space-y-3">
        {STREAMING_PROVIDERS.map((provider) => {
          const mapping = mappingByProvider.get(provider);
          const isManual = Boolean(
            mapping &&
              (mapping.source === ProviderMappingSource.MANUAL ||
                mapping.manuallyCorrectedAt !== null),
          );

          return (
            <div
              className="grid gap-3 rounded-md border border-[var(--border)] bg-[color:rgb(255_255_255_/_0.03)] p-3 md:grid-cols-[10rem_1fr_auto]"
              key={provider}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {getProviderLabel(provider)}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {mapping ? `${isManual ? "Manual" : "Automatic"}: ${mappingId(mapping)}` : "Search fallback"}
                  </p>
                </div>
              </div>

              <form action={saveAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name={targetField} type="hidden" value={props.targetId} />
                <input name="provider" type="hidden" value={provider} />
                <label className="field">
                  <span className="sr-only">{getProviderLabel(provider)} URL or ID</span>
                  <input
                    defaultValue={currentMappingValue(mapping)}
                    name="providerValue"
                    placeholder={`${getProviderLabel(provider)} URL or ID`}
                  />
                </label>
                <SubmitButton className="ghost-button justify-center" pendingLabel="Saving...">
                  Save
                </SubmitButton>
              </form>

              <form action={removeAction}>
                <input name={targetField} type="hidden" value={props.targetId} />
                <input name="provider" type="hidden" value={provider} />
                <SubmitButton
                  className="ghost-button h-full justify-center"
                  disabled={!mapping}
                  pendingLabel="Removing..."
                  title={`Remove ${getProviderLabel(provider)} mapping`}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </SubmitButton>
              </form>
            </div>
          );
        })}
      </div>
    </section>
  );
}
