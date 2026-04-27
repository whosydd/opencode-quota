# Project Plan

## Goal

Build an OpenCode plugin that lets users quickly inspect model or subscription quota so they can decide when to use premium models and when to switch to cheaper ones.

## Product Direction

The target experience is a unified quota command that can show:

- GitHub Copilot premium request quota.
- OpenCode Go rolling, weekly, and monthly quota.
- Future provider-specific quota windows where official or stable unofficial sources exist.

## Delivery Strategy

### Phase 0: Repository Setup ✅

- Create project documentation.
- Define architecture boundaries.
- Ship a minimal plugin structure that is easy to extend.

### Phase 1: Minimal Working Version ✅

- Scope: OpenCode Go only.
- Surface: `/model-quota` slash command in the TUI.
- Output: a short formatted summary shown in a TUI dialog.
- Configuration: `tui.json` plugin options first, then environment variables.
- No caching: always fetches fresh data on each invocation.

### Phase 2: Provider Expansion ✅

- Add GitHub Copilot premium request quota with IDE quota snapshot path and personal billing fallback.
- Provider modules are isolated: each owns its own fetch, parse, and error handling.
- Parallel fetching: all configured providers run concurrently with `Promise.allSettled`; partial failures are reported alongside successes.

### Phase 3: Richer UX

- Optional sidebar summary.
- Background refresh and stale state handling.
- Natural-language tool access through a server plugin if needed.

## Architecture

- `src/tui.ts` owns the slash command registration and TUI feedback.
- `src/config.ts` centralizes environment-based config loading and `tui.json` overrides.
- `src/opencode-go.ts` owns remote fetching, HTML parsing, and data extraction.
- `src/github-copilot.ts` owns GitHub Copilot API fetching and response parsing.
- `src/format.ts` converts provider data into user-facing text.

### Provider Isolation

`tui.ts` does not know how data is fetched. Each provider module:

- Exports a single `get<Provider>Quota()` function that accepts optional config overrides.
- Returns a structured snapshot type, not formatted strings.
- Owns its own error handling and HTTP error surfacing.

### Output Formatting

`format.ts` is the single place for user-facing text. It renders:

- Card-based layout with borders and right-aligned values.
- Progress bars (`[########----------------]`) for quota percentages.
- Severity thresholds: success (< 50%), warning (50-79%), error (>= 80%).
- Combined timestamp at the bottom of all provider cards.

## V1 Shape

- A TUI plugin package exposing `./tui`.
- A single slash command, `/model-quota`.
- Two provider modules only: OpenCode Go and GitHub Copilot. No other providers are supported yet.
- Providers only run when their credentials are configured; unconfigured providers are skipped silently.
- If no providers are configured, a clear error message lists the required credentials.

## Key Technical Choices

- TUI plugin first: smallest path to a visible command.
- Provider module separation: future providers stay isolated.
- Shared formatter: the command stays stable while providers evolve.
- Cookie-based OpenCode Go fetcher: currently the most realistic path until an official API is available.
- GitHub Copilot quota snapshot as primary source: matched to IDE usage; billing endpoint as fallback for personal accounts.

## Configuration Model

Priority: `tui.json` plugin options → environment variables.

### tui.json Plugin Options

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-quota/dist/tui.js",
      {
        "opencodeGo": {
          "workspaceId": "wrk_example",
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

### Environment Variables

- `OPENCODE_GO_WORKSPACE_ID`
- `OPENCODE_GO_AUTH_COOKIE`
- `GITHUB_COPILOT_USERNAME`
- `GITHUB_COPILOT_TOKEN`
- `GITHUB_COPILOT_PLAN` — `"pro"` (default) or `"pro+"`

String values support `{env:VARIABLE_NAME}` placeholders. Shell command placeholders like `{env:$(gh auth token)}` are explicitly rejected.

## Provider Quirks

### OpenCode Go

- Scrapes `https://opencode.ai/workspace/{id}/go` and parses inline JS object literals from HTML.
- Parsing is fragile; the page format can change without warning.
- Returns rolling, weekly, and monthly windows with `quotaPercent` and `resetInSec`.

### GitHub Copilot

- **Primary**: `GET /copilot_internal/user` quota snapshot (matches VS Code IDE usage).
- **Fallback**: `GET /users/{username}/settings/billing/premium_request/usage` (personal billing only; org-managed licenses are not included).
- Quota snapshot 404s are silently ignored and trigger billing fallback.
- Auth/permission/rate-limit errors from quota snapshot are **surfaced directly**, not masked by billing fallback errors.
- `plan` is used for billing fallback to compute percentages; only `"pro"` (300 requests) and `"pro+"` (1500 requests) are supported. Defaults to `"pro"`.

## Risks

- OpenCode Go quota is currently obtained from the web app, so parsing can break if page structure changes.
- Cookies expire, so error handling must remain user-friendly.
- GitHub Copilot `copilot_internal` is an internal API and may change or require different scopes.
- The first version should not overfit around unstable HTML or API response details.

## Definition Of Done For V1

- Repository has clear agent and project documentation.
- `/model-quota` is registered by the TUI plugin.
- The command returns OpenCode Go and/or GitHub Copilot quota when configured.
- Unconfigured providers are skipped; partial failures are reported alongside successes.
- Misconfiguration and auth failures produce clear messages.
- Build succeeds locally and type-checks cleanly.