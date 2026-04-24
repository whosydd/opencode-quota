# opencode-model-status

OpenCode TUI plugin for checking model or subscription usage.

The plugin currently supports:

- OpenCode Go rolling, weekly, and monthly subscription usage
- GitHub Copilot monthly premium request usage, allowance, and overage

It exposes a single slash command:

```text
/model-usage
```

It also exposes a manual refresh command:

```text
/model-usage-refresh
```

## Status

- Current: OpenCode Go and GitHub Copilot
- Planned: ChatGPT or Codex, and other provider adapters

## Install For Local Development

1. Install dependencies:

```bash
npm install
```

2. Build the plugin:

```bash
npm run build
```

3. Add the built plugin to your OpenCode TUI config:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-status/dist/tui.js",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}",
          "refreshIntervalMinutes": 5
        },
        "githubCopilot": {
          "username": "your-github-login",
          "token": "{env:GITHUB_COPILOT_TOKEN}",
          "refreshIntervalMinutes": 5,
          "monthlyAllowance": 300
        }
      }
    ]
  ]
}
```

OpenCode will load the local TUI plugin file directly.

## Configuration

Preferred: `tui.json` plugin options.

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-status/dist/tui.js",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}",
          "refreshIntervalMinutes": 5
        },
        "githubCopilot": {
          "username": "your-github-login",
          "token": "{env:GITHUB_COPILOT_TOKEN}",
          "refreshIntervalMinutes": 5,
          "monthlyAllowance": 300
        }
      }
    ]
  ]
}
```

OpenCode Go also supports the legacy top-level form:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-status/dist/tui.js",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}",
          "refreshIntervalMinutes": 5
        }
      }
    ]
  ]
}
```

Environment variables remain supported as fallback:

```bash
export OPENCODE_GO_WORKSPACE_ID="wrk_your_workspace_id"
export OPENCODE_GO_AUTH_COOKIE="Fe26.2**your_auth_cookie"
export OPENCODE_GO_REFRESH_MINUTES="5"

export GITHUB_COPILOT_USERNAME="your-github-login"
export GITHUB_COPILOT_TOKEN="github_pat_your_token"
export GITHUB_COPILOT_REFRESH_MINUTES="5"
export GITHUB_COPILOT_MONTHLY_ALLOWANCE="300"
```

Config file fallback:

```json
{
  "opencodeGo": {
    "workspaceId": "wrk_your_workspace_id",
    "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}",
    "refreshIntervalMinutes": 5
  },
  "githubCopilot": {
    "username": "your-github-login",
    "token": "{env:GITHUB_COPILOT_TOKEN}",
    "refreshIntervalMinutes": 5,
    "monthlyAllowance": 300
  }
}
```

String config values in `tui.json` and `opencode-model-status.json` also support exact environment placeholders like `{env:OPENCODE_GO_AUTH_COOKIE}` and `{env:GITHUB_COPILOT_TOKEN}`.

Valid config file locations:

- `~/.config/opencode/opencode-model-status.json`
- `~/.opencode/opencode-model-status.json`
- `<project>/.opencode/opencode-model-status.json`

## Usage

Inside OpenCode TUI:

```text
/model-usage
```

Or force a live refresh:

```text
/model-usage-refresh
```

The plugin shows OpenCode Go rolling, weekly, and monthly usage in a TUI dialog with progress bars and a live or cached status line.

If GitHub Copilot is configured, the dialog shows monthly premium request usage, allowance, overage, and reset time.

## GitHub Copilot Notes

- The plugin first tries the same internal quota snapshot path used by IDE surfaces, then falls back to the personal billing usage endpoint.
- The internal quota snapshot is the closest match to what VS Code shows for premium request usage.
- The billing fallback works for usage billed directly to a user account and aggregates all premium request SKUs that draw from the same monthly allowance.
- The billing fallback is only used when the quota snapshot path is unavailable. Authentication, permission, rate-limit, and other quota API failures are surfaced directly instead of being masked by a secondary billing error.
- Use a GitHub token that can read billing usage for the account.
- The billing fallback does not reliably expose the personal plan allowance, so set `githubCopilot.monthlyAllowance` or `GITHUB_COPILOT_MONTHLY_ALLOWANCE` when needed. Use `300` for Copilot Pro or `1500` for Copilot Pro+.

## Security Note

If you put `authCookie` or `token` in `tui.json`, it is stored in plaintext on disk. Prefer environment variables or a user-level config file, not a project repository file.
