# Project Plan

## Goal

Build an OpenCode plugin that lets users quickly inspect model or subscription usage so they can decide when to use premium models and when to switch to cheaper ones.

## Product Direction

The target experience is a unified usage command that can show:

- GitHub Copilot premium request usage.
- ChatGPT or Codex subscription window usage.
- OpenCode Go rolling, weekly, and monthly usage.
- Future provider-specific usage windows where official or stable unofficial sources exist.

## Delivery Strategy

### Phase 0: Repository Setup

- Create project documentation.
- Define architecture boundaries.
- Ship a minimal plugin structure that is easy to extend.

### Phase 1: Minimal Working Version

- Scope: OpenCode Go only.
- Surface: `/model-usage` slash command in the TUI, plus `/model-usage-refresh` for forced refresh.
- Output: a short formatted summary shown in a TUI dialog.
- Configuration: `tui.json` plugin options first, then environment variables, then config file fallback.
- Caching: in-memory cache to avoid repeated scraping.

### Phase 2: Provider Expansion

- Add adapter-based provider normalization.
- Reuse OpenCode built-in usage data where it already exists.
- Add GitHub Copilot and ChatGPT or Codex support.
- Current progress: GitHub Copilot premium request usage is available through the IDE quota snapshot path with a personal billing fallback for user-billed accounts.

### Phase 3: Richer UX

- Optional sidebar summary.
- Background refresh and stale state handling.
- Natural-language tool access through a server plugin if needed.

## Architecture

- `src/tui.ts` owns the slash command registration and TUI feedback.
- `src/config.ts` centralizes environment and file-based config loading.
- `src/opencode-go.ts` owns remote fetching, HTML parsing, and cache behavior.
- `src/github-copilot.ts` owns GitHub billing API fetching and cache behavior.
- `src/format.ts` converts provider data into user-facing text.

## V1 Shape

- A TUI plugin package exposing `./tui`.
- A single slash command, `/model-usage`.
- A provider module dedicated to OpenCode Go.

## Key Technical Choices

- TUI plugin first: smallest path to a visible command.
- Provider module separation: future providers stay isolated.
- Shared formatter: the command stays stable while providers evolve.
- Cookie-based OpenCode Go fetcher: currently the most realistic path until an official API is available.

## Configuration Model

### Preferred

- TUI plugin options in `tui.json`
- `workspaceId`
- `authCookie`
- `refreshIntervalMinutes`

Example:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-usage/dist/tui.js",
      {
        "workspaceId": "wrk_example",
        "authCookie": "Fe26.2**example",
        "refreshIntervalMinutes": 5
      }
    ]
  ]
}
```

### Fallback Environment

- `OPENCODE_GO_WORKSPACE_ID`
- `OPENCODE_GO_AUTH_COOKIE`
- `OPENCODE_GO_REFRESH_MINUTES`

### Fallback File

- `~/.config/opencode/opencode-model-usage.json`
- `~/.opencode/opencode-model-usage.json`
- `<project>/.opencode/opencode-model-usage.json`

Example:

```json
{
  "opencodeGo": {
    "workspaceId": "wrk_example",
    "authCookie": "Fe26.2**example",
    "refreshIntervalMinutes": 5
  }
}
```

## Risks

- OpenCode Go usage is currently obtained from the web app, so parsing can break if page structure changes.
- Cookies expire, so error handling must remain user-friendly.
- The first version should not overfit around unstable HTML details.

## Definition Of Done For V1

- Repository has clear agent and project documentation.
- `/model-usage` is registered by the TUI plugin.
- The command returns OpenCode Go usage when configured.
- Misconfiguration and auth failures produce clear messages.
- Build succeeds locally.
