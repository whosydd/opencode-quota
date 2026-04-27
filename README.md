# opencode-model-quota

<!-- README-I18N:START -->

**English** | [中文](./README.zh.md)

<!-- README-I18N:END -->

OpenCode TUI plugin for checking model or subscription quota.

## Supported Providers

> **Currently only OpenCode Go and GitHub Copilot are supported.** Additional providers may be added in the future.

- **OpenCode Go** — rolling, weekly, and monthly subscription quota (via HTML scraping)
- **GitHub Copilot** — monthly premium request quota, allowance, and overage

Providers only run when their credentials are configured. Unconfigured providers are skipped silently.

## Commands

| Command | Description |
|---------|-------------|
| `/model-quota` | Fetch and show current quota from all configured providers |

The command always fetches fresh data. A loading animation runs while providers are queried in parallel.

## Output

Quota is displayed as a card-based dialog with progress bars, percentages, and reset timers:

```
+--------------------------------------------+
| [OpenCode Go] [subscription]               |
|                                            |
| Rolling: [########------------]  33% 5m    |
| Weekly:  [############--------]  50% 3d 2h |
| Monthly: [####################]  83% 12d   |
+--------------------------------------------+

                Updated: Apr 27, 2:30 PM
```

## Install

### 1. From npm (Recommended)

```bash
npm install opencode-model-quota
```

### 2. Register in OpenCode

Add the plugin to your `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "opencode-model-quota",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}"
        },
        "githubCopilot": {
          "username": "your-github-login",
          "token": "{env:GITHUB_COPILOT_TOKEN}",
          "plan": "pro"
        }
      }
    ]
  ]
}
```

Configure only the providers you need. Omit `opencodeGo` or `githubCopilot` to skip that provider.

### 3. Verify

Restart OpenCode and run `/model-quota` in the TUI.

<details>
<summary>Manual build (for developers)</summary>

```bash
git clone https://github.com/whosydd/opencode-model-usage.git
cd opencode-model-usage
npm install
npm run build
```

Then register using the absolute path to `dist/tui.js`.
</details>

## Configuration

Priority: `tui.json` plugin options → environment variables.

### Environment Variables

```bash
export OPENCODE_GO_WORKSPACE_ID="wrk_your_workspace_id"
export OPENCODE_GO_AUTH_COOKIE="Fe26.2**your_auth_cookie"

export GITHUB_COPILOT_USERNAME="your-github-login"
export GITHUB_COPILOT_TOKEN="github_pat_your_token"
export GITHUB_COPILOT_PLAN="pro"  # "pro" or "pro+"
```

### Getting OpenCode Go Credentials

**Workspace ID:**

1. Log in to [opencode.ai](https://opencode.ai) and open the Go page.
2. The URL will look like `https://opencode.ai/workspace/wrk_xxxxxxxx/go`.
3. The `wrk_xxxxxxxx` part is your workspace ID.

**Auth Cookie:**

1. Log in to [opencode.ai](https://opencode.ai) in your browser.
2. Open Developer Tools (F12 or Ctrl+Shift+I / Cmd+Option+I).
3. Go to **Application** → **Cookies** → `https://opencode.ai`.
4. Find the cookie named `auth` and copy its value.
5. The value starts with `Fe26.2**` and is a long string.

> The cookie expires periodically. If quota fetching fails with an auth error, repeat these steps to get a fresh cookie.

### Configuration Model Details

String values in `tui.json` or config sources support `{env:VARIABLE_NAME}` placeholders. Shell command placeholders like `{env:$(gh auth token)}` are not supported.

`githubCopilot.plan` only supports `"pro"` (300 requests/month) and `"pro+"` (1500 requests/month). It defaults to `"pro"` when omitted.

## GitHub Copilot Data Sources

The plugin tries two GitHub API endpoints in order:

1. **Quota snapshot** (`/copilot_internal/user`) — matches the usage shown in VS Code. Returned when the token has access to the Copilot internal API.
2. **Billing usage** (`/users/{username}/settings/billing/premium_request/usage`) — personal billing only. Falls back when the snapshot endpoint returns 404. Organization-managed licenses are not included.

Auth, permission, and rate-limit errors from the quota snapshot are surfaced directly, not masked by the billing fallback.
