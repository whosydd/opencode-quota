import {
  loadGitHubCopilotConfig,
  type GitHubCopilotConfig,
  type GitHubCopilotConfigOverrides,
} from "./config.js"

type GitHubBillingQuotaItem = {
  product?: unknown
  sku?: unknown
  model?: unknown
  unitType?: unknown
  grossQuantity?: unknown
  discountQuantity?: unknown
  netQuantity?: unknown
  netAmount?: unknown
}

type GitHubBillingQuotaResponse = {
  timePeriod?: {
    year?: unknown
    month?: unknown
  }
  user?: unknown
  usageItems?: unknown
}

type GitHubCopilotQuotaSnapshot = {
  entitlement?: unknown
  remaining?: unknown
  unlimited?: unknown
  overage_count?: unknown
  overage_permitted?: unknown
  percent_remaining?: unknown
  reset_date?: unknown
}

type GitHubCopilotUserInfoResponse = {
  quota_reset_date?: unknown
  quota_snapshots?: {
    premium_interactions?: GitHubCopilotQuotaSnapshot
  }
}

export type GitHubCopilotSnapshot = {
  username: string
  quotaMonth: {
    year: number
    month: number
  }
  usedPremiumRequests: number
  monthlyAllowance: number | null
  quotaPercent: number
  overageRequests: number
  resetAt: number
  fetchedAt: number
  source: "quota-snapshot" | "billing"
}

type QuotaTotals = {
  usedPremiumRequests: number
  includedRequests: number
  billableRequests: number
}

const PLAN_ALLOWANCE: Record<GitHubCopilotConfig["plan"], number> = {
  pro: 300,
  "pro+": 1500,
}

export async function getGitHubCopilotQuota(
  overrides?: GitHubCopilotConfigOverrides,
): Promise<GitHubCopilotSnapshot> {
  const config = loadGitHubCopilotConfig(overrides)
  return fetchGitHubCopilotQuota(config)
}

async function fetchGitHubCopilotQuota(config: GitHubCopilotConfig): Promise<GitHubCopilotSnapshot> {
  const quotaSnapshot = await fetchGitHubCopilotQuotaSnapshot(config)
  if (quotaSnapshot) return quotaSnapshot

  return fetchGitHubCopilotBillingQuota(config)
}

