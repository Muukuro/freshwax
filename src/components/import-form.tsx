"use client";

import { useActionState } from "react";

import { type ImportResult } from "@/app/actions/follows";
import { SubmitButton } from "@/components/submit-button";

export function ImportForm({
  action,
  label = "Import followed artists",
  pendingLabel = "Importing...",
  className = "primary-button",
}: {
  action: (prevState: ImportResult | null, formData: FormData) => Promise<ImportResult>;
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <SubmitButton className={className} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      </form>
      {state ? (
        state.ok ? (
          <p className="text-xs text-[var(--muted)]">
            Import started — artists and sync jobs will appear in the background.
          </p>
        ) : (
          <p className="text-xs text-red-400">{state.error}</p>
        )
      ) : null}
    </div>
  );
}
