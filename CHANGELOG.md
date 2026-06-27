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
