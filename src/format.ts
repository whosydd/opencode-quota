import type { GitHubCopilotSnapshot } from "./github-copilot.js"
import type { OpenAISnapshot } from "./openai.js"
import type { OpenCodeGoSnapshot } from "./opencode-go.js"

const SEPARATOR = "  "
const BAR_WIDTH = 24

export type QuotaEntry = {
  name: string
  group: string
  label?: string
  percentRemaining: number
  resetTimeIso?: string
  right?: string
}

function bar(percentRemaining: number, width: number): string {
  const p = Math.max(0, Math.min(100, Math.round(percentRemaining)))
  const filled = Math.round((p / 100) * width)
  const empty = width - filled
  return "\u2588".repeat(filled) + "\u2591".repeat(empty)
}

function padRight(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width)
  return str + " ".repeat(width - str.length)
}

function padLeft(str: string, width: number): string {
  if (str.length >= width) return str.slice(str.length - width)
  return " ".repeat(width - str.length) + str
}

function formatResetCountdown(iso?: string): string {
  if (!iso) return ""
  const resetDate = new Date(iso)
  const diffMs = resetDate.getTime() - Date.now()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "reset"

  if (diffMs < 60000) {
    return formatDuration(diffMs / 1000)
  }

  const diffMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(diffMinutes / 1440)
  const hours = Math.floor((diffMinutes % 1440) / 60)
  const minutes = diffMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h ${minutes}m`
}

function formatDuration(totalSeconds: number): string {
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

function formatGroupHeader(group: string): string {
  const trimmed = group.trim()
  if (!trimmed) return "[]"
  if (trimmed.startsWith("[")) return trimmed

  const match = trimmed.match(/^([^()]+?)\s*(\(.+\))\s*$/)
  if (match) {
    return `[${match[1]!.trim()}] ${match[2]!.trim()}`
  }

  return `[${trimmed}]`
}

function formatPercentLabel(percentRemaining: number): string {
  return `${Math.round(percentRemaining)}% left`
}

const PERCENT_COL = "100% used".length
const TIME_COL = 7

function formatQuotaEntries(entries: QuotaEntry[]): string {
  const groupOrder: string[] = []
  const groups = new Map<string, QuotaEntry[]>()

  for (const entry of entries) {
    const list = groups.get(entry.group)
    if (list) {
      list.push(entry)
    } else {
      groupOrder.push(entry.group)
      groups.set(entry.group, [entry])
    }
  }

  const lines: string[] = []

  for (let gi = 0; gi < groupOrder.length; gi++) {
    const g = groupOrder[gi]!
    const list = groups.get(g) ?? []
    if (gi > 0) lines.push("")

    lines.push(`\u2192 ${formatGroupHeader(g)}`)

    for (const entry of list) {
      const label = entry.label?.trim() || entry.name
      const right = entry.right?.trim() || ""
      const timeStr = entry.percentRemaining < 100 ? formatResetCountdown(entry.resetTimeIso) : ""
      const displayedPercent = Math.max(0, Math.min(100, Math.round(entry.percentRemaining)))
      const percentLabel = formatPercentLabel(entry.percentRemaining)

      const timeWidth = Math.max(timeStr.length, TIME_COL)
      const nameWidth = Math.max(1, BAR_WIDTH - SEPARATOR.length - timeWidth)
      const leftText = right ? `${label} ${right}` : label

      lines.push(
        (padRight(leftText, nameWidth) + SEPARATOR + padLeft(timeStr, timeWidth)).slice(0, BAR_WIDTH),
      )

      lines.push([bar(displayedPercent, BAR_WIDTH), padLeft(percentLabel, PERCENT_COL)].join(SEPARATOR))
    }
  }

  return lines.join("\n")
}

export function formatOpenCodeGoMessage(snapshot: OpenCodeGoSnapshot): string {
  const entries: QuotaEntry[] = []
  const group = "OpenCode Go"

  if (snapshot.rolling) {
    const percentRemaining = Math.max(0, Math.min(100, 100 - snapshot.rolling.quotaPercent))
    entries.push({
      name: "Rolling",
      group,
      label: "Rolling:",
      percentRemaining,
      resetTimeIso: new Date(Date.now() + snapshot.rolling.resetInSec * 1000).toISOString(),
    })
  }

  if (snapshot.weekly) {
    const percentRemaining = Math.max(0, Math.min(100, 100 - snapshot.weekly.quotaPercent))
    entries.push({
      name: "Weekly",
      group,
      label: "Weekly:",
      percentRemaining,
      resetTimeIso: new Date(Date.now() + snapshot.weekly.resetInSec * 1000).toISOString(),
    })
  }

  if (snapshot.monthly) {
    const percentRemaining = Math.max(0, Math.min(100, 100 - snapshot.monthly.quotaPercent))
    entries.push({
      name: "Monthly",
      group,
      label: "Monthly:",
      percentRemaining,
      resetTimeIso: new Date(Date.now() + snapshot.monthly.resetInSec * 1000).toISOString(),
    })
  }

  if (entries.length === 0) {
    entries.push({
      name: "OpenCode Go",
      group,
      percentRemaining: 0,
    })
  }

  return formatQuotaEntries(entries)
}

export function formatGitHubCopilotMessage(snapshot: GitHubCopilotSnapshot): string {
  const group = "Copilot"
  const percentRemaining = Math.max(0, Math.min(100, Math.round(100 - snapshot.quotaPercent)))
  const resetTimeIso = snapshot.resetAt ? new Date(snapshot.resetAt).toISOString() : undefined

  const right = snapshot.monthlyAllowance !== null
    ? `${snapshot.usedPremiumRequests}/${snapshot.monthlyAllowance}`
    : `${snapshot.usedPremiumRequests} used`

  const entries: QuotaEntry[] = [
    {
      name: "Copilot",
      group,
      label: "Quota:",
      percentRemaining,
      resetTimeIso,
      right,
    },
  ]

  if (snapshot.overageRequests > 0) {
    entries.push({
      name: "Overage",
      group,
      label: "Overage:",
      percentRemaining: 0,
      right: `${snapshot.overageRequests}`,
    })
  }

  return formatQuotaEntries(entries)
}

export function formatOpenAIMessage(snapshot: OpenAISnapshot): string {
  const entries: QuotaEntry[] = []
  const group = snapshot.label

  if (snapshot.windows.primary) {
    entries.push({
      name: snapshot.windows.primary.label,
      group,
      label: `${snapshot.windows.primary.label}:`,
      percentRemaining: snapshot.windows.primary.percentRemaining,
      resetTimeIso: snapshot.windows.primary.resetTimeIso,
    })
  }

  if (snapshot.windows.secondary) {
    entries.push({
      name: snapshot.windows.secondary.label,
      group,
      label: `${snapshot.windows.secondary.label}:`,
      percentRemaining: snapshot.windows.secondary.percentRemaining,
      resetTimeIso: snapshot.windows.secondary.resetTimeIso,
    })
  }

  if (snapshot.windows.codeReview) {
    entries.push({
      name: snapshot.windows.codeReview.label,
      group,
      label: `${snapshot.windows.codeReview.label}:`,
      percentRemaining: snapshot.windows.codeReview.percentRemaining,
      resetTimeIso: snapshot.windows.codeReview.resetTimeIso,
    })
  }

  if (entries.length === 0) {
    entries.push({
      name: snapshot.label,
      group,
      percentRemaining: 0,
    })
  }

  return formatQuotaEntries(entries)
}

export function formatQuotaMessage(messages: string[], fetchedAt?: number): string {
  const result = messages.join("\n\n")

  if (fetchedAt != null) {
    const updatedAt = `Updated: ${formatTimestamp(fetchedAt)}`
    return `${result}\n\n${updatedAt}`
  }

  return result
}

export function formatQuotaLoadingMessage(frame: string): string {
  return `${frame} Fetching...\n\nThis can take a few seconds.`
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
