import type { OpenCodeGoSnapshot } from "./opencode-go.js"
import type { GitHubCopilotSnapshot } from "./github-copilot.js"

export const BAR_SEGMENTS = 24

export type UsageSeverity = "success" | "warning" | "error"

export type UsageWindowView = {
  key: "rolling" | "weekly" | "monthly"
  label: string
  usagePercent: number
  resetText: string
  severity: UsageSeverity
  filledSegments: number
}

export type UsageDialogView = {
  providerLabel: string
  categoryLabel: string
  statusLabel: string
  updatedAt: string
  note?: string
  windows: UsageWindowView[]
}

export function buildUsageDialogView(snapshot: OpenCodeGoSnapshot): UsageDialogView {
  const windows: UsageWindowView[] = []

  if (snapshot.rolling) {
    windows.push(toWindowView("rolling", "Rolling", snapshot.rolling.usagePercent, snapshot.rolling.resetInSec))
  }

  if (snapshot.weekly) {
    windows.push(toWindowView("weekly", "Weekly", snapshot.weekly.usagePercent, snapshot.weekly.resetInSec))
  }

  if (snapshot.monthly) {
    windows.push(toWindowView("monthly", "Monthly", snapshot.monthly.usagePercent, snapshot.monthly.resetInSec))
  }

  return {
    providerLabel: "OpenCode Go",
    categoryLabel: "subscription",
    statusLabel: snapshot.stale ? "cached (stale)" : snapshot.cached ? "cached" : "live",
    updatedAt: formatTimestamp(snapshot.fetchedAt),
    note: snapshot.stale ? "live refresh failed" : undefined,
    windows,
  }
}

export function formatOpenCodeGoMessage(snapshot: OpenCodeGoSnapshot): string {
  const view = buildUsageDialogView(snapshot)
  const windows = view.windows.map(formatWindowBlock).join("\n")
  const parts = [formatMessageHeader(view.providerLabel, view.categoryLabel, view.statusLabel, view.updatedAt), "", windows]

  if (view.note) {
    parts.push("", view.note)
  }

  return parts.join("\n")
}

export function formatGitHubCopilotMessage(snapshot: GitHubCopilotSnapshot): string {
  const statusLabel = snapshot.stale ? "cached (stale)" : snapshot.cached ? "cached" : "live"
  const usageLine =
    snapshot.monthlyAllowance === null
      ? `Usage: ${formatCount(snapshot.usedPremiumRequests)} (unlimited)`
      : `Usage: ${formatCount(snapshot.usedPremiumRequests)} / ${formatCount(snapshot.monthlyAllowance)} (${formatPercent(snapshot.usagePercent)})`
  const parts = [
    formatMessageHeader("GitHub Copilot", "premium requests", statusLabel, formatTimestamp(snapshot.fetchedAt)),
    "",
    `Month: ${formatUsageMonth(snapshot.usageMonth.year, snapshot.usageMonth.month)}`,
    usageLine,
    `Overage: ${formatCount(snapshot.overageRequests)}`,
    `Reset in: ${formatDurationUntil(snapshot.resetAt)}`,
  ]

  if (snapshot.source === "billing") {
    parts.push("", "Source: billing fallback")
  }

  if (snapshot.stale) {
    parts.push("", "live refresh failed")
  }

  return parts.join("\n")
}

export function formatUsageMessage(messages: string[]): string {
  return messages.map(formatCard).join("\n\n")
}

function formatMessageHeader(providerLabel: string, categoryLabel: string, statusLabel: string, updatedAt: string): string {
  return [`[${providerLabel}] [${categoryLabel}] ${statusLabel}`, `Updated: ${updatedAt}`].join("\n")
}

function formatCard(message: string): string {
  const lines = message.split("\n")
  const width = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const border = `+${"-".repeat(width + 2)}+`

  return [border, ...lines.map((line) => `| ${line.padEnd(width, " ")} |`), border].join("\n")
}

function formatWindowBlock(window: UsageWindowView): string {
  const label = `${window.label}:`.padEnd(9, " ")
  const filled = "#".repeat(window.filledSegments)
  const empty = "-".repeat(BAR_SEGMENTS - window.filledSegments)
  const percent = `${window.usagePercent}%`.padStart(5, " ")

  return `${label}[${filled}${empty}] ${percent}  ${window.resetText}`
}

function toWindowView(
  key: UsageWindowView["key"],
  label: string,
  usagePercent: number,
  resetInSec: number,
): UsageWindowView {
  const clamped = Math.max(0, Math.min(100, usagePercent))

  return {
    key,
    label,
    usagePercent: clamped,
    resetText: formatDuration(resetInSec),
    severity: getSeverity(clamped),
    filledSegments: Math.round((clamped / 100) * BAR_SEGMENTS),
  }
}

function getSeverity(usagePercent: number): UsageSeverity {
  if (usagePercent >= 80) return "error"
  if (usagePercent >= 50) return "warning"
  return "success"
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  })
}

export function formatCount(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.max(0, Math.floor(totalSeconds))}s`

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    return `${minutes}m`
  }

  if (totalSeconds < 86400) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

function formatUsageMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

function formatDurationUntil(timestamp: number): string {
  return formatDuration(Math.max(0, Math.floor((timestamp - Date.now()) / 1000)))
}

function formatOverageCost(amountUsd: number): string {
  if (amountUsd <= 0) return ""
  return ` · $${amountUsd.toFixed(2)}`
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
}
