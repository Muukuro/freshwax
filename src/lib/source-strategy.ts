export const SOURCE_STRATEGY = {
  canonicalIdentity: {
    label: "MusicBrainz",
    requiresOperatorConfiguration: false,
  },
  coreReleaseDiscovery: {
    label: "Credential-free public metadata",
    requiresOperatorConfiguration: false,
  },
  optionalEnrichment: {
    label: "Platform enrichment",
    requiresOperatorConfiguration: true,
  },
  optionalUserImport: {
    label: "Account and profile import",
    requiresOperatorConfiguration: true,
  },
} as const;

export function getCoreModeSummary() {
  return "Artist search, follows, sync, and calendar feeds do not depend on connected platforms. Platform integrations add imports, exact links, and additional metadata.";
}
