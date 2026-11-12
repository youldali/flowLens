# AI settings bridge

The frontend uses the existing VS Code `postMessage` bridge. The handlers below
still need to be implemented in the extension; the legacy `ai.configure` command
opens a host-side prompt and cannot implement this form's load/save flow.

Contracts and validators are in `@flowlens/registries/vscode-events`:

- `ai.settings.get`: `{ requestId }`. Reply with `ai.settings.result` containing
  `{ requestId, configuration: { backend, credentialPresence: { openai, anthropic } } }`.
  Both credential-presence values must be booleans. A successful load indicates
  that this host supports the settings save protocol too.
- `ai.settings.save`: `{ requestId, configuration: { backend, credential? } }`.
  `credential`, if supplied, is `{ provider: 'openai' | 'anthropic', apiKey }`.
  It must match the selected API backend. An omitted credential means **keep the
  existing key**; it never means delete a key. Other providers' keys stay intact.
- After saving the backend and any supplied credential, reply with
  `ai.settings.result` and the confirmed backend and credential-presence flags.
  Do not acknowledge success before persistence completes. On failure use
  `ai.settings.error`: `{ requestId, reason: 'unsupported' | 'load-failed' | 'save-failed' }`.
  Do not put keys or raw exception text into responses or logs.

The extension must persist credentials in its existing provider-specific
SecretStorage entries and add backend persistence/selection for `openai-api`,
`claude-api`, and `codex-cli`. The current extension configuration only selects
an API provider (`openai` or `anthropic`). It also needs to honor the `backend`
already included in `explain.node` requests and implement Codex CLI routing/auth.

The frontend loads configuration on toolbar mount and refreshes it on each modal
open. Only confirmed configuration enters the shared `['ai', 'settings']` React Query cache. Keys live
only in the mounted form and the in-flight save request; they are not put into
Redux, React Query mutation state, browser storage, or Explain payloads. Closing
the form discards both providers' draft keys. Dismissal and duplicate submissions
are disabled during a save while its outcome is pending.

An older extension that ignores these operations produces an actionable load
error after the shared `VSCODE_REQUEST_TIMEOUT_MS` timeout (60 seconds), as do all
VS Code request/response operations. No editing or saving is enabled without a
successful load. A timeout cannot undo a request
already delivered to the host, so the error directs users to reopen settings to
check the persisted state. No successful save or credential presence is inferred
from a timeout, submitted key, or the legacy configuration command.