async function fetchGitHubCopilotQuotaSnapshot(config: GitHubCopilotConfig): Promise<GitHubCopilotSnapshot | null> {
  let response: Response
  try {
    response = await fetch("https://api.github.com/copilot_internal/user", {
      headers: {
        Accept: "application/json",
        Authorization: `token ${config.token}`,
        "User-Agent": "opencode-model-quota/0.1.0",
        "X-GitHub-Api-Version": "2025-04-01",
      },
    })
  } catch {
    throw new Error("Network error while fetching GitHub Copilot quota snapshot.")
  }

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    if (response.status === 401) {
      throw new Error("GitHub Copilot authentication failed. Refresh your API token.")
    }

    if (response.status === 403) {
      throw new Error("GitHub Copilot quota request was forbidden. Check that your token can access Copilot quota data.")
    }

    if (response.status === 429) {
      throw new Error("GitHub Copilot quota request was rate limited. Try again shortly.")
    }

    throw new Error(`GitHub Copilot quota request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as GitHubCopilotUserInfoResponse
  return toQuotaSnapshot(payload, config)
}

async function fetchGitHubCopilotBillingQuota(config: GitHubCopilotConfig): Promise<GitHubCopilotSnapshot> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(config.username)}/settings/billing/premium_request/usage`)
  url.searchParams.set("year", String(year))
  url.searchParams.set("month", String(month))

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "opencode-model-quota/0.1.0",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    })
  } catch {
    throw new Error("Network error while fetching GitHub Copilot billing quota.")
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("GitHub Copilot authentication failed. Refresh your API token.")
    }

    if (response.status === 403) {
      throw new Error("GitHub Copilot request was forbidden. Check that your token has the user scope and can read billing quota.")
    }

    if (response.status === 404) {
      throw new Error(
        "GitHub Copilot billing quota was not found for this account. This endpoint requires a personal billing account and a token with the user scope; organization-managed Copilot licenses are not included.",
      )
    }

    throw new Error(`GitHub Copilot request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as GitHubBillingQuotaResponse
  return toBillingSnapshot(payload, config)
}

function toQuotaSnapshot(
  payload: GitHubCopilotUserInfoResponse,
  config: Pick<GitHubCopilotConfig, "username">,
): GitHubCopilotSnapshot | null {
  const premiumInteractions = payload.quota_snapshots?.premium_interactions
  if (!premiumInteractions) return null

  const unlimited = premiumInteractions.unlimited === true
  const entitlement = asNumber(premiumInteractions.entitlement)
  const remaining = asNumber(premiumInteractions.remaining)
  const percentRemaining = asNumber(premiumInteractions.percent_remaining)
  const overageRequests = Math.max(0, asNumber(premiumInteractions.overage_count) ?? 0)
  const resetAt = parseResetTimestamp(premiumInteractions.reset_date ?? payload.quota_reset_date)
  const quotaMonth = resetAt ? quotaMonthFromResetAt(resetAt) : currentQuotaMonth()

  const monthlyAllowance = unlimited ? null : entitlement ?? null
  const usedPremiumRequests = unlimited
    ? Math.max(0, overageRequests)
    : resolveUsedPremiumRequests(entitlement, remaining, percentRemaining, overageRequests)

  return {
    username: config.username,
    quotaMonth,
    usedPremiumRequests,
    monthlyAllowance,
    quotaPercent: toQuotaPercent(usedPremiumRequests, monthlyAllowance, percentRemaining),
    overageRequests,
    resetAt: resetAt ?? Date.UTC(quotaMonth.year, quotaMonth.month, 1, 0, 0, 0),
    fetchedAt: Date.now(),
    source: "quota-snapshot",
  }
}

function toBillingSnapshot(
  payload: GitHubBillingQuotaResponse,
  config: Pick<GitHubCopilotConfig, "username" | "plan">,
): GitHubCopilotSnapshot {
  const quotaMonth = parseQuotaMonth(payload.timePeriod)
  const totals = aggregateQuotaTotals(payload.usageItems)
  const monthlyAllowance = resolveMonthlyAllowance(config.plan, totals)

  return {
    username: asTrimmedString(payload.user) ?? config.username,
    quotaMonth,
    usedPremiumRequests: totals.usedPremiumRequests,
    monthlyAllowance,
    quotaPercent: toQuotaPercent(totals.usedPremiumRequests, monthlyAllowance),
    overageRequests: totals.billableRequests,
    resetAt: Date.UTC(quotaMonth.year, quotaMonth.month, 1, 0, 0, 0),
    fetchedAt: Date.now(),
    source: "billing",
  }
}

function parseQuotaMonth(timePeriod: GitHubBillingQuotaResponse["timePeriod"]): GitHubCopilotSnapshot["quotaMonth"] {
  const now = new Date()
  const year = asPositiveInteger(timePeriod?.year) ?? now.getUTCFullYear()
  const month = asMonth(timePeriod?.month) ?? now.getUTCMonth() + 1

  return { year, month }
}

function aggregateQuotaTotals(input: unknown): QuotaTotals {
  if (!Array.isArray(input)) {
    return {
      usedPremiumRequests: 0,
      includedRequests: 0,
      billableRequests: 0,
    }
  }

  const totals: QuotaTotals = {
    usedPremiumRequests: 0,
    includedRequests: 0,
    billableRequests: 0,
  }

  for (const rawItem of input) {
    if (!rawItem || typeof rawItem !== "object") continue

    const item = rawItem as GitHubBillingQuotaItem

    totals.usedPremiumRequests += asNumber(item.grossQuantity) ?? 0
    totals.includedRequests += asNumber(item.discountQuantity) ?? 0
    totals.billableRequests += asNumber(item.netQuantity) ?? 0
  }

  return totals
}

function currentQuotaMonth(): GitHubCopilotSnapshot["quotaMonth"] {
  const now = new Date()
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  }
}

function quotaMonthFromResetAt(resetAt: number): GitHubCopilotSnapshot["quotaMonth"] {
  return parseQuotaMonth({
    year: new Date(resetAt - 1000).getUTCFullYear(),
    month: new Date(resetAt - 1000).getUTCMonth() + 1,
  })
}

function parseResetTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null

  return timestamp
}

function resolveUsedPremiumRequests(
  entitlement: number | null,
  remaining: number | null,
  percentRemaining: number | null,
  overageRequests: number,
): number {
  if (entitlement !== null && remaining !== null) {
    return Math.max(0, entitlement - remaining + overageRequests)
  }

  if (entitlement !== null && percentRemaining !== null) {
    return Math.max(0, entitlement * (1 - percentRemaining / 100) + overageRequests)
  }

  return Math.max(0, overageRequests)
}

function resolveMonthlyAllowance(plan: GitHubCopilotConfig["plan"], totals: QuotaTotals): number {
  if (totals.billableRequests > 0 && totals.includedRequests > 0) {
    return Math.round(totals.includedRequests)
  }

  return PLAN_ALLOWANCE[plan]
}

function toQuotaPercent(
  usedPremiumRequests: number,
  monthlyAllowance: number | null,
  percentRemaining?: number | null,
): number {
  if (percentRemaining !== undefined && percentRemaining !== null) {
    return Number((100 - percentRemaining).toFixed(1))
  }

  if (monthlyAllowance === null || monthlyAllowance <= 0) return 0
  return Number(((usedPremiumRequests / monthlyAllowance) * 100).toFixed(1))
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function asPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value
  return null
}

function asMonth(value: unknown): number | null {
  const month = asPositiveInteger(value)
  if (month && month >= 1 && month <= 12) return month
  return null
}
