import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const CONFIG_FILE = "opencode-model-status.json"
const DEFAULT_REFRESH_MINUTES = 5

export type OpenCodeGoConfig = {
  workspaceId: string
  authCookie: string
  refreshIntervalMinutes: number
}

export type OpenCodeGoConfigOverrides = Partial<{
  workspaceId: unknown
  authCookie: unknown
  refreshIntervalMinutes: unknown
  opencodeGo: {
    workspaceId?: unknown
    authCookie?: unknown
    refreshIntervalMinutes?: unknown
  }
}>

type ConfigFile = {
  opencodeGo?: Partial<OpenCodeGoConfig>
  workspaceId?: string
  authCookie?: string
  refreshIntervalMinutes?: number
}

export function getConfigPaths(): string[] {
  const homeDirectory = os.homedir()

  return [
    path.join(homeDirectory, ".config", "opencode", CONFIG_FILE),
    path.join(homeDirectory, ".opencode", CONFIG_FILE),
    path.join(process.cwd(), ".opencode", CONFIG_FILE),
  ]
}

export function loadOpenCodeGoConfig(overrides?: OpenCodeGoConfigOverrides): OpenCodeGoConfig {
  const fileConfig = readConfigFile()
  const optionConfig = readOverrides(overrides)
  const workspaceId = (optionConfig.workspaceId ?? process.env.OPENCODE_GO_WORKSPACE_ID ?? fileConfig.workspaceId)?.trim()
  const authCookie = (optionConfig.authCookie ?? process.env.OPENCODE_GO_AUTH_COOKIE ?? fileConfig.authCookie)?.trim()
  const merged = {
    workspaceId,
    authCookie,
    refreshIntervalMinutes: parseRefreshMinutes(
      optionConfig.refreshIntervalMinutes ?? process.env.OPENCODE_GO_REFRESH_MINUTES ?? fileConfig.refreshIntervalMinutes,
    ),
  }

  if (!merged.workspaceId || !merged.authCookie) {
    throw new Error(
      [
        "OpenCode Go is not configured.",
        "Set plugin options in tui.json,",
        "or OPENCODE_GO_WORKSPACE_ID and OPENCODE_GO_AUTH_COOKIE,",
        `or add them to ${CONFIG_FILE}.`,
      ].join(" "),
    )
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
    refreshIntervalMinutes: merged.refreshIntervalMinutes,
  }
}

function readConfigFile(): Partial<OpenCodeGoConfig> {
  let parseError: Error | null = null

  for (const filePath of getConfigPaths()) {
    if (!fs.existsSync(filePath)) continue

    try {
      const parsed = parseConfigFile(filePath)
      if (parsed) return parsed
    } catch (error) {
      parseError = error instanceof Error ? error : new Error(`Failed to read config file: ${filePath}`)
    }
  }

  if (parseError) throw parseError

  return {}
}

function parseConfigFile(filePath: string): Partial<OpenCodeGoConfig> {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ConfigFile
    const opencodeGo = parsed.opencodeGo ?? parsed

    return {
      workspaceId: opencodeGo.workspaceId,
      authCookie: typeof opencodeGo.authCookie === "string" ? opencodeGo.authCookie.trim() : undefined,
      refreshIntervalMinutes: parseRefreshMinutes(opencodeGo.refreshIntervalMinutes),
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse config file: ${filePath}`)
    }
    throw new Error(`Failed to read config file: ${filePath}`)
  }
}

function parseRefreshMinutes(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return DEFAULT_REFRESH_MINUTES
}

function readOverrides(overrides: OpenCodeGoConfigOverrides | undefined): Partial<OpenCodeGoConfig> {
  if (!overrides || typeof overrides !== "object") return {}

  const nested = typeof overrides.opencodeGo === "object" && overrides.opencodeGo ? overrides.opencodeGo : undefined

  return {
    workspaceId: asTrimmedString(overrides.workspaceId ?? nested?.workspaceId),
    authCookie: asTrimmedString(overrides.authCookie ?? nested?.authCookie),
    refreshIntervalMinutes: parseOptionalRefreshMinutes(
      overrides.refreshIntervalMinutes ?? nested?.refreshIntervalMinutes,
    ),
  }
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined
}

function parseOptionalRefreshMinutes(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value === "number" || typeof value === "string") {
    return parseRefreshMinutes(value)
  }

  return undefined
}
