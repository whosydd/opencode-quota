import type { GitHubCopilotSnapshot } from "./github-copilot.js"
import type { OpenCodeGoSnapshot } from "./opencode-go.js"

export const BAR_SEGMENTS = 24

const RIGHT_ALIGN_SEPARATOR = "\t"

export type QuotaSeverity = "success" | "warning" | "error"

export type QuotaWindowView = {
  key: "rolling" | "weekly" | "monthly"
  label: string
  quotaPercent: number
  resetText: string
  severity: QuotaSeverity
  filledSegments: number
}

export type QuotaDialogView = {
  providerLabel: string
  categoryLabel: string
  windows: QuotaWindowView[]
}

export function buildQuotaDialogView(snapshot: OpenCodeGoSnapshot): QuotaDialogView {
  const windows: QuotaWindowView[] = []

  if (snapshot.rolling) {
    windows.push(toWindowView("rolling", "Rolling", snapshot.rolling.quotaPercent, snapshot.rolling.resetInSec))
  }

  if (snapshot.weekly) {
    windows.push(toWindowView("weekly", "Weekly", snapshot.weekly.quotaPercent, snapshot.weekly.resetInSec))
  }

  if (snapshot.monthly) {
    windows.push(toWindowView("monthly", "Monthly", snapshot.monthly.quotaPercent, snapshot.monthly.resetInSec))
  }

  return {
    providerLabel: "OpenCode Go",
    categoryLabel: "subscription",
    windows,
  }
}

export function formatOpenCodeGoMessage(snapshot: OpenCodeGoSnapshot): string {
  const view = buildQuotaDialogView(snapshot)
  const parts = [formatMessageHeader(view.providerLabel, view.categoryLabel), ""]

  if (view.windows.length > 0) {
    parts.push(...view.windows.map(formatWindowRow))
  } else {
    parts.push(formatMetricLine("Quota", "No quota windows available"))
  }

  return parts.join("\n")
}

export function formatGitHubCopilotMessage(snapshot: GitHubCopilotSnapshot): string {
  const parts = [
    formatMessageHeader("GitHub Copilot", "premium requests"),
    "",
    formatMetricLine("Quota", formatCopilotQuota(snapshot)),
    formatMetricLine("Overage", formatCount(snapshot.overageRequests)),
  ]

  if (snapshot.monthlyAllowance !== null) {
    parts.splice(2, 0, formatWindowRow({
      key: "monthly",
      label: "Monthly",
      quotaPercent: Math.max(0, Math.min(100, Math.round(snapshot.quotaPercent))),
      resetText: formatDurationUntil(snapshot.resetAt),
      severity: getSeverity(snapshot.quotaPercent),
      filledSegments: Math.round((Math.max(0, Math.min(100, snapshot.quotaPercent)) / 100) * BAR_SEGMENTS),
    }))
  }

  if (snapshot.source === "billing") {
    parts.push(formatMetricLine("Source", "billing fallback"))
  }

  return parts.join("\n")
}

export function formatQuotaMessage(messages: string[], fetchedAt?: number): string {
  const cards = messages.map((message) => message.split("\n"))
  const width = cards.reduce(
    (maxWidth, lines) => Math.max(maxWidth, lines.reduce((lineMax, line) => Math.max(lineMax, getLineWidth(line)), 0)),
    0,
  )

  const formattedCards = cards.map((lines) => formatCard(lines, width)).join("\n\n")
  
  if (fetchedAt != null) {
    const updatedAt = `Updated: ${formatTimestamp(fetchedAt)}`
    const spacing = " ".repeat(Math.max(0, width + 4 - updatedAt.length))
    return `${formattedCards}\n\n${spacing}${updatedAt}`
  }

  return formattedCards
}

export function formatQuotaLoadingMessage(frame: string): string {
  return `${frame} Fetching...\n\nThis can take a few seconds.`
}

function formatMessageHeader(providerLabel: string, categoryLabel: string): string {
  return `[${providerLabel}] [${categoryLabel}]`
}

function formatCard(lines: string[], width: number): string {
  const border = `+${"-".repeat(width + 2)}+`

  return [border, ...lines.map((line) => `| ${formatCardLine(line, width)} |`), border].join("\n")
}

function getLineWidth(line: string): number {
  const [left, right] = splitRightAlignedLine(line)
  if (!right) return line.length

  return left.length + right.length + 1
}

function formatCardLine(line: string, width: number): string {
  const [left, right] = splitRightAlignedLine(line)
  if (!right) return line.padEnd(width, " ")

  const spacing = " ".repeat(Math.max(1, width - left.length - right.length))
  return `${left}${spacing}${right}`
}

function splitRightAlignedLine(line: string): [string, string | undefined] {
  const separatorIndex = line.indexOf(RIGHT_ALIGN_SEPARATOR)
  if (separatorIndex === -1) return [line, undefined]

  return [line.slice(0, separatorIndex), line.slice(separatorIndex + RIGHT_ALIGN_SEPARATOR.length)]
}

function formatWindowRow(window: QuotaWindowView): string {
  const label = `${window.label}:`.padEnd(8, " ")
  const percent = `${window.quotaPercent}%`.padStart(4, " ")

  return `${label} ${formatBar(window.quotaPercent)} ${percent} ${window.resetText}`
}

function toWindowView(
  key: QuotaWindowView["key"],
  label: string,
  quotaPercent: number,
  resetInSec: number,
): QuotaWindowView {
  const clamped = Math.max(0, Math.min(100, quotaPercent))

  return {
    key,
    label,
    quotaPercent: clamped,
    resetText: formatDuration(resetInSec),
    severity: getSeverity(clamped),
    filledSegments: Math.round((clamped / 100) * BAR_SEGMENTS),
  }
}

function getSeverity(quotaPercent: number): QuotaSeverity {
  if (quotaPercent >= 80) return "error"
  if (quotaPercent >= 50) return "warning"
  return "success"
}

function formatBar(quotaPercent: number): string {
  const clamped = Math.max(0, Math.min(100, quotaPercent))
  const filledSegments = Math.round((clamped / 100) * BAR_SEGMENTS)
  const filled = "#".repeat(filledSegments)
  const empty = "-".repeat(BAR_SEGMENTS - filledSegments)

  return `[${filled}${empty}]`
}

function formatMetricLine(label: string, value: string): string {
  return `${label}: ${value}`
}

function formatCopilotQuota(snapshot: GitHubCopilotSnapshot): string {
  if (snapshot.monthlyAllowance === null) {
    return `${formatCount(snapshot.usedPremiumRequests)} used (unlimited)`
  }

  return `${formatCount(snapshot.usedPremiumRequests)} / ${formatCount(snapshot.monthlyAllowance)} (${formatPercent(
    snapshot.quotaPercent,
  )})`
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

function formatDurationUntil(timestamp: number): string {
  return formatDuration(Math.max(0, Math.floor((timestamp - Date.now()) / 1000)))
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
}
