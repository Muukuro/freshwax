import { Merge } from "lucide-react";

import { mergeDuplicateReleaseAction } from "@/app/actions/releases";
import { SubmitButton } from "@/components/submit-button";

type Candidate = {
  id: string;
  title: string;
  releaseDate: Date;
  releaseGroupMbid: string | null;
  mappings: {
    provider: string;
    providerReleaseId: string;
  }[];
  artists: {
    artist: {
      id: string;
      canonicalName: string;
    };
  }[];
};

export function ReleaseDuplicatePanel({
  releaseId,
  candidates,
}: {
  releaseId: string;
  candidates: Candidate[];
}) {
  if (candidates.length === 0) return null;

  return (
    <details className="provider-mapping-editor">
      <summary className="provider-mapping-editor__summary">
        <span className="ghost-button">
          <Merge className="h-4 w-4" />
          Resolve duplicate
        </span>
      </summary>

      <div className="provider-mapping-editor__content">
        <div className="panel-muted p-4">
          <p className="font-medium text-[var(--text)]">
            Keep this release and merge another copy into it
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            This updates the shared catalog for everyone and preserves follows,
            ignores, discoveries, provider links, and notification history.
            Only merge entries you know are the same release.
          </p>
        </div>

        {candidates.map((candidate) => (
          <form
            action={mergeDuplicateReleaseAction}
            className="panel-muted grid gap-4 p-4"
            key={candidate.id}
          >
            <input
              name="survivingReleaseId"
              type="hidden"
              value={releaseId}
            />
            <input
              name="duplicateReleaseId"
              type="hidden"
              value={candidate.id}
            />

            <div>
              <p className="font-medium text-[var(--text)]">
                {candidate.title}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {candidate.artists
                  .map((entry) => entry.artist.canonicalName)
                  .join(", ")}
                {" · "}
                {candidate.releaseDate.toLocaleDateString("en", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {candidate.releaseGroupMbid
                  ? `MusicBrainz: ${candidate.releaseGroupMbid}`
                  : "No MusicBrainz release-group identity"}
                {candidate.mappings.length
                  ? ` · ${candidate.mappings
                      .map(
                        (mapping) =>
                          `${mapping.provider}: ${mapping.providerReleaseId}`,
                      )
                      .join(" · ")}`
                  : ""}
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
              <input
                className="mt-1"
                name="confirmation"
                required
                type="checkbox"
                value="merge"
              />
              <span>
                I confirm this is a duplicate and the release shown at the top
                of this page should be kept.
              </span>
            </label>

            <div>
              <SubmitButton
                className="ghost-button provider-mapping-editor__remove"
                pendingLabel="Merging..."
              >
                Merge duplicate
              </SubmitButton>
            </div>
          </form>
        ))}
      </div>
    </details>
  );
}
