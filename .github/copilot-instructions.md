# GitHub Copilot Instructions

## Pull Request Review Guidelines

1. **Do not engage in extended back-and-forth conversations** in review comments.
2. Provide clear, actionable feedback in a single round when possible.
3. Avoid responding to your own review comments or other Copilot-generated comments.
4. Focus on code quality, security, and correctness — not stylistic debates.
5. If a discussion thread is already resolved or marked as outdated, do not reopen it.
6. Respect the author's autonomy: suggest, do not insist.

## Review Scope

- Review code changes only, not the PR description or metadata.
- Do not review merge commits unless specifically requested.
- Avoid nitpicking on minor formatting issues unless they violate project standards.

## Behavior Rules

- **NO recursive reviews**: Never trigger a new review based on comments or changes made during a previous Copilot review round.
- One review per push: If the code has already been reviewed by Copilot for the current commit, wait for human action or a new push before reviewing again.
- Do not auto-approve PRs.
