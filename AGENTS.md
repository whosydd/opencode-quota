# AGENTS.md

## Project Purpose

This repository builds an OpenCode usage plugin focused on helping users understand model and subscription usage in one place.

## Current Scope

- The long-term product direction is a unified usage surface for GitHub Copilot, ChatGPT/Codex, OpenCode Go, and other providers.
- The first shipped version is intentionally smaller: a TUI plugin that exposes `/model-usage` and shows OpenCode Go subscription usage only.

## Repository Layout

- `docs/project-plan.md`: product and implementation roadmap.
- `src/tui.ts`: TUI plugin entrypoint.
- `src/config.ts`: config loading and validation.
- `src/opencode-go.ts`: OpenCode Go fetching, parsing, and caching.
- `src/format.ts`: user-facing text formatting.

## Implementation Rules

- Prefer the smallest working change.
- Keep provider-specific logic isolated so new providers can be added without rewriting the TUI command.
- Do not log secrets such as cookies or tokens.
- Prefer environment variables over config files for credentials.
- Keep v1 TUI-only unless a concrete server-side need appears.

## V1 Command Contract

- Slash command: `/model-usage`
- Behavior: fetch OpenCode Go usage and show a formatted result in the TUI.
- Failure mode: show a concise actionable error message.

## Near-Term Expansion

- Add normalized provider adapters.
- Add a server plugin entrypoint if natural-language tool access becomes necessary.
- Add more providers only after the OpenCode Go path is stable.
