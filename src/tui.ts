import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import {
  loadOptionalGitHubCopilotConfig,
  loadOptionalOpenCodeGoConfig,
  type PluginConfigOverrides,
} from "./config.js"
import { getGitHubCopilotUsage } from "./github-copilot.js"
import { formatGitHubCopilotMessage, formatOpenCodeGoMessage, formatUsageMessage } from "./format.js"
import { getOpenCodeGoUsage } from "./opencode-go.js"

const COMMAND_VALUE = "model-usage.show"
const REFRESH_COMMAND_VALUE = "model-usage.refresh"

const tui: TuiPlugin = async (api, options) => {
  const configOverrides = options as PluginConfigOverrides | undefined

  api.command.register(() => [
    {
      title: "Model Usage",
      value: COMMAND_VALUE,
      description: "Show configured model usage",
      category: "Usage",
      suggested: true,
      slash: {
        name: "model-usage",
        aliases: ["go-usage", "copilot-usage"],
      },
      onSelect: () => showUsageDialog(api, configOverrides, false),
    },
    {
      title: "Model Usage Refresh",
      value: REFRESH_COMMAND_VALUE,
      description: "Force refresh configured model usage",
      category: "Usage",
      slash: {
        name: "model-usage-refresh",
        aliases: ["go-usage-refresh", "copilot-usage-refresh"],
      },
      onSelect: () => showUsageDialog(api, configOverrides, true),
    },
  ])
}

async function showUsageDialog(
  api: Parameters<TuiPlugin>[0],
  configOverrides: PluginConfigOverrides | undefined,
  forceRefresh: boolean,
): Promise<void> {
  try {
    const message = await buildUsageMessage(forceRefresh, configOverrides)

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Usage",
        message,
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } catch (error) {
    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Usage Error",
        message: error instanceof Error ? error.message : "Failed to fetch usage.",
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  }
}

async function buildUsageMessage(
  forceRefresh: boolean,
  configOverrides: PluginConfigOverrides | undefined,
): Promise<string> {
  const tasks: Array<Promise<string>> = []
  const errors: string[] = []

  try {
    if (loadOptionalOpenCodeGoConfig(configOverrides)) {
      tasks.push(getOpenCodeGoUsage(forceRefresh, configOverrides).then(formatOpenCodeGoMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  try {
    if (loadOptionalGitHubCopilotConfig(configOverrides)) {
      tasks.push(getGitHubCopilotUsage(forceRefresh, configOverrides).then(formatGitHubCopilotMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  if (tasks.length === 0) {
    if (errors.length > 0) {
      throw new Error(errors.join("\n\n"))
    }

    throw new Error(
      "No usage providers are configured. Set OpenCode Go and/or GitHub Copilot credentials in tui.json, environment variables, or opencode-model-usage.json.",
    )
  }

  const results = await Promise.allSettled(tasks)
  const messages: string[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      messages.push(result.value)
      continue
    }

    errors.push(errorMessage(result.reason))
  }

  if (messages.length === 0) {
    throw new Error(errors.join("\n\n"))
  }

  if (errors.length > 0) {
    messages.push(`Provider errors:\n- ${errors.join("\n- ")}`)
  }

  return formatUsageMessage(messages)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to fetch usage."
}

const plugin: TuiPluginModule & { id: string } = {
  id: "gy.model-status",
  tui,
}

export default plugin
