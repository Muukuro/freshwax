import { Provider, ProviderMappingSource } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";

import {
  removeArtistProviderMappingAction,
  removeReleaseProviderMappingAction,
  saveArtistProviderMappingAction,
  saveReleaseProviderMappingAction,
} from "@/app/actions/provider-mappings";
import { PlatformIcon } from "@/components/platform-link";
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
    <details className="provider-mapping-editor">
      <summary className="provider-mapping-editor__summary">
        <span className="ghost-button">
          <Pencil className="h-4 w-4" />
          Edit provider links
        </span>
      </summary>

      <div className="provider-mapping-editor__content">
        {STREAMING_PROVIDERS.map((provider) => {
          const mapping = mappingByProvider.get(provider);
          const isManual = Boolean(
            mapping &&
              (mapping.source === ProviderMappingSource.MANUAL ||
                mapping.manuallyCorrectedAt !== null),
          );

          return (
            <div
              className="provider-mapping-editor__row"
              key={provider}
            >
              <div className="provider-mapping-editor__provider">
                <PlatformIcon provider={provider} />
                <div className="provider-mapping-editor__provider-copy">
                  <p>{getProviderLabel(provider)}</p>
                  <span>
                    {mapping
                      ? `${isManual ? "Manual" : "Automatic"}: ${mappingId(mapping)}`
                      : "Search fallback"}
                  </span>
                </div>
              </div>

              <form action={saveAction} className="provider-mapping-editor__form">
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
                <SubmitButton className="ghost-button" pendingLabel="Saving...">
                  Save
                </SubmitButton>
              </form>

              <form action={removeAction}>
                <input name={targetField} type="hidden" value={props.targetId} />
                <input name="provider" type="hidden" value={provider} />
                <SubmitButton
                  className="ghost-button provider-mapping-editor__remove"
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
    </details>
  );
}
