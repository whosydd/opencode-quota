import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { OpenCodeGoConfigOverrides } from "./config.js"
import { formatUsageMessage } from "./format.js"
import { getOpenCodeGoUsage } from "./opencode-go.js"

const COMMAND_VALUE = "model-usage.show"
const REFRESH_COMMAND_VALUE = "model-usage.refresh"

const tui: TuiPlugin = async (api, options) => {
  const configOverrides = options as OpenCodeGoConfigOverrides | undefined

  api.command.register(() => [
    {
      title: "Model Usage",
      value: COMMAND_VALUE,
      description: "Show OpenCode Go subscription usage",
      category: "Usage",
      suggested: true,
      slash: {
        name: "model-usage",
        aliases: ["go-usage"],
      },
      onSelect: () => showUsageDialog(api, configOverrides, false),
    },
    {
      title: "Model Usage Refresh",
      value: REFRESH_COMMAND_VALUE,
      description: "Force refresh OpenCode Go subscription usage",
      category: "Usage",
      slash: {
        name: "model-usage-refresh",
        aliases: ["go-usage-refresh"],
      },
      onSelect: () => showUsageDialog(api, configOverrides, true),
    },
  ])
}

async function showUsageDialog(
  api: Parameters<TuiPlugin>[0],
  configOverrides: OpenCodeGoConfigOverrides | undefined,
  forceRefresh: boolean,
): Promise<void> {
  try {
    const snapshot = await getOpenCodeGoUsage(forceRefresh, configOverrides)

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Usage",
        message: formatUsageMessage(snapshot),
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

const plugin: TuiPluginModule & { id: string } = {
  id: "gy.model-status",
  tui,
}

export default plugin