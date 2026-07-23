# Changelog

All notable Freshwax changes are recorded here.

Freshwax uses semantic versioning with release tags named `vMAJOR.MINOR.PATCH`.

## Unreleased

### Major

- Use for breaking operator-facing changes, incompatible data or environment changes, removed user workflows, or release behavior that requires manual migration.

### Minor

- Use for backward-compatible product features, new optional integrations, new operator capabilities, and meaningful workflow additions.

### Patch

- Use for backward-compatible bug fixes, documentation corrections, dependency maintenance, and small operational fixes.
- Prevent duplicate releases from reappearing when MusicBrainz and provider dates differ, and add a safe release-detail merge action that preserves user and notification history.

## v0.0.4 - 2026-07-01

### Changed

- Refreshed the app theme background color and install icons for a cleaner branded app appearance.

## v0.0.3 - 2026-07-01

### Changed

- Added the Freshwax logo and refreshed install icons for a more polished branded app experience.

## v0.0.2 - 2026-06-28

### Changed

- Simplified container startup so one Freshwax service applies the schema, runs the worker, and serves the web app.
- Added restart policies and a web health check for Docker-based deployments.

### Fixed

- Fixed same-name artist search and follow handling by matching followed artists with MusicBrainz artist ids instead of normalized names.
- Fixed the Docker Compose restart policy syntax for the local and published-image compose files.

## v0.0.1 - 2026-06-28

### Added

- Initial in-house pre-prod release for deploying and testing the self-hosted Freshwax app.

## Release Entry Format

When cutting a release, move relevant bullets from `Unreleased` into a new version section:

```markdown
## v1.2.3 - YYYY-MM-DD

### Added

- New backward-compatible capability.

### Changed

- Behavior change that remains compatible.

### Fixed

- Bug fix or reliability correction.

### Security

- Security-relevant fix or hardening.
```

Keep unreleased entries concise and user/operator focused. Link pull requests or issues when the reference helps explain the change.

GitHub Release notes are generated for semver tags and should stay aligned with the versioned changelog entry. Each release should make the version clear and include the exact published image tag, for example `ghcr.io/muukuro/freshwax:1.2.3`, so operators can pin repeatable installs.
