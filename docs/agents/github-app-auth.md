# GitHub App authentication for Codex

Codex must use the `freshwax-codex` GitHub App installation for GitHub operations on `Muukuro/freshwax`. The wrapper creates a short-lived App JWT locally, exchanges it for a repository-scoped installation token immediately before each command, and passes that token only through the child process environment.

## Local installation

Install the repository script at `~/.local/bin/codex-gh`. Create `~/.config/freshwax-codex/config` with:

```text
APP_ID=123456
INSTALLATION_ID=12345678
PRIVATE_KEY_PATH=~/.config/freshwax-codex/freshwax-codex.2026-07-23.private-key.pem
```

The IDs are nonsensitive, but the local config and private key must be readable only by their owner:

```bash
chmod 600 ~/.config/freshwax-codex/config
chmod 600 ~/.config/freshwax-codex/freshwax-codex.2026-07-23.private-key.pem
```

The private key and machine-specific config stay outside the repository. Do not copy, move, rewrite, commit, print, or paste the key. If `~/.local/bin` is not already on `PATH`, invoke the wrapper by its full path or add only that directory to the user's existing PATH configuration.

## Verification and use

Verify identity before the first GitHub write in a task:

```bash
codex-gh whoami
codex-gh gh repo view Muukuro/freshwax
codex-gh gh issue list --repo Muukuro/freshwax
codex-gh gh pr list --repo Muukuro/freshwax
codex-gh gh api repos/Muukuro/freshwax/actions/runs
```

Use the same prefix for controlled writes:

```bash
codex-gh gh issue comment 123 --repo Muukuro/freshwax --body "..."
codex-gh git push origin HEAD
```

The wrapper does not alter the normal `gh` login, credential storage, Git configuration, configured remote, or Git author. Git commit authorship continues to use the human author's configured `user.name` and `user.email`; issue, PR, push, and API attribution uses the GitHub App bot identity.

## Token lifetime and permissions

GitHub installation tokens expire after one hour. The wrapper requests a fresh token immediately before every invocation, so retry a command through `codex-gh` instead of persisting or reusing a token.

A `403` usually means the App lacks the required repository permission. Confirm the operation is allowed by repository policy, inspect the App installation permissions, grant only the necessary permission in GitHub, and then rerun `codex-gh whoami`. Never fall back to the human `gh` account.

## Rotation and revocation

To rotate the key, generate and download a replacement from the GitHub App settings, store it outside the repository with mode `600`, update `PRIVATE_KEY_PATH`, verify with `codex-gh whoami`, and revoke the old key in GitHub. To revoke all access, suspend or uninstall the App installation and remove the local key and config through an appropriate secure deletion process.
