# opencode-model-status

OpenCode TUI plugin for checking model or subscription usage.

The first version only supports OpenCode Go and exposes a single slash command:

```text
/model-usage
```

It also exposes a manual refresh command:

```text
/model-usage-refresh
```

## Status

- Current: OpenCode Go only
- Planned: Copilot, ChatGPT or Codex, and other provider adapters

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
        "workspaceId": "wrk_your_workspace_id",
        "authCookie": "Fe26.2**your_auth_cookie",
        "refreshIntervalMinutes": 5
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
        "workspaceId": "wrk_your_workspace_id",
        "authCookie": "Fe26.2**your_auth_cookie",
        "refreshIntervalMinutes": 5
      }
    ]
  ]
}
```

Nested form is also supported:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-status/dist/tui.js",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "Fe26.2**your_auth_cookie",
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
```

Config file fallback:

```json
{
  "opencodeGo": {
    "workspaceId": "wrk_your_workspace_id",
    "authCookie": "Fe26.2**your_auth_cookie",
    "refreshIntervalMinutes": 5
  }
}
```

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

## Security Note

If you put `authCookie` in `tui.json`, it is stored in plaintext on disk. Prefer a user-level config file, not a project repository file.
