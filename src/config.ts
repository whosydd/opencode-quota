import path from "node:path"

const ENV_REFERENCE_PATTERN = /^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/
const ENV_PLACEHOLDER_PATTERN = /^\{env:(.+)\}$/

export type OpenCodeGoConfig = {
  workspaceId: string
  authCookie: string
}

export type GitHubCopilotPlan = "pro" | "pro+"

export type GitHubCopilotConfig = {
  username: string
  token: string
  plan: GitHubCopilotPlan
}

export type PluginConfigOverrides = Partial<{
  workspaceId: unknown
  authCookie: unknown
  opencodeGo: {
    workspaceId?: unknown
    authCookie?: unknown
  }
  githubCopilot: {
    username?: unknown
    token?: unknown
    plan?: unknown
  }
}>

export type OpenCodeGoConfigOverrides = PluginConfigOverrides
export type GitHubCopilotConfigOverrides = PluginConfigOverrides

function readOpenCodeGoOverrides(overrides: PluginConfigOverrides | undefined): Partial<OpenCodeGoConfig> {
  if (!overrides || typeof overrides !== "object") return {}

  const nested = typeof overrides.opencodeGo === "object" && overrides.opencodeGo ? overrides.opencodeGo : undefined

  return {
    workspaceId: asTrimmedString(overrides.workspaceId ?? nested?.workspaceId),
    authCookie: asTrimmedString(overrides.authCookie ?? nested?.authCookie),
  }
}

export function loadOpenCodeGoConfig(overrides?: PluginConfigOverrides): OpenCodeGoConfig {
  const config = loadOptionalOpenCodeGoConfig(overrides)
  if (config) return config

  throw new Error(
    [
      "OpenCode Go is not configured.",
      "Set plugin options in tui.json,",
      "or OPENCODE_GO_WORKSPACE_ID and OPENCODE_GO_AUTH_COOKIE.",
    ].join(" "),
  )
}

export function loadOptionalOpenCodeGoConfig(overrides?: PluginConfigOverrides): OpenCodeGoConfig | null {
  const optionConfig = readOpenCodeGoOverrides(overrides)
  const workspaceId = (optionConfig.workspaceId ?? process.env.OPENCODE_GO_WORKSPACE_ID)?.trim()
  const authCookie = (optionConfig.authCookie ?? process.env.OPENCODE_GO_AUTH_COOKIE)?.trim()

  if (!workspaceId || !authCookie) return null

  const merged = {
    workspaceId,
    authCookie,
  }

  if (!/^wrk_[A-Za-z0-9_-]+$/.test(merged.workspaceId)) {
    throw new Error("OPENCODE_GO_WORKSPACE_ID is invalid.")
  }

  if (merged.authCookie.length < 10) {
    throw new Error("OPENCODE_GO_AUTH_COOKIE looks invalid.")
  }

  return {
    workspaceId: merged.workspaceId,
    authCookie: merged.authCookie,
  }
}

export function loadGitHubCopilotConfig(overrides?: PluginConfigOverrides): GitHubCopilotConfig {
  const config = loadOptionalGitHubCopilotConfig(overrides)
  if (config) return config

  throw new Error(
    [
      "GitHub Copilot is not configured.",
      "Set githubCopilot.username and githubCopilot.token in tui.json,",
      "or GITHUB_COPILOT_USERNAME and GITHUB_COPILOT_TOKEN.",
    ].join(" "),
  )
}

export function loadOptionalGitHubCopilotConfig(
  overrides?: PluginConfigOverrides,
): GitHubCopilotConfig | null {
  const optionConfig = readGitHubCopilotOverrides(overrides)
  const username = (optionConfig.username ?? process.env.GITHUB_COPILOT_USERNAME)?.trim()
  const token = (optionConfig.token ?? process.env.GITHUB_COPILOT_TOKEN)?.trim()

  if (!username || !token) return null

  const merged = {
    username,
    token,
    plan: parsePlan(
      optionConfig.plan ?? process.env.GITHUB_COPILOT_PLAN,
    ),
  }

  if (!/^[A-Za-z0-9-]+$/.test(merged.username)) {
    throw new Error("GITHUB_COPILOT_USERNAME is invalid.")
  }

  if (merged.token.length < 20) {
    throw new Error("GITHUB_COPILOT_TOKEN looks invalid.")
  }

  return {
    username: merged.username,
    token: merged.token,
    plan: merged.plan,
  }
}

function readGitHubCopilotOverrides(
  overrides: PluginConfigOverrides | undefined,
): Partial<GitHubCopilotConfig> {
  if (!overrides || typeof overrides !== "object") return {}

  const nested = typeof overrides.githubCopilot === "object" && overrides.githubCopilot ? overrides.githubCopilot : undefined

  return {
    username: asTrimmedString(nested?.username),
    token: asTrimmedString(nested?.token),
    plan: asTrimmedStringOrValue(nested?.plan) as GitHubCopilotPlan | undefined,
  }
}

function asTrimmedStringOrValue(value: unknown): unknown {
  return typeof value === "string" ? asTrimmedString(value) : value
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  const envName = parseEnvReference(trimmed)
  if (envName) {
    const resolved = process.env[envName]?.trim()
    if (!resolved) {
      throw new Error(`Environment variable ${envName} is not set.`)
    }

    return resolved
  }

  if (looksLikeEnvPlaceholder(trimmed)) {
    throw new Error(
      `Invalid environment placeholder "${trimmed}". Use {env:VARIABLE_NAME}; shell commands like {env:$(gh auth token)} are not supported.`,
    )
  }

  return trimmed
}

function parsePlan(value: unknown): GitHubCopilotPlan {
  if (value === undefined || value === null) return "pro"

  const normalized = typeof value === "string" ? value.toLowerCase().trim() : String(value)

  if (normalized === "pro+") {
    return "pro+"
  }

  if (normalized === "pro") {
    return "pro"
  }

  throw new Error("GITHUB_COPILOT_PLAN must be \"pro\" or \"pro+\".")
}

function parseEnvReference(value: string): string | null {
  const match = value.match(ENV_REFERENCE_PATTERN)
  return match ? match[1] : null
}

function looksLikeEnvPlaceholder(value: string): boolean {
  return ENV_PLACEHOLDER_PATTERN.test(value)
}
