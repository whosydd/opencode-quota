import type { OpenCodeGoSnapshot } from "./opencode-go.js"

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

export function formatUsageMessage(snapshot: OpenCodeGoSnapshot): string {
  const view = buildUsageDialogView(snapshot)
  const windows = view.windows.map(formatWindowBlock).join("\n\n")
  const parts = [`[${view.providerLabel}] [${view.categoryLabel}] ${view.statusLabel} · ${view.updatedAt}`, "", windows]

  if (view.note) {
    parts.push("", view.note)
  }

  return parts.join("\n")
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
