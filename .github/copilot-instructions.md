# GitHub Copilot Instructions

## Pull Request Review Guidelines

1. **Scope: review ONLY the code changes introduced in this commit/PR.** Do not comment on unchanged files, unrelated historical code, PR description, or metadata.
2. **Severity filter: raise issues only for bugs, logical errors, security risks, or obvious problems.** If the code works correctly and is reasonably clear, do not request changes.
3. **No conversation for minor issues.** Do not start review threads for style preferences, optional optimizations, or trivial formatting. If you must note a minor suggestion, include it in a single summary comment prefixed with `(Optional)`.
4. **One round only.** Provide all feedback in a single review. Do not respond to your own review comments or other Copilot-generated comments.
5. **Do not reopen resolved threads.** If a discussion is marked as resolved or outdated, leave it closed.
6. **Respect the author's autonomy.** Suggest, do not insist. Do not demand changes for subjective improvements.

## Review Scope

- Review **only the diff** of the current commit/PR.
- Do not review merge commits unless specifically requested.
- Do not review unchanged lines or files outside the diff.

## Behavior Rules

- **NO recursive reviews:** Never trigger a new review based on comments or changes made during a previous Copilot review round.
- **One review per push:** If the code has already been reviewed by Copilot for the current commit, wait for human action or a new push before reviewing again.
- **Do not auto-approve PRs.**
- **Do not request changes for minor or optional improvements.**
