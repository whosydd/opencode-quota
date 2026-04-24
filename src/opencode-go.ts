import crypto from "node:crypto"
import {
  loadOpenCodeGoConfig,
  type OpenCodeGoConfig,
  type OpenCodeGoConfigOverrides,
} from "./config.js"

type OpenCodeGoWindow = {
  usagePercent: number
  resetInSec: number
}

export type OpenCodeGoSnapshot = {
  rolling: OpenCodeGoWindow | null
  weekly: OpenCodeGoWindow | null
  monthly: OpenCodeGoWindow | null
  fetchedAt: number
  stale?: boolean
  cached?: boolean
}

type CacheEntry = {
  configFingerprint: string
  expiresAt: number
  snapshot: OpenCodeGoSnapshot
}

let cache: CacheEntry | null = null

export async function getOpenCodeGoUsage(
  forceRefresh = false,
  overrides?: OpenCodeGoConfigOverrides,
): Promise<OpenCodeGoSnapshot> {
  const config = loadOpenCodeGoConfig(overrides)
  const now = Date.now()
  const configFingerprint = createConfigFingerprint(config)

  if (!forceRefresh && cache && cache.configFingerprint === configFingerprint && cache.expiresAt > now) {
    return {
      ...cache.snapshot,
      cached: true,
    }
  }

  try {
    const snapshot = await fetchOpenCodeGoUsage(config)
    cache = {
      configFingerprint,
      snapshot,
      expiresAt: now + config.refreshIntervalMinutes * 60_000,
    }
    return snapshot
  } catch (error) {
    if (cache && cache.configFingerprint === configFingerprint) {
      return {
        ...cache.snapshot,
        stale: true,
      }
    }

    throw error
  }
}

async function fetchOpenCodeGoUsage(config: OpenCodeGoConfig): Promise<OpenCodeGoSnapshot> {
  let response: Response
  try {
    response = await fetch(`https://opencode.ai/workspace/${encodeURIComponent(config.workspaceId)}/go`, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Cookie: `auth=${config.authCookie}`,
        "User-Agent": "opencode-model-usage/0.1.0",
      },
    })
  } catch {
    throw new Error("Network error while fetching OpenCode Go usage.")
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("OpenCode Go authentication failed. Refresh your auth cookie.")
    }

    throw new Error(`OpenCode Go request failed with HTTP ${response.status}.`)
  }

  const html = await response.text()
  const snapshot = {
    rolling: extractWindow(html, "rollingUsage"),
    weekly: extractWindow(html, "weeklyUsage"),
    monthly: extractWindow(html, "monthlyUsage"),
    fetchedAt: Date.now(),
  }

  if (!snapshot.rolling && !snapshot.weekly && !snapshot.monthly) {
    throw new Error("Could not parse usage data from the OpenCode Go page. The page format may have changed.")
  }

  return snapshot
}

function extractWindow(html: string, fieldName: string): OpenCodeGoWindow | null {
  const objectLiteral = extractObjectLiteral(html, fieldName)
  if (!objectLiteral) return null

  const parsed = parseLooseObjectLiteral(objectLiteral) as Record<string, unknown>
  const usagePercent = asNumber(parsed.usagePercent)
  const resetInSec = asNumber(parsed.resetInSec)

  if (usagePercent === null || resetInSec === null) return null

  return {
    usagePercent: Math.round(usagePercent),
    resetInSec: Math.max(0, Math.round(resetInSec)),
  }
}

function extractObjectLiteral(html: string, fieldName: string): string | null {
  const patterns = [
    new RegExp(`${escapeRegExp(fieldName)}\\s*:\\s*\\$R\\[\\d+\\]\\s*=\\s*\\{`),
    new RegExp(`\"${escapeRegExp(fieldName)}\"\\s*:\\s*\\{`),
    new RegExp(`${escapeRegExp(fieldName)}\\s*:\\s*\\{`),
    new RegExp(`${escapeRegExp(fieldName)}\\s*=\\s*\\{`),
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (!match || match.index === undefined) continue

    const start = match.index + match[0].lastIndexOf("{")
    const objectLiteral = readObjectLiteral(html, start)
    if (objectLiteral) return objectLiteral
  }

  return null
}

function readObjectLiteral(html: string, start: number): string | null {
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false
  let escaped = false

  for (let index = start; index < html.length; index += 1) {
    const char = html[index]

    if (escaped) {
      escaped = false
      continue
    }

    if ((inSingleQuote || inDoubleQuote || inBacktick) && char === "\\") {
      escaped = true
      continue
    }

    if (!inDoubleQuote && !inBacktick && char === "'") {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (!inSingleQuote && !inBacktick && char === '"') {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === "`") {
      inBacktick = !inBacktick
      continue
    }

    if (inSingleQuote || inDoubleQuote || inBacktick) continue

    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return html.slice(start, index + 1)
      }
    }
  }

  return null
}

function parseLooseObjectLiteral(input: string): unknown {
  const normalized = input
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'((?:\\.|[^'\\])*)'/g, (_, value: string) => {
      const escaped = value.replace(/"/g, '\\"')
      return `"${escaped}"`
    })
    .replace(/("(?:\\.|[^"\\])*")|\bundefined\b/g, (match, quoted) => quoted ?? "null")
    .replace(/,\s*([}\]])/g, "$1")

  try {
    return JSON.parse(normalized)
  } catch {
    throw new Error("Could not parse an OpenCode Go usage payload.")
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createConfigFingerprint(config: OpenCodeGoConfig): string {
  return JSON.stringify({
    workspaceId: config.workspaceId,
    authCookie: crypto.createHash("sha256").update(config.authCookie).digest("hex"),
    refreshIntervalMinutes: config.refreshIntervalMinutes,
  })
}
