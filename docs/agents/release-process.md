# Release Process for Agents

Freshwax releases are created from semver Git tags in the form `vMAJOR.MINOR.PATCH`.

## Required Checks

Before creating or recommending a release tag, verify the release candidate has passed:

- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`
- `npm run test:schema-upgrade`

If schema or setup behavior changed in the release, also verify:

- `npx prisma migrate deploy`
- `npm run prisma:seed`

The schema-upgrade check must create a populated database from the previous
release tag and apply the candidate schema in place. A clean-database
`prisma migrate deploy` against a clean database is not sufficient evidence that an existing installation can
upgrade safely.

Do not create a release tag if required checks are failing or unrun without explicitly telling the maintainer what is missing.

## Choosing the Version Bump

Use the largest required bump from the included changes:

- Major: breaking operator behavior, incompatible environment variable changes, removed or renamed public routes such as `/calendar/:token.ics`, incompatible database changes or migrations requiring manual operator intervention, or removed user workflows.
- Minor: backward-compatible product features, new optional provider integrations, new release/feed/calendar capabilities, new documented operator features, or new background jobs that preserve existing setup.
- Patch: bug fixes, reliability fixes, documentation-only updates, dependency maintenance that does not change operator requirements, and internal refactors with no intended behavior change.

When a maintainer requests a bump that is too small for the change set, refuse to create the tag and explain the smallest safe bump. When a maintainer requests a larger bump than required, point out the mismatch and ask for confirmation before proceeding.

## Changelog Rules

Keep `CHANGELOG.md` current while work is merged:

- Add pending changes under `Unreleased`.
- Put each entry under `Major`, `Minor`, or `Patch` when the likely release impact is clear.
- During release, move shipped entries into `## vMAJOR.MINOR.PATCH - YYYY-MM-DD`.
- Use `Added`, `Changed`, `Fixed`, and `Security` inside versioned sections.
- Write for self-hosted operators and users, not for implementation archaeology.

If a change has no user, operator, security, or compatibility impact, it can be omitted from the changelog.

## GitHub Release Notes

Semver tag pushes create or update the GitHub Release for that tag when the release workflow is present. The release notes are generated from GitHub commit and pull request metadata, then the workflow appends the exact container image pull command.

Before creating the tag, make sure the changelog and merged pull request titles are useful enough for operators to understand what changed. The GitHub Release for `vMAJOR.MINOR.PATCH` must make the released version clear and must reference the matching image tag:

```bash
docker pull ghcr.io/muukuro/freshwax:MAJOR.MINOR.PATCH
```

Use exact semver image tags in release notes and operator instructions. Moving tags such as `latest`, `MAJOR`, and `MAJOR.MINOR` are convenience tags, not the repeatable release identifier.

## Creating a Release

1. Inspect the commits and changelog entries since the previous release tag.
2. Choose the semver bump using the rules above.
3. Confirm required checks pass.
4. Update `CHANGELOG.md` with the final version and release date.
5. Commit the changelog update.
6. Create and push the tag named `vMAJOR.MINOR.PATCH`.

The release workflow is responsible for publishing the Docker image and creating or updating the GitHub Release for the pushed tag.
