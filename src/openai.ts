import { readAuthFileCached, resolveOpenAIAuth, isAuthExpired } from "./opencode-auth.js"

type RateLimitWindow = {
  used_percent: number
  limit_window_seconds: number
  reset_after_seconds: number
  reset_at?: number
}

type OpenAIUsageResponse = {
  plan_type: string
  rate_limit: {
    limit_reached: boolean
    primary_window: RateLimitWindow
    secondary_window: RateLimitWindow | null
  } | null
  code_review_rate_limit?: {
    primary_window: RateLimitWindow | null
  } | null
  credits?: {
    has_credits: boolean
    unlimited: boolean
    balance: string | null
  } | null
}

type OpenAIWindow = {
  label: string
  percentRemaining: number
  resetTimeIso?: string
}

export type OpenAISnapshot = {
  label: string
  email?: string
  windows: {
    primary?: OpenAIWindow
    secondary?: OpenAIWindow
    codeReview?: OpenAIWindow
  }
  fetchedAt: number
}

const OPENAI_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"

function deriveLabel(planType: string | undefined): string {
  const raw = (planType ?? "").toLowerCase()
  if (raw.includes("pro")) return "OpenAI (Pro)"
  if (raw.includes("plus")) return "OpenAI (Plus)"
  if (planType) return `OpenAI (${planType})`
  return "OpenAI"
}

function remainingPercent(window: RateLimitWindow): number {
  return Math.max(0, Math.min(100, Math.round(100 - window.used_percent)))
}

function labelForWindow(window: RateLimitWindow, fallback: string): string {
  const seconds = window.limit_window_seconds
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback

  if (seconds % 86400 === 0) {
    const days = Math.round(seconds / 86400)
    return days === 1 ? "Daily" : `${days}d`
  }

  if (seconds % 3600 === 0) {
    const hours = Math.round(seconds / 3600)
    return hours === 1 ? "Hourly" : `${hours}h`
  }

  if (seconds % 60 === 0) {
    const minutes = Math.round(seconds / 60)
    return minutes === 1 ? "1m" : `${minutes}m`
  }

  return `${Math.round(seconds)}s`
}

function resetIsoFromSeconds(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined
  return new Date(Date.now() + Math.round(seconds * 1000)).toISOString()
}

function resetIsoFromTimestamp(timestamp?: number): string | undefined {
  if (!Number.isFinite(timestamp) || !timestamp) return undefined
  const ms = Math.round(timestamp * 1000)
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return new Date(ms).toISOString()
}

export async function getOpenAIQuota(): Promise<OpenAISnapshot | null> {
  const auth = await readAuthFileCached()
  const resolved = resolveOpenAIAuth(auth)

  if (!resolved) return null

  if (isAuthExpired(resolved.expiresAt)) {
    throw new Error("OpenAI authentication expired. Log in to OpenAI again through OpenCode.")
  }

  if (resolved.accessToken.length < 20) {
    throw new Error("OpenAI access token looks invalid.")
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolved.accessToken}`,
    "User-Agent": "opencode-quota/0.3.2",
  }

  if (resolved.accountId) {
    headers["ChatGPT-Account-Id"] = resolved.accountId
  }

  let response: Response
  try {
    response = await fetch(OPENAI_USAGE_URL, { headers })
  } catch {
    throw new Error("Network error while fetching OpenAI quota.")
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("OpenAI authentication failed. Your session may have expired.")
    }
    if (response.status === 403) {
      throw new Error("OpenAI quota request was forbidden.")
    }
    if (response.status === 429) {
      throw new Error("OpenAI quota request was rate limited. Try again shortly.")
    }
    throw new Error(`OpenAI quota request failed with HTTP ${response.status}.`)
  }

  const data = (await response.json()) as OpenAIUsageResponse
  const primaryWindow = data.rate_limit?.primary_window

  if (!primaryWindow) {
    throw new Error("No quota data received from OpenAI.")
  }

  const primary: OpenAIWindow = {
    label: labelForWindow(primaryWindow, "Primary"),
    percentRemaining: remainingPercent(primaryWindow),
    resetTimeIso: resetIsoFromTimestamp(primaryWindow.reset_at) ?? resetIsoFromSeconds(primaryWindow.reset_after_seconds),
  }

  const secondary: OpenAIWindow | undefined = data.rate_limit?.secondary_window
    ? {
        label: labelForWindow(data.rate_limit.secondary_window, "Secondary"),
        percentRemaining: remainingPercent(data.rate_limit.secondary_window),
        resetTimeIso:
          resetIsoFromTimestamp(data.rate_limit.secondary_window.reset_at) ??
          resetIsoFromSeconds(data.rate_limit.secondary_window.reset_after_seconds),
      }
    : undefined

  const codeReview: OpenAIWindow | undefined = data.code_review_rate_limit?.primary_window
    ? {
        label: "Code Review",
        percentRemaining: remainingPercent(data.code_review_rate_limit.primary_window),
        resetTimeIso:
          resetIsoFromTimestamp(data.code_review_rate_limit.primary_window.reset_at) ??
          resetIsoFromSeconds(data.code_review_rate_limit.primary_window.reset_after_seconds),
      }
    : undefined

  return {
    label: deriveLabel(data.plan_type),
    email: resolved.email,
    windows: { primary, secondary, codeReview },
    fetchedAt: Date.now(),
  }
}
