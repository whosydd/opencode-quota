import path from "node:path"

const ENV_REFERENCE_PATTERN = /^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/
const ENV_PLACEHOLDER_PATTERN = /^\{env:(.+)\}$/

export type OpenCodeGoConfig = {
  workspaceId: string
  authCookie: string
}

export type PluginConfigOverrides = Record<string, unknown>
export type OpenCodeGoConfigOverrides = PluginConfigOverrides

export function loadOpenCodeGoConfig(): OpenCodeGoConfig {
  const config = loadOptionalOpenCodeGoConfig()
  if (config) return config

  throw new Error(
    [
      "OpenCode Go is not configured.",
      "Set OPENCODE_GO_WORKSPACE_ID and OPENCODE_GO_AUTH_COOKIE.",
    ].join(" "),
  )
}

export function loadOptionalOpenCodeGoConfig(): OpenCodeGoConfig | null {
  const workspaceId = asTrimmedString(process.env.OPENCODE_GO_WORKSPACE_ID)
  const authCookie = asTrimmedString(process.env.OPENCODE_GO_AUTH_COOKIE)

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

function parseEnvReference(value: string): string | null {
  const match = value.match(ENV_REFERENCE_PATTERN)
  return match ? match[1] : null
}

function looksLikeEnvPlaceholder(value: string): boolean {
  return ENV_PLACEHOLDER_PATTERN.test(value)
}
