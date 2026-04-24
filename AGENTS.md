# AGENTS.md

## Project Purpose

OpenCode TUI plugin that shows model/subscription usage from multiple providers in one place.

## Current Scope

- OpenCode Go rolling, weekly, and monthly subscription usage (HTML scraping)
- GitHub Copilot monthly premium request usage, allowance, and overage
- Two slash commands: `/model-usage` (cached) and `/model-usage-refresh` (force live)

## Build & Verify

```bash
npm install
npm run build      # tsup ESM + dts -> dist/
npm run typecheck  # tsc --noEmit
```

No test suite exists yet. Verify by building and type-checking.

## Repository Layout

- `src/tui.ts`: TUI plugin entrypoint. Registers slash commands, orchestrates provider calls, renders dialogs.
- `src/config.ts`: Config loading with priority: `tui.json` plugin options → env vars → `opencode-model-usage.json` file.
- `src/opencode-go.ts`: HTML fetch + parse for OpenCode Go usage. In-memory cache with stale fallback.
- `src/github-copilot.ts`: GitHub API fetcher. Tries IDE quota snapshot first, falls back to personal billing usage endpoint. In-memory cache with stale fallback.
- `src/format.ts`: Text formatting for TUI dialog output.
- `docs/project-plan.md`: Roadmap (phases 0-3).

## Architecture Rules

- Keep provider logic isolated. `tui.ts` should not know how data is fetched.
- Each provider owns its own fetch, parse, cache, and error handling.
- `format.ts` is the single place for user-facing text; providers return structured data, not strings.
- Do not log secrets (cookies, tokens) anywhere.
- Prefer environment variables over config files for credentials.

## Provider Quirks

### OpenCode Go
- Scrapes `https://opencode.ai/workspace/{id}/go` and parses inline JS object literals from HTML.
- Parsing is fragile; the page format can change without warning.
- Returns rolling, weekly, and monthly windows with `usagePercent` and `resetInSec`.

### GitHub Copilot
- **Primary**: `GET /copilot_internal/user` quota snapshot (matches VS Code IDE usage).
- **Fallback**: `GET /users/{username}/settings/billing/premium_request/usage` (personal billing only; org-managed licenses are not included).
- Quota snapshot 404s are silently ignored and trigger billing fallback.
- Auth/permission/rate-limit errors from quota snapshot are **surfaced directly**, not masked by billing fallback errors.
- `monthlyAllowance` is required for billing fallback to compute percentages; set to `300` (Copilot Pro) or `1500` (Copilot Pro+).

## Config & Secrets

- Config file name: `opencode-model-usage.json`
- Valid locations: `~/.config/opencode/`, `~/.opencode/`, `<project>/.opencode/`
- String values support `{env:VARIABLE_NAME}` placeholders. Shell command placeholders like `{env:$(gh auth token)}` are explicitly rejected.
- Never commit tokens or cookies to the repo.

## Constraints

- TUI-only for now. No server plugin entrypoint unless a concrete need appears.
- This is a single-package repo, not a monorepo.
